import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import type { SchoolClass, Student } from "@/lib/data";
import { checkParent, emptyParent, hasContent, linkParent, type ParentForm, type ParentRow } from "@/lib/families";
import { parseOrThrow, optionalString, studentSchema } from "@/lib/validation";
import { ParentBlock } from "@/components/parent-block";
import { PhotoPicker } from "@/components/photo-field";
import { uploadStudentPhoto } from "@/lib/photos";
import { Panel } from "@/components/kit";

const inputClass =
  "mt-1.5 h-9 w-full rounded-md border border-border bg-card px-3 text-[13px] outline-none focus:border-primary/50";
const areaClass =
  "mt-1.5 min-h-[72px] w-full rounded-md border border-border bg-card px-3 py-2 text-[13px] outline-none focus:border-primary/50";

function Field({
  name,
  label,
  type = "text",
  required,
  defaultValue,
  placeholder,
}: {
  name: string;
  label: string;
  type?: string;
  required?: boolean;
  defaultValue?: string;
  placeholder?: string;
}) {
  return (
    <div>
      <label htmlFor={name} className="label-caps">
        {label}
        {required ? <span className="text-late"> *</span> : null}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        required={required}
        defaultValue={defaultValue}
        placeholder={placeholder}
        className={inputClass}
      />
    </div>
  );
}

const section = "text-[12px] font-semibold uppercase tracking-[0.12em] text-primary";

/**
 * Inscription d'un élève, sur le modèle de la fiche d'inscription de l'école :
 * renseignements sur l'enfant, fratrie, parents ou représentants légaux (noms obligatoires),
 * renseignements sanitaires. Les frais de la classe sont attribués automatiquement.
 */
export function EnrollmentForm({
  students,
  classes,
  parents,
  nextMatricule,
  today,
  onClose,
}: {
  students: Student[];
  classes: SchoolClass[];
  parents: ParentRow[];
  nextMatricule: string;
  today: string;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [p1, setP1] = useState<ParentForm>(emptyParent());
  const [p2, setP2] = useState<ParentForm>(emptyParent());
  const [photo, setPhoto] = useState<File | null>(null);

  const create = useMutation({
    mutationFn: async (form: FormData) => {
      const genderRaw = String(form.get("gender") ?? "");
      if (genderRaw !== "M" && genderRaw !== "F") throw new Error("Choisissez le sexe de l'élève.");
      const studentType = String(form.get("student_type") ?? "");
      if (studentType !== "nouveau" && studentType !== "ancien") {
        throw new Error("Indiquez si l'élève est nouveau ou ancien.");
      }
      // Les noms des parents sont obligatoires : on vérifie avant de créer l'élève
      checkParent(p1, "1er parent ou représentant légal", true);
      checkParent(p2, "2e parent ou représentant légal", false);

      const values = parseOrThrow(studentSchema, {
        matricule: String(form.get("matricule") ?? ""),
        first_name: String(form.get("first_name") ?? ""),
        last_name: String(form.get("last_name") ?? ""),
        gender: genderRaw,
        birth_date: optionalString(form.get("birth_date")),
        birth_place: optionalString(form.get("birth_place")),
        phone: optionalString(form.get("phone")),
        address: optionalString(form.get("address")),
        class_id: String(form.get("class_id") ?? ""),
      });
      const selectedClass = classes.find((c) => c.id === values.class_id);
      if (!selectedClass) throw new Error("Sélectionnez une classe.");
      if (students.some((s) => s.matricule.trim().toLowerCase() === values.matricule.toLowerCase())) {
        throw new Error(`Le matricule "${values.matricule}" est déjà utilisé.`);
      }

      const extra = (key: string): string | null => optionalString(form.get(key)) ?? null;
      const { data: created, error } = await supabase
        .from("students")
        .insert({
          matricule: values.matricule,
          first_name: values.first_name,
          last_name: values.last_name.toUpperCase(),
          gender: values.gender,
          birth_date: values.birth_date ?? null,
          birth_place: values.birth_place ?? null,
          phone: values.phone ?? null,
          address: values.address ?? null,
          class_id: selectedClass.id,
          academic_year_id: selectedClass.academic_year_id,
          enrollment_date: today,
          status: "actif",
          student_type: studentType,
          nationality: extra("nationality"),
          previous_school: extra("previous_school"),
          previous_class: extra("previous_class"),
          siblings: extra("siblings"),
          health_notes: extra("health_notes"),
          emergency_contact: extra("emergency_contact"),
          emergency_phone: extra("emergency_phone"),
        } as never)
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      const newId = (created as unknown as { id: string } | null)?.id;
      if (!newId) throw new Error("L'élève n'a pas pu être créé.");

      // Frais de la classe (inscription comprise pour un nouvel élève)
      let feesAssigned = true;
      const { error: feeError } = await supabase.rpc(
        "assign_student_fees" as never,
        { _student_id: newId, _include_inscription: studentType === "nouveau" } as never,
      );
      if (feeError) feesAssigned = false;

      // Parents : un échec ici n'annule pas l'inscription, mais on le signale clairement
      let parentsError: string | null = null;
      try {
        await linkParent(newId, p1, true);
        if (hasContent(p2)) await linkParent(newId, p2, false);
      } catch (e) {
        parentsError = e instanceof Error ? e.message : "Erreur inconnue";
      }
      // Photo : un échec ici n'annule pas l'inscription ; on peut l'ajouter ensuite depuis la fiche de l'élève
      let photoError: string | null = null;
      if (photo) {
        try {
          await uploadStudentPhoto(newId, photo);
        } catch (e) {
          photoError = e instanceof Error ? e.message : "Erreur inconnue";
        }
      }
      return { feesAssigned, parentsError, photoError };
    },
    onSuccess: ({ feesAssigned, parentsError, photoError }) => {
      if (photoError) {
        toast.warning("Élève inscrit, mais la photo n'a pas pu être enregistrée", {
          description: `${photoError}. Ajoutez-la depuis la fiche de l'élève.`,
        });
      } else if (parentsError) {
        toast.warning("Élève inscrit, mais les parents n'ont pas pu être enregistrés", {
          description: `${parentsError}. Ajoutez-les depuis la fiche de l'élève.`,
        });
      } else if (!feesAssigned) {
        toast.warning("Élève inscrit, mais les frais n'ont pas pu être attribués", {
          description: "Prévenez l'administrateur pour attribuer l'écolage à cet élève.",
        });
      } else {
        toast.success("Élève inscrit", { description: "Parents enregistrés et frais de la classe attribués." });
      }
      void queryClient.invalidateQueries({
        predicate: (query) => /student|parent|fee|payment/i.test(String(query.queryKey[0])),
      });
      onClose();
    },
    onError: (e: Error) => toast.error("Inscription impossible", { description: e.message }),
  });

  return (
    <Panel>
      <div className="flex items-start justify-between gap-4">
        <h2 className="text-[15px] font-semibold">Nouvelle inscription</h2>
        <button type="button" onClick={onClose} className="text-[13px] text-muted-foreground hover:underline">
          Fermer
        </button>
      </div>
      <p className="mt-1 text-[12px] text-muted-foreground">
        Les champs marqués d'une étoile sont obligatoires. Comme sur la fiche d'inscription, les noms du ou des
        parents (ou du représentant légal) doivent être renseignés.
      </p>

      <form
        className="mt-5 space-y-7"
        onSubmit={(e) => {
          e.preventDefault();
          create.mutate(new FormData(e.currentTarget));
        }}
      >
        <section className="space-y-3">
          <h3 className={section}>Renseignements sur l'enfant</h3>
          <PhotoPicker file={photo} onChange={setPhoto} />
          <div className="grid gap-4 md:grid-cols-3">
            <Field name="matricule" label="Matricule" required defaultValue={nextMatricule} />
            <Field name="last_name" label="Nom" required />
            <Field name="first_name" label="Prénoms" required />
            <div>
              <label htmlFor="gender" className="label-caps">
                Sexe <span className="text-late">*</span>
              </label>
              <select id="gender" name="gender" required defaultValue="" className={inputClass}>
                <option value="" disabled>
                  Choisir…
                </option>
                <option value="M">Masculin</option>
                <option value="F">Féminin</option>
              </select>
            </div>
            <div>
              <label htmlFor="student_type" className="label-caps">
                Nouveau ou ancien <span className="text-late">*</span>
              </label>
              <select id="student_type" name="student_type" required defaultValue="" className={inputClass}>
                <option value="" disabled>
                  Choisir…
                </option>
                <option value="nouveau">Nouveau</option>
                <option value="ancien">Ancien</option>
              </select>
            </div>
            <div>
              <label htmlFor="class_id" className="label-caps">
                Classe sollicitée <span className="text-late">*</span>
              </label>
              <select id="class_id" name="class_id" required defaultValue="" className={inputClass}>
                <option value="">Sélectionner…</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <Field name="birth_date" label="Né(e) le" type="date" />
            <Field name="birth_place" label="à" />
            <Field name="nationality" label="Nationalité" />
            <Field name="previous_school" label="École de provenance" />
            <Field name="previous_class" label="Classe faite" />
            <Field name="phone" label="Téléphone de la famille" />
            <div className="md:col-span-3">
              <Field name="address" label="Adresse" />
            </div>
            <div className="md:col-span-3">
              <label htmlFor="siblings" className="label-caps">
                Fratrie : frères et sœurs dans l'établissement (noms, prénoms et classe)
              </label>
              <textarea id="siblings" name="siblings" className={areaClass} />
            </div>
          </div>
        </section>

        <section className="space-y-3">
          <h3 className={section}>Parents ou représentant légal</h3>
          <div className="grid gap-4 xl:grid-cols-2">
            <ParentBlock
              idPrefix="p1"
              title="1er parent ou représentant légal"
              required
              value={p1}
              onChange={setP1}
              directory={parents}
            />
            <ParentBlock
              idPrefix="p2"
              title="2e parent ou représentant légal"
              required={false}
              value={p2}
              onChange={setP2}
              directory={parents}
            />
          </div>
        </section>

        <section className="space-y-3">
          <h3 className={section}>Renseignements sanitaires de l'enfant</h3>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <label htmlFor="health_notes" className="label-caps">
                Allergies, problèmes de santé (asthme, vue…), traitement en cours
              </label>
              <textarea id="health_notes" name="health_notes" className={areaClass} />
            </div>
            <Field name="emergency_contact" label="Personne à prévenir en cas d'urgence (autre que les parents)" />
            <Field name="emergency_phone" label="Téléphone de cette personne" />
          </div>
        </section>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={create.isPending}
            className="h-9 rounded-md bg-primary px-3.5 text-[13px] font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
          >
            {create.isPending ? "Enregistrement…" : "Enregistrer l'inscription"}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="h-9 rounded-md border border-border bg-card px-3.5 text-[13px] font-medium hover:bg-muted"
          >
            Annuler
          </button>
        </div>
      </form>
    </Panel>
  );
}

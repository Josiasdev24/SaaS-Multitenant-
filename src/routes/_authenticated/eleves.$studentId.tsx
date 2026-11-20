import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQueries, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { q, computeFinance, studentAverage, fullName } from "@/lib/data";
import { money, moneyShort, num, dateFr, pct, todayISO } from "@/lib/format";
import { useCurrentUser } from "@/lib/session";
import { StudentParentsPanel } from "@/components/student-parents-panel";
import { StudentPhotoPanel } from "@/components/photo-field";
import { DeleteStudentPanel } from "@/components/delete-student-panel";
import { ParentBlock } from "@/components/parent-block";
import {
  checkParent,
  emptyParent,
  fromRow,
  hasContent,
  linkParent,
  updateParent,
  type ParentForm,
} from "@/lib/families";
import {
  PageHeader,
  Panel,
  Section,
  TableWrap,
  Th,
  Td,
  EmptyRow,
  FeeStatusBadge,
  Tag,
  LoadingBlock,
  KpiGrid,
  Kpi,
} from "@/components/kit";

export const Route = createFileRoute("/_authenticated/eleves/$studentId")({
  head: () => ({
    meta: [
      { title: "Fiche élève — Complexe Scolaire Omarus Adodo" },
      {
        name: "description",
        content:
          "Fiche individuelle : état civil, moyennes par matière, absences, écolage et famille.",
      },
      { property: "og:title", content: "Fiche élève — Complexe Scolaire Omarus Adodo" },
      {
        property: "og:description",
        content: "État civil, résultats, absences et écolage de l'élève.",
      },
      { property: "og:type", content: "profile" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: StudentDetail,
});

const TYPE_LABELS: Record<string, string> = { nouveau: "Nouveau", ancien: "Ancien" };
const STATUS_LABELS: Record<string, string> = {
  actif: "Actif",
  transfere: "Transféré",
  sorti: "Sorti",
  archive: "Archivé",
};
type WithType = { student_type?: string | null };
type PrimaryFlag = { is_primary?: boolean | null };

const inputClass =
  "mt-1.5 h-9 w-full rounded-md border border-border bg-card px-3 text-[13px] outline-none focus:border-primary/50";

const sectionClass = "text-[12px] font-semibold uppercase tracking-[0.12em] text-primary";
const areaClass =
  "mt-1.5 min-h-[72px] w-full rounded-md border border-border bg-card px-3 py-2 text-[13px] outline-none focus:border-primary/50";

/** Lit une information du dossier d'inscription qui n'est pas dans le type de base. */
function extra(student: unknown, key: string): string {
  const v = (student as Record<string, unknown>)[key];
  return typeof v === "string" ? v : "";
}

function EditField({
  name,
  label,
  type = "text",
  required,
  defaultValue,
}: {
  name: string;
  label: string;
  type?: string;
  required?: boolean;
  defaultValue?: string;
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
        className={inputClass}
      />
    </div>
  );
}

function StudentDetail() {
  const { studentId } = Route.useParams();
  const { data: user } = useCurrentUser();
  const perms = user?.permissions;
  const today = todayISO();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [p1, setP1] = useState<ParentForm>(emptyParent());
  const [p2, setP2] = useState<ParentForm>(emptyParent());
  const formRef = useRef<HTMLDivElement | null>(null);

  // Quand on clique sur « Modifier », on amène le formulaire à l'écran
  useEffect(() => {
    if (editing) formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [editing]);

  const [
    students,
    classes,
    subjects,
    evaluations,
    grades,
    attendance,
    studentFees,
    payments,
    fees,
    parents,
    studentParents,
    terms,
  ] = useQueries({
    queries: [
      q.students(),
      q.classes(),
      q.subjects(),
      { ...q.evaluations(), enabled: Boolean(perms?.viewAcademics) },
      { ...q.grades(), enabled: Boolean(perms?.viewAcademics) },
      { ...q.attendance(), enabled: Boolean(perms?.viewAttendance) },
      { ...q.studentFees(), enabled: Boolean(perms?.viewFinance) },
      { ...q.payments(), enabled: Boolean(perms?.viewFinance) },
      { ...q.fees(), enabled: Boolean(perms?.viewFinance) },
      { ...q.parents(), enabled: Boolean(perms?.viewFamilies) },
      { ...q.studentParents(), enabled: Boolean(perms?.viewFamilies) },
      q.terms(),
    ],
  });

  const student = (students.data ?? []).find((s) => s.id === studentId);
  const klass = classes.data?.find((c) => c.id === student?.class_id);

  // Parents rattachés à l'élève, le 1er contact en premier
  const myLinks = useMemo(
    () =>
      (studentParents.data ?? [])
        .filter((l) => l.student_id === studentId)
        .sort(
          (a, b) =>
            Number(Boolean((b as unknown as PrimaryFlag).is_primary)) -
            Number(Boolean((a as unknown as PrimaryFlag).is_primary)),
        ),
    [studentParents.data, studentId],
  );
  const linkedParentIds = useMemo(() => new Set(myLinks.map((l) => l.parent_id)), [myLinks]);
  const link1 = myLinks[0];
  const link2 = myLinks[1];

  /** Ouvre le formulaire de modification avec les parents actuels déjà remplis. */
  function openEdit() {
    const toForm = (l: (typeof myLinks)[number] | undefined): ParentForm => {
      if (!l) return emptyParent();
      const parent = (parents.data ?? []).find((x) => x.id === l.parent_id);
      return parent ? { ...fromRow(parent, l.relationship), existingId: null } : emptyParent(l.relationship);
    };
    setP1(toForm(link1));
    setP2(toForm(link2));
    setEditing(true);
  }

  const updateStudent = useMutation({
    mutationFn: async (form: FormData) => {
      const gender = String(form.get("gender") ?? "");
      const studentType = String(form.get("student_type") ?? "");
      const status = String(form.get("status") ?? "");
      const text = (key: string) => {
        const v = String(form.get(key) ?? "").trim();
        return v === "" ? null : v;
      };
      const lastName = String(form.get("last_name") ?? "").trim();
      const firstName = String(form.get("first_name") ?? "").trim();
      if (lastName === "") throw new Error("Le nom est obligatoire.");
      if (firstName === "") throw new Error("Les prénoms sont obligatoires.");
      const classId = String(form.get("class_id") ?? "");
      if (classId !== "" && !(classes.data ?? []).some((c) => c.id === classId)) {
        throw new Error("Classe inconnue.");
      }
      // Les parents sont vérifiés avant d'enregistrer quoi que ce soit
      checkParent(p1, "1er parent ou représentant légal", false);
      checkParent(p2, "2e parent ou représentant légal", false);
      const { error } = await supabase
        .from("students")
        .update({
          last_name: lastName.toUpperCase(),
          first_name: firstName,
          gender: gender === "M" || gender === "F" ? gender : null,
          student_type: studentType === "nouveau" || studentType === "ancien" ? studentType : null,
          status: status in STATUS_LABELS ? status : "actif",
          class_id: classId === "" ? null : classId,
          birth_date: text("birth_date"),
          birth_place: text("birth_place"),
          nationality: text("nationality"),
          previous_school: text("previous_school"),
          previous_class: text("previous_class"),
          phone: text("phone"),
          address: text("address"),
          siblings: text("siblings"),
          health_notes: text("health_notes"),
          emergency_contact: text("emergency_contact"),
          emergency_phone: text("emergency_phone"),
        } as never)
        .eq("id", studentId);
      if (error) throw new Error(error.message);

      // Parents : modifier les parents déjà rattachés, ou en ajouter un
      const saveSlot = async (
        form: ParentForm,
        link: typeof link1 | undefined,
        isPrimary: boolean,
      ) => {
        if (!hasContent(form)) return;
        if (link) await updateParent(link.parent_id, link.id, form);
        else await linkParent(studentId, form, isPrimary);
      };
      try {
        await saveSlot(p1, link1, true);
        await saveSlot(p2, link2, !link1 && !hasContent(p1));
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Erreur inconnue";
        throw new Error(`Les informations de l'élève sont enregistrées, mais pas celles des parents : ${msg}`);
      }
    },
    onSuccess: () => {
      toast.success("Fiche mise à jour");
      setEditing(false);
      void queryClient.invalidateQueries({
        predicate: (query) => /student|class|parent/i.test(String(query.queryKey[0])),
      });
    },
    onError: (e: Error) => toast.error("Modification impossible", { description: e.message }),
  });

  const subjectRows = useMemo(() => {
    if (!perms?.viewAcademics || !student) return [];
    const evals = (evaluations.data ?? []).filter((e) => e.class_id === student.class_id);
    const mine = (grades.data ?? []).filter((g) => g.student_id === student.id);
    return (subjects.data ?? [])
      .map((s) => {
        const subjectEvals = evals.filter((e) => e.subject_id === s.id);
        const ids = new Set(subjectEvals.map((e) => e.id));
        const gradeRows = mine.filter((g) => ids.has(g.evaluation_id));
        const avg = gradeRows.length
          ? gradeRows.reduce((acc, g) => {
              const ev = subjectEvals.find((e) => e.id === g.evaluation_id)!;
              return acc + (Number(g.score ?? 0) / (Number(ev.max_score) || 20)) * 20;
            }, 0) / gradeRows.length
          : null;
        return { id: s.id, name: s.name, count: gradeRows.length, average: avg };
      })
      .filter((r) => r.count > 0);
  }, [perms?.viewAcademics, student, evaluations.data, grades.data, subjects.data]);

  const generalAverage = useMemo(
    () =>
      perms?.viewAcademics && student
        ? studentAverage(student.id, grades.data ?? [], evaluations.data ?? [])
        : null,
    [perms?.viewAcademics, student, grades.data, evaluations.data],
  );

  const attendanceRows = useMemo(
    () => (attendance.data ?? []).filter((a) => a.student_id === studentId),
    [attendance.data, studentId],
  );
  const absences = attendanceRows.filter((a) => a.status === "absent").length;
  const lateCount = attendanceRows.filter((a) => a.status === "retard").length;
  const presenceRate = attendanceRows.length
    ? ((attendanceRows.length - absences) / attendanceRows.length) * 100
    : null;

  const finance = useMemo(
    () =>
      perms?.viewFinance && student
        ? computeFinance(
            student.id,
            studentFees.data ?? [],
            payments.data ?? [],
            fees.data ?? [],
            today,
          )
        : null,
    [perms?.viewFinance, student, studentFees.data, payments.data, fees.data, today],
  );

  const myPayments = useMemo(
    () => (payments.data ?? []).filter((p) => p.student_id === studentId),
    [payments.data, studentId],
  );

  const family = useMemo(() => {
    if (!perms?.viewFamilies) return [];
    const links = (studentParents.data ?? []).filter((l) => l.student_id === studentId);
    return links.map((l) => ({
      relationship: l.relationship,
      parent: parents.data?.find((p) => p.id === l.parent_id),
    }));
  }, [perms?.viewFamilies, studentParents.data, parents.data, studentId]);

  if (students.isPending) return <LoadingBlock />;
  if (!student) {
    return (
      <Panel>
        <p className="text-[15px] font-medium">Élève introuvable</p>
        <p className="mt-2 text-[13px] text-muted-foreground">
          Cette fiche n'existe pas ou n'est pas accessible avec votre rôle.
        </p>
        <Link to="/eleves" className="mt-4 inline-block text-[13px] text-primary hover:underline">
          Retour au répertoire
        </Link>
      </Panel>
    );
  }

  const studentType = (student as WithType).student_type ?? null;

  return (
    <div className="space-y-8 rise">
      <PageHeader
        title={fullName(student)}
        subtitle={`Matricule ${student.matricule} · ${klass?.name ?? "Non affecté"} · Inscrit le ${dateFr(student.enrollment_date)}`}
        right={
          <Link to="/eleves" className="text-[13px] text-primary hover:underline">
            Retour au répertoire
          </Link>
        }
      />

      <KpiGrid>
        {perms?.viewAcademics ? (
          <Kpi
            label="Moyenne générale"
            value={num(generalAverage)}
            hint="sur 20, toutes matières"
          />
        ) : null}
        {perms?.viewAttendance ? (
          <Kpi
            label="Présence"
            value={presenceRate === null ? "—" : pct(presenceRate)}
            hint={`${absences} absences · ${lateCount} retards`}
          />
        ) : null}
        {perms?.viewFinance && finance ? (
          <>
            <Kpi
              label="Écolage payé"
              value={moneyShort(finance.paid)}
              hint={`sur ${money(finance.due)}`}
            />
            <Kpi
              label="Reste à payer"
              value={moneyShort(finance.remaining)}
              hint={
                finance.nextDue
                  ? `Prochaine échéance : ${finance.nextDue.name} (${dateFr(finance.nextDue.date)})`
                  : "Aucune échéance à venir"
              }
            />
          </>
        ) : null}
      </KpiGrid>

      {editing && perms?.manageStructure ? (
        <div ref={formRef} className="scroll-mt-24">
        <Panel>
          <div className="flex items-start justify-between gap-4">
            <h2 className="text-[15px] font-semibold">Modifier les informations de l'élève</h2>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="text-[13px] text-muted-foreground hover:underline"
            >
              Fermer
            </button>
          </div>
          <p className="mt-1 text-[12px] text-muted-foreground">
            Mêmes informations qu'à l'inscription. Les parents se modifient plus bas, dans « Parents et
            tuteurs », et la photo dans l'encadré photo.
          </p>
          <form
            key={student.id}
            className="mt-5 space-y-7"
            onSubmit={(e) => {
              e.preventDefault();
              updateStudent.mutate(new FormData(e.currentTarget));
            }}
          >
            <section className="space-y-3">
              <h3 className={sectionClass}>Renseignements sur l'enfant</h3>
              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <span className="label-caps">Matricule</span>
                  <div className={`${inputClass} flex items-center bg-muted/50 text-muted-foreground`}>
                    {student.matricule}
                  </div>
                </div>
                <EditField name="last_name" label="Nom" required defaultValue={student.last_name} />
                <EditField name="first_name" label="Prénoms" required defaultValue={student.first_name} />
                <div>
                  <label htmlFor="gender" className="label-caps">
                    Sexe
                  </label>
                  <select id="gender" name="gender" defaultValue={student.gender ?? ""} className={inputClass}>
                    <option value="">Non renseigné</option>
                    <option value="M">Masculin</option>
                    <option value="F">Féminin</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="student_type" className="label-caps">
                    Nouveau ou ancien
                  </label>
                  <select
                    id="student_type"
                    name="student_type"
                    defaultValue={studentType ?? ""}
                    className={inputClass}
                  >
                    <option value="">Non renseigné</option>
                    <option value="nouveau">Nouveau</option>
                    <option value="ancien">Ancien</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="class_id" className="label-caps">
                    Classe
                  </label>
                  <select id="class_id" name="class_id" defaultValue={student.class_id ?? ""} className={inputClass}>
                    <option value="">Non affecté</option>
                    {(classes.data ?? []).map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <EditField name="birth_date" label="Né(e) le" type="date" defaultValue={student.birth_date ?? ""} />
                <EditField name="birth_place" label="à" defaultValue={student.birth_place ?? ""} />
                <EditField
                  name="nationality"
                  label="Nationalité"
                  defaultValue={extra(student, "nationality")}
                />
                <EditField
                  name="previous_school"
                  label="École de provenance"
                  defaultValue={extra(student, "previous_school")}
                />
                <EditField
                  name="previous_class"
                  label="Classe faite"
                  defaultValue={extra(student, "previous_class")}
                />
                <EditField name="phone" label="Téléphone de la famille" defaultValue={student.phone ?? ""} />
                <div className="md:col-span-2">
                  <EditField name="address" label="Adresse" defaultValue={student.address ?? ""} />
                </div>
                <div className="md:col-span-3">
                  <label htmlFor="siblings" className="label-caps">
                    Fratrie : frères et sœurs dans l'établissement (noms, prénoms et classe)
                  </label>
                  <textarea
                    id="siblings"
                    name="siblings"
                    defaultValue={extra(student, "siblings")}
                    className={areaClass}
                  />
                </div>
                <div>
                  <label htmlFor="status" className="label-caps">
                    Situation
                  </label>
                  <select id="status" name="status" defaultValue={student.status} className={inputClass}>
                    {Object.entries(STATUS_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <p className="text-[12px] text-muted-foreground">
                Changer de classe ne modifie pas l'écolage déjà attribué à l'élève : si le niveau change
                (par exemple CP1 vers CE1), les frais sont à ajuster séparément.
              </p>
            </section>

            <section className="space-y-3">
              <h3 className={sectionClass}>Parents ou représentant légal</h3>
              <div className="grid gap-4 xl:grid-cols-2">
                <ParentBlock
                  idPrefix="edit-p1"
                  title="1er parent ou représentant légal"
                  hint={
                    link1
                      ? "Les coordonnées modifiées valent aussi pour les autres enfants de ce parent."
                      : undefined
                  }
                  required={Boolean(link1)}
                  value={p1}
                  onChange={setP1}
                  directory={link1 ? [] : (parents.data ?? []).filter((p) => !linkedParentIds.has(p.id))}
                />
                <ParentBlock
                  idPrefix="edit-p2"
                  title="2e parent ou représentant légal"
                  hint={
                    link2
                      ? "Les coordonnées modifiées valent aussi pour les autres enfants de ce parent."
                      : undefined
                  }
                  required={false}
                  value={p2}
                  onChange={setP2}
                  directory={link2 ? [] : (parents.data ?? []).filter((p) => !linkedParentIds.has(p.id))}
                />
              </div>
              <p className="text-[12px] text-muted-foreground">
                Pour retirer un parent de cet élève, utilisez « Retirer » dans l'encadré « Parents et tuteurs ».
              </p>
            </section>

            <section className="space-y-3">
              <h3 className={sectionClass}>Renseignements sanitaires de l'enfant</h3>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="md:col-span-2">
                  <label htmlFor="health_notes" className="label-caps">
                    Allergies, problèmes de santé (asthme, vue…), traitement en cours
                  </label>
                  <textarea
                    id="health_notes"
                    name="health_notes"
                    defaultValue={extra(student, "health_notes")}
                    className={areaClass}
                  />
                </div>
                <EditField
                  name="emergency_contact"
                  label="Personne à prévenir en cas d'urgence (autre que les parents)"
                  defaultValue={extra(student, "emergency_contact")}
                />
                <EditField
                  name="emergency_phone"
                  label="Téléphone de cette personne"
                  defaultValue={extra(student, "emergency_phone")}
                />
              </div>
            </section>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="submit"
                disabled={updateStudent.isPending}
                className="h-9 rounded-md bg-primary px-3.5 text-[13px] font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
              >
                {updateStudent.isPending ? "Enregistrement…" : "Enregistrer les modifications"}
              </button>
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="h-9 rounded-md border border-border bg-card px-3.5 text-[13px] font-medium hover:bg-muted"
              >
                Annuler
              </button>
            </div>
          </form>
        </Panel>
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-3">
        <Panel className="lg:col-span-1">
          <div className="mb-4">
            <StudentPhotoPanel
              studentId={studentId}
              path={(student as { photo_path?: string | null }).photo_path}
              canEdit={Boolean(perms?.manageStructure)}
            />
          </div>
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-[15px] font-semibold">État civil</h2>
            {perms?.manageStructure && !editing ? (
              <button
                type="button"
                onClick={() => openEdit()}
                className="h-8 rounded-md border border-border px-3 text-[12px] font-medium hover:bg-muted"
              >
                Modifier
              </button>
            ) : null}
          </div>

            <dl className="mt-4 space-y-3 text-[13px]">
              <Row
                label="Sexe"
                value={
                  student.gender === "F"
                    ? "Féminin"
                    : student.gender === "M"
                      ? "Masculin"
                      : "Non renseigné"
                }
              />
              <Row
                label="Nouveau / ancien"
                value={studentType ? (TYPE_LABELS[studentType] ?? studentType) : "Non renseigné"}
              />
              <Row
                label="Naissance"
                value={`${dateFr(student.birth_date)}${student.birth_place ? ` à ${student.birth_place}` : ""}`}
              />
              <Row label="Adresse" value={student.address ?? "—"} />
              <Row label="Téléphone" value={student.phone ?? "—"} />
              <Row label="Situation" value={STATUS_LABELS[student.status] ?? student.status} />
            </dl>
          {perms?.viewFinance && finance ? (
            <div className="mt-5 border-t border-border pt-4">
              <div className="label-caps">Situation d'écolage</div>
              <div className="mt-2">
                <FeeStatusBadge status={finance.status} />
              </div>
            </div>
          ) : null}
        </Panel>

        {perms?.viewFamilies ? (
          <StudentParentsPanel
            studentId={studentId}
            links={(studentParents.data ?? []).filter((l) => l.student_id === studentId)}
            parents={parents.data ?? []}
            canEdit={Boolean(perms.manageStructure)}
            extras={student as unknown as Record<string, string | null | undefined>}
          />
        ) : null}
      </div>

      {perms?.viewAcademics ? (
        <Section title="Résultats par matière">
          <TableWrap minWidth={520}>
            <thead className="border-b border-border bg-muted/40">
              <tr>
                <Th>Matière</Th>
                <Th>Notes saisies</Th>
                <Th className="text-right">Moyenne /20</Th>
                <Th>Appréciation</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {subjectRows.length === 0 ? (
                <EmptyRow colSpan={4} label="Aucune note enregistrée pour cet élève." />
              ) : (
                subjectRows.map((r) => (
                  <tr key={r.id} className="hover:bg-muted/40">
                    <Td className="font-medium">{r.name}</Td>
                    <Td className="text-muted-foreground">{r.count}</Td>
                    <Td className="num-display text-right text-[15px]">{num(r.average)}</Td>
                    <Td>
                      {r.average === null ? (
                        <Tag>—</Tag>
                      ) : r.average >= 12 ? (
                        <Tag tone="ok">Bien</Tag>
                      ) : r.average >= 10 ? (
                        <Tag tone="partial">Moyen</Tag>
                      ) : (
                        <Tag tone="late">Insuffisant</Tag>
                      )}
                    </Td>
                  </tr>
                ))
              )}
            </tbody>
          </TableWrap>
        </Section>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        {perms?.viewAttendance ? (
          <Section title="Absences et retards">
            <TableWrap minWidth={380}>
              <thead className="border-b border-border bg-muted/40">
                <tr>
                  <Th>Date</Th>
                  <Th>Statut</Th>
                  <Th>Motif</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {attendanceRows.filter((a) => a.status !== "present").length === 0 ? (
                  <EmptyRow colSpan={3} label="Aucune absence enregistrée." />
                ) : (
                  attendanceRows
                    .filter((a) => a.status !== "present")
                    .slice(0, 10)
                    .map((a) => (
                      <tr key={a.id} className="hover:bg-muted/40">
                        <Td>{dateFr(a.attendance_date)}</Td>
                        <Td>
                          {a.status === "absent" ? (
                            <Tag tone="late">Absent</Tag>
                          ) : (
                            <Tag tone="partial">
                              Retard {a.minutes_late ? `${a.minutes_late} min` : ""}
                            </Tag>
                          )}
                        </Td>
                        <Td className="text-muted-foreground">{a.reason ?? "—"}</Td>
                      </tr>
                    ))
                )}
              </tbody>
            </TableWrap>
          </Section>
        ) : null}

        {perms?.viewFinance ? (
          <Section title="Historique des paiements">
            <TableWrap minWidth={380}>
              <thead className="border-b border-border bg-muted/40">
                <tr>
                  <Th>Date</Th>
                  <Th>Moyen</Th>
                  <Th>Reçu</Th>
                  <Th className="text-right">Montant</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {myPayments.length === 0 ? (
                  <EmptyRow colSpan={4} label="Aucun paiement enregistré." />
                ) : (
                  myPayments.map((p) => (
                    <tr key={p.id} className="hover:bg-muted/40">
                      <Td>{dateFr(p.paid_at)}</Td>
                      <Td className="text-muted-foreground">{p.method}</Td>
                      <Td className="num-display text-[12px] text-muted-foreground">
                        {p.receipt_number ? (
                          <Link
                            to="/ecolage/recu/$paymentId"
                            params={{ paymentId: p.id }}
                            className="text-primary hover:underline"
                          >
                            {p.receipt_number}
                          </Link>
                        ) : (
                          "—"
                        )}
                      </Td>
                      <Td className="num-display text-right">{moneyShort(p.amount)}</Td>
                    </tr>
                  ))
                )}
              </tbody>
            </TableWrap>
          </Section>
        ) : null}
      </div>

      {perms?.viewAcademics ? (
        <p className="text-[12px] text-faint">
          Périodes de l'année : {(terms.data ?? []).map((t) => t.name).join(" · ") || "—"}
        </p>
      ) : null}

      {user?.role === "admin" ? (
        <DeleteStudentPanel
          studentId={studentId}
          name={fullName(student)}
          matricule={student.matricule}
          paymentCount={perms?.viewFinance ? myPayments.length : null}
          paidTotal={
            perms?.viewFinance ? myPayments.reduce((s, p) => s + Number(p.amount), 0) : null
          }
          gradeCount={null}
          absenceCount={perms?.viewAttendance ? absences + lateCount : null}
        />
      ) : null}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium">{value}</dd>
    </div>
  );
}

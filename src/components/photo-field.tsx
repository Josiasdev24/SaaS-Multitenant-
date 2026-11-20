import { useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { removeStudentPhoto, uploadStudentPhoto, usePhotoUrl } from "@/lib/photos";

const frame = "flex h-32 w-28 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-muted/40 text-center text-[11px] text-muted-foreground";
const smallButton =
  "h-8 rounded-md border border-border bg-card px-3 text-[12px] font-medium hover:bg-muted disabled:opacity-60";

/** Choix de la photo pendant l'inscription : aperçu immédiat, enregistrée avec l'élève. */
export function PhotoPicker({ file, onChange }: { file: File | null; onChange: (file: File | null) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => {
    if (!file) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  return (
    <div className="flex items-start gap-4">
      <div className={frame}>
        {preview ? <img src={preview} alt="Photo de l'élève" className="h-full w-full object-cover" /> : "Pas de photo"}
      </div>
      <div className="space-y-2">
        <div className="label-caps">Photo de l'élève</div>
        <p className="max-w-xs text-[12px] text-muted-foreground">
          Elle apparaîtra automatiquement sur les bulletins : on n'aura plus à la rajouter. Sur téléphone, on peut la prendre
          directement avec l'appareil photo.
        </p>
        <input
          ref={input}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            onChange(e.target.files?.[0] ?? null);
            e.target.value = "";
          }}
        />
        <div className="flex gap-2">
          <button type="button" className={smallButton} onClick={() => input.current?.click()}>
            {file ? "Changer la photo" : "Choisir une photo"}
          </button>
          {file ? (
            <button type="button" className={smallButton} onClick={() => onChange(null)}>
              Retirer
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/** Photo sur la fiche de l'élève : ajouter, changer, retirer. */
export function StudentPhotoPanel({
  studentId,
  path,
  canEdit,
}: {
  studentId: string;
  path: string | null | undefined;
  canEdit: boolean;
}) {
  const queryClient = useQueryClient();
  const input = useRef<HTMLInputElement>(null);
  const url = usePhotoUrl(path);

  function refresh() {
    void queryClient.invalidateQueries({ predicate: (query) => /student|photo/i.test(String(query.queryKey[0])) });
  }

  const upload = useMutation({
    mutationFn: (file: File) => uploadStudentPhoto(studentId, file, path ?? null),
    onSuccess: () => {
      toast.success("Photo enregistrée");
      refresh();
    },
    onError: (e: Error) => toast.error("Photo non enregistrée", { description: e.message }),
  });

  const remove = useMutation({
    mutationFn: () => removeStudentPhoto(studentId, path as string),
    onSuccess: () => {
      toast.success("Photo retirée");
      refresh();
    },
    onError: (e: Error) => toast.error("Suppression impossible", { description: e.message }),
  });

  return (
    <div className="flex items-start gap-4">
      <div className={frame}>
        {url ? <img src={url} alt="Photo de l'élève" className="h-full w-full object-cover" /> : path ? "Chargement…" : "Pas de photo"}
      </div>
      {canEdit ? (
        <div className="space-y-2 print-hidden">
          <input
            ref={input}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) upload.mutate(f);
              e.target.value = "";
            }}
          />
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={upload.isPending} className={smallButton} onClick={() => input.current?.click()}>
              {upload.isPending ? "Enregistrement…" : path ? "Changer la photo" : "Ajouter une photo"}
            </button>
            {path ? (
              <button
                type="button"
                disabled={remove.isPending}
                className={smallButton}
                onClick={() => {
                  if (window.confirm("Retirer la photo de cet élève ?")) remove.mutate();
                }}
              >
                Retirer
              </button>
            ) : null}
          </div>
          <p className="max-w-xs text-[12px] text-muted-foreground">Elle s'affiche sur le bulletin de l'élève.</p>
        </div>
      ) : null}
    </div>
  );
}

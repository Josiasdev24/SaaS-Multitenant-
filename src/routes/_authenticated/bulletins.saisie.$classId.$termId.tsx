import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { appreciation, fmt, trimAverage } from "@/lib/bulletin";
import { fullName } from "@/lib/data";
import { saveNotes, useBulletinData, type StudentWithType } from "@/lib/bulletin-data";
import { noteKey } from "@/lib/bulletin";
import { useCurrentUser } from "@/lib/session";
import {
  PageHeader,
  Panel,
  TableWrap,
  Th,
  Td,
  EmptyRow,
  LoadingBlock,
  NoAccess,
} from "@/components/kit";

export const Route = createFileRoute("/_authenticated/bulletins/saisie/$classId/$termId")({
  head: () => ({
    meta: [{ title: "Saisie des notes — Registre scolaire" }],
  }),
  component: SaisiePage,
});

const inputClass =
  "h-8 w-24 rounded-md border border-border bg-card px-2 text-center text-[13px] outline-none focus:border-primary/50";

/** "16,5" ou "16.5" -> 16.5 ; "" -> null ; hors de 0 à 20 -> erreur. */
function parseScore(raw: string): number | null {
  const t = raw.trim().replace(",", ".");
  if (t === "") return null;
  const n = Number(t);
  if (!Number.isFinite(n) || n < 0 || n > 20) throw new Error(`Note invalide : « ${raw} » (entre 0 et 20).`);
  return n;
}

function SaisiePage() {
  const { classId, termId } = Route.useParams();
  const { data: user } = useCurrentUser();
  const perms = user?.permissions;
  const data = useBulletinData(classId, termId, Boolean(perms?.editAcademics));
  const [subjectId, setSubjectId] = useState("");

  if (!perms) return <LoadingBlock />;
  if (!perms.editAcademics) return <NoAccess />;
  if (data.pending) return <LoadingBlock />;

  const available = data.subjects.filter(
    (s) => !perms.ownClassesOnly || s.teacherId === user?.teacherId,
  );
  const chosen = available.find((s) => s.subjectId === subjectId) ?? available[0];
  const term = data.terms.find((t) => t.id === termId);

  return (
    <div className="space-y-6 rise">
      <PageHeader
        title={`Saisie des notes — ${data.klass?.name ?? ""}`}
        subtitle={`${term?.name ?? ""} · ${data.schoolYear}`}
        right={
          <Link to="/bulletins" className="text-[13px] text-primary hover:underline">
            Retour aux bulletins
          </Link>
        }
      />

      {available.length === 0 ? (
        <Panel>
          <p className="text-[13px] text-muted-foreground">
            Aucune matière à saisir pour cette classe avec votre compte.
          </p>
        </Panel>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <label htmlFor="subject" className="label-caps">
              Matière
            </label>
            <select
              id="subject"
              value={chosen?.subjectId ?? ""}
              onChange={(e) => setSubjectId(e.target.value)}
              className="h-9 rounded-md border border-border bg-card px-3 text-[13px] outline-none focus:border-primary/50"
            >
              {available.map((s) => (
                <option key={s.subjectId} value={s.subjectId}>
                  {s.label} (coef. {s.coefficient})
                </option>
              ))}
            </select>
          </div>
          {chosen ? (
            <Grid
              key={`${chosen.subjectId}-${termId}`}
              students={data.students}
              subjectId={chosen.subjectId}
              termId={termId}
              notes={data.notes}
            />
          ) : null}
        </>
      )}
    </div>
  );
}

function Grid({
  students,
  subjectId,
  termId,
  notes,
}: {
  students: StudentWithType[];
  subjectId: string;
  termId: string;
  notes: ReturnType<typeof useBulletinData>["notes"];
}) {
  const queryClient = useQueryClient();

  const initial = useMemo(() => {
    const m: Record<string, { a: string; b: string }> = {};
    for (const s of students) {
      const n = notes.get(noteKey(s.id, subjectId, termId));
      m[s.id] = {
        a: n?.classAvg === null || n?.classAvg === undefined ? "" : String(n.classAvg).replace(".", ","),
        b: n?.composition === null || n?.composition === undefined ? "" : String(n.composition).replace(".", ","),
      };
    }
    return m;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [values, setValues] = useState(initial);

  const save = useMutation({
    mutationFn: async () => {
      const rows = students
        .map((s) => ({
          studentId: s.id,
          subjectId,
          termId,
          classAvg: parseScore(values[s.id]?.a ?? ""),
          composition: parseScore(values[s.id]?.b ?? ""),
        }))
        .filter((r) => r.classAvg !== null || r.composition !== null || (initial[r.studentId]?.a ?? "") !== "" || (initial[r.studentId]?.b ?? "") !== "");
      await saveNotes(rows);
    },
    onSuccess: () => {
      toast.success("Notes enregistrées");
      queryClient.invalidateQueries({ queryKey: ["bulletin-notes"] });
    },
    onError: (e: Error) => toast.error("Enregistrement impossible", { description: e.message }),
  });

  function set(id: string, field: "a" | "b", value: string) {
    setValues((prev) => ({
      ...prev,
      [id]: { a: prev[id]?.a ?? "", b: prev[id]?.b ?? "", [field]: value },
    }));
  }

  function preview(id: string): number | null {
    try {
      return trimAverage({
        classAvg: parseScore(values[id]?.a ?? ""),
        composition: parseScore(values[id]?.b ?? ""),
      });
    } catch {
      return null;
    }
  }

  return (
    <>
      <TableWrap minWidth={620}>
        <thead className="border-b border-border bg-muted/40">
          <tr>
            <Th>N°</Th>
            <Th>Élève</Th>
            <Th className="text-center">Moy. classe</Th>
            <Th className="text-center">Composition</Th>
            <Th className="text-right">Moy. trimestre</Th>
            <Th>Appréciation</Th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {students.length === 0 ? (
            <EmptyRow colSpan={6} label="Aucun élève dans cette classe." />
          ) : (
            students.map((s, i) => {
              const p = preview(s.id);
              return (
                <tr key={s.id} className="hover:bg-muted/40">
                  <Td className="text-muted-foreground">{i + 1}</Td>
                  <Td className="font-medium">{fullName(s)}</Td>
                  <Td className="text-center">
                    <input
                      inputMode="decimal"
                      value={values[s.id]?.a ?? ""}
                      onChange={(e) => set(s.id, "a", e.target.value)}
                      aria-label={`Moyenne de classe de ${fullName(s)}`}
                      className={inputClass}
                    />
                  </Td>
                  <Td className="text-center">
                    <input
                      inputMode="decimal"
                      value={values[s.id]?.b ?? ""}
                      onChange={(e) => set(s.id, "b", e.target.value)}
                      aria-label={`Composition de ${fullName(s)}`}
                      className={inputClass}
                    />
                  </Td>
                  <Td className="num-display text-right">{p === null ? "—" : fmt(p)}</Td>
                  <Td className="text-muted-foreground">{appreciation(p) || "—"}</Td>
                </tr>
              );
            })
          )}
        </tbody>
      </TableWrap>
      <div>
        <button
          type="button"
          disabled={save.isPending}
          onClick={() => save.mutate()}
          className="h-9 rounded-md bg-primary px-3.5 text-[13px] font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
        >
          {save.isPending ? "Enregistrement…" : "Enregistrer les notes"}
        </button>
        <p className="mt-2 text-[12px] text-muted-foreground">
          Notes sur 20, virgule ou point. La moyenne du trimestre s'affiche dès que la moyenne de
          classe et la composition sont saisies.
        </p>
      </div>
    </>
  );
}

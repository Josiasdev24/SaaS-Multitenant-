import { useRef } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQueries, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { q } from "@/lib/data";
import { saveRemarks, useBulletinData, type Remarks } from "@/lib/bulletin-data";
import { dateFr, todayISO } from "@/lib/format";
import { useCurrentUser } from "@/lib/session";
import { BulletinSheet, BULLETIN_PRINT_CSS } from "@/components/bulletin-sheet";
import { LoadingBlock, NoAccess, PageHeader, Panel } from "@/components/kit";

export const Route = createFileRoute("/_authenticated/bulletins/eleve/$studentId/$termId")({
  head: () => ({
    meta: [{ title: "Bulletin — Registre scolaire" }],
  }),
  component: StudentBulletinPage,
});

function StudentBulletinPage() {
  const { studentId, termId } = Route.useParams();
  const { data: user } = useCurrentUser();
  const perms = user?.permissions;
  const [students] = useQueries({ queries: [{ ...q.students(), enabled: Boolean(perms?.viewAcademics) }] });

  if (!perms) return <LoadingBlock />;
  if (!perms.viewAcademics) return <NoAccess />;
  if (students.isPending) return <LoadingBlock />;

  const student = (students.data ?? []).find((s) => s.id === studentId);
  if (!student?.class_id) {
    return (
      <Panel>
        <p className="text-[13px] text-muted-foreground">Élève introuvable ou sans classe.</p>
      </Panel>
    );
  }
  return <Inner classId={student.class_id} studentId={studentId} termId={termId} />;
}

const REMARK_FIELDS: { key: keyof Remarks; label: string }[] = [
  { key: "absences", label: "Absences" },
  { key: "retards", label: "Retards" },
  { key: "honor_roll", label: "Tableau d'honneur" },
  { key: "congratulations", label: "Félicitation" },
  { key: "encouragement", label: "Encouragement" },
  { key: "warning", label: "Avertissement pour le travail" },
  { key: "blame", label: "Blâme pour le travail" },
  { key: "decision", label: "Décision du conseil de classe" },
  { key: "observation", label: "Observations du chef d'établissement" },
];

const inputClass =
  "mt-1.5 h-9 w-full rounded-md border border-border bg-card px-3 text-[13px] outline-none focus:border-primary/50";

function Inner({ classId, studentId, termId }: { classId: string; studentId: string; termId: string }) {
  const { data: user } = useCurrentUser();
  const perms = user?.permissions;
  const queryClient = useQueryClient();
  const data = useBulletinData(classId, termId);
  const formRef = useRef<HTMLFormElement>(null);

  const save = useMutation({
    mutationFn: async (form: FormData) => {
      const text = (key: string) => {
        const v = String(form.get(key) ?? "").trim();
        return v === "" ? null : v;
      };
      await saveRemarks({
        student_id: studentId,
        term_id: termId,
        absences: text("absences"),
        retards: text("retards"),
        honor_roll: text("honor_roll"),
        congratulations: text("congratulations"),
        encouragement: text("encouragement"),
        warning: text("warning"),
        blame: text("blame"),
        decision: text("decision"),
        observation: text("observation"),
      });
    },
    onSuccess: () => {
      toast.success("Observations enregistrées");
      queryClient.invalidateQueries({ queryKey: ["bulletin-remarks"] });
    },
    onError: (e: Error) => toast.error("Enregistrement impossible", { description: e.message }),
  });

  if (data.pending) return <LoadingBlock />;

  const report = data.report.reports.find((r) => r.student.id === studentId);
  const term = data.terms.find((t) => t.id === termId);
  if (!report) {
    return (
      <Panel>
        <p className="text-[13px] text-muted-foreground">Bulletin introuvable.</p>
      </Panel>
    );
  }
  const remarks = data.remarks.find((x) => x.student_id === studentId && x.term_id === termId) ?? null;
  const canEditRemarks =
    Boolean(perms?.manageStructure) ||
    (Boolean(perms?.editAcademics) && data.klass?.main_teacher_id === user?.teacherId && Boolean(user?.teacherId));

  return (
    <div className="space-y-6 rise">
      <style>{BULLETIN_PRINT_CSS}</style>
      <PageHeader
        title={`Bulletin — ${report.student.first_name} ${report.student.last_name}`}
        subtitle={`${data.klass?.name ?? ""} · ${term?.name ?? ""}`}
        right={
          <div className="flex gap-2">
            <Link
              to="/bulletins"
              className="flex h-9 items-center rounded-md border border-border px-3.5 text-[13px] font-medium hover:bg-muted"
            >
              Retour
            </Link>
            <button
              type="button"
              onClick={() => window.print()}
              className="h-9 rounded-md bg-primary px-3.5 text-[13px] font-medium text-primary-foreground hover:bg-primary/90"
            >
              Imprimer
            </button>
          </div>
        }
      />

      {canEditRemarks ? (
        <Panel>
          <h2 className="text-[15px] font-semibold">Observations et décision</h2>
          <p className="mt-1 text-[12px] text-muted-foreground">
            Ces mentions s'impriment en bas du bulletin. Laissez vide pour garder la ligne en pointillés.
          </p>
          <form
            ref={formRef}
            key={`${studentId}-${termId}-${remarks ? "r" : "n"}`}
            className="mt-4 grid gap-4 md:grid-cols-3"
            onSubmit={(e) => {
              e.preventDefault();
              save.mutate(new FormData(e.currentTarget));
            }}
          >
            {REMARK_FIELDS.map((f) => (
              <div key={f.key} className={f.key === "observation" || f.key === "decision" ? "md:col-span-3" : ""}>
                <label htmlFor={f.key} className="label-caps">
                  {f.label}
                </label>
                <input
                  id={f.key}
                  name={f.key}
                  defaultValue={(remarks?.[f.key] as string | null) ?? ""}
                  className={inputClass}
                />
              </div>
            ))}
            <div className="md:col-span-3">
              <button
                type="submit"
                disabled={save.isPending}
                className="h-9 rounded-md bg-primary px-3.5 text-[13px] font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
              >
                {save.isPending ? "Enregistrement…" : "Enregistrer les observations"}
              </button>
            </div>
          </form>
        </Panel>
      ) : null}

      <div id="print-area">
        <BulletinSheet
          report={report}
          classReport={data.report}
          className={data.klass?.name ?? ""}
          schoolYear={data.schoolYear}
          termOrder={term?.order ?? 1}
          remarks={remarks}
          titulaire={data.titulaire}
          date={dateFr(todayISO())}
        />
      </div>
    </div>
  );
}

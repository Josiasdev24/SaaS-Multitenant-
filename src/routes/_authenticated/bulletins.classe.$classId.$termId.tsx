import { createFileRoute, Link } from "@tanstack/react-router";

import { useBulletinData } from "@/lib/bulletin-data";
import { dateFr, todayISO } from "@/lib/format";
import { useCurrentUser } from "@/lib/session";
import { BulletinSheet, BULLETIN_PRINT_CSS } from "@/components/bulletin-sheet";
import { LoadingBlock, NoAccess, PageHeader } from "@/components/kit";

export const Route = createFileRoute("/_authenticated/bulletins/classe/$classId/$termId")({
  head: () => ({
    meta: [{ title: "Bulletins de la classe — Registre scolaire" }],
  }),
  component: ClassBulletinsPage,
});

function ClassBulletinsPage() {
  const { classId, termId } = Route.useParams();
  const { data: user } = useCurrentUser();
  const perms = user?.permissions;
  const data = useBulletinData(classId, termId, Boolean(perms?.viewAcademics));

  if (!perms) return <LoadingBlock />;
  if (!perms.viewAcademics) return <NoAccess />;
  if (data.pending) return <LoadingBlock />;

  const term = data.terms.find((t) => t.id === termId);
  const date = dateFr(todayISO());

  return (
    <div className="space-y-6 rise">
      <style>{BULLETIN_PRINT_CSS}</style>
      <PageHeader
        title={`Bulletins — ${data.klass?.name ?? ""}`}
        subtitle={`${term?.name ?? ""} · ${data.report.reports.length} bulletin(s), un par page`}
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
              Imprimer tous les bulletins
            </button>
          </div>
        }
      />
      <div id="print-area" className="space-y-8">
        {data.report.reports.map((r) => (
          <BulletinSheet
            key={r.student.id}
            report={r}
            classReport={data.report}
            className={data.klass?.name ?? ""}
            schoolYear={data.schoolYear}
            termOrder={term?.order ?? 1}
            remarks={data.remarks.find((x) => x.student_id === r.student.id && x.term_id === termId) ?? null}
            titulaire={data.titulaire}
            date={date}
          />
        ))}
      </div>
    </div>
  );
}

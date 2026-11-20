import { createFileRoute, Link } from "@tanstack/react-router";

import { appreciation, fmt, ordinal } from "@/lib/bulletin";
import { fullName } from "@/lib/data";
import { useBulletinData } from "@/lib/bulletin-data";
import { useCurrentUser } from "@/lib/session";
import { BULLETIN_PRINT_CSS } from "@/components/bulletin-sheet";
import { LoadingBlock, NoAccess, PageHeader } from "@/components/kit";

export const Route = createFileRoute("/_authenticated/bulletins/classement/$classId/$termId")({
  head: () => ({
    meta: [{ title: "Fiche de classement — Registre scolaire" }],
  }),
  component: ClassementPage,
});

const cell = "border border-black px-2 py-1";

function ClassementPage() {
  const { classId, termId } = Route.useParams();
  const { data: user } = useCurrentUser();
  const perms = user?.permissions;
  const data = useBulletinData(classId, termId, Boolean(perms?.viewAcademics));

  if (!perms) return <LoadingBlock />;
  if (!perms.viewAcademics) return <NoAccess />;
  if (data.pending) return <LoadingBlock />;

  const term = data.terms.find((t) => t.id === termId);
  const showAnnual = (term?.order ?? 0) >= 2;

  const sorted = [...data.report.reports].sort((a, b) => {
    if (a.average === null && b.average === null) {
      return fullName(a.student).localeCompare(fullName(b.student));
    }
    if (a.average === null) return 1;
    if (b.average === null) return -1;
    return b.average - a.average;
  });

  return (
    <div className="space-y-6 rise">
      <style>{BULLETIN_PRINT_CSS}</style>
      <PageHeader
        title="Fiche de classement"
        subtitle={`${data.klass?.name ?? ""} · ${term?.name ?? ""} · ${data.schoolYear}`}
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

      <div id="print-area">
        <div
          className="classement-sheet mx-auto w-full max-w-[794px] bg-white p-5 text-[12px] text-black"
          style={{ fontFamily: "Arial, Helvetica, sans-serif" }}
        >
          <div className="flex items-center justify-between gap-4">
            <img src="/logo.png" alt="" width={64} height={64} className="h-16 w-16" />
            <div className="text-center">
              <div className="text-[14px] font-bold">COMPLEXE SCOLAIRE "OMARUS ADODO"</div>
              <div className="mt-1 text-[16px] font-bold underline">FICHE DE CLASSEMENT</div>
              <div className="mt-1 font-semibold">
                Classe : {data.klass?.name} · {term?.name} · Année scolaire {data.schoolYear}
              </div>
            </div>
            <div className="w-16" />
          </div>

          <table className="mt-4 w-full border-collapse">
            <thead>
              <tr className="font-bold">
                <th className={`${cell} w-12`}>Rang</th>
                <th className={`${cell} text-left`}>Nom et prénoms</th>
                <th className={`${cell} w-10`}>Sexe</th>
                <th className={`${cell} w-16`}>Coef.</th>
                <th className={`${cell} w-20`}>Total</th>
                <th className={`${cell} w-20`}>Moyenne</th>
                <th className={`${cell} w-28`}>Appréciation</th>
                {showAnnual ? <th className={`${cell} w-20`}>Moy. annuelle</th> : null}
                {showAnnual ? <th className={`${cell} w-14`}>Rang ann.</th> : null}
              </tr>
            </thead>
            <tbody>
              {sorted.map((r) => (
                <tr key={r.student.id}>
                  <td className={`${cell} text-center font-bold`}>{ordinal(r.rank)}</td>
                  <td className={`${cell} font-semibold uppercase`}>{fullName(r.student)}</td>
                  <td className={`${cell} text-center`}>{r.student.gender ?? ""}</td>
                  <td className={`${cell} text-center`}>{r.totalCoefficient || ""}</td>
                  <td className={`${cell} text-center`}>{r.totalCoefficient ? fmt(r.totalPoints) : ""}</td>
                  <td className={`${cell} text-center font-bold`}>{fmt(r.average)}</td>
                  <td className={cell}>{appreciation(r.average)}</td>
                  {showAnnual ? (
                    <td className={`${cell} text-center font-bold`}>{fmt(r.annualAverage)}</td>
                  ) : null}
                  {showAnnual ? (
                    <td className={`${cell} text-center`}>{ordinal(r.annualRank)}</td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>

          <div className="mt-3 flex justify-between text-[11px]">
            <span>
              Effectif : {data.report.effectif} · Faible moyenne : {fmt(data.report.weakest)} · Forte
              moyenne : {fmt(data.report.strongest)}
            </span>
            <span>Le Directeur : N'TSAKPOE Antoine</span>
          </div>
        </div>
      </div>
    </div>
  );
}

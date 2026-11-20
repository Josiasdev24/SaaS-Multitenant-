import { usePhotoUrl } from "@/lib/photos";
import {
  GROUP_TITLES,
  appreciation,
  averageInWords,
  fmt,
  fmtCoef,
  ordinal,
  type ClassReport,
  type StudentReport,
} from "@/lib/bulletin";
import { fullName } from "@/lib/data";
import type { Remarks, StudentWithType } from "@/lib/bulletin-data";

/** Impression A4 : seule la zone #print-area est imprimée, un bulletin par page. */
export const BULLETIN_PRINT_CSS = `
@media print {
  @page { size: A4 portrait; margin: 6mm; }
  body * { visibility: hidden !important; }
  #print-area, #print-area * { visibility: visible !important; }
  #print-area { position: absolute; left: 0; top: 0; width: 100%; }
  #print-area .bulletin-sheet { max-width: none !important; padding: 0 !important; break-after: page; page-break-after: always; }
  #print-area .bulletin-sheet:last-child { break-after: auto; page-break-after: auto; }
  #print-area .classement-sheet { max-width: none !important; }
}
`;

const TERM_TITLES = ["PREMIER", "DEUXIEME", "TROISIEME"];
const TERM_SHORT = ["1er", "2e", "3e"];

type Props = {
  report: StudentReport<StudentWithType>;
  classReport: ClassReport<StudentWithType>;
  className: string;
  schoolYear: string;
  termOrder: number;
  remarks: Remarks | null;
  titulaire: string;
  date: string;
};

const cell = "border border-black px-1.5 py-[3px]";
const head = "border border-black bg-white px-1.5 py-1 text-center font-bold";

/**
 * Bulletin d'évaluation du collège, reproduit à l'identique du modèle de l'école
 * (en-tête, matières par groupe, totaux, rangs, observations, signatures).
 */
export function BulletinSheet({
  report,
  classReport,
  className,
  schoolYear,
  termOrder,
  remarks,
  titulaire,
  date,
}: Props) {
  const s = report.student;
  const sexe = s.gender === "F" ? "F" : s.gender === "M" ? "M" : "";
  const statut =
    s.student_type === "nouveau" ? "NOUVEAU" : s.student_type === "ancien" ? "ANCIEN" : "";
  const annual = report.annualAverage;
  const photoUrl = usePhotoUrl((s as { photo_path?: string | null }).photo_path);

  return (
    <div
      className="bulletin-sheet mx-auto w-full max-w-[794px] bg-white p-5 text-[11px] leading-tight text-black"
      style={{ fontFamily: "Arial, Helvetica, sans-serif" }}
    >
      {/* En-tête */}
      <div className="grid grid-cols-[1fr_auto_1fr] items-start gap-2">
        <div className="space-y-1 text-[10px] font-bold">
          <div className="text-[11px]">N° : 00016001ADJJJ062616.49</div>
          <div>MINISTERE DE L'EDUCATION NATIONALE</div>
          <div>DIRECTION REGIONALE DE L'EDUCATION GRAND-LOME</div>
          <div className="pt-2 text-[13px]">COMPLEXE SCOLAIRE</div>
          <div className="text-[13px]">"OMARUS ADODO"</div>
          <div className="pl-3">BE ADJIDOME</div>
          <div className="pl-1">90 20 77 16 / 97 66 50 16</div>
          <div className="pl-1">Lomé-Togo</div>
        </div>
        <img
          src="/logo-omarus.jpg"
          alt="Complexe Scolaire Omarus Adodo"
          width={96}
          height={96}
          className="h-24 w-24 object-contain"
          onError={(e) => {
            const img = e.currentTarget;
            if (!img.src.endsWith("/logo.png")) img.src = "/logo.png";
          }}
        />
        <div className="space-y-1 text-right text-[10px] font-bold">
          <div>REPUBLIQUE TOGOLAISE</div>
          <div className="underline">Travail-Liberté-Patrie</div>
          <div className="pt-3 text-left text-[11px]">
            <div>
              Année Scolaire : <span>{schoolYear}</span>
            </div>
            <div>
              Classe <span className="ml-4">{className}</span>
            </div>
            <div>
              Effectif <span className="ml-3">{classReport.effectif}</span>
            </div>
            <div className="mt-1 flex items-stretch gap-1">
              <span>STATUT</span>
              <span className="min-w-[70px] border border-black px-1 text-center">{statut}</span>
              <span className="ml-auto">SEXE :</span>
              <span className="min-w-[24px] border-2 border-black px-1 text-center">{sexe}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Titre */}
      <div className="mx-auto mt-3 w-[62%] border-2 border-black px-3 py-1 text-center text-[16px] font-bold leading-tight tracking-wide">
        BULLETIN D' EVALUATION
        <br />
        DU {TERM_TITLES[termOrder - 1] ?? ""} TRIMESTRE
      </div>

      <div className="mt-3 flex items-end justify-between">
        <div className="text-[11px] font-bold">
          NOM ET PRENOMS : <span className="uppercase">{fullName(s)}</span>
        </div>
        <div className="h-16 w-14 overflow-hidden border border-black" aria-label="Photo">
          {photoUrl ? <img src={photoUrl} alt="" className="h-full w-full object-cover" /> : null}
        </div>
      </div>

      {/* Tableau des matières */}
      <table className="mt-2 w-full border-collapse text-[11px]">
        <thead>
          <tr>
            <th className={`${head} w-[24%] text-[12px]`} rowSpan={2}>
              MATIERES
            </th>
            <th className={head}>Moy</th>
            <th className={head} rowSpan={2}>
              COMP.
            </th>
            <th className={head}>MOY.</th>
            <th className={head} rowSpan={2}>
              Coef.
            </th>
            <th className={head}>Notes</th>
            <th className={head} rowSpan={2}>
              Rang
            </th>
            <th className={`${head} w-[13%]`} rowSpan={2}>
              Appréciations
            </th>
            <th className={`${head} w-[12%]`} rowSpan={2}>
              Noms des Prof
            </th>
            <th className={`${head} w-[9%]`} rowSpan={2}>
              Signature
            </th>
          </tr>
          <tr>
            <th className={head}>Classe</th>
            <th className={head}>Trim</th>
            <th className={head}>Définitives</th>
          </tr>
        </thead>
        <tbody>
          {report.groups.map((g) => (
            <GroupBlock key={g.group} group={g} />
          ))}
        </tbody>
      </table>

      {/* Bas du bulletin : totaux, moyennes et rangs */}
      <div className="mt-3 grid grid-cols-[1fr_auto] gap-3">
        <div>
          <div className="grid grid-cols-[1fr_auto]">
            <div className="flex items-center justify-center">
              <div className="flex">
                <div className="border border-black px-3 py-1 text-[13px] font-bold">TOTAUX</div>
                <div className="min-w-[36px] border border-black px-2 py-1 text-center text-[13px] font-bold text-red-700">
                  {report.totalCoefficient ? fmtCoef(report.totalCoefficient) : ""}
                </div>
                <div className="min-w-[70px] border border-black px-2 py-1 text-center text-[13px] font-bold text-red-700">
                  {report.totalCoefficient ? fmt(report.totalPoints) : ""}
                </div>
              </div>
            </div>
            <div />
          </div>

          <div className="mt-2 grid grid-cols-[auto_1fr] gap-3">
            <div className="text-[12px]">
              {report.terms.map((t) => (
                <div key={t.term.id} className="flex items-baseline gap-2">
                  <span>
                    Moy. {TERM_SHORT[t.term.order - 1] ?? t.term.order}{" "}
                    {t.term.order === 1 ? "Trim" : "Trim"}:
                  </span>
                  <span className="font-bold text-blue-800">{fmt(t.average)}</span>
                  <span className="ml-1">Rang:</span>
                  <span className="font-bold text-red-700">{ordinal(t.rank)}</span>
                </div>
              ))}
              <div className="flex items-baseline gap-2">
                <span>Moy. Ann Trim :</span>
                <span className="font-bold text-blue-800">{fmt(annual)}</span>
                <span className="ml-1">Rang:</span>
                <span className="font-bold text-red-700">{ordinal(report.annualRank)}</span>
              </div>
            </div>
            <div>
              <div className="flex">
                <div className="flex-1 border border-black px-2 py-1 text-center font-bold">
                  Moyenne en lettre
                </div>
                <div className="min-w-[110px] border border-black px-2 py-1 text-center text-[24px] font-bold text-green-700">
                  {fmt(annual)}
                </div>
              </div>
              <div className="border border-black px-2 py-2 text-center text-[12px] font-bold text-green-700">
                {averageInWords(annual) || "\u00A0"}
              </div>
            </div>
          </div>
        </div>

        <div className="w-[190px]">
          <div className="border border-black px-2 py-1 text-[11px] font-bold">
            Faible Moy : <span className="ml-2">{fmt(classReport.weakest)}</span>
          </div>
          <div className="border border-black border-t-0 px-2 py-1 text-[11px] font-bold">
            Forte Moy : <span className="ml-2">{fmt(classReport.strongest)}</span>
          </div>
          <div className="mt-3 text-center text-[11px] font-bold">
            Observations du Chef d'Etablissement
          </div>
          <div className="mt-1 text-center text-[13px] font-bold italic text-green-700">
            {remarks?.observation ?? ""}
          </div>
        </div>
      </div>

      {/* Observations, décision et signatures */}
      <div className="mt-6 grid grid-cols-[1.1fr_1fr_1fr] gap-3 text-[11px]">
        <div className="space-y-[7px] italic">
          <DottedLine label="Absences" value={remarks?.absences} />
          <DottedLine label="Retards" value={remarks?.retards} />
          <DottedLine label="Tableau d'honneur" value={remarks?.honor_roll} />
          <DottedLine label="Félicitation" value={remarks?.congratulations} />
          <DottedLine label="Encouragement" value={remarks?.encouragement} />
          <DottedLine label="Avertis. Pour le travail" value={remarks?.warning} />
          <DottedLine label="Blâme pour le travail" value={remarks?.blame} />
        </div>
        <div className="flex flex-col items-center justify-between text-center">
          <div className="italic">
            Décision du conseil de classe
            {remarks?.decision ? (
              <span className="ml-1 not-italic font-semibold">: {remarks.decision}</span>
            ) : (
              "......"
            )}
          </div>
          <div className="mt-14 font-bold">Titulaire</div>
          <div className="mt-6 font-bold uppercase">{titulaire}</div>
        </div>
        <div className="flex flex-col items-center justify-end text-center font-bold">
          <div className="mt-24">N'TSAKPOE Antoine</div>
          <div className="mt-1 text-[10px] font-normal">Lomé, le {date}</div>
        </div>
      </div>
    </div>
  );
}

function GroupBlock({ group }: { group: StudentReport<StudentWithType>["groups"][number] }) {
  return (
    <>
      <tr>
        <td colSpan={10} className={`${cell} text-center font-bold`}>
          {GROUP_TITLES[group.group]}
        </td>
      </tr>
      {group.rows.map((r) => (
        <tr key={r.subject.subjectId}>
          <td className={`${cell} font-bold`}>{r.subject.label}</td>
          <td className={`${cell} text-center`}>{fmt(r.classAvg)}</td>
          <td className={`${cell} text-center`}>{fmt(r.composition)}</td>
          <td className={`${cell} text-center`}>{fmt(r.trimAvg)}</td>
          <td className={`${cell} text-center font-bold text-red-700`}>{fmtCoef(r.subject.coefficient)}</td>
          <td className={`${cell} text-center font-bold text-red-700`}>{fmt(r.points)}</td>
          <td className={`${cell} text-center font-bold`}>{ordinal(r.rank)}</td>
          <td className={`${cell} font-semibold`}>{appreciation(r.trimAvg)}</td>
          <td className={`${cell} font-bold`}>{r.trimAvg === null ? "" : r.subject.teacher.toUpperCase()}</td>
          <td className={cell} />
        </tr>
      ))}
      {group.group !== "facultative" ? (
        <>
          <tr>
            <td className={`${cell} font-bold`}>TOTAL</td>
            <td className={cell} />
            <td className={cell} />
            <td className={cell} />
            <td className={`${cell} text-center font-bold text-red-700`}>
              {group.coefficient ? fmtCoef(group.coefficient) : ""}
            </td>
            <td className={`${cell} text-center font-bold text-red-700`}>
              {group.coefficient ? fmt(group.points) : ""}
            </td>
            <td colSpan={4} className="border-0" />
          </tr>
          <tr>
            <td className={`${cell} font-bold`}>MOYENNE</td>
            <td className={cell} />
            <td className={cell} />
            <td className={cell} />
            <td className={cell} />
            <td className={`${cell} text-center font-bold text-red-700`}>{fmt(group.average)}</td>
            <td colSpan={4} className="border-0" />
          </tr>
        </>
      ) : null}
    </>
  );
}

function DottedLine({ label, value }: { label: string; value?: string | null | undefined }) {
  return (
    <div className="flex items-end gap-1">
      <span className="shrink-0">{label}</span>
      <span className="min-h-[13px] flex-1 border-b border-dotted border-black px-1 not-italic">
        {value ?? ""}
      </span>
    </div>
  );
}

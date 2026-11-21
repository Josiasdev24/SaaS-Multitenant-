import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQueries, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { q, fullName, compareNames } from "@/lib/data";
import { dateFr, pct, todayISO } from "@/lib/format";
import { useCurrentUser } from "@/lib/session";
import { DeleteAction, ensureDeleted } from "@/components/delete-actions";
import {
  PageHeader,
  TableWrap,
  Th,
  Td,
  EmptyRow,
  LoadingBlock,
  Panel,
  Section,
  NoAccess,
  Kpi,
  KpiGrid,
  Tag,
} from "@/components/kit";

export const Route = createFileRoute("/_authenticated/absences/")({
  head: () => ({
    meta: [
      { title: "Absences & retards" },
      { name: "description", content: "Appel quotidien par classe, historique des absences et taux de présence." },
      { property: "og:title", content: "Absences & retards" },
      { property: "og:description", content: "Faites l'appel et suivez l'assiduité de chaque classe." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AttendancePage,
});

type Status = "present" | "absent" | "retard";
const STATUS_LABEL: Record<Status, string> = { present: "Présent", absent: "Absent", retard: "Retard" };

function AttendancePage() {
  const { data: user } = useCurrentUser();
  const perms = user?.permissions;
  const isFounder = user?.role === "admin";
  const queryClient = useQueryClient();

  const [classId, setClassId] = useState("");
  const [day, setDay] = useState(todayISO());
  const [draft, setDraft] = useState<Record<string, Status>>({});

  const [classes, students, attendance, classSubjects] = useQueries({
    queries: [q.classes(), q.students(), q.attendance(), q.classSubjects()],
  });

  const myClasses = useMemo(() => {
    const all = classes.data ?? [];
    if (!perms?.ownClassesOnly || !user?.teacherId) return all;
    return all.filter(
      (c) =>
        c.main_teacher_id === user.teacherId ||
        (classSubjects.data ?? []).some((cs) => cs.class_id === c.id && cs.teacher_id === user.teacherId),
    );
  }, [classes.data, classSubjects.data, perms?.ownClassesOnly, user?.teacherId]);

  useEffect(() => {
    if (!classId && myClasses.length) setClassId(myClasses[0]!.id);
  }, [myClasses, classId]);
  useEffect(() => setDraft({}), [classId, day]);

  const roster = useMemo(
    () =>
      (students.data ?? [])
        .filter((s) => s.class_id === classId && s.status === "actif")
        .sort(compareNames),
    [students.data, classId],
  );

  const dayRecords = useMemo(
    () => (attendance.data ?? []).filter((a) => a.attendance_date === day && a.class_id === classId),
    [attendance.data, day, classId],
  );
  const recordByStudent = useMemo(() => {
    const m = new Map<string, (typeof dayRecords)[number]>();
    dayRecords.forEach((r) => m.set(r.student_id, r));
    return m;
  }, [dayRecords]);

  const stats = useMemo(() => {
    const rows = (attendance.data ?? []).filter((a) => !classId || a.class_id === classId);
    const total = rows.length || 1;
    return {
      total: rows.length,
      absent: rows.filter((a) => a.status === "absent").length,
      retard: rows.filter((a) => a.status === "retard").length,
      rate: (rows.filter((a) => a.status === "present").length / total) * 100,
    };
  }, [attendance.data, classId]);

  const topAbsentees = useMemo(() => {
    const counts = new Map<string, number>();
    (attendance.data ?? [])
      .filter((a) => a.status === "absent")
      .forEach((a) => counts.set(a.student_id, (counts.get(a.student_id) ?? 0) + 1));
    return [...counts.entries()]
      .map(([studentId, count]) => ({
        student: (students.data ?? []).find((s) => s.id === studentId) ?? null,
        count,
      }))
      .filter((x) => x.student)
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);
  }, [attendance.data, students.data]);

  const saveCall = useMutation({
    mutationFn: async () => {
      const entries = roster.map((s) => {
        const status: Status = draft[s.id] ?? (recordByStudent.get(s.id)?.status as Status) ?? "present";
        return { student_id: s.id, class_id: classId, attendance_date: day, status };
      });
      if (entries.length === 0) throw new Error("Aucun élève à appeler.");
      const existingIds = dayRecords.map((r) => r.id);
      if (existingIds.length) {
        const { error: delError } = await supabase.from("attendance").delete().in("id", existingIds);
        if (delError) throw new Error(delError.message);
      }
      const { error } = await supabase.from("attendance").insert(entries as never);
      if (error) throw new Error(error.message);
      return entries.length;
    },
    onSuccess: (count) => {
      toast.success(`Appel enregistré pour ${count} élèves`);
      setDraft({});
      queryClient.invalidateQueries({ queryKey: ["attendance"] });
    },
    onError: (e: Error) => toast.error("Enregistrement impossible", { description: e.message }),
  });

  if (!perms) return <LoadingBlock />;
  if (!perms.viewAttendance) return <NoAccess />;
  if (classes.isPending || attendance.isPending) return <LoadingBlock />;

  const className = myClasses.find((c) => c.id === classId)?.name ?? "cette classe";

  return (
    <div className="space-y-6 rise">
      <PageHeader title="Absences & retards" subtitle="Appel quotidien et suivi de l'assiduité." />

      <KpiGrid>
        <Kpi label="Taux de présence" value={pct(stats.rate)} hint="Sur la période enregistrée" />
        <Kpi label="Absences" value={stats.absent} />
        <Kpi label="Retards" value={stats.retard} />
        <Kpi label="Relevés" value={stats.total} />
      </KpiGrid>

      <Panel>
        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <label htmlFor="a-class" className="label-caps">Classe</label>
            <select id="a-class" value={classId} onChange={(e) => setClassId(e.target.value)} className={inputClass}>
              {myClasses.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="a-day" className="label-caps">Date</label>
            <input id="a-day" type="date" value={day} onChange={(e) => setDay(e.target.value)} className={inputClass} />
          </div>
          <div className="flex items-end gap-4">
            {perms.editAttendance ? (
              <button
                type="button"
                onClick={() => saveCall.mutate()}
                disabled={saveCall.isPending || roster.length === 0}
                className="h-9 rounded-md bg-primary px-3.5 text-[13px] font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {saveCall.isPending ? "Enregistrement…" : "Enregistrer l'appel"}
              </button>
            ) : null}
            {isFounder && dayRecords.length > 0 ? (
              <DeleteAction
                label="Supprimer l'appel du jour"
                message={
                  `Supprimer tout l'appel de ${className} du ${dateFr(day)} ?\n\n` +
                  `${dayRecords.length} relevé(s) de présence, d'absence et de retard seront effacés.`
                }
                success={`Appel du ${dateFr(day)} supprimé`}
                run={async () => {
                  ensureDeleted(
                    await supabase
                      .from("attendance")
                      .delete()
                      .in(
                        "id",
                        dayRecords.map((r) => r.id),
                      )
                      .select("id"),
                  );
                  setDraft({});
                }}
                className="h-9 text-[13px] font-medium text-destructive hover:underline disabled:opacity-50"
              />
            ) : null}
          </div>
        </div>
      </Panel>

      <Section title={`Appel du ${dateFr(day)}`}>
        <TableWrap minWidth={640}>
          <thead className="border-b border-border bg-muted/40">
            <tr>
              <Th>Élève</Th>
              <Th>Matricule</Th>
              <Th>Statut</Th>
              {isFounder ? <Th className="print-hidden text-right">Action</Th> : null}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {roster.length === 0 ? (
              <EmptyRow colSpan={isFounder ? 4 : 3} label="Aucun élève actif dans cette classe." />
            ) : (
              roster.map((s) => {
                const record = recordByStudent.get(s.id);
                const current: Status = draft[s.id] ?? (record?.status as Status) ?? "present";
                return (
                  <tr key={s.id} className="hover:bg-muted/40">
                    <Td className="font-medium">
                      <Link to="/eleves/$studentId" params={{ studentId: s.id }} className="hover:underline">
                        {fullName(s)}
                      </Link>
                    </Td>
                    <Td className="num-display text-muted-foreground">{s.matricule}</Td>
                    <Td>
                      {perms.editAttendance ? (
                        <div className="flex gap-1.5">
                          {(["present", "absent", "retard"] as Status[]).map((st) => (
                            <button
                              key={st}
                              type="button"
                              onClick={() => setDraft((d) => ({ ...d, [s.id]: st }))}
                              className={
                                "h-7 rounded-full px-2.5 text-[12px] font-medium transition-colors " +
                                (current === st
                                  ? st === "present"
                                    ? "bg-ok/15 text-ok"
                                    : st === "absent"
                                      ? "bg-late/15 text-late"
                                      : "bg-partial/15 text-partial"
                                  : "border border-border text-muted-foreground hover:bg-muted")
                              }
                            >
                              {STATUS_LABEL[st]}
                            </button>
                          ))}
                        </div>
                      ) : (
                        <Tag tone={current === "present" ? "ok" : current === "absent" ? "late" : "partial"}>
                          {STATUS_LABEL[current]}
                        </Tag>
                      )}
                    </Td>
                    {isFounder ? (
                      <Td className="print-hidden text-right">
                        {record ? (
                          <DeleteAction
                            message={`Supprimer le relevé de ${fullName(s)} du ${dateFr(day)} (${STATUS_LABEL[record.status as Status] ?? record.status}) ?`}
                            success="Relevé supprimé"
                            run={async () => {
                              ensureDeleted(
                                await supabase.from("attendance").delete().eq("id", record.id).select("id"),
                              );
                              setDraft((d) => {
                                const next = { ...d };
                                delete next[s.id];
                                return next;
                              });
                            }}
                          />
                        ) : (
                          <span className="text-[12px] text-faint">—</span>
                        )}
                      </Td>
                    ) : null}
                  </tr>
                );
              })
            )}
          </tbody>
        </TableWrap>
      </Section>

      <Section title="Élèves les plus absents">
        <TableWrap minWidth={480}>
          <thead className="border-b border-border bg-muted/40">
            <tr>
              <Th>Élève</Th>
              <Th className="text-right">Absences</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {topAbsentees.length === 0 ? (
              <EmptyRow colSpan={2} label="Aucune absence enregistrée." />
            ) : (
              topAbsentees.map((a) => (
                <tr key={a.student!.id} className="hover:bg-muted/40">
                  <Td>
                    <Link to="/eleves/$studentId" params={{ studentId: a.student!.id }} className="font-medium hover:underline">
                      {fullName(a.student!)}
                    </Link>
                  </Td>
                  <Td className="num-display text-right">{a.count}</Td>
                </tr>
              ))
            )}
          </tbody>
        </TableWrap>
      </Section>
    </div>
  );
}

const inputClass =
  "mt-1.5 h-9 w-full rounded-md border border-border bg-card px-3 text-[13px] outline-none focus:border-primary/50";

-- =====================================================================
-- 0004 — RÈGLES RLS (isolation imposée par la base)
-- Principe : toute politique commence par « school_id est une de MES écoles ».
-- Les politiques d'écriture ont un WITH CHECK identique : impossible
-- d'écrire une ligne dans l'école d'un autre.
-- Le super-administrateur n'a AUCUN accès aux tables de données d'élèves,
-- de notes ou de finances : seulement écoles, cycles, membres, journal.
-- =====================================================================

-- ---------- Activer la RLS partout ----------
do $$
declare t record;
begin
  for t in select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
           where n.nspname = 'public' and c.relkind = 'r'
  loop
    execute format('alter table public.%I enable row level security', t.relname);
  end loop;
end $$;

-- Aide : profils des membres d'une école dont l'utilisateur est Fondateur.
create function public.founder_sees_user(uid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.school_members a
    join public.school_members b on b.school_id = a.school_id
    where a.user_id = uid and b.user_id = auth.uid()
      and b.role = 'founder' and b.status = 'active'
  );
$$;

-- ---------- Noyau ----------
create policy schools_select on public.schools for select to authenticated
  using (id in (select public.my_schools()) or public.is_super_admin());
create policy schools_update on public.schools for update to authenticated
  using (public.is_founder(id)) with check (public.is_founder(id));

create policy cycles_select on public.school_cycles for select to authenticated
  using (school_id in (select public.my_schools()) or public.is_super_admin());
create policy cycles_write on public.school_cycles for all to authenticated
  using (public.is_founder(school_id) or public.is_super_admin())
  with check (public.is_founder(school_id) or public.is_super_admin());

create policy members_select on public.school_members for select to authenticated
  using (user_id = auth.uid() or public.is_founder(school_id) or public.is_super_admin());
-- Le Fondateur gère les membres de son école, sauf d'autres Fondateurs ; le super-admin gère tout.
create policy members_write on public.school_members for all to authenticated
  using ((public.is_founder(school_id) and role <> 'founder') or public.is_super_admin())
  with check ((public.is_founder(school_id) and role <> 'founder') or public.is_super_admin());

create policy member_cycles_select on public.member_cycles for select to authenticated
  using (public.is_founder(school_id) or public.is_super_admin()
         or exists (select 1 from public.school_members m where m.id = member_id and m.user_id = auth.uid()));
create policy member_cycles_write on public.member_cycles for all to authenticated
  using (public.is_founder(school_id) or public.is_super_admin())
  with check (public.is_founder(school_id) or public.is_super_admin());

create policy profiles_select on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_super_admin() or public.founder_sees_user(id));
create policy profiles_update on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

create policy audit_select on public.audit_log for select to authenticated
  using (public.is_founder(school_id) or public.is_super_admin());
-- super_admins : aucune politique (fermée à l'API).

-- ---------- Structure (lecture : tout membre ; écriture : Fondateur / Directeur) ----------
create policy ay_select on public.academic_years for select to authenticated
  using (school_id in (select public.my_schools()));
create policy ay_write on public.academic_years for all to authenticated
  using (school_id in (select public.my_schools()) and public.manage_structure(school_id))
  with check (school_id in (select public.my_schools()) and public.manage_structure(school_id));

create policy terms_select on public.terms for select to authenticated
  using (school_id in (select public.my_schools()));
create policy terms_write on public.terms for all to authenticated
  using (school_id in (select public.my_schools()) and public.manage_structure(school_id))
  with check (school_id in (select public.my_schools()) and public.manage_structure(school_id));

create policy levels_select on public.education_levels for select to authenticated
  using (school_id in (select public.my_schools()));
create policy levels_write on public.education_levels for all to authenticated
  using (school_id in (select public.my_schools()) and public.manage_structure(school_id))
  with check (school_id in (select public.my_schools()) and public.manage_structure(school_id));

create policy subjects_select on public.subjects for select to authenticated
  using (school_id in (select public.my_schools()));
create policy subjects_write on public.subjects for all to authenticated
  using (school_id in (select public.my_schools()) and public.manage_structure(school_id))
  with check (school_id in (select public.my_schools()) and public.manage_structure(school_id));

create policy teachers_select on public.teachers for select to authenticated
  using (school_id in (select public.my_schools()));
create policy teachers_write on public.teachers for all to authenticated
  using (school_id in (select public.my_schools()) and public.manage_structure(school_id))
  with check (school_id in (select public.my_schools()) and public.manage_structure(school_id));

create policy teacher_subjects_select on public.teacher_subjects for select to authenticated
  using (school_id in (select public.my_schools()));
create policy teacher_subjects_write on public.teacher_subjects for all to authenticated
  using (school_id in (select public.my_schools()) and public.manage_structure(school_id))
  with check (school_id in (select public.my_schools()) and public.manage_structure(school_id));

create policy class_subjects_select on public.class_subjects for select to authenticated
  using (school_id in (select public.my_schools()));
create policy class_subjects_write on public.class_subjects for all to authenticated
  using (school_id in (select public.my_schools()) and public.manage_structure(school_id))
  with check (school_id in (select public.my_schools()) and public.manage_structure(school_id));

-- Classes : visibles selon le cycle (ou si l'on y enseigne) ; écriture dans le cycle du niveau.
create policy classes_select on public.classes for select to authenticated
  using (school_id in (select public.my_schools()) and public.sees_class(school_id, id));
create policy classes_write on public.classes for all to authenticated
  using (school_id in (select public.my_schools()) and public.manage_structure(school_id)
         and public.sees_class(school_id, id))
  with check (school_id in (select public.my_schools()) and public.manage_structure(school_id)
              and public.cycle_scope_ok(school_id, public.level_cycle(school_id, level_id)));

-- ---------- Élèves et familles ----------
create policy students_select on public.students for select to authenticated
  using (school_id in (select public.my_schools()) and public.sees_class(school_id, class_id));
create policy students_insert on public.students for insert to authenticated
  with check (school_id in (select public.my_schools()) and public.can_enroll(school_id)
              and public.sees_class(school_id, class_id));
create policy students_update on public.students for update to authenticated
  using (school_id in (select public.my_schools()) and public.can_enroll(school_id)
         and public.sees_class(school_id, class_id))
  with check (school_id in (select public.my_schools()) and public.can_enroll(school_id)
              and public.sees_class(school_id, class_id));
create policy students_delete on public.students for delete to authenticated
  using (school_id in (select public.my_schools()) and public.is_founder(school_id));

create policy parents_select on public.parents for select to authenticated
  using (school_id in (select public.my_schools()) and public.sees_parent(school_id, id));
create policy parents_write on public.parents for all to authenticated
  using (school_id in (select public.my_schools()) and public.can_enroll(school_id) and public.sees_parent(school_id, id))
  with check (school_id in (select public.my_schools()) and public.can_enroll(school_id));

create policy student_parents_select on public.student_parents for select to authenticated
  using (school_id in (select public.my_schools()) and public.can_enroll(school_id)
         and public.sees_student(school_id, student_id));
create policy student_parents_write on public.student_parents for all to authenticated
  using (school_id in (select public.my_schools()) and public.can_enroll(school_id)
         and public.sees_student(school_id, student_id))
  with check (school_id in (select public.my_schools()) and public.can_enroll(school_id)
              and public.sees_student(school_id, student_id));

-- ---------- Notes (secondary) : la Secrétaire est exclue ----------
create policy evaluations_select on public.evaluations for select to authenticated
  using (school_id in (select public.my_schools())
         and (public.acad_admin_class(school_id, class_id) or public.teaches_subject(school_id, class_id, subject_id)));
create policy evaluations_write on public.evaluations for all to authenticated
  using (school_id in (select public.my_schools())
         and (public.acad_admin_class(school_id, class_id) or public.teaches_subject(school_id, class_id, subject_id)))
  with check (school_id in (select public.my_schools())
              and (public.acad_admin_class(school_id, class_id) or public.teaches_subject(school_id, class_id, subject_id)));

create policy grades_select on public.grades for select to authenticated
  using (school_id in (select public.my_schools()) and public.eval_ok(school_id, evaluation_id));
create policy grades_write on public.grades for all to authenticated
  using (school_id in (select public.my_schools()) and public.eval_ok(school_id, evaluation_id))
  with check (school_id in (select public.my_schools()) and public.eval_ok(school_id, evaluation_id));

create policy report_cards_select on public.report_cards for select to authenticated
  using (school_id in (select public.my_schools())
         and (public.acad_admin_student(school_id, student_id) or public.teaches_student(school_id, student_id)));
create policy report_cards_write on public.report_cards for all to authenticated
  using (school_id in (select public.my_schools()) and public.is_founder(school_id))
  with check (school_id in (select public.my_schools()) and public.is_founder(school_id));

create policy bulletin_notes_select on public.bulletin_notes for select to authenticated
  using (school_id in (select public.my_schools())
         and (public.acad_admin_student(school_id, student_id)
              or public.teaches_student_subject(school_id, student_id, subject_id)));
create policy bulletin_notes_write on public.bulletin_notes for all to authenticated
  using (school_id in (select public.my_schools())
         and (public.acad_admin_student(school_id, student_id)
              or public.teaches_student_subject(school_id, student_id, subject_id)))
  with check (school_id in (select public.my_schools())
              and (public.acad_admin_student(school_id, student_id)
                   or public.teaches_student_subject(school_id, student_id, subject_id)));

create policy bulletin_remarks_select on public.bulletin_remarks for select to authenticated
  using (school_id in (select public.my_schools())
         and (public.acad_admin_student(school_id, student_id) or public.is_main_teacher(school_id, student_id)));
create policy bulletin_remarks_write on public.bulletin_remarks for all to authenticated
  using (school_id in (select public.my_schools())
         and (public.acad_admin_student(school_id, student_id) or public.is_main_teacher(school_id, student_id)))
  with check (school_id in (select public.my_schools())
              and (public.acad_admin_student(school_id, student_id) or public.is_main_teacher(school_id, student_id)));

-- ---------- Notes (primary) ----------
create policy primary_subjects_select on public.primary_subjects for select to authenticated
  using (school_id in (select public.my_schools()));
create policy primary_subjects_write on public.primary_subjects for all to authenticated
  using (school_id in (select public.my_schools()) and public.manage_structure(school_id))
  with check (school_id in (select public.my_schools()) and public.manage_structure(school_id));

create policy primary_scores_select on public.primary_scores for select to authenticated
  using (school_id in (select public.my_schools()) and public.primary_ok(school_id, student_id, false));
create policy primary_scores_write on public.primary_scores for all to authenticated
  using (school_id in (select public.my_schools()) and public.primary_ok(school_id, student_id, true))
  with check (school_id in (select public.my_schools()) and public.primary_ok(school_id, student_id, true));

-- ---------- Absences : la Secrétaire est exclue ----------
create policy attendance_select on public.attendance for select to authenticated
  using (school_id in (select public.my_schools()) and public.att_ok(school_id, student_id));
create policy attendance_write on public.attendance for all to authenticated
  using (school_id in (select public.my_schools()) and public.att_ok(school_id, student_id))
  with check (school_id in (select public.my_schools()) and public.att_ok(school_id, student_id));

-- ---------- Finances ----------
-- Lecture : Fondateur, Secrétaire (si activé), Directeur (élèves de ses cycles).
-- Écriture : Fondateur, Secrétaire (si activé). Suppression de paiement : Fondateur seul.
create policy school_fees_select on public.school_fees for select to authenticated
  using (school_id in (select public.my_schools()) and public.finance_viewer(school_id)
         and (level_id is null or public.cycle_scope_ok(school_id, public.level_cycle(school_id, level_id))));
create policy school_fees_write on public.school_fees for all to authenticated
  using (school_id in (select public.my_schools()) and public.finance_editor(school_id))
  with check (school_id in (select public.my_schools()) and public.finance_editor(school_id));

create policy student_fees_select on public.student_fees for select to authenticated
  using (school_id in (select public.my_schools()) and public.finance_viewer(school_id)
         and public.sees_student(school_id, student_id));
create policy student_fees_write on public.student_fees for all to authenticated
  using (school_id in (select public.my_schools()) and public.finance_editor(school_id)
         and public.sees_student(school_id, student_id))
  with check (school_id in (select public.my_schools()) and public.finance_editor(school_id)
              and public.sees_student(school_id, student_id));

create policy fee_payments_select on public.fee_payments for select to authenticated
  using (school_id in (select public.my_schools()) and public.finance_viewer(school_id)
         and public.sees_student(school_id, student_id));
create policy fee_payments_insert on public.fee_payments for insert to authenticated
  with check (school_id in (select public.my_schools()) and public.finance_editor(school_id)
              and public.sees_student(school_id, student_id));
create policy fee_payments_update on public.fee_payments for update to authenticated
  using (school_id in (select public.my_schools()) and public.finance_editor(school_id)
         and public.sees_student(school_id, student_id))
  with check (school_id in (select public.my_schools()) and public.finance_editor(school_id)
              and public.sees_student(school_id, student_id));
create policy fee_payments_delete on public.fee_payments for delete to authenticated
  using (school_id in (select public.my_schools()) and public.is_founder(school_id));

-- Ajustements : lecture seule en direct ; les écritures passent par les fonctions add/remove_fee_adjustment.
create policy fee_adjustments_select on public.fee_adjustments for select to authenticated
  using (school_id in (select public.my_schools()) and public.finance_viewer(school_id)
         and public.sees_student(school_id, student_id));
create policy fee_adjustment_effects_select on public.fee_adjustment_effects for select to authenticated
  using (school_id in (select public.my_schools()) and public.finance_viewer(school_id)
         and public.adjustment_student_ok(school_id, adjustment_id));

create policy payment_deletions_select on public.payment_deletions for select to authenticated
  using (school_id in (select public.my_schools()) and public.is_founder(school_id));
create policy payment_deletions_insert on public.payment_deletions for insert to authenticated
  with check (school_id in (select public.my_schools()) and public.is_founder(school_id));

-- Dépenses : propres à l'école, pas liées à un cycle → Fondateur (et Secrétaire si activé).
create policy expenses_select on public.expenses for select to authenticated
  using (school_id in (select public.my_schools()) and public.finance_editor(school_id));
create policy expenses_write on public.expenses for all to authenticated
  using (school_id in (select public.my_schools()) and public.finance_editor(school_id))
  with check (school_id in (select public.my_schools()) and public.finance_editor(school_id));

create policy incomes_select on public.incomes for select to authenticated
  using (school_id in (select public.my_schools())
         and (public.finance_editor(school_id)
              or (public.finance_viewer(school_id) and student_id is not null
                  and public.sees_student(school_id, student_id))));
create policy incomes_write on public.incomes for all to authenticated
  using (school_id in (select public.my_schools()) and public.finance_editor(school_id))
  with check (school_id in (select public.my_schools()) and public.finance_editor(school_id));

create policy tontine_select on public.tontine_deposits for select to authenticated
  using (school_id in (select public.my_schools()) and public.finance_viewer(school_id)
         and public.sees_student(school_id, student_id));
create policy tontine_write on public.tontine_deposits for all to authenticated
  using (school_id in (select public.my_schools()) and public.finance_editor(school_id)
         and public.sees_student(school_id, student_id))
  with check (school_id in (select public.my_schools()) and public.finance_editor(school_id)
              and public.sees_student(school_id, student_id));

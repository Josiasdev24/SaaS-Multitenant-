-- =====================================================================
-- 0003 — FONCTIONS D'ACCÈS ET DÉCLENCHEURS DE SÉCURITÉ
-- Toutes prennent l'école (sid) en paramètre : rien n'est « global ».
-- Toutes sont SECURITY DEFINER avec search_path vide (noms qualifiés).
-- =====================================================================

-- ---------- Cycles ----------
create function public.level_cycle(sid uuid, lid uuid) returns uuid
language sql stable security definer set search_path = '' as $$
  select l.cycle_id from public.education_levels l
  where l.school_id = sid and l.id = lid and sid in (select public.my_schools());
$$;

create function public.class_cycle(sid uuid, cid uuid) returns uuid
language sql stable security definer set search_path = '' as $$
  select l.cycle_id
  from public.classes c
  join public.education_levels l on l.school_id = c.school_id and l.id = c.level_id
  where c.school_id = sid and c.id = cid and sid in (select public.my_schools());
$$;

-- L'utilisateur a-t-il accès au cycle donné dans cette école ?
--   Fondateur, Secrétaire : tous les cycles.
--   Directeur : ses cycles ; s'il n'en a aucun d'assigné, tous (directeur général).
--   Primaire : uniquement ses cycles assignés.
--   Enseignant surveillant : uniquement ses cycles assignés.
create function public.cycle_scope_ok(sid uuid, cyc uuid) returns boolean
language plpgsql stable security definer set search_path = '' as $$
declare
  r public.school_role; mid uuid; sup boolean; has_scope boolean; hit boolean;
begin
  select m.role, m.id, m.is_supervisor into r, mid, sup
  from public.school_members m
  join public.schools s on s.id = m.school_id
  where m.school_id = sid and m.user_id = auth.uid() and m.status = 'active' and s.status = 'active';
  if r is null then return false; end if;
  if r in ('founder', 'secretary') then return true; end if;
  if cyc is null then return r = 'director'; end if;
  select exists (select 1 from public.member_cycles where member_id = mid),
         exists (select 1 from public.member_cycles where member_id = mid and cycle_id = cyc)
    into has_scope, hit;
  if r = 'director' then return (not has_scope) or hit; end if;
  if r = 'primary'  then return hit; end if;
  if r = 'teacher'  then return sup and hit; end if;
  return false;
end $$;

-- ---------- Enseignant ----------
create function public.my_teacher_id(sid uuid) returns uuid
language sql stable security definer set search_path = '' as $$
  select m.teacher_id from public.school_members m
  join public.schools s on s.id = m.school_id
  where m.school_id = sid and m.user_id = auth.uid() and m.status = 'active' and s.status = 'active'
  limit 1;
$$;

create function public.teaches_class(sid uuid, cid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(
    exists (select 1 from public.classes c
            where c.school_id = sid and c.id = cid and c.main_teacher_id = public.my_teacher_id(sid))
    or exists (select 1 from public.class_subjects cs
               where cs.school_id = sid and cs.class_id = cid and cs.teacher_id = public.my_teacher_id(sid)),
    false);
$$;

create function public.teaches_subject(sid uuid, cid uuid, subj uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(exists (select 1 from public.class_subjects cs
          where cs.school_id = sid and cs.class_id = cid and cs.subject_id = subj
            and cs.teacher_id = public.my_teacher_id(sid)), false);
$$;

-- ---------- Visibilité des classes et des élèves ----------
create function public.sees_class(sid uuid, cid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select case
    when public.role_in(sid) is null then false
    when cid is null then public.role_in(sid) in ('founder', 'secretary', 'director')
    else public.cycle_scope_ok(sid, public.class_cycle(sid, cid)) or public.teaches_class(sid, cid)
  end;
$$;

create function public.sees_student(sid uuid, stid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select public.sees_class(sid, s.class_id)
                   from public.students s where s.school_id = sid and s.id = stid), false);
$$;

create function public.teaches_student(sid uuid, stid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select public.teaches_class(sid, s.class_id)
                   from public.students s where s.school_id = sid and s.id = stid), false);
$$;

create function public.teaches_student_subject(sid uuid, stid uuid, subj uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select public.teaches_subject(sid, s.class_id, subj)
                   from public.students s where s.school_id = sid and s.id = stid), false);
$$;

create function public.is_main_teacher(sid uuid, stid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select exists (select 1 from public.classes c
                                  where c.school_id = sid and c.id = s.class_id
                                    and c.main_teacher_id = public.my_teacher_id(sid))
                   from public.students s where s.school_id = sid and s.id = stid), false);
$$;

create function public.sees_parent(sid uuid, pid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select case public.role_in(sid)
    when 'founder'   then true
    when 'secretary' then true
    when 'director'  then
      not exists (select 1 from public.student_parents sp where sp.school_id = sid and sp.parent_id = pid)
      or exists (select 1 from public.student_parents sp
                 where sp.school_id = sid and sp.parent_id = pid and public.sees_student(sid, sp.student_id))
    else false
  end;
$$;

-- ---------- Rôles fonctionnels ----------
create function public.manage_structure(sid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(public.role_in(sid) in ('founder', 'director'), false);
$$;

create function public.can_enroll(sid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(public.role_in(sid) in ('founder', 'secretary', 'director'), false);
$$;

-- Type d'élève (nouveau/ancien) et régimes d'écolage : Fondateur et Directeur seulement.
create function public.can_edit_sensitive(sid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(public.role_in(sid) in ('founder', 'director'), false);
$$;

-- Finances : le Fondateur toujours ; la Secrétaire seulement si l'école a activé secretary_can_collect.
create function public.finance_editor(sid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(public.role_in(sid) = 'founder', false)
      or (coalesce(public.role_in(sid) = 'secretary', false)
          and coalesce((select s.secretary_can_collect from public.schools s where s.id = sid), false));
$$;

-- Lecture des finances : éditeurs + Directeur (limité aux élèves de ses cycles par les politiques).
create function public.finance_viewer(sid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.finance_editor(sid) or coalesce(public.role_in(sid) = 'director', false);
$$;

-- ---------- Notes ----------
create function public.acad_admin_class(sid uuid, cid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(public.role_in(sid) in ('founder', 'director'), false) and public.sees_class(sid, cid);
$$;

create function public.acad_admin_student(sid uuid, stid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(public.role_in(sid) in ('founder', 'director'), false) and public.sees_student(sid, stid);
$$;

create function public.eval_ok(sid uuid, eid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select public.acad_admin_class(sid, e.class_id) or public.teaches_subject(sid, e.class_id, e.subject_id)
                   from public.evaluations e where e.school_id = sid and e.id = eid), false);
$$;

create function public.att_ok(sid uuid, stid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.acad_admin_student(sid, stid)
      or public.teaches_student(sid, stid)
      or (public.is_supervisor(sid) and public.sees_student(sid, stid));
$$;

create function public.primary_ok(sid uuid, stid uuid, write_access boolean) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.sees_student(sid, stid)
     and (coalesce(public.role_in(sid) in ('founder', 'director', 'primary'), false)
          or (not write_access and coalesce(public.role_in(sid) = 'secretary', false)));
$$;

create function public.adjustment_student_ok(sid uuid, adj uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select public.sees_student(sid, a.student_id)
                   from public.fee_adjustments a where a.school_id = sid and a.id = adj), false);
$$;

-- ---------- Déclencheurs ----------
-- Type d'élève et régimes : seuls Fondateur et Directeur peuvent les changer.
-- (À la création d'un élève, la Secrétaire peut indiquer nouveau/ancien, mais pas de régime.)
-- Sans utilisateur (migrations, import serveur avec clé de service) : autorisé.
create function public.students_guard() returns trigger
language plpgsql set search_path = '' as $$
begin
  if auth.uid() is null or public.can_edit_sensitive(new.school_id) then
    return new;
  end if;
  if tg_op = 'INSERT' then
    if new.fee_status <> 'normal' or new.fee_discount <> 0 or new.fee_note is not null then
      raise exception 'Seuls le Fondateur et le Directeur peuvent définir un régime d''écolage';
    end if;
  else
    if new.student_type is distinct from old.student_type
       or new.fee_status is distinct from old.fee_status
       or new.fee_discount is distinct from old.fee_discount
       or new.fee_note is distinct from old.fee_note then
      raise exception 'Seuls le Fondateur et le Directeur peuvent modifier le type d''élève ou le régime';
    end if;
  end if;
  return new;
end $$;
create trigger trg_students_guard before insert or update on public.students
  for each row execute function public.students_guard();

-- Une note du primaire ne dépasse pas le maximum de la matière.
create function public.primary_score_within_max() returns trigger
language plpgsql security definer set search_path = '' as $$
declare mx numeric;
begin
  if new.score is not null then
    select max_points into mx from public.primary_subjects
    where school_id = new.school_id and id = new.subject_id;
    if mx is not null and new.score > mx then
      raise exception 'La note dépasse le maximum de la matière (%)', mx;
    end if;
  end if;
  return new;
end $$;
create trigger trg_primary_scores_max before insert or update on public.primary_scores
  for each row execute function public.primary_score_within_max();

-- Un versement de tontine déjà appliqué ne se supprime pas à la main.
create function public.tontine_no_delete_settled() returns trigger
language plpgsql set search_path = '' as $$
begin
  if old.settled_at is not null and pg_trigger_depth() = 1 then
    raise exception 'Ce versement a déjà été appliqué à l''écolage';
  end if;
  return old;
end $$;
create trigger trg_tontine_no_delete before delete on public.tontine_deposits
  for each row execute function public.tontine_no_delete_settled();

-- Journal : suppression de paiements et d'élèves.
create trigger audit_payment_delete after delete on public.fee_payments
  for each row execute function public.audit_row();
create trigger audit_student_delete after delete on public.students
  for each row execute function public.audit_row();

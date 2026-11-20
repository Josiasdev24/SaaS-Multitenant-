-- =====================================================================
-- 0005 — FONCTIONS MÉTIER (RPC), ADMINISTRATION, STOCKAGE, DROITS
-- Chaque RPC déduit l'école À PARTIR DE LA LIGNE visée (jamais d'un
-- paramètre fourni par le client) puis vérifie rôle et périmètre.
-- =====================================================================

-- ---------- Affectation des frais à un élève ----------
create function public.assign_student_fees(_student_id uuid, _include_inscription boolean default true)
returns integer
language plpgsql security definer set search_path = '' as $$
declare sid uuid; n integer;
begin
  select school_id into sid from public.students where id = _student_id;
  if sid is null or not public.can_enroll(sid) or not public.sees_student(sid, _student_id) then
    raise exception 'Accès refusé';
  end if;

  insert into public.student_fees (school_id, student_id, school_fee_id, amount_due, due_date)
  select s.school_id, s.id, f.id, f.amount, f.due_date
  from public.students s
  join public.classes c on c.school_id = s.school_id and c.id = s.class_id
  join public.school_fees f on f.school_id = s.school_id
                           and f.level_id = c.level_id
                           and f.academic_year_id = s.academic_year_id
  where s.id = _student_id
    and (_include_inscription or f.kind::text <> 'inscription')
    and not exists (select 1 from public.student_fees sf
                    where sf.student_id = s.id and sf.school_fee_id = f.id);
  get diagnostics n = row_count;
  return n;
end $$;

-- ---------- Ajustements d'écolage (réduction familiale, bourse, arriéré) ----------
create function public.add_fee_adjustment(_student_id uuid, _kind text, _amount numeric, _label text default null)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  sid uuid; adj_id uuid; remaining numeric := _amount; cut numeric; rec record;
  v_level uuid; v_year uuid; arrears_fee uuid; existing uuid; new_sf uuid;
begin
  select school_id into sid from public.students where id = _student_id;
  if sid is null or not public.finance_editor(sid) or not public.sees_student(sid, _student_id) then
    raise exception 'Accès refusé';
  end if;
  if _kind not in ('reduction_familiale', 'bourse', 'arriere') then
    raise exception 'Type d''ajustement invalide';
  end if;
  if _amount is null or _amount <= 0 then
    raise exception 'Le montant doit être supérieur à 0';
  end if;

  if _kind = 'arriere' then
    select c.level_id, s.academic_year_id into v_level, v_year
    from public.students s join public.classes c on c.school_id = s.school_id and c.id = s.class_id
    where s.id = _student_id;
    if v_level is null then
      raise exception 'Cet élève n''est affecté à aucune classe';
    end if;

    select f.id into arrears_fee from public.school_fees f
    where f.school_id = sid and f.level_id = v_level and f.academic_year_id = v_year
      and f.kind::text = 'autre' and f.name = 'Arriérés'
    limit 1;
    if arrears_fee is null then
      insert into public.school_fees (school_id, academic_year_id, level_id, name, kind, amount, due_date, order_index)
      values (sid, v_year, v_level, 'Arriérés', 'autre', 0, current_date, 99)
      returning id into arrears_fee;
    end if;

    insert into public.fee_adjustments (school_id, student_id, kind, amount, label, created_by)
    values (sid, _student_id, _kind, _amount, nullif(btrim(_label), ''), auth.uid())
    returning id into adj_id;

    select id into existing from public.student_fees
    where student_id = _student_id and school_fee_id = arrears_fee;

    if existing is null then
      insert into public.student_fees (school_id, student_id, school_fee_id, amount_due, due_date)
      values (sid, _student_id, arrears_fee, _amount, current_date) returning id into new_sf;
      insert into public.fee_adjustment_effects (school_id, adjustment_id, student_fee_id, delta, created_row)
      values (sid, adj_id, new_sf, _amount, true);
    else
      update public.student_fees set amount_due = amount_due + _amount where id = existing;
      insert into public.fee_adjustment_effects (school_id, adjustment_id, student_fee_id, delta, created_row)
      values (sid, adj_id, existing, _amount, false);
    end if;
  else
    if (select coalesce(sum(sf.amount_due), 0)
        from public.student_fees sf join public.school_fees f on f.id = sf.school_fee_id
        where sf.student_id = _student_id and f.kind::text = 'tranche') < _amount then
      raise exception 'Le montant dépasse l''écolage restant de cet élève';
    end if;

    insert into public.fee_adjustments (school_id, student_id, kind, amount, label, created_by)
    values (sid, _student_id, _kind, _amount, nullif(btrim(_label), ''), auth.uid())
    returning id into adj_id;

    for rec in
      select sf.id, sf.amount_due
      from public.student_fees sf join public.school_fees f on f.id = sf.school_fee_id
      where sf.student_id = _student_id and f.kind::text = 'tranche' and sf.amount_due > 0
      order by f.order_index desc
    loop
      exit when remaining <= 0;
      cut := least(rec.amount_due, remaining);
      update public.student_fees set amount_due = amount_due - cut where id = rec.id;
      insert into public.fee_adjustment_effects (school_id, adjustment_id, student_fee_id, delta, created_row)
      values (sid, adj_id, rec.id, -cut, false);
      remaining := remaining - cut;
    end loop;
  end if;
  return adj_id;
end $$;

create function public.remove_fee_adjustment(_adjustment_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare sid uuid; stid uuid; e record;
begin
  select school_id, student_id into sid, stid from public.fee_adjustments where id = _adjustment_id;
  if sid is null or not public.finance_editor(sid) or not public.sees_student(sid, stid) then
    raise exception 'Accès refusé';
  end if;

  for e in select * from public.fee_adjustment_effects where adjustment_id = _adjustment_id and school_id = sid loop
    update public.student_fees set amount_due = greatest(amount_due - e.delta, 0)
    where id = e.student_fee_id and school_id = sid;
    if e.created_row then
      delete from public.student_fees where id = e.student_fee_id and school_id = sid and amount_due = 0;
    end if;
  end loop;
  delete from public.fee_adjustments where id = _adjustment_id and school_id = sid;
end $$;

-- ---------- Tontine ----------
create function public.settle_tontine(_student_id uuid, _month date) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  sid uuid;
  v_start date := date_trunc('month', _month)::date;
  v_end   date := (date_trunc('month', _month) + interval '1 month')::date;
  v_total numeric; v_paid_at date; v_payment uuid;
begin
  select school_id into sid from public.students where id = _student_id;
  if sid is null or not public.finance_editor(sid) or not public.sees_student(sid, _student_id) then
    raise exception 'Accès refusé';
  end if;

  select coalesce(sum(amount), 0) into v_total from public.tontine_deposits
  where school_id = sid and student_id = _student_id and settled_at is null
    and deposit_date >= v_start and deposit_date < v_end;
  if v_total <= 0 then
    raise exception 'Aucun versement à appliquer pour ce mois';
  end if;

  v_paid_at := least(current_date, v_end - 1);
  insert into public.fee_payments (school_id, student_id, amount, paid_at, method, note, recorded_by)
  values (sid, _student_id, v_total, v_paid_at, 'tontine', 'Tontine ' || to_char(v_start, 'MM/YYYY'), auth.uid())
  returning id into v_payment;

  update public.tontine_deposits set settled_at = now()
  where school_id = sid and student_id = _student_id and settled_at is null
    and deposit_date >= v_start and deposit_date < v_end;
  return v_payment;
end $$;

-- NOUVEAU : prend l'école en paramètre (l'ancienne version n'avait pas de notion d'école).
create function public.settle_tontine_month(_school_id uuid, _month date) returns integer
language plpgsql security definer set search_path = '' as $$
declare
  v_start date := date_trunc('month', _month)::date;
  v_end   date := (date_trunc('month', _month) + interval '1 month')::date;
  rec record; n integer := 0;
begin
  if not public.finance_editor(_school_id) then
    raise exception 'Accès refusé';
  end if;
  for rec in
    select distinct student_id from public.tontine_deposits
    where school_id = _school_id and settled_at is null and deposit_date >= v_start and deposit_date < v_end
  loop
    perform public.settle_tontine(rec.student_id, _month);
    n := n + 1;
  end loop;
  return n;
end $$;

-- ---------- Administration (super-administrateur uniquement) ----------
create function public.create_school(p_name text, p_slug text, p_cycles jsonb default null)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare sid uuid; c jsonb; i int := 0;
begin
  if not public.is_super_admin() then raise exception 'Accès refusé'; end if;
  insert into public.schools (name, slug) values (btrim(p_name), lower(btrim(p_slug))) returning id into sid;

  if p_cycles is null then
    p_cycles := '[{"code":"jardin","name":"Jardin","grading_system":"primary"},
                  {"code":"primaire","name":"Primaire","grading_system":"primary"},
                  {"code":"college","name":"Collège","grading_system":"secondary"},
                  {"code":"lycee","name":"Lycée","grading_system":"secondary"}]'::jsonb;
  end if;
  for c in select * from jsonb_array_elements(p_cycles) loop
    i := i + 1;
    insert into public.school_cycles (school_id, code, name, order_index, grading_system)
    values (sid, c ->> 'code', c ->> 'name', i, coalesce(c ->> 'grading_system', 'secondary'));
  end loop;

  insert into public.audit_log (school_id, actor, action, entity, entity_id, details)
  values (sid, auth.uid(), 'CREATE_SCHOOL', 'schools', sid, jsonb_build_object('name', p_name, 'slug', p_slug));
  return sid;
end $$;

-- Rattache un compte EXISTANT à une école, avec un rôle et des cycles.
-- (La création du compte lui-même, avec mot de passe, se fait côté serveur avec la clé de service.)
create function public.admin_add_member(
  p_school uuid, p_user uuid, p_role public.school_role,
  p_cycle_codes text[] default '{}', p_teacher uuid default null, p_supervisor boolean default false)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare mid uuid; v_code text; cid uuid;
begin
  if not public.is_super_admin() then raise exception 'Accès refusé'; end if;
  insert into public.school_members (school_id, user_id, role, teacher_id, is_supervisor)
  values (p_school, p_user, p_role, p_teacher, p_supervisor)
  on conflict (school_id, user_id)
  do update set role = excluded.role, teacher_id = excluded.teacher_id,
                is_supervisor = excluded.is_supervisor, status = 'active'
  returning id into mid;

  delete from public.member_cycles where member_id = mid;
  foreach v_code in array coalesce(p_cycle_codes, '{}') loop
    select id into cid from public.school_cycles where school_id = p_school and school_cycles.code = v_code;
    if cid is null then raise exception 'Cycle inconnu : %', v_code; end if;
    insert into public.member_cycles (member_id, school_id, cycle_id) values (mid, p_school, cid);
  end loop;
  return mid;
end $$;

create function public.admin_set_school_status(p_school uuid, p_status text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_super_admin() then raise exception 'Accès refusé'; end if;
  if p_status not in ('active', 'suspended') then raise exception 'Statut invalide'; end if;
  update public.schools set status = p_status where id = p_school;
end $$;

-- ---------- Stockage ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('student-photos', 'student-photos', false, 2097152, array['image/jpeg', 'image/png', 'image/webp']),
  ('school-logos',   'school-logos',   false, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

-- Convertit un texte en uuid, ou renvoie null (jamais d'erreur).
create function public.try_uuid(t text) returns uuid
language plpgsql immutable set search_path = '' as $$
begin
  return t::uuid;
exception when others then
  return null;
end $$;

-- Photos : <school_id>/<student_id>/<fichier>. Lecture = droit de voir l'élève (sa RLS s'applique).
create policy photos_read on storage.objects for select to authenticated
  using (bucket_id = 'student-photos'
         and public.try_uuid((storage.foldername(name))[1]) in (select public.my_schools())
         and exists (select 1 from public.students s
                     where s.school_id = public.try_uuid((storage.foldername(name))[1])
                       and s.id = public.try_uuid((storage.foldername(name))[2])));
create policy photos_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'student-photos'
         and public.try_uuid((storage.foldername(name))[1]) in (select public.my_schools())
         and public.can_enroll(public.try_uuid((storage.foldername(name))[1]))
         and exists (select 1 from public.students s
                     where s.school_id = public.try_uuid((storage.foldername(name))[1])
                       and s.id = public.try_uuid((storage.foldername(name))[2])));
create policy photos_update on storage.objects for update to authenticated
  using (bucket_id = 'student-photos'
         and public.try_uuid((storage.foldername(name))[1]) in (select public.my_schools())
         and public.can_enroll(public.try_uuid((storage.foldername(name))[1])))
  with check (bucket_id = 'student-photos'
         and public.try_uuid((storage.foldername(name))[1]) in (select public.my_schools())
         and public.can_enroll(public.try_uuid((storage.foldername(name))[1])));
create policy photos_delete on storage.objects for delete to authenticated
  using (bucket_id = 'student-photos'
         and public.try_uuid((storage.foldername(name))[1]) in (select public.my_schools())
         and public.can_enroll(public.try_uuid((storage.foldername(name))[1])));

-- Logos : <school_id>/<fichier>. Lecture : membres de l'école. Écriture : Fondateur.
create policy logos_read on storage.objects for select to authenticated
  using (bucket_id = 'school-logos'
         and public.try_uuid((storage.foldername(name))[1]) in (select public.my_schools()));
create policy logos_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'school-logos' and public.is_founder(public.try_uuid((storage.foldername(name))[1])));
create policy logos_update on storage.objects for update to authenticated
  using (bucket_id = 'school-logos' and public.is_founder(public.try_uuid((storage.foldername(name))[1])))
  with check (bucket_id = 'school-logos' and public.is_founder(public.try_uuid((storage.foldername(name))[1])));
create policy logos_delete on storage.objects for delete to authenticated
  using (bucket_id = 'school-logos' and public.is_founder(public.try_uuid((storage.foldername(name))[1])));

-- ---------- Droits d'accès (défense en profondeur, en plus de la RLS) ----------
-- Personne sans connexion (anon) n'a aucun accès aux tables ni aux fonctions.
revoke all on all tables    in schema public from anon;
revoke all on all sequences in schema public from anon;
revoke all on all functions in schema public from public, anon;
alter default privileges in schema public revoke all on tables    from anon;
alter default privileges in schema public revoke all on functions from public, anon;

grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant execute on all functions in schema public to authenticated;

-- Tables à droits réduits.
revoke all on public.super_admins from authenticated;
revoke all on public.audit_log from authenticated;
grant select on public.audit_log to authenticated;

revoke insert, update, delete on public.schools from authenticated;   -- création via create_school()
grant update (name, short_name, logo_path, address, city, phone, email, country, currency,
              primary_color, accent_color, header_lines, absence_threshold,
              current_academic_year_id, secretary_can_collect, settings)
  on public.schools to authenticated;

revoke insert, update, delete on public.profiles from authenticated;
grant update (full_name) on public.profiles to authenticated;

-- Les fonctions create_school / admin_add_member / admin_set_school_status sont appelables
-- par tout compte connecté mais refusent (« Accès refusé ») tout autre que le super-administrateur.

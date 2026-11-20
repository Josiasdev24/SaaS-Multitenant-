-- =====================================================================
-- 0008 — ÉCRAN SUPER-ADMINISTRATEUR
-- Lecture de la liste des écoles et de leurs comptes (jamais des élèves,
-- notes ou paiements). Réservé au super-administrateur.
-- =====================================================================

create function public.admin_list_schools()
returns table (id uuid, slug text, name text, city text, status text, created_at timestamptz, members bigint)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_super_admin() then raise exception 'Accès refusé'; end if;
  return query
    select s.id, s.slug, s.name, s.city, s.status, s.created_at,
           (select count(*) from public.school_members m where m.school_id = s.id)
    from public.schools s order by s.name;
end $$;

create function public.admin_list_members(p_school uuid)
returns table (user_id uuid, email text, full_name text, role public.school_role,
               status text, is_supervisor boolean, cycles text[])
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_super_admin() then raise exception 'Accès refusé'; end if;
  return query
    select m.user_id, p.email, p.full_name, m.role, m.status, m.is_supervisor,
           coalesce((select array_agg(c.code order by c.order_index)
                     from public.member_cycles mc
                     join public.school_cycles c on c.school_id = mc.school_id and c.id = mc.cycle_id
                     where mc.member_id = m.id), '{}')
    from public.school_members m
    left join public.profiles p on p.id = m.user_id
    where m.school_id = p_school
    order by m.role, p.full_name;
end $$;

create function public.admin_set_member_status(p_school uuid, p_user uuid, p_status text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_super_admin() then raise exception 'Accès refusé'; end if;
  if p_status not in ('active', 'disabled') then raise exception 'Statut invalide'; end if;
  update public.school_members set status = p_status where school_id = p_school and user_id = p_user;
end $$;

revoke all on function public.admin_list_schools()                         from public, anon;
revoke all on function public.admin_list_members(uuid)                     from public, anon;
revoke all on function public.admin_set_member_status(uuid, uuid, text)    from public, anon;
grant execute on function public.admin_list_schools()                      to authenticated;
grant execute on function public.admin_list_members(uuid)                  to authenticated;
grant execute on function public.admin_set_member_status(uuid, uuid, text) to authenticated;

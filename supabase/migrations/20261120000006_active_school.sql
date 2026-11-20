-- =====================================================================
-- 0006 — ÉCOLE ACTIVE
-- L'application envoie l'école choisie dans l'en-tête « x-school-id ».
--   * Un compte qui appartient à PLUSIEURS écoles ne voit que l'école active.
--   * Les insertions reçoivent school_id automatiquement (école active, ou
--     l'unique école du compte) : l'application n'a pas à le fournir partout.
-- L'en-tête ne peut JAMAIS donner accès à une école dont on n'est pas membre :
-- une école non autorisée donne simplement un résultat vide.
-- =====================================================================

-- Toutes les écoles dont l'utilisateur est membre actif (ancienne logique de my_schools).
create function public.member_schools() returns setof uuid
language sql stable security definer set search_path = '' as $$
  select m.school_id
  from public.school_members m
  join public.schools s on s.id = m.school_id
  where m.user_id = auth.uid() and m.status = 'active' and s.status = 'active';
$$;

-- Valeur brute de l'en-tête x-school-id (null s'il est absent).
create function public.requested_school_raw() returns text
language plpgsql stable set search_path = '' as $$
declare h text;
begin
  h := nullif(current_setting('request.headers', true), '');
  if h is null then return null; end if;
  return nullif(btrim((h::json) ->> 'x-school-id'), '');
exception when others then
  return null;
end $$;

-- Écoles accessibles pour CETTE requête :
--   en-tête présent  -> uniquement l'école demandée, si l'on en est membre (sinon rien) ;
--   en-tête absent   -> toutes les écoles du compte.
create or replace function public.my_schools() returns setof uuid
language plpgsql stable security definer set search_path = '' as $$
declare raw text; req uuid;
begin
  raw := public.requested_school_raw();
  if raw is null then
    return query select * from public.member_schools();
  else
    req := public.try_uuid(raw);
    if req is not null then
      return query select ms from public.member_schools() ms where ms = req;
    end if;
  end if;
end $$;

-- École par défaut des nouvelles lignes.
create function public.default_school_id() returns uuid
language plpgsql stable security definer set search_path = '' as $$
declare s uuid; n int;
begin
  select count(*) into n from public.my_schools();
  select x into s from public.my_schools() x limit 1;
  if n = 1 then return s; end if;
  if n = 0 then raise exception 'Aucune école active pour ce compte'; end if;
  raise exception 'Plusieurs écoles : choisissez l''école active';
end $$;

-- Droits d'exécution (comme les autres fonctions).
revoke all on function public.member_schools()        from public, anon;
revoke all on function public.requested_school_raw()  from public, anon;
revoke all on function public.default_school_id()     from public, anon;
grant execute on function public.member_schools()       to authenticated;
grant execute on function public.requested_school_raw() to authenticated;
grant execute on function public.default_school_id()    to authenticated;

-- my_memberships() continue de lister TOUTES les écoles du compte (sélecteur d'école).
create or replace function public.my_memberships()
returns table (school_id uuid, school_name text, slug text, role public.school_role,
               is_supervisor boolean, cycle_ids uuid[])
language sql stable security definer set search_path = '' as $$
  select s.id, s.name, s.slug, m.role, m.is_supervisor,
         coalesce((select array_agg(mc.cycle_id) from public.member_cycles mc where mc.member_id = m.id), '{}')
  from public.member_schools() ms
  join public.school_members m on m.school_id = ms and m.user_id = auth.uid()
  join public.schools s on s.id = ms
  order by s.name;
$$;

-- school_id se remplit tout seul sur les tables de données.
do $$
declare t record;
begin
  for t in
    select c.relname
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace and n.nspname = 'public'
    join pg_attribute a on a.attrelid = c.oid and a.attname = 'school_id' and not a.attisdropped
    where c.relkind = 'r'
      and c.relname not in ('school_members', 'member_cycles', 'audit_log')
  loop
    execute format('alter table public.%I alter column school_id set default public.default_school_id()', t.relname);
  end loop;
end $$;

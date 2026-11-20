-- =====================================================================
-- 0007 — INFORMATIONS DE SESSION POUR L'APPLICATION
--  * L'école active peut aussi être transmise dans l'en-tête « x-client-info »
--    (« ... school=<uuid> ») : cet en-tête est déjà accepté par le navigateur
--    sans réglage particulier, contrairement à un en-tête inventé.
--  * my_memberships() renvoie aussi les réglages de l'école (nom, logo, couleurs…),
--    pour afficher la bonne école dès la connexion.
-- =====================================================================

create or replace function public.requested_school_raw() returns text
language plpgsql stable set search_path = '' as $$
declare h json; v text;
begin
  h := nullif(current_setting('request.headers', true), '')::json;
  if h is null then return null; end if;
  v := nullif(btrim(h ->> 'x-school-id'), '');
  if v is null then
    v := substring(coalesce(h ->> 'x-client-info', '') from 'school=([0-9a-fA-F-]{36})');
  end if;
  return v;
exception when others then
  return null;
end $$;

drop function public.my_memberships();
create function public.my_memberships()
returns table (school_id uuid, role public.school_role, is_supervisor boolean,
               teacher_id uuid, cycle_ids uuid[], school jsonb)
language sql stable security definer set search_path = '' as $$
  select s.id, m.role, m.is_supervisor, m.teacher_id,
         coalesce((select array_agg(mc.cycle_id) from public.member_cycles mc where mc.member_id = m.id), '{}'),
         jsonb_build_object(
           'id', s.id, 'slug', s.slug, 'name', s.name, 'short_name', s.short_name,
           'logo_path', s.logo_path, 'address', s.address, 'city', s.city,
           'phone', s.phone, 'email', s.email, 'country', s.country, 'currency', s.currency,
           'primary_color', s.primary_color, 'accent_color', s.accent_color,
           'header_lines', s.header_lines, 'absence_threshold', s.absence_threshold,
           'secretary_can_collect', s.secretary_can_collect,
           'current_academic_year_id', s.current_academic_year_id)
  from public.member_schools() ms
  join public.school_members m on m.school_id = ms and m.user_id = auth.uid()
  join public.schools s on s.id = ms
  order by s.name;
$$;
revoke all on function public.my_memberships() from public, anon;
grant execute on function public.my_memberships() to authenticated;

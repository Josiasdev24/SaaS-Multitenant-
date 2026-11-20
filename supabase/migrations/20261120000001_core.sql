-- =====================================================================
-- 0001 — NOYAU MULTI-ÉCOLE
-- Écoles, cycles, membres (rôle par école), super-administrateurs,
-- journal d'audit, et fonctions d'identité de base.
-- Nouveau projet : aucune dépendance avec la base d'Omarus.
-- =====================================================================

-- ---------- Types ----------
create type public.school_role      as enum ('founder', 'director', 'secretary', 'teacher', 'primary');
create type public.student_status   as enum ('actif', 'archive', 'transfere', 'sorti');
create type public.gender           as enum ('M', 'F');
create type public.attendance_status as enum ('present', 'absent', 'retard');
create type public.fee_kind         as enum ('inscription', 'tranche', 'autre');
create type public.teacher_status   as enum ('actif', 'conge', 'inactif');

-- ---------- Utilitaire ----------
create function public.set_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- ---------- Écoles ----------
-- Une ligne par établissement. Remplace school_settings et app_settings
-- de l'ancienne application (réglages désormais PAR école).
create table public.schools (
  id                       uuid primary key default gen_random_uuid(),
  slug                     text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{1,62}$'),
  name                     text not null check (length(btrim(name)) > 0),
  short_name               text,
  logo_path                text,                       -- chemin dans le bucket school-logos : <school_id>/...
  address                  text,
  city                     text,                       -- « Lomé, le … » sur les documents
  phone                    text,
  email                    text,
  country                  text not null default 'TG',
  currency                 text not null default 'FCFA',
  primary_color            text check (primary_color is null or primary_color ~ '^#[0-9a-fA-F]{6}$'),
  accent_color             text check (accent_color  is null or accent_color  ~ '^#[0-9a-fA-F]{6}$'),
  header_lines             jsonb not null default '[]'::jsonb,   -- mentions officielles en tête des bulletins
  absence_threshold        int  not null default 5 check (absence_threshold >= 0),
  current_academic_year_id uuid,                       -- clé étrangère ajoutée dans la migration 0002
  secretary_can_collect    boolean not null default false,
  settings                 jsonb not null default '{}'::jsonb,
  status                   text not null default 'active' check (status in ('active', 'suspended')),
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);
create trigger trg_schools_updated before update on public.schools
  for each row execute function public.set_updated_at();

-- ---------- Cycles (configurables par école) ----------
-- Ex. : Jardin, Primaire, Collège, Lycée. grading_system décide du mode de notation.
create table public.school_cycles (
  id             uuid primary key default gen_random_uuid(),
  school_id      uuid not null references public.schools(id) on delete cascade,
  code           text not null check (code ~ '^[a-z0-9_]{1,30}$'),
  name           text not null,
  order_index    int  not null default 0,
  grading_system text not null default 'secondary' check (grading_system in ('secondary', 'primary')),
  created_at     timestamptz not null default now(),
  unique (school_id, id),
  unique (school_id, code)
);

-- ---------- Profils (un par compte, indépendant des écoles) ----------
create table public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  full_name  text not null default '',
  email      text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger trg_profiles_updated before update on public.profiles
  for each row execute function public.set_updated_at();

-- ---------- Membres : un rôle par école et par compte ----------
create table public.school_members (
  id            uuid primary key default gen_random_uuid(),
  school_id     uuid not null references public.schools(id) on delete cascade,
  user_id       uuid not null references auth.users(id) on delete cascade,
  role          public.school_role not null,
  teacher_id    uuid,                                  -- lien vers teachers (clé composite ajoutée en 0002)
  is_supervisor boolean not null default false,
  status        text not null default 'active' check (status in ('active', 'disabled')),
  created_at    timestamptz not null default now(),
  unique (school_id, id),
  unique (school_id, user_id)
);
create index school_members_user_idx on public.school_members (user_id);

-- Cycles confiés à un membre (Directeur de cycle, compte Primaire, surveillant).
create table public.member_cycles (
  member_id uuid not null,
  school_id uuid not null,
  cycle_id  uuid not null,
  primary key (member_id, cycle_id),
  foreign key (school_id, member_id) references public.school_members (school_id, id) on delete cascade,
  foreign key (school_id, cycle_id)  references public.school_cycles  (school_id, id) on delete cascade
);

-- ---------- Super-administrateurs (vous seul) ----------
-- Aucune politique RLS : la table n'est lisible que par les fonctions ci-dessous.
create table public.super_admins (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

-- ---------- Journal d'audit ----------
create table public.audit_log (
  id         bigint generated always as identity primary key,
  school_id  uuid references public.schools(id) on delete set null,
  actor      uuid,
  action     text not null,
  entity     text not null,
  entity_id  uuid,
  details    jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index audit_log_school_idx on public.audit_log (school_id, created_at desc);

-- ---------- Fonctions d'identité (SECURITY DEFINER, search_path vide) ----------
create function public.is_super_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.super_admins where user_id = auth.uid());
$$;

-- Écoles actives auxquelles appartient l'utilisateur connecté.
create function public.my_schools() returns setof uuid
language sql stable security definer set search_path = '' as $$
  select m.school_id
  from public.school_members m
  join public.schools s on s.id = m.school_id
  where m.user_id = auth.uid() and m.status = 'active' and s.status = 'active';
$$;

-- Rôle de l'utilisateur dans une école (null s'il n'en est pas membre actif).
create function public.role_in(sid uuid) returns public.school_role
language sql stable security definer set search_path = '' as $$
  select m.role
  from public.school_members m
  join public.schools s on s.id = m.school_id
  where m.school_id = sid and m.user_id = auth.uid()
    and m.status = 'active' and s.status = 'active'
  limit 1;
$$;

create function public.is_founder(sid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(public.role_in(sid) = 'founder', false);
$$;

create function public.is_supervisor(sid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select m.is_supervisor from public.school_members m
                   join public.schools s on s.id = m.school_id
                   where m.school_id = sid and m.user_id = auth.uid()
                     and m.status = 'active' and s.status = 'active' limit 1), false);
$$;

-- Écoles + rôle + cycles de l'utilisateur connecté (sert à la redirection après connexion).
create function public.my_memberships()
returns table (school_id uuid, school_name text, slug text, role public.school_role,
               is_supervisor boolean, cycle_ids uuid[])
language sql stable security definer set search_path = '' as $$
  select s.id, s.name, s.slug, m.role, m.is_supervisor,
         coalesce((select array_agg(mc.cycle_id) from public.member_cycles mc where mc.member_id = m.id), '{}')
  from public.school_members m
  join public.schools s on s.id = m.school_id
  where m.user_id = auth.uid() and m.status = 'active' and s.status = 'active'
  order by s.name;
$$;

-- Profil automatique à la création d'un compte. N'accorde AUCUN accès.
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, full_name, email)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''), new.email)
  on conflict (id) do nothing;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Écriture dans le journal depuis les déclencheurs.
create function public.audit_row() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  r jsonb := to_jsonb(coalesce(new, old));
  sid uuid;
begin
  sid := case when tg_table_name = 'schools' then (r ->> 'id')::uuid else (r ->> 'school_id')::uuid end;
  insert into public.audit_log (school_id, actor, action, entity, entity_id, details)
  values (sid, auth.uid(), tg_op, tg_table_name, (r ->> 'id')::uuid,
          case tg_op when 'DELETE' then r when 'UPDATE' then jsonb_build_object('old', to_jsonb(old), 'new', to_jsonb(new)) else r end);
  return coalesce(new, old);
end $$;

create trigger audit_schools after update on public.schools
  for each row execute function public.audit_row();
create trigger audit_members after insert or update or delete on public.school_members
  for each row execute function public.audit_row();

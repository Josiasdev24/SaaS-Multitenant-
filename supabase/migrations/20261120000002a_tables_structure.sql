-- 0002a — Tables : années, niveaux, matières, enseignants, classes
-- (Partie du fichier 2, à exécuter dans l'ordre : 2a, puis 2b, puis 2c)

-- =====================================================================
-- 0002 — TABLES MÉTIER
-- Chaque ligne appartient à UNE école (school_id NOT NULL).
-- Les liens entre tables sont des clés étrangères COMPOSITES
-- (school_id, id) : une ligne ne peut jamais pointer vers une ligne
-- d'une autre école, même par erreur de code.
-- =====================================================================

-- ---------- Année scolaire, trimestres, niveaux, matières ----------
create table public.academic_years (
  id         uuid primary key default gen_random_uuid(),
  school_id  uuid not null references public.schools(id) on delete cascade,
  label      text not null,
  start_date date not null,
  end_date   date not null,
  is_current boolean not null default false,
  created_at timestamptz not null default now(),
  check (end_date > start_date),
  unique (school_id, id),
  unique (school_id, label)
);

-- Année courante de l'école (composite : l'année doit être celle de la même école).
alter table public.schools
  add foreign key (id, current_academic_year_id)
  references public.academic_years (school_id, id) on delete set null (current_academic_year_id);

create table public.terms (
  id               uuid primary key default gen_random_uuid(),
  school_id        uuid not null references public.schools(id) on delete cascade,
  academic_year_id uuid not null,
  name             text not null,
  order_index      int  not null default 1,
  start_date       date not null,
  end_date         date not null,
  check (end_date > start_date),
  unique (school_id, id),
  unique (school_id, academic_year_id, name),
  foreign key (school_id, academic_year_id) references public.academic_years (school_id, id) on delete cascade
);

create table public.education_levels (
  id          uuid primary key default gen_random_uuid(),
  school_id   uuid not null references public.schools(id) on delete cascade,
  cycle_id    uuid not null,
  name        text not null,
  order_index int  not null default 0,
  created_at  timestamptz not null default now(),
  unique (school_id, id),
  unique (school_id, name),
  foreign key (school_id, cycle_id) references public.school_cycles (school_id, id) on delete restrict
);

create table public.subjects (
  id                  uuid primary key default gen_random_uuid(),
  school_id           uuid not null references public.schools(id) on delete cascade,
  name                text not null,
  code                text not null,
  default_coefficient numeric(4,2) not null default 1,
  groupe              text,
  created_at          timestamptz not null default now(),
  unique (school_id, id),
  unique (school_id, name),
  unique (school_id, code)
);

create table public.teachers (
  id         uuid primary key default gen_random_uuid(),
  school_id  uuid not null references public.schools(id) on delete cascade,
  first_name text not null,
  last_name  text not null,
  phone      text,
  email      text,
  status     public.teacher_status not null default 'actif',
  hire_date  date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (school_id, id)
);

-- Un membre « Enseignant » est lié à sa fiche enseignant (même école obligatoirement).
alter table public.school_members
  add foreign key (school_id, teacher_id)
  references public.teachers (school_id, id) on delete set null (teacher_id);

create table public.classes (
  id              uuid primary key default gen_random_uuid(),
  school_id       uuid not null references public.schools(id) on delete cascade,
  name            text not null,
  level_id        uuid not null,
  academic_year_id uuid not null,
  main_teacher_id uuid,
  capacity        int,
  is_archived     boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (school_id, id),
  unique (school_id, name, academic_year_id),
  foreign key (school_id, level_id)         references public.education_levels (school_id, id) on delete restrict,
  foreign key (school_id, academic_year_id) references public.academic_years   (school_id, id) on delete restrict,
  foreign key (school_id, main_teacher_id)  references public.teachers         (school_id, id) on delete set null (main_teacher_id)
);

create table public.class_subjects (
  id          uuid primary key default gen_random_uuid(),
  school_id   uuid not null references public.schools(id) on delete cascade,
  class_id    uuid not null,
  subject_id  uuid not null,
  teacher_id  uuid,
  coefficient numeric(4,2) not null default 1,
  unique (school_id, id),
  unique (class_id, subject_id),
  foreign key (school_id, class_id)   references public.classes  (school_id, id) on delete cascade,
  foreign key (school_id, subject_id) references public.subjects (school_id, id) on delete cascade,
  foreign key (school_id, teacher_id) references public.teachers (school_id, id) on delete set null (teacher_id)
);

create table public.teacher_subjects (
  id         uuid primary key default gen_random_uuid(),
  school_id  uuid not null references public.schools(id) on delete cascade,
  teacher_id uuid not null,
  subject_id uuid not null,
  unique (teacher_id, subject_id),
  foreign key (school_id, teacher_id) references public.teachers (school_id, id) on delete cascade,
  foreign key (school_id, subject_id) references public.subjects (school_id, id) on delete cascade
);

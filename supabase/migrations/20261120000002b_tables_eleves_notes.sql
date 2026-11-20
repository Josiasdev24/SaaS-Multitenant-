-- 0002b — Tables : élèves, familles, notes, absences
-- (Partie du fichier 2, à exécuter dans l'ordre : 2a, puis 2b, puis 2c)

-- ---------- Élèves et familles ----------
create table public.parents (
  id         uuid primary key default gen_random_uuid(),
  school_id  uuid not null references public.schools(id) on delete cascade,
  first_name text not null,
  last_name  text not null,
  phone      text,
  email      text,
  address    text,
  profession text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (school_id, id)
);

create table public.students (
  id               uuid primary key default gen_random_uuid(),
  school_id        uuid not null references public.schools(id) on delete cascade,
  matricule        text not null,
  first_name       text not null,
  last_name        text not null,
  gender           public.gender,
  birth_date       date,
  birth_place      text,
  address          text,
  phone            text,
  class_id         uuid,
  academic_year_id uuid not null,
  enrollment_date  date not null default current_date,
  status           public.student_status not null default 'actif',
  notes            text,
  emergency_contact text,
  emergency_phone  text,
  health_notes     text,
  nationality      text,
  photo_path       text,
  previous_class   text,
  previous_school  text,
  siblings         text,
  -- Champs sensibles : modifiables seulement par Fondateur et Directeur (déclencheur en 0003).
  student_type     text check (student_type is null or student_type in ('nouveau', 'ancien')),
  fee_status       text not null default 'normal'
                   check (fee_status in ('normal', 'personnel', 'bourse', 'bourse_partielle', 'proche_personnel')),
  fee_discount     numeric(12,2) not null default 0 check (fee_discount >= 0),
  fee_note         text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (school_id, id),
  unique (school_id, matricule),
  foreign key (school_id, class_id)         references public.classes        (school_id, id) on delete set null (class_id),
  foreign key (school_id, academic_year_id) references public.academic_years (school_id, id) on delete restrict
);

create table public.student_parents (
  id           uuid primary key default gen_random_uuid(),
  school_id    uuid not null references public.schools(id) on delete cascade,
  student_id   uuid not null,
  parent_id    uuid not null,
  relationship text not null default 'tuteur',
  is_primary   boolean not null default true,
  unique (student_id, parent_id),
  foreign key (school_id, student_id) references public.students (school_id, id) on delete cascade,
  foreign key (school_id, parent_id)  references public.parents  (school_id, id) on delete cascade
);

-- ---------- Notes (cycles de type « secondary ») ----------
create table public.evaluations (
  id         uuid primary key default gen_random_uuid(),
  school_id  uuid not null references public.schools(id) on delete cascade,
  class_id   uuid not null,
  subject_id uuid not null,
  term_id    uuid not null,
  title      text not null,
  kind       text not null default 'devoir',
  rank       int  not null default 1,
  eval_date  date not null default current_date,
  max_score  numeric(5,2) not null default 20 check (max_score > 0),
  created_at timestamptz not null default now(),
  unique (school_id, id),
  unique (school_id, class_id, subject_id, term_id, kind, rank),
  foreign key (school_id, class_id)   references public.classes  (school_id, id) on delete cascade,
  foreign key (school_id, subject_id) references public.subjects (school_id, id) on delete restrict,
  foreign key (school_id, term_id)    references public.terms    (school_id, id) on delete restrict
);

create table public.grades (
  id            uuid primary key default gen_random_uuid(),
  school_id     uuid not null references public.schools(id) on delete cascade,
  evaluation_id uuid not null,
  student_id    uuid not null,
  score         numeric(5,2) check (score is null or score >= 0),
  comment       text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (evaluation_id, student_id),
  foreign key (school_id, evaluation_id) references public.evaluations (school_id, id) on delete cascade,
  foreign key (school_id, student_id)    references public.students    (school_id, id) on delete cascade
);

create table public.report_cards (
  id              uuid primary key default gen_random_uuid(),
  school_id       uuid not null references public.schools(id) on delete cascade,
  student_id      uuid not null,
  term_id         uuid not null,
  general_average numeric(5,2),
  appreciation    text,
  generated_at    timestamptz,
  unique (student_id, term_id),
  foreign key (school_id, student_id) references public.students (school_id, id) on delete cascade,
  foreign key (school_id, term_id)    references public.terms    (school_id, id) on delete cascade
);

create table public.bulletin_notes (
  id          uuid primary key default gen_random_uuid(),
  school_id   uuid not null references public.schools(id) on delete cascade,
  student_id  uuid not null,
  subject_id  uuid not null,
  term_id     uuid not null,
  class_avg   numeric(5,2),
  composition numeric(5,2),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (student_id, subject_id, term_id),
  foreign key (school_id, student_id) references public.students (school_id, id) on delete cascade,
  foreign key (school_id, subject_id) references public.subjects (school_id, id) on delete cascade,
  foreign key (school_id, term_id)    references public.terms    (school_id, id) on delete cascade
);

create table public.bulletin_remarks (
  id             uuid primary key default gen_random_uuid(),
  school_id      uuid not null references public.schools(id) on delete cascade,
  student_id     uuid not null,
  term_id        uuid not null,
  absences       text,
  retards        text,
  blame          text,
  warning        text,
  encouragement  text,
  congratulations text,
  honor_roll     text,
  observation    text,
  decision       text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (student_id, term_id),
  foreign key (school_id, student_id) references public.students (school_id, id) on delete cascade,
  foreign key (school_id, term_id)    references public.terms    (school_id, id) on delete cascade
);

-- ---------- Notes (cycles de type « primary ») ----------
create table public.primary_subjects (
  id          uuid primary key default gen_random_uuid(),
  school_id   uuid not null references public.schools(id) on delete cascade,
  grp         text not null,
  name        text not null,
  block       text not null,
  coefficient numeric(5,2) not null default 1,
  max_points  numeric(6,2) not null default 10,
  order_index int not null default 0,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  unique (school_id, id),
  unique (school_id, grp, name)
);

create table public.primary_scores (
  id         uuid primary key default gen_random_uuid(),
  school_id  uuid not null references public.schools(id) on delete cascade,
  student_id uuid not null,
  subject_id uuid not null,
  month_key  text not null,
  score      numeric(6,2) check (score is null or score >= 0),
  updated_at timestamptz not null default now(),
  unique (student_id, subject_id, month_key),
  foreign key (school_id, student_id) references public.students         (school_id, id) on delete cascade,
  foreign key (school_id, subject_id) references public.primary_subjects (school_id, id) on delete cascade
);

-- ---------- Absences ----------
create table public.attendance (
  id              uuid primary key default gen_random_uuid(),
  school_id       uuid not null references public.schools(id) on delete cascade,
  student_id      uuid not null,
  class_id        uuid,
  attendance_date date not null default current_date,
  status          public.attendance_status not null,
  minutes_late    int,
  reason          text,
  recorded_by     uuid references auth.users(id) on delete set null,
  created_at      timestamptz not null default now(),
  unique (student_id, attendance_date),
  foreign key (school_id, student_id) references public.students (school_id, id) on delete cascade,
  foreign key (school_id, class_id)   references public.classes  (school_id, id) on delete set null (class_id)
);

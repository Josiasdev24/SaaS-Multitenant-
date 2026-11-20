-- 0002c — Tables : finances, déclencheurs, index, sécurité des lignes
-- (Partie du fichier 2, à exécuter dans l'ordre : 2a, puis 2b, puis 2c)

-- ---------- Finances ----------
create table public.school_fees (
  id               uuid primary key default gen_random_uuid(),
  school_id        uuid not null references public.schools(id) on delete cascade,
  academic_year_id uuid not null,
  level_id         uuid,
  name             text not null,
  kind             public.fee_kind not null default 'tranche',
  amount           numeric(12,2) not null check (amount >= 0),
  due_date         date,
  order_index      int not null default 1,
  created_at       timestamptz not null default now(),
  unique (school_id, id),
  foreign key (school_id, academic_year_id) references public.academic_years   (school_id, id) on delete cascade,
  foreign key (school_id, level_id)         references public.education_levels (school_id, id) on delete cascade
);

create table public.student_fees (
  id            uuid primary key default gen_random_uuid(),
  school_id     uuid not null references public.schools(id) on delete cascade,
  student_id    uuid not null,
  school_fee_id uuid not null,
  amount_due    numeric(12,2) not null check (amount_due >= 0),
  due_date      date,
  unique (school_id, id),
  unique (student_id, school_fee_id),
  foreign key (school_id, student_id)    references public.students    (school_id, id) on delete cascade,
  foreign key (school_id, school_fee_id) references public.school_fees (school_id, id) on delete cascade
);

create table public.fee_payments (
  id             uuid primary key default gen_random_uuid(),
  school_id      uuid not null references public.schools(id) on delete cascade,
  student_id     uuid not null,
  student_fee_id uuid,
  amount         numeric(12,2) not null check (amount > 0),
  paid_at        date not null default current_date,
  method         text not null default 'especes',
  receipt_number text,
  note           text,
  recorded_by    uuid references auth.users(id) on delete set null,
  created_at     timestamptz not null default now(),
  foreign key (school_id, student_id)     references public.students     (school_id, id) on delete cascade,
  foreign key (school_id, student_fee_id) references public.student_fees (school_id, id) on delete set null (student_fee_id)
);
-- Numéro de reçu unique PAR école.
create unique index fee_payments_receipt_unique on public.fee_payments (school_id, receipt_number)
  where receipt_number is not null;

create table public.fee_adjustments (
  id         uuid primary key default gen_random_uuid(),
  school_id  uuid not null references public.schools(id) on delete cascade,
  student_id uuid not null,
  kind       text not null check (kind in ('reduction_familiale', 'bourse', 'arriere')),
  amount     numeric(12,2) not null check (amount > 0),
  label      text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (school_id, id),
  foreign key (school_id, student_id) references public.students (school_id, id) on delete cascade
);

create table public.fee_adjustment_effects (
  id             uuid primary key default gen_random_uuid(),
  school_id      uuid not null references public.schools(id) on delete cascade,
  adjustment_id  uuid not null,
  student_fee_id uuid not null,
  delta          numeric(12,2) not null,
  created_row    boolean not null default false,
  foreign key (school_id, adjustment_id)  references public.fee_adjustments (school_id, id) on delete cascade,
  foreign key (school_id, student_fee_id) references public.student_fees    (school_id, id) on delete cascade
);

-- Trace des paiements supprimés (aucune clé vers les lignes supprimées).
create table public.payment_deletions (
  id             uuid primary key default gen_random_uuid(),
  school_id      uuid not null references public.schools(id) on delete cascade,
  payment_id     uuid not null,
  student_id     uuid,
  student_name   text,
  amount         numeric(12,2) not null,
  method         text,
  paid_at        date,
  receipt_number text,
  note           text,
  deleted_by     uuid references auth.users(id) on delete set null,
  deleted_at     timestamptz not null default now()
);

create table public.expenses (
  id           uuid primary key default gen_random_uuid(),
  school_id    uuid not null references public.schools(id) on delete cascade,
  amount       numeric(12,2) not null check (amount >= 0),
  category     text not null,
  label        text,
  expense_date date not null default current_date,
  created_by   uuid references auth.users(id) on delete set null,
  created_at   timestamptz not null default now()
);

create table public.incomes (
  id          uuid primary key default gen_random_uuid(),
  school_id   uuid not null references public.schools(id) on delete cascade,
  student_id  uuid,
  amount      numeric(12,2) not null check (amount >= 0),
  category    text not null,
  label       text,
  income_date date not null default current_date,
  created_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  foreign key (school_id, student_id) references public.students (school_id, id) on delete set null (student_id)
);

create table public.tontine_deposits (
  id           uuid primary key default gen_random_uuid(),
  school_id    uuid not null references public.schools(id) on delete cascade,
  student_id   uuid not null,
  amount       numeric(12,2) not null check (amount > 0),
  deposit_date date not null default current_date,
  note         text,
  settled_at   timestamptz,
  created_by   uuid references auth.users(id) on delete set null,
  created_at   timestamptz not null default now(),
  foreign key (school_id, student_id) references public.students (school_id, id) on delete cascade
);

-- ---------- Déclencheurs d'horodatage ----------
create trigger trg_teachers_updated  before update on public.teachers  for each row execute function public.set_updated_at();
create trigger trg_classes_updated   before update on public.classes   for each row execute function public.set_updated_at();
create trigger trg_parents_updated   before update on public.parents   for each row execute function public.set_updated_at();
create trigger trg_students_updated  before update on public.students  for each row execute function public.set_updated_at();
create trigger trg_grades_updated    before update on public.grades    for each row execute function public.set_updated_at();
create trigger trg_bnotes_updated    before update on public.bulletin_notes   for each row execute function public.set_updated_at();
create trigger trg_bremarks_updated  before update on public.bulletin_remarks for each row execute function public.set_updated_at();
create trigger trg_pscores_updated   before update on public.primary_scores   for each row execute function public.set_updated_at();

-- ---------- Index sur school_id ----------
-- Index utiles aux listes les plus fréquentes.
create index students_class_idx      on public.students (school_id, class_id);
create index students_name_idx       on public.students (school_id, last_name, first_name);
create index fee_payments_student_idx on public.fee_payments (school_id, student_id);
create index student_fees_student_idx on public.student_fees (school_id, student_id);
create index attendance_date_idx     on public.attendance (school_id, attendance_date);
create index grades_student_idx      on public.grades (school_id, student_id);
create index evaluations_class_idx   on public.evaluations (school_id, class_id);

-- Et un index (school_id, …) sur toute table qui n'en a pas encore un en tête.
do $$
declare t record;
begin
  for t in
    select c.relname
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace and n.nspname = 'public'
    join pg_attribute a on a.attrelid = c.oid and a.attname = 'school_id' and not a.attisdropped
    where c.relkind = 'r'
      and not exists (
        select 1 from pg_index i
        where i.indrelid = c.oid and i.indkey[0] = a.attnum
      )
  loop
    execute format('create index %I on public.%I (school_id)', t.relname || '_school_idx', t.relname);
  end loop;
end $$;

-- ---------- Un school_id ne change jamais ----------
create function public.forbid_school_change() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.school_id is distinct from old.school_id then
    raise exception 'Une ligne ne peut pas changer d''école';
  end if;
  return new;
end $$;

do $$
declare t record;
begin
  for t in
    select c.relname
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace and n.nspname = 'public'
    join pg_attribute a on a.attrelid = c.oid and a.attname = 'school_id' and not a.attisdropped
    where c.relkind = 'r'
  loop
    execute format('create trigger trg_school_immutable before update on public.%I
                    for each row execute function public.forbid_school_change()', t.relname);
  end loop;
end $$;

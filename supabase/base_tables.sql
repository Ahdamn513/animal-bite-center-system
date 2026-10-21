-- Tables
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  contact text,
  role text not null default 'patient'
    check (role in ('patient','staff','admin')),
  created_at timestamptz not null default now()
);

create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.profiles(id) on delete cascade,
  slot_time timestamptz not null,
  queue_number int,
  status text not null default 'booked'
    check (status in ('booked','arrived','called','done','cancelled')),
  arrived_at timestamptz,
  called_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.vaccine_doses (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.profiles(id) on delete cascade,
  dose_number int not null,
  scheduled_date date not null,
  given_at timestamptz
);

create table public.chat_logs (
  id uuid primary key default gen_random_uuid(),
  question text not null,
  answer text,
  created_at timestamptz not null default now()
);

-- Helper: is the current user staff or admin?
create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('staff','admin')
  );
$$;

-- Turn on Row Level Security
alter table public.profiles enable row level security;
alter table public.appointments enable row level security;
alter table public.vaccine_doses enable row level security;
alter table public.chat_logs enable row level security;

-- Policies
create policy "read own profile, staff read all"
  on public.profiles for select
  using (id = auth.uid() or public.is_staff());

create policy "create own profile"
  on public.profiles for insert
  with check (id = auth.uid());

create policy "read own appointments, staff read all"
  on public.appointments for select
  using (patient_id = auth.uid() or public.is_staff());

create policy "patients book own appointments"
  on public.appointments for insert
  with check (patient_id = auth.uid());

create policy "staff update appointments"
  on public.appointments for update
  using (public.is_staff());

create policy "read own doses, staff read all"
  on public.vaccine_doses for select
  using (patient_id = auth.uid() or public.is_staff());

create policy "staff manage doses"
  on public.vaccine_doses for all
  using (public.is_staff())
  with check (public.is_staff());

create policy "staff read chat logs"
  on public.chat_logs for select
  using (public.is_staff());

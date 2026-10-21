-- BiteQueue prototype: run this AFTER the base tables script.

-- 1. Walk-ins: an appointment can belong to a person without an account
alter table public.appointments
  alter column patient_id drop not null;
alter table public.appointments
  add column if not exists walk_in_name text;
alter table public.appointments
  drop constraint if exists appointments_has_person;
alter table public.appointments
  add constraint appointments_has_person
  check (patient_id is not null or walk_in_name is not null);

-- 2. Staff can add walk-ins; patients can cancel their own booking
drop policy if exists "staff add appointments" on public.appointments;
create policy "staff add appointments"
  on public.appointments for insert
  with check (public.is_staff());

drop policy if exists "patients cancel own appointments" on public.appointments;
create policy "patients cancel own appointments"
  on public.appointments for update
  using (patient_id = auth.uid())
  with check (patient_id = auth.uid() and status = 'cancelled');

-- 3. Create a profile automatically when someone signs up
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, contact)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    new.email
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 4. At most 5 online bookings per time slot
create or replace function public.enforce_slot_capacity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.patient_id is not null and (
    select count(*) from public.appointments
    where slot_time = new.slot_time and status <> 'cancelled'
  ) >= 5 then
    raise exception 'This time slot is full. Please choose another slot.';
  end if;
  return new;
end;
$$;

drop trigger if exists check_slot_capacity on public.appointments;
create trigger check_slot_capacity
  before insert on public.appointments
  for each row execute function public.enforce_slot_capacity();

-- 5. Public queue board: numbers and statuses only, never names
create or replace function public.queue_board()
returns table (queue_number int, status text)
language sql
stable
security definer
set search_path = public
as $$
  select a.queue_number, a.status
  from public.appointments a
  where a.queue_number is not null
    and a.status in ('arrived','called','done')
    and (a.slot_time at time zone 'Asia/Manila')::date
        = (now() at time zone 'Asia/Manila')::date
  order by a.queue_number;
$$;

-- 6. How many bookings each slot already has on a given day
create or replace function public.slot_counts(for_day date)
returns table (slot_time timestamptz, taken bigint)
language sql
stable
security definer
set search_path = public
as $$
  select a.slot_time, count(*)
  from public.appointments a
  where a.patient_id is not null
    and a.status <> 'cancelled'
    and (a.slot_time at time zone 'Asia/Manila')::date = for_day
  group by a.slot_time;
$$;

grant execute on function public.queue_board() to anon, authenticated;
grant execute on function public.slot_counts(date) to anon, authenticated;

-- 7. After you sign up in the app, make yourself admin (use YOUR email):
-- update public.profiles set role = 'admin'
--   where contact = 'sherwinadam13@gmail.com';

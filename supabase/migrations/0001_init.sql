-- Graduation Blueprint: student records, survey answers, plans and advisor reviews.
-- Records seeded from data/students/*.json stand in for an authorized degree-audit export (FR-08).
-- Row-level security: a student reads only their own rows; advisors read everything and decide reviews.

create table if not exists public.students (
  key text primary key,                 -- e.g. 'jordan'
  name text not null,
  tag text,
  sample boolean not null default true,
  start_term text not null,
  current_term text not null,
  target_grad_term text not null,
  programs text[] not null default '{}',
  declared boolean not null default false,
  other_hours jsonb,
  satisfied_slots jsonb,
  holds jsonb,
  preferences jsonb,
  source text not null default 'registrar_sample',
  updated_at timestamptz not null default now()
);

create table if not exists public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  role text not null check (role in ('student', 'advisor')),
  display_name text not null,
  student_key text references public.students (key) on delete set null
);

create table if not exists public.course_records (
  id bigint generated always as identity primary key,
  student_key text not null references public.students (key) on delete cascade,
  code text not null,
  grade text,
  term text not null,
  status text not null check (status in ('completed', 'in-progress')),
  credits numeric,
  transfer_from text,
  transfer_verified boolean,
  counts_toward text,
  -- where the record came from: the (sample) registrar feed, a confirmed transcript upload, or the student
  source text not null check (source in ('registrar_sample', 'transcript_upload', 'student_reported')),
  created_at timestamptz not null default now()
);
create index if not exists course_records_student on public.course_records (student_key);

create table if not exists public.survey_responses (
  id bigint generated always as identity primary key,
  student_key text not null references public.students (key) on delete cascade,
  answers jsonb not null,
  created_at timestamptz not null default now()
);
create index if not exists survey_student on public.survey_responses (student_key, created_at desc);

create table if not exists public.saved_plans (
  id bigint generated always as identity primary key,
  student_key text not null references public.students (key) on delete cascade,
  programs text[] not null,
  plan jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists public.advisor_reviews (
  id text primary key,
  student_key text not null references public.students (key) on delete cascade,
  student_name text not null,
  programs text[] not null,
  status text not null check (status in ('submitted', 'approved', 'changes-requested')),
  submitted_at timestamptz not null default now(),
  decided_at timestamptz,
  advisor_note text,
  plan jsonb not null,
  questions text[] not null default '{}'
);
create index if not exists reviews_student on public.advisor_reviews (student_key, submitted_at desc);

-- ---------- Helpers (security definer so policies can read profiles without recursion) ----------
create or replace function public.is_advisor() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where user_id = auth.uid() and role = 'advisor');
$$;

create or replace function public.my_student_key() returns text
language sql stable security definer set search_path = public as $$
  select student_key from public.profiles where user_id = auth.uid();
$$;

-- ---------- Row-level security ----------
alter table public.students enable row level security;
alter table public.profiles enable row level security;
alter table public.course_records enable row level security;
alter table public.survey_responses enable row level security;
alter table public.saved_plans enable row level security;
alter table public.advisor_reviews enable row level security;

drop policy if exists "own profile" on public.profiles;
create policy "own profile" on public.profiles for select using (user_id = auth.uid() or public.is_advisor());

drop policy if exists "read own student" on public.students;
create policy "read own student" on public.students for select using (key = public.my_student_key() or public.is_advisor());

drop policy if exists "read own records" on public.course_records;
create policy "read own records" on public.course_records for select using (student_key = public.my_student_key() or public.is_advisor());
-- Students add records from a confirmed transcript or their own entry; registrar records stay read-only
drop policy if exists "add own records" on public.course_records;
create policy "add own records" on public.course_records for insert
  with check (student_key = public.my_student_key() and source in ('transcript_upload', 'student_reported'));
drop policy if exists "remove own reported records" on public.course_records;
create policy "remove own reported records" on public.course_records for delete
  using (student_key = public.my_student_key() and source in ('transcript_upload', 'student_reported'));

drop policy if exists "own surveys" on public.survey_responses;
create policy "own surveys" on public.survey_responses for select using (student_key = public.my_student_key() or public.is_advisor());
drop policy if exists "add own survey" on public.survey_responses;
create policy "add own survey" on public.survey_responses for insert with check (student_key = public.my_student_key());

drop policy if exists "own plans" on public.saved_plans;
create policy "own plans" on public.saved_plans for select using (student_key = public.my_student_key() or public.is_advisor());
drop policy if exists "add own plan" on public.saved_plans;
create policy "add own plan" on public.saved_plans for insert with check (student_key = public.my_student_key());

drop policy if exists "read reviews" on public.advisor_reviews;
create policy "read reviews" on public.advisor_reviews for select using (student_key = public.my_student_key() or public.is_advisor());
drop policy if exists "submit own review" on public.advisor_reviews;
create policy "submit own review" on public.advisor_reviews for insert
  with check (student_key = public.my_student_key() and status = 'submitted');
drop policy if exists "advisor decides" on public.advisor_reviews;
create policy "advisor decides" on public.advisor_reviews for update using (public.is_advisor()) with check (public.is_advisor());
drop policy if exists "student withdraws own review" on public.advisor_reviews;
create policy "student withdraws own review" on public.advisor_reviews for delete using (student_key = public.my_student_key() or public.is_advisor());

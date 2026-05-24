create extension if not exists "pgcrypto";

create table if not exists public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  plan text not null default 'free' check (plan in ('free', 'pro')),
  scans_used_this_month integer not null default 0 check (scans_used_this_month >= 0),
  stripe_customer_id text,
  stripe_subscription_id text,
  created_at timestamptz not null default now()
);

create table if not exists public.scans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  niche text not null,
  city text not null,
  status text not null check (status in ('pending', 'running', 'done', 'error')),
  result_count integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  scan_id uuid not null references public.scans (id) on delete cascade,
  business_name text not null,
  website_url text,
  phone text,
  address text,
  google_place_id text,
  score integer check (score between 0 and 100),
  issues jsonb not null default '[]'::jsonb,
  tech_stack jsonb not null default '[]'::jsonb,
  page_speed integer,
  has_https boolean,
  has_mobile boolean,
  has_analytics boolean,
  last_modified_year integer,
  outreach_email text,
  created_at timestamptz not null default now()
);

create index if not exists scans_user_id_idx on public.scans (user_id);
create index if not exists scans_created_at_idx on public.scans (created_at desc);
create index if not exists leads_scan_id_idx on public.leads (scan_id);
create index if not exists leads_score_idx on public.leads (score);

alter table public.users enable row level security;
alter table public.scans enable row level security;
alter table public.leads enable row level security;

create policy "Users can read their own user row"
  on public.users
  for select
  using (auth.uid() = id);

create policy "Users can update their own user row"
  on public.users
  for update
  using (auth.uid() = id);

create policy "Users can insert their own user row"
  on public.users
  for insert
  with check (auth.uid() = id);

create policy "Users can view their own scans"
  on public.scans
  for select
  using (auth.uid() = user_id);

create policy "Users can create their own scans"
  on public.scans
  for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own scans"
  on public.scans
  for update
  using (auth.uid() = user_id);

create policy "Users can view their own leads"
  on public.leads
  for select
  using (
    exists (
      select 1
      from public.scans
      where public.scans.id = public.leads.scan_id
        and public.scans.user_id = auth.uid()
    )
  );

create policy "Users can create leads for their own scans"
  on public.leads
  for insert
  with check (
    exists (
      select 1
      from public.scans
      where public.scans.id = public.leads.scan_id
        and public.scans.user_id = auth.uid()
    )
  );

create policy "Users can update leads for their own scans"
  on public.leads
  for update
  using (
    exists (
      select 1
      from public.scans
      where public.scans.id = public.leads.scan_id
        and public.scans.user_id = auth.uid()
    )
  );

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Migration to create the "preguntes" table for dynamic questionnaire
-- Created on 2026-06-30

create table if not exists public.preguntes (
  id          text primary key,
  titol       text not null,
  tipus       text not null,
  opcions     jsonb,
  requerit    boolean not null default false,
  activa      boolean not null default true,
  ordre       integer,
  updated_at  timestamptz default now()
);

-- Enable Row Level Security (RLS)
alter table public.preguntes enable row level security;

-- Policies for "preguntes" table
-- 1. Allow anonymous users (public form) to select/read the questions
create policy anon_select_preguntes on public.preguntes
  for select to anon using (true);

-- 2. Allow authenticated users (secretaries/admins) to manage (all actions) the questions
create policy auth_all_preguntes on public.preguntes
  for all to authenticated using (true) with check (true);

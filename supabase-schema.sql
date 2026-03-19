-- ═══════════════════════════════════════════════════════════════════════════
--  NeuralDock — Supabase Database Schema
--  Paste this entire file into: Supabase Dashboard → SQL Editor → Run
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Enable UUID extension ────────────────────────────────────────────────
create extension if not exists "pgcrypto";

-- ════════════════════════════════════════════
--  1. PROFILES (extends auth.users)
-- ════════════════════════════════════════════
create table if not exists public.profiles (
  id          uuid references auth.users on delete cascade primary key,
  username    text unique,
  full_name   text,
  avatar_url  text,
  plan        text    default 'free',
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

-- Auto-create profile when a new user signs up
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, username, full_name, avatar_url)
  values (
    new.id,
    new.raw_user_meta_data->>'user_name',
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ════════════════════════════════════════════
--  2. USER SETTINGS
-- ════════════════════════════════════════════
create table if not exists public.user_settings (
  user_id             uuid references public.profiles on delete cascade primary key,
  current_model       text    default 'gpt-4o',
  temperature         numeric default 0.7,
  response_length     text    default 'balanced',
  memory_enabled      boolean default true,
  speak_responses     boolean default false,
  speak_speed         numeric default 1.0,
  font_size           text    default 'medium',
  system_prompt       text    default '',
  custom_instructions text    default '',
  updated_at          timestamptz default now()
);

-- ════════════════════════════════════════════
--  3. CONVERSATIONS
-- ════════════════════════════════════════════
create table if not exists public.conversations (
  id          uuid        default gen_random_uuid() primary key,
  user_id     uuid        references public.profiles on delete cascade not null,
  title       text        default 'New Chat',
  model       text        default 'gpt-4o',
  messages    jsonb       default '[]'::jsonb,
  pinned      boolean     default false,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

create index if not exists conversations_user_id_updated_at
  on public.conversations (user_id, updated_at desc);

-- ════════════════════════════════════════════
--  4. IDE PROJECTS
-- ════════════════════════════════════════════
create table if not exists public.ide_projects (
  id          uuid        default gen_random_uuid() primary key,
  user_id     uuid        references public.profiles on delete cascade not null,
  name        text        default 'my-project',
  files       jsonb       default '{}'::jsonb,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

create index if not exists ide_projects_user_id
  on public.ide_projects (user_id, updated_at desc);

-- ════════════════════════════════════════════
--  5. GENERATED IMAGES
-- ════════════════════════════════════════════
create table if not exists public.generated_images (
  id          uuid        default gen_random_uuid() primary key,
  user_id     uuid        references public.profiles on delete cascade not null,
  prompt      text,
  provider    text,
  model       text,
  image_url   text,
  width       integer,
  height      integer,
  created_at  timestamptz default now()
);

create index if not exists generated_images_user_id
  on public.generated_images (user_id, created_at desc);

-- ════════════════════════════════════════════
--  6. ROW LEVEL SECURITY (RLS)
--  Each user can only see and edit their own data
-- ════════════════════════════════════════════

-- Profiles
alter table public.profiles         enable row level security;
alter table public.user_settings    enable row level security;
alter table public.conversations    enable row level security;
alter table public.ide_projects     enable row level security;
alter table public.generated_images enable row level security;

-- Profiles policies
create policy "Users can view own profile"
  on public.profiles for select using (auth.uid() = id);
create policy "Users can update own profile"
  on public.profiles for update using (auth.uid() = id);
create policy "Users can insert own profile"
  on public.profiles for insert with check (auth.uid() = id);

-- Settings policies
create policy "Users can manage own settings"
  on public.user_settings for all using (auth.uid() = user_id);

-- Conversations policies
create policy "Users can manage own conversations"
  on public.conversations for all using (auth.uid() = user_id);

-- IDE projects policies
create policy "Users can manage own IDE projects"
  on public.ide_projects for all using (auth.uid() = user_id);

-- Generated images policies
create policy "Users can manage own images"
  on public.generated_images for all using (auth.uid() = user_id);

-- ════════════════════════════════════════════
--  DONE — all tables and policies created
-- ════════════════════════════════════════════

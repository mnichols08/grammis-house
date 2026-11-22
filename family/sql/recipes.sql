-- Recipes the family shares with Grammi. Each waits here until her editor collects it as a draft
-- post (docker/recipe-inbox.mjs); then it is marked delivered and its photos are deleted, because
-- the draft holds them now. Nothing here is ever public.
--
-- Private the way open.blog's own tables are: row level security on with no policies, nothing
-- granted to anon or authenticated; the family service reaches it as the database's owner.
-- Running it twice changes nothing.

create table if not exists public.grammis_recipe_submissions (
  id uuid primary key default gen_random_uuid(),
  site_id text not null,
  created_at timestamptz not null default now(),
  author_name text not null check (char_length(author_name) between 1 and 60),
  author_link text check (author_link is null or char_length(author_link) between 1 and 300),
  -- The recipe as the family service checked it (family/lib/recipe-check.js): words only.
  recipe jsonb not null check (jsonb_typeof(recipe) = 'object' and pg_column_size(recipe) < 120000),
  photo_count smallint not null default 0 check (photo_count between 0 and 4),
  sender_digest text not null,
  delivered_at timestamptz,
  delivered_as text check (delivered_as is null or char_length(delivered_as) <= 300)
);

create index if not exists grammis_recipe_submissions_waiting
  on public.grammis_recipe_submissions (site_id, created_at) where delivered_at is null;
create index if not exists grammis_recipe_submissions_sender
  on public.grammis_recipe_submissions (site_id, sender_digest, created_at);

create table if not exists public.grammis_recipe_photos (
  submission_id uuid not null references public.grammis_recipe_submissions (id) on delete cascade,
  position smallint not null check (position between 0 and 3),
  -- A JPEG with the camera's notes taken out, at most 900 KB.
  bytes bytea not null check (octet_length(bytes) between 4 and 921600),
  primary key (submission_id, position)
);

alter table public.grammis_recipe_submissions enable row level security;
alter table public.grammis_recipe_photos enable row level security;
revoke all on public.grammis_recipe_submissions, public.grammis_recipe_photos from public, anon, authenticated;

-- A request: someone asking Grammi for one of her recipes. Its `recipe` holds { title, details }, it
-- has no link and no photos, and it becomes a draft she writes herself.
alter table public.grammis_recipe_submissions
  add column if not exists kind text not null default 'recipe' check (kind in ('recipe', 'request'));

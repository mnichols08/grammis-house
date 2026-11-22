-- The fridge on The Family Wall: where each letter magnet is, and the drawings the family makes.
-- A drawing waits until Grammi puts it up (with her word, on the page); she can take it down again.
-- Private the way open.blog's own tables are: row level security on with no policies, nothing
-- granted to anon or authenticated; the family service reaches it as the database's owner.
-- Running it twice changes nothing.

create table if not exists public.grammis_fridge_magnets (
  site_id text not null,
  id smallint not null check (id between 0 and 199),
  x real not null check (x between 2 and 98),
  y real not null check (y between 2 and 98),
  r real not null default 0 check (r between -45 and 45),
  moved_at timestamptz not null default now(),
  primary key (site_id, id)
);

create table if not exists public.grammis_fridge_drawings (
  id uuid primary key default gen_random_uuid(),
  site_id text not null,
  created_at timestamptz not null default now(),
  by_name text not null default '' check (char_length(by_name) <= 40),
  -- Pen strokes only, as family/lib/fridge.js checked them: never a picture file, never markup.
  drawing jsonb not null check (jsonb_typeof(drawing) = 'object' and pg_column_size(drawing) < 200000),
  status text not null default 'waiting' check (status in ('waiting', 'up', 'down')),
  x real not null default 50 check (x between 2 and 98),
  y real not null default 30 check (y between 2 and 98),
  r real not null default 0 check (r between -45 and 45),
  moved_at timestamptz not null default now(),
  decided_at timestamptz,
  sender_digest text not null
);

create index if not exists grammis_fridge_drawings_status
  on public.grammis_fridge_drawings (site_id, status, created_at);

alter table public.grammis_fridge_magnets enable row level security;
alter table public.grammis_fridge_drawings enable row level security;
revoke all on public.grammis_fridge_magnets, public.grammis_fridge_drawings from public, anon, authenticated;

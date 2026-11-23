-- Notes to Grammi ("Write to Grammi" on The Fridge), kept after they are emailed to her, and when
-- she was last told what had come in. Private the way open.blog's own tables are: row level security
-- on with no policies, nothing granted to anon or authenticated. Running it twice changes nothing.

create table if not exists public.grammis_letters (
  id uuid primary key default gen_random_uuid(),
  site_id text not null,
  created_at timestamptz not null default now(),
  from_name text not null check (char_length(from_name) between 1 and 60),
  reply_to text check (reply_to is null or char_length(reply_to) between 3 and 200),
  note text not null check (char_length(note) between 1 and 2000),
  sender_digest text not null,
  -- Set once the email to her went out; one that didn't is tried again with the next ping.
  mailed_at timestamptz
);

create index if not exists grammis_letters_unmailed on public.grammis_letters (site_id, created_at) where mailed_at is null;
create index if not exists grammis_letters_sender on public.grammis_letters (site_id, sender_digest, created_at);

create table if not exists public.grammis_pings (
  site_id text primary key,
  -- Everything that came in before this has been told to her.
  told_until timestamptz not null
);

alter table public.grammis_letters enable row level security;
alter table public.grammis_pings enable row level security;
revoke all on public.grammis_letters, public.grammis_pings from public, anon, authenticated;

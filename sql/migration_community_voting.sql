-- sql/migration_community_voting.sql
-- Off-chain community voting tables for wallet-signed polls.

create table if not exists public.community_polls (
  id text primary key,
  title text not null,
  description text,
  options jsonb not null default '[]'::jsonb,
  linked_event_id bigint,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  closed_at timestamptz,
  created_by_address text,
  updated_by_address text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.community_poll_votes (
  id bigserial primary key,
  poll_id text not null references public.community_polls(id) on delete cascade,
  option_id text not null,
  voter_address text not null,
  created_at timestamptz default now()
);

create index if not exists community_polls_created_at_idx
  on public.community_polls (created_at desc);

create index if not exists community_polls_starts_at_idx
  on public.community_polls (starts_at desc);

create index if not exists community_poll_votes_poll_idx
  on public.community_poll_votes (poll_id);

create unique index if not exists community_poll_votes_poll_voter_uidx
  on public.community_poll_votes (poll_id, voter_address);

alter table public.community_polls enable row level security;
alter table public.community_poll_votes enable row level security;

create policy "community_polls_read_only"
  on public.community_polls for select
  using (true);

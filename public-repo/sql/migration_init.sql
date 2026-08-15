-- sql/migration_init.sql
-- Chat tables, indices, and RLS policies for Biggi live chat.

create table if not exists public.messages (
  id bigserial primary key,
  author_address text,
  author_name text,
  content text,
  created_at timestamptz default now(),
  edited_at timestamptz,
  deleted boolean default false
);

create table if not exists public.nonces (
  nonce text primary key,
  address text,
  created_at timestamptz default now(),
  used boolean default false
);

create table if not exists public.rules (
  id smallint primary key default 1,
  text text,
  updated_by_address text,
  updated_at timestamptz default now()
);

create table if not exists public.chat_config (
  id smallint primary key default 1,
  owner_address text,
  created_at timestamptz default now()
);

create table if not exists public.moderation_log (
  mod_id bigserial primary key,
  action text,
  message_id bigint,
  by_address text,
  at timestamptz default now()
);

create index if not exists messages_created_at_idx on public.messages (created_at);
create index if not exists nonces_created_at_idx on public.nonces (created_at);

alter table public.messages enable row level security;
alter table public.nonces enable row level security;
alter table public.rules enable row level security;
alter table public.chat_config enable row level security;
alter table public.moderation_log enable row level security;

-- Public read-only policies (client uses anon key for select).
create policy "messages_read_only"
  on public.messages for select
  using (true);

create policy "rules_read_only"
  on public.rules for select
  using (true);

create policy "chat_config_read_only"
  on public.chat_config for select
  using (true);

-- Seed config and rules (replace owner address before running).
insert into public.chat_config (id, owner_address)
values (1, '0x64ADb3e4B5BE8567c599bA8e050F7016C3D51eD0')
on conflict (id) do update set owner_address = excluded.owner_address;

insert into public.rules (id, text, updated_by_address)
values (1, 'Be respectful. No spam, scams, or off-topic flooding.', '0x64ADb3e4B5BE8567c599bA8e050F7016C3D51eD0')
on conflict (id) do update
set text = excluded.text, updated_by_address = excluded.updated_by_address, updated_at = now();

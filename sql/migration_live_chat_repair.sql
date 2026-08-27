-- Idempotent production repair for Biggi live chat.
-- Run this once in the Supabase SQL Editor for the configured project.

begin;

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

lock table public.nonces in share row exclusive mode;

delete from public.nonces
where address is null or btrim(address) = '';

update public.nonces
set address = lower(btrim(address));

with ranked as (
  select
    ctid as row_id,
    row_number() over (
      partition by address
      order by created_at desc nulls last, nonce desc
    ) as row_number
  from public.nonces
)
delete from public.nonces as nonce_row
using ranked
where nonce_row.ctid = ranked.row_id
  and ranked.row_number > 1;

alter table public.nonces alter column address set not null;

create unique index if not exists nonces_address_unique_idx
  on public.nonces (address);
create index if not exists nonces_created_at_idx
  on public.nonces (created_at);
create index if not exists messages_created_at_idx
  on public.messages (created_at desc);
create index if not exists messages_author_created_at_idx
  on public.messages (author_address, created_at desc);

alter table public.messages enable row level security;
alter table public.nonces enable row level security;
alter table public.rules enable row level security;
alter table public.chat_config enable row level security;
alter table public.moderation_log enable row level security;

drop policy if exists messages_read_only on public.messages;
create policy messages_read_only
  on public.messages for select
  using (true);

drop policy if exists rules_read_only on public.rules;
create policy rules_read_only
  on public.rules for select
  using (true);

drop policy if exists chat_config_read_only on public.chat_config;
create policy chat_config_read_only
  on public.chat_config for select
  using (true);

insert into public.chat_config (id, owner_address)
values (1, '0x402ce2ff958ab47edafc42296d2682cc8f9d92b2')
on conflict (id) do update
set owner_address = excluded.owner_address;

insert into public.rules (id, text, updated_by_address)
values (
  1,
  'Be respectful. No spam, scams, or off-topic flooding.',
  '0x402ce2ff958ab47edafc42296d2682cc8f9d92b2'
)
on conflict (id) do update
set text = excluded.text,
    updated_by_address = excluded.updated_by_address,
    updated_at = now();

alter table public.messages replica identity full;

do $$
begin
  if exists (
    select 1 from pg_publication where pubname = 'supabase_realtime'
  ) and not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'messages'
  ) then
    alter publication supabase_realtime add table public.messages;
  end if;
end
$$;

commit;

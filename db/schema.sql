-- طرح پیشنهادی Production (جایگزین JSON store)
-- برای multi-user به همه جدول‌های tenant-owned ستون user_id/tenant_id و RLS اضافه شود.

create table if not exists treasury_policy (
  id text primary key default 'default',
  payload jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists analysis_snapshot (
  id uuid primary key,
  created_at timestamptz not null default now(),
  payload jsonb not null
);

create table if not exists watch_rule (
  id uuid primary key,
  created_at timestamptz not null default now(),
  enabled boolean not null default true,
  payload jsonb not null
);

create table if not exists treasury_plan (
  id uuid primary key,
  created_at timestamptz not null default now(),
  enabled boolean not null default true,
  kind text not null,
  payload jsonb not null
);
create index if not exists treasury_plan_enabled_kind on treasury_plan(enabled, kind);

create table if not exists shadow_trade (
  id uuid primary key,
  created_at timestamptz not null default now(),
  payload jsonb not null
);

-- Exactly one execution reservation per preview/clientId. Insert this row transactionally
-- together with 24h budget checks BEFORE POSTing an order to WallGold.
create table if not exists trade_execution_claim (
  client_id text primary key,
  claimed_at timestamptz not null default now(),
  symbol text not null,
  side text not null check (side in ('buy','sell')),
  grams numeric(24,8) not null,
  notional_toman numeric(30,0) not null,
  state text not null default 'attempted',
  order_id text null,
  payload jsonb not null default '{}'::jsonb
);
create index if not exists trade_execution_claim_time on trade_execution_claim(claimed_at desc);

-- Append-only audit: MANY events may belong to the same client_id/order_id.
create table if not exists trade_audit (
  id bigserial primary key,
  client_id text not null,
  order_id text null,
  event_type text not null,
  created_at timestamptz not null default now(),
  payload jsonb not null
);
create index if not exists trade_audit_client_time on trade_audit(client_id, created_at desc);
create index if not exists trade_audit_order_time on trade_audit(order_id, created_at desc) where order_id is not null;

create table if not exists market_snapshot (
  id bigserial primary key,
  observed_at timestamptz not null,
  symbol text not null,
  payload jsonb not null
);
create index if not exists market_snapshot_symbol_time on market_snapshot(symbol, observed_at desc);

-- Credential material MUST NOT be stored in the tables above.
-- Use a dedicated secret manager / KMS-backed vault for private/self-hosted deployments.
-- A public multi-user OpenAI Plugin should not collect/process users raw WallGold API keys; use an official
-- WallGold delegation/integration model instead and keep only non-secret account linkage metadata here.

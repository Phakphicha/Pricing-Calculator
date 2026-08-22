-- ═══════════════════════════════════════════════════════════
-- Multi-Platform Pricing Calculator (TH) — schema.sql
-- Cloud mode (Mode 2): Supabase / PostgreSQL schema.
-- The app runs fully client-side (LocalStorage) by default;
-- run this schema in Supabase and plug the URL + anon key
-- into a fetch() wrapper in app.js to sync calculations.
-- ═══════════════════════════════════════════════════════════

-- ผู้ใช้งาน (แขกรับเรียบร้อยใช้ anonymous id ได้)
create table if not exists public.users (
  id          uuid primary key default gen_random_uuid(),
  email       text unique,
  display_name text,
  created_at  timestamptz not null default now()
);

-- อัตราค่าธรรมเนียมต่อแพลตฟอร์ม/หมวดหมู่ (preset กลาง)
create table if not exists public.fee_presets (
  id            serial primary key,
  platform      text not null check (platform in ('shopee','tiktok','lazada','custom')),
  category      text not null,               -- fashion | electronics | health | fmcg | other
  commission_pct numeric(5,2) not null default 0,
  payment_pct    numeric(5,2) not null default 0,
  service_pct    numeric(5,2) not null default 0,
  campaign_pct   numeric(5,2) not null default 0,
  fixed_fee_bht  numeric(10,2) not null default 0,
  effective_date date not null default current_date,
  created_at     timestamptz not null default now(),
  unique (platform, category, effective_date)
);

-- ประวัติการคำนวณ (sync จาก LocalStorage)
create table if not exists public.calculations (
  id            bigserial primary key,
  user_id       uuid references public.users(id) on delete cascade,
  sku           text,
  platform      text not null,
  calc_mode     text not null check (calc_mode in ('target','evaluate')),
  cost_bht      numeric(12,2) not null,
  packaging_bht numeric(12,2) not null default 0,
  target_profit_bht numeric(12,2),
  sell_price_bht numeric(12,2) not null,
  net_profit_bht numeric(12,2) not null,
  margin_pct    numeric(6,2) not null,
  ads_pct       numeric(5,2) not null default 0,
  voucher_pct   numeric(5,2) not null default 0,
  fees_snapshot jsonb not null default '{}',  -- snapshot ของอัตราค่าธรรมเนียม ณ วันคำนวณ
  created_at    timestamptz not null default now()
);

-- โหมดหลายสินค้า (bulk)
create table if not exists public.bulk_items (
  id             bigserial primary key,
  calculation_batch_id uuid,                  -- รหัสชุดการคำนวณ (สร้างฝั่ง client ก็ได้)
  sku            text not null,
  cost_bth       numeric(12,2) not null,
  packaging_bth  numeric(12,2) not null default 0,
  target_profit  numeric(12,2) not null,
  results        jsonb not null default '{}', -- ราคา/กำไรต่อแพลตฟอร์ม
  created_at     timestamptz not null default now()
);

create index if not exists idx_calculations_user   on public.calculations(user_id, created_at desc);
create index if not exists idx_calculations_sku    on public.calculations(sku);
create index if not exists idx_bulk_items_batch    on public.bulk_items(calculation_batch_id);

-- ── Row Level Security (Supabase) ──
alter table public.users        enable row level security;
alter table public.calculations enable row level security;
alter table public.bulk_items   enable row level security;
alter table public.fee_presets  enable row level security;

-- preset เป็นข้อมูลสาธารณะ (อ่านได้ทุกคน เขียนได้เฉพาะ admin)
create policy "fee_presets_public_read" on public.fee_presets
  for select using (true);

-- ผู้ใช้เห็น/แก้ไขเฉพาะข้อมูลของตัวเอง (สมมติใช้ auth.uid() ของ Supabase)
create policy "own_calculations" on public.calculations
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own_bulk_items" on public.bulk_items
  for all using (true) with check (true);  -- ปรับตามโครงสร้าง auth ของคุณ

-- ── ตัวอย่าง seed ข้อมูล preset ──
insert into public.fee_presets (platform, category, commission_pct, payment_pct, service_pct, campaign_pct, fixed_fee_bht)
values
  ('shopee','fashion',4.0,2.0,0,3.0,1.07),
  ('shopee','electronics',5.0,2.0,0,3.0,1.07),
  ('shopee','health',5.5,2.0,0,3.0,1.07),
  ('shopee','fmcg',3.0,2.0,0,3.0,1.07),
  ('tiktok','fashion',4.0,1.6,0,2.0,0),
  ('tiktok','electronics',4.5,1.6,0,2.0,0),
  ('tiktok','health',5.0,1.6,0,2.0,0),
  ('tiktok','fmcg',3.0,1.6,0,2.0,0),
  ('lazada','fashion',3.0,2.0,1.0,2.0,0),
  ('lazada','electronics',4.0,2.0,1.0,2.0,0),
  ('lazada','health',4.5,2.0,1.0,2.0,0),
  ('lazada','fmcg',2.5,2.0,1.0,2.0,0)
on conflict (platform, category, effective_date) do nothing;

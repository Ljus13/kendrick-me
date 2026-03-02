-- ============================================================
-- Bertie Bott's Every Flavour Beans — Phase 1: Schema + RLS
-- Run this in Supabase SQL Editor (Dashboard → SQL → New query)
-- ============================================================

-- ──────────────────────────────────────────────────────────────
-- 1. beans_master — คลังข้อมูลเยลลี่ (Master Data)
-- ──────────────────────────────────────────────────────────────
create table if not exists public.beans_master (
  id          uuid primary key default gen_random_uuid(),
  flavor      text not null,
  flavor_th   text not null,          -- ชื่อรสชาติภาษาไทย (แสดงบนหน้าเว็บ)
  points      integer not null default 0,
  img_hidden  text,  -- URL จาก Supabase Storage (รูปก่อนเปิด)
  img_revealed text, -- URL จาก Supabase Storage (รูปหลังเปิด)
  created_at  timestamptz not null default now()
);

comment on table public.beans_master is 'Master data for jelly bean flavors, managed by Admin CMS';

-- ──────────────────────────────────────────────────────────────
-- 2. game_rooms — ห้องแข่งขัน
-- ──────────────────────────────────────────────────────────────
create table if not exists public.game_rooms (
  id            uuid primary key default gen_random_uuid(),
  room_code     text not null unique,
  status        text not null default 'waiting'
                  check (status in ('waiting', 'playing', 'finished')),
  players       jsonb not null default '[]'::jsonb,
  -- players shape: [{ session_id, name, ip, score, turn_order, is_ready }]
  current_turn  integer not null default 0,
  total_clicked integer not null default 0,
  created_at    timestamptz not null default now()
);

create index if not exists idx_game_rooms_code on public.game_rooms (room_code);
create index if not exists idx_game_rooms_status on public.game_rooms (status);

comment on table public.game_rooms is 'Active/completed game rooms with player state';

-- ──────────────────────────────────────────────────────────────
-- 3. game_board — กระดาน 5×4 (20 ช่อง) ต่อห้อง
-- ──────────────────────────────────────────────────────────────
create table if not exists public.game_board (
  id          uuid primary key default gen_random_uuid(),
  room_id     uuid not null references public.game_rooms (id) on delete cascade,
  slot_index  integer not null check (slot_index >= 0 and slot_index <= 19),
  bean_id     uuid not null references public.beans_master (id),
  is_revealed boolean not null default false,
  revealed_by uuid,  -- session_id ของคนที่คลิก

  unique (room_id, slot_index)
);

create index if not exists idx_game_board_room on public.game_board (room_id);

comment on table public.game_board is 'Per-room 5x4 grid (20 slots) mapping slots to beans';

-- ──────────────────────────────────────────────────────────────
-- 4. global_leaderboard — คะแนนรวมสะสมต่อผู้เล่น (upsert by name)
-- ──────────────────────────────────────────────────────────────
create table if not exists public.global_leaderboard (
  id            uuid primary key default gen_random_uuid(),
  player_name   text not null unique,  -- ชื่อซ้ำ = row เดิม
  total_score   integer not null default 0,
  games_played  integer not null default 0,
  best_score    integer,               -- คะแนนสูงสุดที่เคยทำได้ในเกมเดียว
  last_played   timestamptz not null default now(),
  ip_address    text
);

create index if not exists idx_leaderboard_score on public.global_leaderboard (total_score desc);
create index if not exists idx_leaderboard_played on public.global_leaderboard (last_played desc);

comment on table public.global_leaderboard is 'Accumulated player scores — upsert by player_name';

-- ──────────────────────────────────────────────────────────────
-- 5. profiles — ผู้เล่นที่สมัครสมาชิก (Supabase Auth)
--    ผูกกับ auth.users — ในอนาคตจะมีฟีเจอร์พิเศษ
-- ──────────────────────────────────────────────────────────────
create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  username    text unique,
  display_name text,
  avatar_url  text,
  role        text not null default 'player' check (role in ('player', 'admin')),
  created_at  timestamptz not null default now()
);

comment on table public.profiles is 'Registered user profiles linked to Supabase Auth — future premium features';

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, username, display_name)
  values (
    new.id,
    new.raw_user_meta_data ->> 'username',
    coalesce(new.raw_user_meta_data ->> 'display_name', new.raw_user_meta_data ->> 'username')
  );
  return new;
end;
$$ language plpgsql security definer;

-- Trigger: เมื่อ user ใหม่สมัคร → สร้าง profile อัตโนมัติ
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();


-- ============================================================
-- RLS Policies
-- ============================================================

-- Enable RLS on all tables
alter table public.beans_master enable row level security;
alter table public.game_rooms enable row level security;
alter table public.game_board enable row level security;
alter table public.global_leaderboard enable row level security;
alter table public.profiles enable row level security;

-- ── beans_master ─────────────────────────────────────────────
-- ทุกคนอ่านได้ (เกมต้องดึงข้อมูลเยลลี่)
create policy "beans_master: public read"
  on public.beans_master for select
  to anon, authenticated
  using (true);

-- เฉพาะ Admin (authenticated) เท่านั้นที่เขียนได้
create policy "beans_master: admin insert"
  on public.beans_master for insert
  to authenticated
  with check (true);

create policy "beans_master: admin update"
  on public.beans_master for update
  to authenticated
  using (true)
  with check (true);

create policy "beans_master: admin delete"
  on public.beans_master for delete
  to authenticated
  using (true);

-- ── game_rooms ───────────────────────────────────────────────
-- ทุกคนอ่าน/เขียนได้ (public gameplay, ผู้เล่นไม่ต้อง login)
create policy "game_rooms: public read"
  on public.game_rooms for select
  to anon, authenticated
  using (true);

create policy "game_rooms: public insert"
  on public.game_rooms for insert
  to anon, authenticated
  with check (true);

create policy "game_rooms: public update"
  on public.game_rooms for update
  to anon, authenticated
  using (true)
  with check (true);

-- ── game_board ───────────────────────────────────────────────
create policy "game_board: public read"
  on public.game_board for select
  to anon, authenticated
  using (true);

create policy "game_board: public insert"
  on public.game_board for insert
  to anon, authenticated
  with check (true);

create policy "game_board: public update"
  on public.game_board for update
  to anon, authenticated
  using (true)
  with check (true);

-- ── global_leaderboard ──────────────────────────────────────
-- ทุกคนอ่านได้
create policy "leaderboard: public read"
  on public.global_leaderboard for select
  to anon, authenticated
  using (true);

-- ทุกคน insert ได้ (บันทึกคะแนนหลังจบเกม)
create policy "leaderboard: public insert"
  on public.global_leaderboard for insert
  to anon, authenticated
  with check (true);

-- ทุกคน update ได้ (สำหรับ upsert สะสมคะแนน)
create policy "leaderboard: public update"
  on public.global_leaderboard for update
  to anon, authenticated
  using (true)
  with check (true);

-- ห้าม delete (ป้องกันลบคะแนน)
-- ไม่สร้าง policy = ไม่อนุญาตโดยอัตโนมัติเพราะ RLS เปิดอยู่

-- ── profiles ─────────────────────────────────────────────────
-- อ่านได้ทุกคน (แสดง avatar, display_name ในเกม)
create policy "profiles: public read"
  on public.profiles for select
  to anon, authenticated
  using (true);

-- เจ้าของ profile แก้ไขได้เฉพาะของตัวเอง
create policy "profiles: owner update"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);


-- ============================================================
-- Storage Bucket: bean-images (public)
-- ============================================================
-- Note: ต้องสร้าง bucket ผ่าน Supabase Dashboard → Storage → New bucket
-- ชื่อ: bean-images
-- Public: Yes
--
-- หรือใช้ SQL นี้ (ถ้า Supabase version รองรับ):
insert into storage.buckets (id, name, public)
values ('bean-images', 'bean-images', true)
on conflict (id) do nothing;

-- Storage policy: ให้ทุกคนอ่านรูปได้
create policy "bean-images: public read"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'bean-images');

-- เฉพาะ authenticated (Admin) upload/delete ได้
create policy "bean-images: admin upload"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'bean-images');

create policy "bean-images: admin update"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'bean-images');

create policy "bean-images: admin delete"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'bean-images');

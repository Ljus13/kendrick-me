# 🍬 Bertie Bott's Every Flavour Beans — Build Phases

**Stack:** SolidJS · Tailwind CSS · Supabase (PostgreSQL + Realtime + Storage + Auth)  
**Theme:** `#10141d` · `#151723` · `#b1a59a` — Harry Potter Vibe

---

## Phase 1 — Project Foundation & DB Schema

**Goal:** ตั้ง project structure + Supabase ให้พร้อมก่อนสร้าง feature

- [x] Init SolidJS + Tailwind CSS project
- [x] เชื่อม Supabase client (`supabase-js`)
- [x] สร้าง Tables ใน Supabase: → `supabase/001_schema_and_rls.sql`

| Table | Key Columns |
|---|---|
| `beans_master` | `id`, `flavor`, `points`, `img_hidden`, `img_revealed` |
| `game_rooms` | `id`, `room_code`, `status`, `players (JSONB)`, `current_turn`, `total_clicked` |
| `game_board` | `room_id`, `slot_index` (0–19), `bean_id`, `is_revealed` |
| `global_leaderboard` | `id`, `player_name` (unique), `total_score`, `games_played`, `best_score`, `last_played` |
| `profiles` | `id` (FK auth.users), `username`, `display_name`, `avatar_url`, `role` |

- [x] ตั้ง RLS policies → รวมอยู่ใน `001_schema_and_rls.sql`
  - `beans_master`: อ่านได้ทุกคน / เขียนได้เฉพาะ Authenticated (Admin)
  - `game_rooms`, `game_board`: อ่าน/เขียนได้ทุกคน (public gameplay)
  - `global_leaderboard`: อ่านได้ทุกคน / insert+update ได้ทุกคน (upsert) / delete ไม่ได้
  - `profiles`: อ่านได้ทุกคน / update ได้เฉพาะเจ้าของ
- [x] สร้าง Supabase Storage bucket: `bean-images` → รวมอยู่ใน `001_schema_and_rls.sql`
- [x] เพิ่ม seed data เยลลี่ 20 รส → `supabase/002_seed_beans.sql`
- [x] TypeScript types → `src/types/database.ts`

---

## Phase 2 — Admin CMS

**Goal:** ให้ Admin จัดการ Master Data เยลลี่ได้ผ่าน UI โดยไม่ต้องแตะ DB โดยตรง

- [x] หน้า `/admin/login` — Supabase Email/Password Auth
- [x] Route guard: redirect ถ้า session ไม่ valid
- [x] หน้า `/admin/dashboard`:
  - ตาราง Bean Listing (ชื่อ, คะแนน, รูป, ปุ่ม Edit/Delete)
  - Form เพิ่ม Bean ใหม่ (flavor, flavor_th, points, upload `img_hidden` + `img_revealed`)
  - File Uploader → Supabase Storage → เก็บ URL ลง `beans_master` อัตโนมัติ
  - สรุปสถิติ: จำนวนรสชาติ, คะแนนเฉลี่ย, รสดี/แย่, สถานะรูป

---

## Phase 3 — Lobby & Room System (No-Auth Players)

**Goal:** ผู้เล่นทั่วไปเข้าเกมได้ทันทีโดยไม่ต้องสมัครสมาชิก

- [ ] หน้า Home: กรอก Nickname → สร้าง `session_id` (UUID) เก็บใน `localStorage`
- [ ] สร้างห้อง: generate `room_code` (เช่น `BB-8899`) → insert `game_rooms`
- [ ] เข้าห้อง: กรอก room_code → ดึง room data
- [ ] Lobby UI: แสดงผู้เล่นใน Realtime ด้วย **Supabase Presence**
- [ ] ปุ่ม "Ready" — เมื่อทุกคน ready (2–4 คน) → trigger เริ่มเกม
- [ ] Virtual Dice Roll: สุ่มลำดับ `turn_order` ให้ผู้เล่นแต่ละคน

---

## Phase 4 — Core Gameplay (Real-time)

**Goal:** ระบบหัวใจของเกม — เลือกเยลลี่, คำนวณแต้ม, sync ทุกคนพร้อมกัน

- [ ] Game Init: สุ่มเยลลี่ 20 เม็ดจาก `beans_master` → insert ลง `game_board`
- [ ] Grid 5×4 UI: แสดง `img_hidden` ทั้ง 20 ช่อง
- [ ] Turn indicator: highlight ว่าตอนนี้ใครเล่น (เช็คจาก `session_id` vs `current_turn`)
- [ ] Click bean:
  1. Optimistic UI — เปลี่ยนรูปทันที (instant feedback)
  2. update `game_board.is_revealed = true`
  3. คำนวณ score → update `players[].score` ใน `game_rooms`
  4. advance `current_turn` → คนถัดไป
- [ ] **Supabase Broadcast**: broadcast event ให้ทุก client อัปเดต board พร้อมกัน
- [ ] แสดง flavor name + points popup หลังคลิก

---

## Phase 5 — Game End, Ranking & Leaderboard

**Goal:** สรุปผลเกม + บันทึกสถิติ Global

- [ ] ตรวจ `total_clicked === 20` → trigger game end
- [ ] หน้า Podium: แสดงอันดับ 1–4 พร้อมชื่อและคะแนน
- [ ] Auto-save: **upsert** คะแนนลง `global_leaderboard` (ชื่อซ้ำสะสม total_score + games_played + best_score)
- [ ] หน้า `/stats` (Public):
  - Top 10 / Top 50 High Scores ตลอดกาล
  - Recent Players (เกมที่เพิ่งจบ)
- [ ] ลิงก์ Stats จากหน้า Home

---

## Phase 6 — Effects & Polish

**Goal:** เพิ่มความสนุกและ Harry Potter Vibe

- [ ] Emote / Reaction buttons ระหว่างเกม
- [ ] Screen shake effect เมื่อคนอื่นเจอเม็ดคะแนนติดลบมาก (Broadcast event)
- [ ] Animations: bean flip, score popup, dice roll
- [ ] Harry Potter theme: เลือก font, สี `#10141d / #151723 / #b1a59a`, texture/pattern
- [ ] Responsive layout (mobile-friendly)
- [ ] Loading states & error handling ทุก async call

---

## Phase 7 — Testing & Deploy

- [ ] ทดสอบ Realtime sync หลายคน (2–4 players จริง)
- [ ] ทดสอบ Edge cases: disconnect กลางเกม, room expired
- [ ] Deploy Frontend → Vercel / Netlify
- [ ] ตั้ง Supabase production environment variables
- [ ] Smoke test: Admin login → add bean → play full game → check leaderboard

---

## สรุป Phase Overview

```
Phase 1 → DB + Supabase Setup          (Foundation)      ✅ SQL ready
Phase 2 → Admin CMS                    (Content Management) ✅ Done
Phase 3 → Lobby & Room System          (Player Entry)      ← ถัดไป
Phase 4 → Realtime Gameplay            (Core Loop)
Phase 5 → Game End & Leaderboard       (Scoring)
Phase 6 → Effects & Polish             (UX/Theme)
Phase 7 → Testing & Deploy             (Ship it)
```

> **แนะนำ:** เริ่ม Phase 1 → 2 เพื่อให้มีข้อมูลเยลลี่ก่อน แล้วค่อยทำ Phase 3-4 พร้อมกันเพราะ Lobby กับ Gameplay ต้องทดสอบร่วมกัน

---

## Progress Log

| Date | Completed |
|---|---|
| 2026-03-02 | Phase 0: SolidJS + Vite + Tailwind v4 + Supabase client installed, `.gitignore`, `.env.example` created |
| 2026-03-02 | Phase 1: SQL migrations ready (`001_schema_and_rls.sql`, `002_seed_beans.sql`), TS types, cleaned up dupes |
| 2026-03-02 | Update: Grid 5×4 (20 slots), Leaderboard upsert by name, profiles table + auth trigger |
| 2026-03-02 | Phase 2: Admin CMS — login, auth guard, dashboard, bean CRUD, file uploader, stats overview |

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
| `game_rooms` | `id`, `room_code`, `status`, `players (JSONB)`, `current_turn`, `total_clicked`, `bean_count` |
| `game_board` | `room_id`, `slot_index` (0–49), `bean_id`, `is_revealed` |
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

- [x] หน้า Home: กรอก Nickname → สร้าง `session_id` (UUID) เก็บใน `localStorage`
- [x] สร้างห้อง: generate `room_code` (เช่น `BB-8899`) → insert `game_rooms`
- [x] เข้าห้อง: กรอก room_code → ดึง room data
- [x] Lobby UI: แสดงผู้เล่นใน Realtime ด้วย **Supabase Presence**
- [x] ปุ่ม "Ready" — เมื่อทุกคน ready (2–4 คน) → trigger เริ่มเกม
- [x] Virtual Dice Roll: สุ่มลำดับ `turn_order` ให้ผู้เล่นแต่ละคน

---

## Phase 4 — Core Gameplay (Real-time)

**Goal:** ระบบหัวใจของเกม — เลือกเยลลี่, คำนวณแต้ม, sync ทุกคนพร้อมกัน

- [x] Game Init: สุ่มเยลลี่ 20 เม็ดจาก `beans_master` → insert ลง `game_board`
- [x] Grid 5×4 UI: แสดง `img_hidden` ทั้ง 20 ช่อง
- [x] Turn indicator: highlight ว่าตอนนี้ใครเล่น (เช็คจาก `session_id` vs `current_turn`)
- [x] Click bean:
  1. Optimistic UI — เปลี่ยนรูปทันที (instant feedback)
  2. update `game_board.is_revealed = true`
  3. คำนวณ score → update `players[].score` ใน `game_rooms`
  4. advance `current_turn` → คนถัดไป
- [x] **Supabase Broadcast**: broadcast event ให้ทุก client อัปเดต board พร้อมกัน
- [x] แสดง flavor name + points popup หลังคลิก

---

## Phase 5 — Game End, Ranking & Leaderboard

**Goal:** สรุปผลเกม + บันทึกสถิติ Global

- [x] ตรวจ `total_clicked === 20` → trigger game end
- [x] หน้า Podium: แสดงอันดับ 1–4 พร้อมชื่อและคะแนน
- [x] Auto-save: **upsert** คะแนนลง `global_leaderboard` (ชื่อซ้ำสะสม total_score + games_played + best_score)
- [x] หน้า `/stats` (Public):
  - Top 10 / Top 50 High Scores ตลอดกาล
  - Recent Players (เกมที่เพิ่งจบ)
- [x] ลิงก์ Stats จากหน้า Home

---

## Phase 6 — Effects & Polish

**Goal:** เพิ่มความสนุกและ Harry Potter Vibe

- [x] Emote / Reaction buttons ระหว่างเกม
- [x] Screen shake effect เมื่อคนอื่นเจอเม็ดคะแนนติดลบมาก (Broadcast event)
- [x] Animations: bean flip, score popup, dice roll
- [x] Harry Potter theme: เลือก font, สี `#10141d / #151723 / #b1a59a`, texture/pattern
- [x] Responsive layout (mobile-friendly)
- [x] Loading states & error handling ทุก async call

---

## Phase 7 — Testing & Deploy

- [x] ทดสอบ Realtime sync หลายคน (2–4 players จริง)
- [x] ทดสอบ Edge cases: disconnect กลางเกม, room expired
- [x] Deploy Frontend → Vercel / Netlify
- [x] ตั้ง Supabase production environment variables
- [x] Smoke test: Admin login → add bean → play full game → check leaderboard

---

## สรุป Phase Overview

```
Phase 1 → DB + Supabase Setup          (Foundation)      ✅ SQL ready
Phase 2 → Admin CMS                    (Content Management) ✅ Done
Phase 3 → Lobby & Room System          (Player Entry)      ✅ Done
Phase 4 → Realtime Gameplay            (Core Loop)         ✅ Done
Phase 5 → Game End & Leaderboard       (Scoring)           ✅ Done
Phase 6 → Effects & Polish             (UX/Theme)          ✅ Done
Phase 7 → Testing & Deploy             (Ship it)           ✅ Done
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
| 2026-03-02 | Phase 3: Lobby & Room System — playerStore, roomStore, roomHelpers, Home (nickname+room), Lobby (presence+ready+dice), router |
| 2026-03-02 | Phase 4: Core Gameplay — gameStore (init/load/click/broadcast), Game page (5×4 grid, turn indicator, score sidebar, reveal popup, game-over overlay), CSS animations |
| 2026-03-02 | Phase 5: Game End & Leaderboard — leaderboardStore (auto-save ranked scores), Stats page (top scores + recent players), footer link |
| 2026-03-02 | Phase 6: Effects & Polish — Emote system (4 reactions via Broadcast), screen shake on bad beans (≤-3), bean flip 3D animation, score float-up, HP font (Cinzel + Crimson Text), parchment bg texture, shimmer on hidden beans, glow pulse, responsive mobile layout, improved loading states |
| 2026-03-02 | Phase 7: Testing & Deploy — Connection status banner (connected/reconnecting/disconnected), auto-reconnect on visibility change & network recovery, room expiry guard (2h max), Vercel deploy config (`vercel.json` + SPA rewrites), env var docs in `.env.example`, CSS @import fix |
| 2026-03-03 | Feature: Configurable bean count per room — เลือก 20/30/40/50 เม็ดตอนสร้างห้อง, dynamic grid layout (5×4 / 6×5 / 8×5 / 10×5), max players 4 คน (20/30) หรือ 6 คน (40/50), migration `005_add_bean_count.sql` |
| 2026-03-03 | Feature: Stackable reveal popups — popups ซ้อนกันที่ด้านบน (max 8), auto-remove อิสระทีละอัน (3s), compact horizontal layout |
| 2026-03-03 | Fix: DB constraint `game_board.slot_index` ขยาย 0–19 → 0–49 via `006_expand_slot_index.sql` |
| 2026-03-03 | Fix: Screen shake — เบาลง (±2px, 0.4s) และเขย่าเฉพาะผู้เล่นที่กดโดน ไม่กระทบคนอื่น |

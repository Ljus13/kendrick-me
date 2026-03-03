# 🍬 Bertie Bott's Every Flavour Beans — Multiplayer Web Game

<p align="center">
  <img src="https://img.shields.io/badge/SolidJS-1.9-blue?logo=solid" alt="SolidJS" />
  <img src="https://img.shields.io/badge/Supabase-Realtime-3ecf8e?logo=supabase" alt="Supabase" />
  <img src="https://img.shields.io/badge/Tailwind_CSS-v4-38bdf8?logo=tailwindcss" alt="Tailwind" />
  <img src="https://img.shields.io/badge/TypeScript-strict-3178c6?logo=typescript" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Deploy-Vercel-black?logo=vercel" alt="Vercel" />
</p>

> เกม Harry Potter มัลติเพลเยอร์แบบเรียลไทม์   สุ่มเยลลี่บีน 20 เม็ด — รสชาติดีได้แต้ม รสชาติแย่โดนหักแต้ม 🧙‍♂️

---

## ✨ Features

| Category | Details |
|---|---|
| **Multiplayer 2-4 คน** | สร้างห้อง / เข้าห้องด้วยรหัส `BB-XXXX` พร้อมระบบ Ready + Dice Roll สุ่มลำดับ |
| **Realtime Sync** | Supabase Presence + Broadcast — ทุกคนเห็นบอร์ดเดียวกันแบบ real-time |
| **No-Auth Players** | ไม่ต้องสมัครสมาชิก ใช้ Nickname + Session ID เล่นได้ทันที |
| **Admin CMS** | จัดการรสชาติ เพิ่ม/ลบ/แก้ไข อัปโหลดรูป ผ่าน Dashboard (Supabase Auth) |
| **Global Leaderboard** | บันทึกสถิติอัตโนมัติ — Top Scores, Recent Players |
| **Connection Management** | ตรวจจับ IP ซ้ำ, ชื่อซ้ำ, ข้ามตาคนที่หลุด, โอนสิทธิ์หัวห้องอัตโนมัติ |
| **In-Game Chat** | แชทในเกมแบบ real-time ผ่าน Broadcast |
| **Emotes + Effects** | รีแอค 4 แบบ, Screen Shake, 3D Bean Flip Animation |
| **Harry Potter Theme** | สี `#10141d` / `#151723` / `#b1a59a` + ฟอนต์ Cinzel & Kanit |
| **Responsive** | เล่นได้ทั้ง Desktop และ Mobile |

---

## 🏗 Tech Stack

```
Frontend    → SolidJS 1.9 + TypeScript (strict)
Styling     → Tailwind CSS v4
Backend     → Supabase (PostgreSQL + Realtime + Storage + Auth)
Realtime    → Supabase Presence (online/offline) + Broadcast (events)
Deploy      → Vercel (auto-deploy from GitHub)
Fonts       → Cinzel (English display) + Kanit (Thai body)
```

---

## 📁 Project Structure

```
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
├── vercel.json                   # SPA rewrite rules
├── .env.example                  # Environment variable template
│
├── src/
│   ├── App.tsx                   # Router setup
│   ├── index.tsx                 # Entry point
│   ├── index.css                 # Global styles + animations
│   │
│   ├── components/
│   │   └── admin/
│   │       ├── AuthGuard.tsx     # Admin route protection
│   │       ├── BeanForm.tsx      # CRUD form for beans
│   │       ├── BeanTable.tsx     # Bean listing table
│   │       ├── FileUploader.tsx  # Image upload to Supabase Storage
│   │       └── StatsOverview.tsx # Admin stats summary
│   │
│   ├── lib/
│   │   ├── supabase.ts          # Supabase client init
│   │   └── ip.ts                # Public IP detection (session cached)
│   │
│   ├── pages/
│   │   ├── Home.tsx              # Nickname + Create/Join room
│   │   ├── Lobby.tsx             # Waiting room + Ready + Dice Roll
│   │   ├── Game.tsx              # 5×4 grid gameplay + chat + emotes
│   │   ├── Stats.tsx             # Global leaderboard
│   │   └── admin/
│   │       ├── AdminLogin.tsx    # Admin authentication
│   │       └── AdminDashboard.tsx# Bean management CMS
│   │
│   ├── stores/
│   │   ├── playerStore.ts       # Player identity (localStorage)
│   │   ├── roomStore.ts         # Room CRUD + Presence + Session mgmt
│   │   ├── gameStore.ts         # Board state + turns + scoring + chat
│   │   ├── leaderboardStore.ts  # Global score tracking
│   │   └── authStore.ts         # Admin auth state
│   │
│   └── types/
│       └── database.ts          # TypeScript interfaces for all tables
│
└── supabase/
    ├── 001_schema_and_rls.sql   # Tables + RLS policies + Storage bucket
    ├── 002_seed_beans.sql       # 20 bean flavors seed data
    ├── 003_enable_realtime.sql  # Enable Realtime on tables
    └── 004_fix_delete_rls.sql   # DELETE policy for game cleanup
```

---

## 🚀 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) v18+
- [Supabase](https://supabase.com/) account (free tier works)
- [Vercel](https://vercel.com/) account (optional, for deploy)

### 1. Clone & Install

```bash
git clone https://github.com/Ljus13/kendrick-me.git
cd kendrick-me
npm install
```

### 2. Setup Supabase

1. สร้าง project ใหม่ที่ [supabase.com](https://supabase.com)
2. ไปที่ **SQL Editor** แล้วรันไฟล์ SQL ตามลำดับ:

```
supabase/001_schema_and_rls.sql   ← สร้าง tables + RLS + storage bucket
supabase/002_seed_beans.sql       ← เพิ่มเยลลี่ 20 รสชาติ
supabase/003_enable_realtime.sql  ← เปิด Realtime สำหรับ game tables
supabase/004_fix_delete_rls.sql   ← เพิ่ม DELETE policy
```

3. คัดลอก **Project URL** และ **anon public key** จาก Settings → API

### 3. Environment Variables

```bash
cp .env.example .env
```

แก้ไข `.env`:

```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-public-key-here
```

### 4. Run Development Server

```bash
npm run dev
```

เปิด [http://localhost:5173](http://localhost:5173)

### 5. Create Admin Account

1. ไปที่ Supabase Dashboard → **Authentication** → **Users**
2. สร้าง user ด้วย email + password
3. ไปที่ **Table Editor** → ตาราง `profiles` → แก้ `role` เป็น `admin`
4. เข้าหน้า `/admin/login` เพื่อใช้ Admin CMS

---

## 🎮 How to Play

1. **กรอกชื่อ** — ตั้งชื่อเล่นได้เลย ไม่ต้องสมัคร
2. **สร้างห้อง** หรือ **เข้าห้อง** ด้วยรหัส `BB-XXXX`
3. **รอผู้เล่น** 2-4 คน กด Ready ทุกคน
4. **ทอยลูกเต๋า** สุ่มลำดับเล่น
5. **เลือกเยลลี่** ผลัดกันเลือก 20 เม็ด — รสดีได้แต้ม รสแย่โดนหัก!
6. **จบเกม** ดูอันดับ + บันทึก Leaderboard อัตโนมัติ

---

## 🔗 Connection & Session Management

โปรเจกต์นี้มีระบบจัดการ connection ครบ:

| สถานการณ์ | วิธีจัดการ |
|---|---|
| เปิดบราวเซอร์ใหม่ เครื่องเดิม | ตรวจจับ IP ซ้ำ → แจ้งเตือนให้เล่นต่อหรือเริ่มใหม่ |
| ชื่อซ้ำข้ามห้อง | บล็อกไม่ให้เข้า → แจ้งเปลี่ยนชื่อ |
| หลุด / เน็ตดับ / ปิดแอพ | แสดงแถบสถานะ 🔗 แดง + auto reconnect |
| 2 คนเล่น มีคนหลุด | แสดง Modal ให้เลือก "รอ" หรือ "จบเกม" |
| 3-4 คน มีคนหลุด | ข้ามตาคนที่ offline อัตโนมัติ (5 วินาที) |
| หัวห้องหลุด | นับถอยหลัง 2 นาที → สุ่มโอนสิทธิ์หัวห้องใหม่ |

---

## 🗄 Database Schema

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────────┐
│  beans_master    │     │   game_rooms     │     │    game_board       │
├─────────────────┤     ├──────────────────┤     ├─────────────────────┤
│ id (uuid)       │     │ id (uuid)        │◄────│ room_id (fk)        │
│ flavor          │◄────│ players (jsonb)  │     │ slot_index (0-19)   │
│ flavor_th       │     │ room_code        │     │ bean_id (fk)        │
│ points          │     │ status           │     │ is_revealed         │
│ img_hidden      │     │ current_turn     │     │ revealed_by         │
│ img_revealed    │     │ total_clicked    │     └─────────────────────┘
└─────────────────┘     └──────────────────┘
                                                  ┌─────────────────────┐
┌─────────────────┐     ┌──────────────────┐     │    profiles          │
│ global_          │     │ supabase storage │     ├─────────────────────┤
│ leaderboard     │     ├──────────────────┤     │ id (auth.users fk)  │
├─────────────────┤     │ bean-images/     │     │ username            │
│ player_name     │     │  ├── hidden/     │     │ display_name        │
│ total_score     │     │  └── revealed/   │     │ avatar_url          │
│ games_played    │     └──────────────────┘     │ role (admin/player) │
│ best_score      │                               └─────────────────────┘
└─────────────────┘
```

---

## 📡 Realtime Architecture

```
                     Supabase Realtime
                     ─────────────────
                            │
            ┌───────────────┼───────────────┐
            │               │               │
      ┌─────▼─────┐  ┌─────▼─────┐  ┌──────▼──────┐
      │  Presence  │  │ Broadcast │  │  postgres_   │
      │            │  │           │  │  changes     │
      ├────────────┤  ├───────────┤  ├──────────────┤
      │ • Online/  │  │ • Bean    │  │ • Room       │
      │   Offline  │  │   Reveal  │  │   status     │
      │ • Player   │  │ • Turn    │  │ • Board      │
      │   list     │  │   Change  │  │   updates    │
      │ • Host     │  │ • Emotes  │  │ • Player     │
      │   detect   │  │ • Chat    │  │   changes    │
      └────────────┘  │ • Game    │  └──────────────┘
                      │   End     │
                      └───────────┘
```

---

## 🛠 Available Scripts

```bash
npm run dev       # Start dev server (port 5173)
npm run build     # TypeScript check + Vite production build
npm run preview   # Preview production build locally
```

---

## 🌐 Deploy to Vercel

1. Push code to GitHub
2. Import repo ที่ [vercel.com/new](https://vercel.com/new)
3. เพิ่ม Environment Variables:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. Deploy! — Vercel จะ auto-deploy ทุกครั้งที่ push

---

## 📝 Development Phases

โปรเจกต์นี้สร้างขึ้นเป็น 7 เฟส (ดูรายละเอียดใน [PHASES.md](PHASES.md)):

| Phase | Description | Status |
|---|---|---|
| 1 | DB Schema + Supabase Setup | ✅ |
| 2 | Admin CMS (Bean CRUD) | ✅ |
| 3 | Lobby & Room System (No-Auth) | ✅ |
| 4 | Core Gameplay (Realtime Grid) | ✅ |
| 5 | Game End & Leaderboard | ✅ |
| 6 | Effects & Polish (HP Theme) | ✅ |
| 7 | Testing & Deploy | ✅ |

---

## 🧪 Key Technical Decisions

| Decision | Why |
|---|---|
| **SolidJS** over React | Fine-grained reactivity, smaller bundle, no virtual DOM overhead |
| **No-Auth players** | ลดแรงเสียดทานเข้าเกม — ใช้ `localStorage` session + server JSONB |
| **Supabase Presence** | ตรวจจับ online/offline แบบ realtime ไม่ต้อง polling |
| **Supabase Broadcast** | ส่ง event แบบ fire-and-forget ไม่ต้อง insert/query DB |
| **Deterministic Active Host** | แก้ race condition — ผู้เล่นออนไลน์คนแรกตาม turn order เป็นคนสั่ง |
| **Tailwind v4** | CSS-first config, `@theme` directive, smaller output |
| **TypeScript strict** | catch bugs at compile time, better DX with stores |

---

## 🤝 Contributing

Pull requests are welcome! สำหรับ major changes กรุณาเปิด issue ก่อนเพื่อหารือ

1. Fork the repo
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'feat: add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📄 License

This project is open source and available under the [MIT License](LICENSE).

---

## 🙏 Credits

- **Harry Potter** universe by J.K. Rowling — this is a fan-made game for educational purposes
- **SolidJS** — [solidjs.com](https://www.solidjs.com/)
- **Supabase** — [supabase.com](https://supabase.com/)
- **Tailwind CSS** — [tailwindcss.com](https://tailwindcss.com/)
- **Google Fonts** — Cinzel & Kanit

---

<p align="center">
  Made with ⚡ SolidJS + 💚 Supabase
  <br />
  <em>"ทุกรสชาติคือการเรียนรู้"</em> 🍬
</p>

import { createSignal, createResource, Show, For } from "solid-js";
import type { Accessor } from "solid-js";
import { useNavigate } from "@solidjs/router";
import { signOut } from "../../stores/authStore";
import { supabase } from "../../lib/supabase";
import type { Bean, GameRoom } from "../../types/database";
import BeanTable from "../../components/admin/BeanTable";
import BeanForm from "../../components/admin/BeanForm";
import GlobalHiddenImageUploader from "../../components/admin/GlobalHiddenImageUploader";
import StatsOverview from "../../components/admin/StatsOverview";
import Modal from "../../components/ui/Modal";
import type { ModalConfig } from "../../components/ui/Modal";

async function fetchBeans(): Promise<Bean[]> {
  const { data, error } = await supabase
    .from("beans_master")
    .select("*")
    .order("points", { ascending: false });
  if (error) throw error;
  return data as Bean[];
}

async function fetchRooms(): Promise<GameRoom[]> {
  const { data, error } = await supabase
    .from("game_rooms")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data as GameRoom[];
}

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [beans, { refetch }] = createResource(fetchBeans);
  const [rooms, { refetch: refetchRooms }] = createResource(fetchRooms);
  const [editingBean, setEditingBean] = createSignal<Bean | null>(null);
  const [showForm, setShowForm] = createSignal(false);
  const [activeTab, setActiveTab] = createSignal<"beans" | "rooms">("beans");
  const [modalState, setModalState] = createSignal<ModalConfig | null>(null);

  async function handleLogout() {
    await signOut();
    navigate("/admin/login", { replace: true });
  }

  function handleAdd() {
    setEditingBean(null);
    setShowForm(true);
  }

  function handleEdit(bean: Bean) {
    setEditingBean(bean);
    setShowForm(true);
  }

  function handleDelete(bean: Bean) {
    setModalState({
      title: "ลบรสชาติ",
      message: `ลบ "${bean.flavor_th}" จริงหรือไม่?`,
      type: "confirm",
      variant: "danger",
      confirmText: "ลบเลย",
      onConfirm: async () => {
        const filesToDelete: string[] = [];
        if (bean.img_hidden) filesToDelete.push(extractPath(bean.img_hidden));
        if (bean.img_revealed) filesToDelete.push(extractPath(bean.img_revealed));
        if (filesToDelete.length > 0) {
          await supabase.storage.from("bean-images").remove(filesToDelete);
        }
        const { error } = await supabase.from("beans_master").delete().eq("id", bean.id);
        if (error) {
          setModalState({ title: "เกิดข้อผิดพลาด", message: "ลบไม่สำเร็จ: " + error.message, type: "alert" });
          return;
        }
        refetch();
      }
    });
  }

  function handleFormDone() {
    setShowForm(false);
    setEditingBean(null);
    refetch();
  }

  // ── Room management ────────────────────────────────────────

  function handleDeleteRoom(room: GameRoom) {
    const playerNames = room.players.map(p => p.name).join(", ") || "ไม่มีผู้เล่น";
    setModalState({
      title: "ลบห้องเกม",
      message: `ลบห้อง ${room.room_code} จริงหรือไม่?\nผู้เล่น: ${playerNames}\nสถานะ: ${roomStatusText(room.status)}`,
      type: "confirm",
      variant: "danger",
      confirmText: "ลบเลย",
      onConfirm: async () => {
        await supabase.from("game_board").delete().eq("room_id", room.id);
        const { error } = await supabase.from("game_rooms").delete().eq("id", room.id);
        if (error) {
          setModalState({ title: "เกิดข้อผิดพลาด", message: "ลบห้องไม่สำเร็จ: " + error.message, type: "alert" });
          return;
        }
        refetchRooms();
      }
    });
  }

  function handleDeleteAllFinished() {
    const finished = rooms()?.filter(r => r.status === "finished") ?? [];
    if (finished.length === 0) {
      setModalState({ title: "ไม่มีห้องที่จบ", message: "ไม่มีห้องที่เกมจบแล้ว", type: "alert" });
      return;
    }
    setModalState({
      title: "ลบห้องที่จบแล้ว",
      message: `ลบห้องที่จบแล้วทั้งหมด ${finished.length} ห้อง?`,
      type: "confirm",
      variant: "danger",
      confirmText: "ลบทั้งหมด",
      onConfirm: async () => {
        for (const r of finished) {
          await supabase.from("game_board").delete().eq("room_id", r.id);
          await supabase.from("game_rooms").delete().eq("id", r.id);
        }
        refetchRooms();
      }
    });
  }

  function roomStatusBadge(status: string): string {
    switch (status) {
      case "waiting": return "bg-blue-500/20 text-blue-400";
      case "playing": return "bg-amber-500/20 text-amber-400";
      case "finished": return "bg-emerald-500/20 text-emerald-400";
      default: return "bg-[#b1a59a]/20 text-[#b1a59a]";
    }
  }

  function roomStatusText(status: string): string {
    switch (status) {
      case "waiting": return "⏳ รอผู้เล่น";
      case "playing": return "🎮 กำลังเล่น";
      case "finished": return "✅ จบแล้ว";
      default: return status;
    }
  }

  function timeAgo(dateStr: string): string {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "เมื่อกี้";
    if (mins < 60) return `${mins} นาทีที่แล้ว`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours} ชม.ที่แล้ว`;
    return `${Math.floor(hours / 24)} วันที่แล้ว`;
  }

  return (
    <div class="min-h-screen bg-[#10141d] text-[#b1a59a]">
      {/* Header */}
      <header class="bg-[#151723] border-b border-[#b1a59a]/10 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 class="text-xl font-bold">🍬 Admin Dashboard</h1>
          <p class="text-xs text-[#b1a59a]/50">จัดการข้อมูลเยลลี่</p>
        </div>
        <button
          onClick={handleLogout}
          class="px-4 py-1.5 text-sm rounded-lg border border-[#b1a59a]/20 hover:bg-[#b1a59a]/10 transition-colors"
        >
          ออกจากระบบ
        </button>
      </header>

      <main class="max-w-6xl mx-auto p-6 space-y-6">
        {/* Stats */}
        <Show when={beans()}>
          {(list) => <StatsOverview beans={list()} />}
        </Show>

        {/* Tab switcher */}
        <div class="flex gap-2 border-b border-[#b1a59a]/10 pb-2">
          <button
            onClick={() => setActiveTab("beans")}
            class={`px-4 py-2 rounded-t-lg text-sm font-semibold transition-colors ${
              activeTab() === "beans"
                ? "bg-[#151723] border border-[#b1a59a]/20 border-b-transparent text-amber-400"
                : "text-[#b1a59a]/50 hover:text-[#b1a59a]/80"
            }`}
          >
            🍬 เยลลี่ ({beans()?.length ?? 0})
          </button>
          <button
            onClick={() => { setActiveTab("rooms"); refetchRooms(); }}
            class={`px-4 py-2 rounded-t-lg text-sm font-semibold transition-colors ${
              activeTab() === "rooms"
                ? "bg-[#151723] border border-[#b1a59a]/20 border-b-transparent text-amber-400"
                : "text-[#b1a59a]/50 hover:text-[#b1a59a]/80"
            }`}
          >
            🏰 ห้องเกม ({rooms()?.length ?? 0})
          </button>
        </div>

        {/* ── Beans Tab ─────────────────────────────── */}
        <Show when={activeTab() === "beans"}>
          {/* Actions */}
          <div class="flex items-center justify-between">
            <h2 class="text-lg font-semibold">รายการเยลลี่ ({beans()?.length ?? 0} รสชาติ)</h2>
            <button
              onClick={handleAdd}
              class="px-4 py-2 rounded-lg bg-[#b1a59a] text-[#10141d] font-semibold text-sm hover:bg-[#c4b8ad] transition-colors"
            >
              + เพิ่มรสชาติใหม่
            </button>
          </div>

          {/* Global hidden image */}
          <GlobalHiddenImageUploader />

          {/* Table */}
          <Show
            when={!beans.loading}
            fallback={<div class="text-center py-12 text-[#b1a59a]/40">กำลังโหลด...</div>}
          >
            <Show
              when={beans() && beans()!.length > 0}
              fallback={<div class="text-center py-12 text-[#b1a59a]/40">ยังไม่มีข้อมูลเยลลี่ — กดเพิ่มได้เลย</div>}
            >
              <BeanTable
                beans={beans()!}
                onEdit={handleEdit}
                onDelete={handleDelete}
              />
            </Show>
          </Show>
        </Show>

        {/* ── Rooms Tab ─────────────────────────────── */}
        <Show when={activeTab() === "rooms"}>
          <div class="flex items-center justify-between">
            <h2 class="text-lg font-semibold">ห้องเกมทั้งหมด ({rooms()?.length ?? 0} ห้อง)</h2>
            <div class="flex gap-2">
              <button
                onClick={() => refetchRooms()}
                class="px-3 py-2 rounded-lg border border-[#b1a59a]/20 text-sm hover:bg-[#b1a59a]/10 transition-colors"
              >
                🔄 รีเฟรช
              </button>
              <button
                onClick={handleDeleteAllFinished}
                class="px-3 py-2 rounded-lg bg-red-600/20 border border-red-500/30 text-red-400 text-sm hover:bg-red-600/30 transition-colors"
              >
                🗑️ ลบห้องที่จบแล้ว
              </button>
            </div>
          </div>

          <Show
            when={!rooms.loading}
            fallback={<div class="text-center py-12 text-[#b1a59a]/40">กำลังโหลด...</div>}
          >
            <Show
              when={rooms() && rooms()!.length > 0}
              fallback={<div class="text-center py-12 text-[#b1a59a]/40">ยังไม่มีห้องเกม</div>}
            >
              <div class="bg-[#151723] rounded-xl border border-[#b1a59a]/10 overflow-hidden">
                <table class="w-full text-sm">
                  <thead>
                    <tr class="border-b border-[#b1a59a]/10 text-[#b1a59a]/60 text-left">
                      <th class="px-4 py-3 font-medium">รหัสห้อง</th>
                      <th class="px-4 py-3 font-medium">สถานะ</th>
                      <th class="px-4 py-3 font-medium">ผู้เล่น</th>
                      <th class="px-4 py-3 font-medium">สร้างเมื่อ</th>
                      <th class="px-4 py-3 font-medium text-right">จัดการ</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-[#b1a59a]/5">
                    <For each={rooms()}>
                      {(r: GameRoom) => (
                        <tr class="hover:bg-[#b1a59a]/5 transition-colors">
                          <td class="px-4 py-3 font-mono font-bold">{r.room_code}</td>
                          <td class="px-4 py-3">
                            <span class={`text-xs px-2 py-1 rounded-full font-medium ${roomStatusBadge(r.status)}`}>
                              {roomStatusText(r.status)}
                            </span>
                          </td>
                          <td class="px-4 py-3">
                            <div class="flex flex-col gap-0.5">
                              <For each={r.players}>
                                {(p) => (
                                  <span class="text-xs">
                                    {p.name}
                                    <Show when={p.is_ready}>
                                      <span class="text-emerald-400 ml-1">✓</span>
                                    </Show>
                                    <span class="opacity-40 ml-1">({p.score})</span>
                                  </span>
                                )}
                              </For>
                              <Show when={r.players.length === 0}>
                                <span class="text-xs opacity-30">ว่าง</span>
                              </Show>
                            </div>
                          </td>
                          <td class="px-4 py-3 text-xs opacity-60">{timeAgo(r.created_at)}</td>
                          <td class="px-4 py-3 text-right">
                            <button
                              onClick={() => handleDeleteRoom(r)}
                              class="px-3 py-1 text-xs rounded-lg bg-red-600/20 border border-red-500/30 
                                     text-red-400 hover:bg-red-600/30 transition-colors"
                            >
                              🗑️ ลบ
                            </button>
                          </td>
                        </tr>
                      )}
                    </For>
                  </tbody>
                </table>
              </div>
            </Show>
          </Show>
        </Show>
      </main>

      {/* Modal (confirm/alert) */}
      <Modal
        show={!!modalState()}
        title={modalState()?.title ?? ""}
        message={modalState()?.message ?? ""}
        type={modalState()?.type}
        variant={modalState()?.variant}
        confirmText={modalState()?.confirmText}
        onConfirm={modalState()?.onConfirm}
        onClose={() => setModalState(null)}
      />

      {/* BeanForm Popup */}
      <Show when={showForm()}>
        <div class="fixed inset-0 z-50 flex items-start justify-center p-4 overflow-y-auto">
          {/* Backdrop */}
          <div
            class="fixed inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => { setShowForm(false); setEditingBean(null); }}
          />
          {/* Dialog */}
          <div class="relative w-full max-w-2xl my-8">
            <BeanForm
              bean={editingBean()}
              onDone={handleFormDone}
              onCancel={() => { setShowForm(false); setEditingBean(null); }}
            />
          </div>
        </div>
      </Show>
    </div>
  );
}

/** Extract storage path from full public URL */
function extractPath(url: string): string {
  const marker = "/object/public/bean-images/";
  const idx = url.indexOf(marker);
  return idx >= 0 ? url.slice(idx + marker.length) : url;
}

// ============================================================
// Marry Me, Mary! — Wedding Chat Timeline
// Route: /marry
// Standalone wedding-themed chat journal — public, no auth
// ============================================================

import { createSignal, For, Show, onMount, onCleanup } from "solid-js";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import Modal from "../components/ui/Modal";

// ╔══════════════════════════════════════════════════════════╗
// ║  CONFIGURATION — ✏️ Edit once, applies everywhere        ║
// ╠══════════════════════════════════════════════════════════╣
// ║  Change names, colours & default avatars here            ║
// ╚══════════════════════════════════════════════════════════╝
const LEFT_NAME         = "German Schneider";  // blue person's display name
const LEFT_COLOR        = "#4BA3C3";           // avatar circle & name text
const LEFT_BG           = "#E8F4FD";           // message bubble background
const LEFT_TEXT         = "#1A6A8A";           // message body text colour
const LEFT_AVATAR_DEFAULT  = "";               // default avatar URL (empty = initials)

const RIGHT_NAME        = "Cecilia Rosa";       // pink person's display name
const RIGHT_COLOR       = "#E87BA3";           // avatar circle & name text
const RIGHT_BG          = "#FDEEF6";           // message bubble background
const RIGHT_TEXT        = "#A33360";           // message body text colour
const RIGHT_AVATAR_DEFAULT = "";               // default avatar URL (empty = initials)
// ╚══════════════════════════════════════════════════════════╝



const MISSIONS = [
  { id: 1, label: "First Move" },
  { id: 2, label: "First Meal" },
  { id: 3, label: "Outside Day" },
  { id: 4, label: "Home Refill" },
  { id: 5, label: "Date Night" },
] as const;

// ── Types ─────────────────────────────────────────────────────
interface ChatMsg {
  id: string;
  mission_id: number;
  pair_index: number;
  side: "left" | "right";
  message: string;
  created_at: string;
  updated_at: string;
}
interface ChatPair {
  index: number;
  left?: ChatMsg;
  right?: ChatMsg;
}

// ── Helper: first two initials ─────────────────────────────────
function initials(name: string): string {
  return name.trim().split(/\s+/).map((w) => w[0] ?? "").join("").slice(0, 2).toUpperCase();
}

// ── Component ─────────────────────────────────────────────────
export default function MarryMeMary() {
  const [missionId, setMissionId] = createSignal<number | null>(null);
  const [msgs, setMsgs] = createSignal<ChatMsg[]>([]);
  const [loading, setLoading] = createSignal(false);
  const [editingId, setEditingId] = createSignal<string | null>(null);
  const [editText, setEditText] = createSignal("");
  const [saving, setSaving] = createSignal(false);
  const [appError, setAppError] = createSignal<string | null>(null);
  const [deleteTarget, setDeleteTarget] = createSignal<{ id: string; displayName: string } | null>(null);

  // ── Realtime ───────────────────────────────────────────────
  // Unique ID for this browser tab — used to ignore own broadcast events
  const clientId = crypto.randomUUID();
  let rtChannel: RealtimeChannel | null = null;
  const typingTimers = new Map<string, ReturnType<typeof setTimeout>>();
  // Map<senderId, msgId> — which message each remote client is typing in
  const [typingMap, setTypingMap] = createSignal<Map<string, string>>(new Map());

  onCleanup(() => {
    if (rtChannel) supabase.removeChannel(rtChannel);
    typingTimers.forEach((t) => clearTimeout(t));
  });

  // ── Avatar URL state (persisted in Supabase wedding_avatars) ───
  const [leftAvatar, setLeftAvatar] = createSignal<string>(LEFT_AVATAR_DEFAULT);
  const [rightAvatar, setRightAvatar] = createSignal<string>(RIGHT_AVATAR_DEFAULT);
  const [avatarSaving, setAvatarSaving] = createSignal(false);
  // editing avatar: null = none, 'left' | 'right' = open
  const [editingAvatar, setEditingAvatar] = createSignal<"left" | "right" | null>(null);
  const [avatarInput, setAvatarInput] = createSignal("");

  async function fetchAvatars() {
    const { data } = await supabase.from("wedding_avatars").select("side, avatar_url");
    if (data) {
      for (const row of data) {
        if (row.side === "left")  setLeftAvatar(row.avatar_url ?? "");
        if (row.side === "right") setRightAvatar(row.avatar_url ?? "");
      }
    }
  }

  function openAvatarEdit(side: "left" | "right") {
    setAvatarInput(side === "left" ? leftAvatar() : rightAvatar());
    setEditingAvatar(side);
  }
  async function saveAvatar() {
    const url = avatarInput().trim();
    const side = editingAvatar();
    if (!side) return;
    setAvatarSaving(true);
    const { error } = await supabase
      .from("wedding_avatars")
      .update({ avatar_url: url, updated_at: new Date().toISOString() })
      .eq("side", side);
    if (!error) {
      if (side === "left") setLeftAvatar(url);
      else setRightAvatar(url);
      setEditingAvatar(null);
      setAvatarInput("");
    } else {
      setAppError("บันทึกรูปไม่สำเร็จ: " + error.message);
    }
    setAvatarSaving(false);
  }
  async function clearAvatar(side: "left" | "right") {
    setAvatarSaving(true);
    const { error } = await supabase
      .from("wedding_avatars")
      .update({ avatar_url: "", updated_at: new Date().toISOString() })
      .eq("side", side);
    if (!error) {
      if (side === "left") setLeftAvatar("");
      else setRightAvatar("");
      setEditingAvatar(null);
      setAvatarInput("");
    } else {
      setAppError("ลบรูปไม่สำเร็จ: " + error.message);
    }
    setAvatarSaving(false);
  }

  // ── Setup realtime channel for a mission ──────────────────
  function setupRealtime(mid: number) {
    // Tear down previous channel
    if (rtChannel) supabase.removeChannel(rtChannel);
    setTypingMap(new Map());
    typingTimers.forEach((t) => clearTimeout(t));
    typingTimers.clear();

    rtChannel = supabase
      .channel(`mmm-mission-${mid}`)
      // ── Postgres Changes ────────────────────────────────
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "wedding_chat_messages", filter: `mission_id=eq.${mid}` },
        (payload) => {
          const newMsg = payload.new as ChatMsg;
          setMsgs((prev) => (prev.some((m) => m.id === newMsg.id) ? prev : [...prev, newMsg]));
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "wedding_chat_messages", filter: `mission_id=eq.${mid}` },
        (payload) => {
          const updated = payload.new as ChatMsg;
          setMsgs((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
        }
      )
      .on(
        "postgres_changes",
        // DELETE: no filter — PK only available, filter client-side
        { event: "DELETE", schema: "public", table: "wedding_chat_messages" },
        (payload) => {
          const old = payload.old as { id: string };
          setMsgs((prev) => prev.filter((m) => m.id !== old.id));
        }
      )
      // ── Broadcast: typing indicator ──────────────────────
      .on("broadcast", { event: "typing" }, (payload) => {
        const { senderId, msgId } = payload.payload as { senderId: string; msgId: string | null };
        if (senderId === clientId) return; // ignore own echoes
        setTypingMap((prev) => {
          const next = new Map(prev);
          if (msgId) next.set(senderId, msgId);
          else next.delete(senderId);
          return next;
        });
        // Auto-expire typing state after 6 s in case of disconnect
        const existing = typingTimers.get(senderId);
        if (existing) clearTimeout(existing);
        if (msgId) {
          typingTimers.set(
            senderId,
            setTimeout(() => {
              setTypingMap((prev) => { const next = new Map(prev); next.delete(senderId); return next; });
              typingTimers.delete(senderId);
            }, 6000)
          );
        } else {
          typingTimers.delete(senderId);
        }
      })
      .subscribe();
  }

  function broadcastTyping(msgId: string | null) {
    rtChannel?.send({ type: "broadcast", event: "typing", payload: { senderId: clientId, msgId } });
  }

  // Inject Google Fonts + load avatars once
  onMount(() => {
    if (!document.querySelector("#mmm-fonts")) {
      const link = document.createElement("link");
      link.id = "mmm-fonts";
      link.rel = "stylesheet";
      link.href = "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@600;700&family=Nunito:wght@400;500;600;700&display=swap";
      document.head.appendChild(link);
    }
    fetchAvatars();
  });

  // ── Data fetching ──────────────────────────────────────────
  async function fetchMsgs(mid: number) {
    setLoading(true);
    setAppError(null);
    setupRealtime(mid); // subscribe before fetch — avoid missing events
    const { data, error } = await supabase
      .from("wedding_chat_messages")
      .select("*")
      .eq("mission_id", mid)
      .order("pair_index", { ascending: true })
      .order("side", { ascending: true });   // 'left' < 'right' alphabetically

    if (error) {
      setAppError("โหลดข้อมูลไม่สำเร็จ: " + error.message);
    } else {
      setMsgs((data ?? []) as ChatMsg[]);
    }
    setLoading(false);
  }

  // ── Add pair (left + right) ────────────────────────────────
  async function addPair() {
    const mid = missionId();
    if (mid === null) return;

    const current = msgs();
    const maxIdx = current.length > 0
      ? Math.max(...current.map((m) => m.pair_index))
      : -1;
    const nextIdx = maxIdx + 1;

    const { data, error } = await supabase
      .from("wedding_chat_messages")
      .insert([
        { mission_id: mid, pair_index: nextIdx, side: "left",  message: "" },
        { mission_id: mid, pair_index: nextIdx, side: "right", message: "" },
      ])
      .select();

    if (error) {
      setAppError("เพิ่มคู่แชทไม่สำเร็จ: " + error.message);
    } else if (data) {
      setMsgs([...current, ...(data as ChatMsg[])]);
    }
  }

  // ── Delete single message ──────────────────────────────────
  async function deleteMsg(id: string) {
    const { error } = await supabase
      .from("wedding_chat_messages")
      .delete()
      .eq("id", id);

    if (error) {
      setAppError("ลบไม่สำเร็จ: " + error.message);
    } else {
      setMsgs(msgs().filter((m) => m.id !== id));
    }
  }

  // ── Edit helpers ───────────────────────────────────────────
  function startEdit(msg: ChatMsg) {
    setEditingId(msg.id);
    setEditText(msg.message);
    broadcastTyping(msg.id);
  }

  function cancelEdit() {
    broadcastTyping(null);
    setEditingId(null);
    setEditText("");
  }

  async function saveEdit(id: string) {
    const text = editText().trim();
    if (text.length === 0) { setAppError("กรุณากรอกข้อความก่อนบันทึก"); return; }
    if (text.length > 5000) { setAppError("ข้อความยาวเกิน 5,000 ตัวอักษร"); return; }

    setSaving(true);
    const { error } = await supabase
      .from("wedding_chat_messages")
      .update({ message: text, updated_at: new Date().toISOString() })
      .eq("id", id);

    if (error) {
      setAppError("บันทึกไม่สำเร็จ: " + error.message);
    } else {
      setMsgs(msgs().map((m) => m.id === id ? { ...m, message: text } : m));
      broadcastTyping(null);
      setEditingId(null);
      setEditText("");
    }
    setSaving(false);
  }

  // ── Group messages into pairs ──────────────────────────────
  const pairs = (): ChatPair[] => {
    const map = new Map<number, ChatPair>();
    for (const m of msgs()) {
      if (!map.has(m.pair_index)) map.set(m.pair_index, { index: m.pair_index });
      const p = map.get(m.pair_index)!;
      if (m.side === "left") p.left = m;
      else p.right = m;
    }
    return [...map.values()].sort((a, b) => a.index - b.index);
  };

  // ── Avatar component (left or right) ──────────────────────
  const Avatar = (props: { side: "left" | "right" }) => {
    const color = props.side === "left" ? LEFT_COLOR : RIGHT_COLOR;
    const name  = props.side === "left" ? LEFT_NAME  : RIGHT_NAME;
    const url   = () => props.side === "left" ? leftAvatar() : rightAvatar();
    return (
      <Show
        when={url()}
        fallback={
          <div
            class="w-11 h-11 rounded-full flex-shrink-0 flex items-center justify-center text-white text-xs font-bold shadow-md select-none"
            style={{ background: color }}
            title={name}
          >
            {initials(name)}
          </div>
        }
      >
        <img
          src={url()}
          alt={name}
          title={name}
          class="w-11 h-11 rounded-full flex-shrink-0 object-cover shadow-md select-none"
          style={{ border: `2px solid ${color}` }}
          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
        />
      </Show>
    );
  };

  // ── Bubble component ───────────────────────────────────────
  const Bubble = (props: { msg: ChatMsg }) => {
    const { msg } = props;
    const isLeft  = msg.side === "left";
    const bubbleBg    = isLeft ? LEFT_BG    : RIGHT_BG;
    const nameColor   = isLeft ? LEFT_COLOR : RIGHT_COLOR;
    const textColor   = isLeft ? LEFT_TEXT  : RIGHT_TEXT;
    const borderAccent = isLeft ? "#B8DCEF"  : "#F0B8D4";
    const displayName = isLeft ? LEFT_NAME  : RIGHT_NAME;
    // True when a remote client is editing this exact slot
    const someoneTyping = () => [...typingMap().values()].includes(msg.id);

    return (
      <div
        class="relative flex-1 rounded-2xl px-4 pt-3 pb-3 shadow-sm group"
        style={{
          background: bubbleBg,
          "border-left": isLeft ? `3px solid ${nameColor}` : "none",
          "border-right": !isLeft ? `3px solid ${nameColor}` : "none",
        }}
      >
        {/* Name */}
        <div class="font-bold text-sm mb-1" style={{ color: nameColor, "font-family": "'Cormorant Garamond', serif", "font-size": "0.95rem" }}>
          {displayName}:
        </div>

        {/* View mode */}
        <Show when={editingId() !== msg.id}>
          <p
            class="text-sm leading-relaxed whitespace-pre-wrap break-words"
            style={{ color: msg.message ? textColor : "#C8C8C8", "font-style": msg.message ? "normal" : "italic" }}
          >
            {msg.message || "ยังไม่มีข้อความ"}
          </p>

          {/* Typing indicator — shown to other clients when someone edits */}
          <Show when={someoneTyping()}>
            <div class="flex items-center gap-1 mt-2" style={{ color: nameColor }}>
              <span class="mmm-dot" /><span class="mmm-dot" /><span class="mmm-dot" />
              <span class="text-xs ml-1.5 font-medium" style={{ opacity: "0.75" }}>กำลังพิมพ์</span>
            </div>
          </Show>

          {/* Hover action buttons */}
          <div
            class="absolute top-2 right-2 z-10 flex gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity duration-200"
          >
            <button
              onClick={() => startEdit(msg)}
              class="w-7 h-7 rounded-full bg-white shadow-sm text-xs flex items-center justify-center hover:bg-sky-50 transition-colors"
              style={{ border: `1px solid ${borderAccent}` }}
              title="แก้ไข"
            >
              ✏️
            </button>
            <button
              onClick={() => setDeleteTarget({ id: msg.id, displayName })}
              class="w-7 h-7 rounded-full bg-white shadow-sm text-xs flex items-center justify-center hover:bg-red-50 transition-colors"
              style={{ border: `1px solid #FFBBBB` }}
              title="ลบ"
            >
              🗑️
            </button>
          </div>
        </Show>

        {/* Edit mode */}
        <Show when={editingId() === msg.id}>
          <textarea
            class="w-full rounded-xl p-2.5 text-sm resize-none outline-none transition-colors"
            style={{
              border: `2px solid ${borderAccent}`,
              background: "white",
              color: "#333",
              "min-height": "80px",
            }}
            rows={4}
            maxLength={5000}
            placeholder="พิมพ์ข้อความ... (รองรับบรรทัดใหม่ด้วย Enter)"
            value={editText()}
            onInput={(e) => setEditText(e.currentTarget.value)}
          />
          <div class="flex items-center gap-2 mt-2">
            <button
              onClick={() => saveEdit(msg.id)}
              disabled={saving()}
              class="text-xs px-4 py-1.5 rounded-full font-semibold text-white transition-opacity disabled:opacity-50"
              style={{ background: nameColor }}
            >
              {saving() ? "กำลังบันทึก..." : "บันทึก"}
            </button>
            <button
              onClick={cancelEdit}
              class="text-xs px-4 py-1.5 rounded-full font-semibold bg-gray-100 text-gray-500 hover:bg-gray-200 transition-colors"
            >
              ยกเลิก
            </button>
            <span class="ml-auto text-xs text-gray-300">
              {editText().length} / 5000
            </span>
          </div>
        </Show>
      </div>
    );
  };

  // ── Render ─────────────────────────────────────────────────
  return (
    <div
      class="min-h-screen"
      style={{
        background: "linear-gradient(160deg, #FFF5F8 0%, #FAFCFF 45%, #F0F8FF 100%)",
        "font-family": "'Nunito', 'Kanit', sans-serif",
      }}
    >

      {/* ── Page-scoped styles ─────────────────────────────── */}
      <style textContent={`
        .mmm-select {
          -webkit-appearance: none;
          appearance: none;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='18' height='18' viewBox='0 0 24 24' fill='%234BA3C3'%3E%3Cpath d='M7 10l5 5 5-5z'/%3E%3C/svg%3E");
          background-repeat: no-repeat;
          background-position: right 14px center;
          padding-right: 42px;
        }
        .mmm-select:focus { outline: none; box-shadow: 0 0 0 3px rgba(75,163,195,0.25); }

        .mmm-pair {
          animation: mmm-fadein 0.35s ease both;
        }
        @keyframes mmm-fadein {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        .mmm-add-btn {
          transition: all 0.25s ease;
          box-shadow: 0 2px 12px rgba(0,0,0,0.08);
        }
        .mmm-add-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 22px rgba(232,123,163,0.25);
          border-color: #E87BA3 !important;
          color: #E87BA3 !important;
        }

        /* Typing indicator dots */
        .mmm-dot {
          width: 5px; height: 5px; border-radius: 50%;
          background: currentColor; display: inline-block;
          animation: mmm-typing-dot 1.4s ease-in-out infinite both;
        }
        .mmm-dot:nth-child(1) { animation-delay: 0s; }
        .mmm-dot:nth-child(2) { animation-delay: 0.2s; }
        .mmm-dot:nth-child(3) { animation-delay: 0.4s; }
        @keyframes mmm-typing-dot {
          0%, 60%, 100% { transform: translateY(0); opacity: 0.35; }
          30% { transform: translateY(-5px); opacity: 1; }
        }

        .mmm-avatar-wrap { position: relative; display: inline-flex; cursor: pointer; }
        .mmm-avatar-wrap:hover .mmm-avatar-edit-badge { opacity: 1; }
        .mmm-avatar-edit-badge {
          position: absolute; inset: 0; border-radius: 9999px;
          background: rgba(0,0,0,0.45);
          display: flex; align-items: center; justify-content: center;
          font-size: 13px; color: #fff; opacity: 0;
          transition: opacity 0.2s ease;
        }

        .mmm-modal-overlay {
          position: fixed; inset: 0; z-index: 50;
          background: rgba(0,0,0,0.35);
          display: flex; align-items: center; justify-content: center;
          padding: 16px;
          animation: mmm-fadein 0.2s ease;
        }
        .mmm-modal {
          background: white; border-radius: 20px;
          padding: 24px; width: 100%; max-width: 380px;
          box-shadow: 0 20px 60px rgba(0,0,0,0.18);
        }
      `} />

      {/* ── Avatar edit modal ───────────────────────────────── */}
      <Show when={editingAvatar() !== null}>
        <div class="mmm-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setEditingAvatar(null); }}>
          <div class="mmm-modal">
            <h2 class="font-bold mb-1" style={{ "font-family": "'Cormorant Garamond', serif", "font-size": "1.2rem",
              color: editingAvatar() === "left" ? LEFT_COLOR : RIGHT_COLOR
            }}>
              แก้ไขรูป {editingAvatar() === "left" ? LEFT_NAME : RIGHT_NAME}
            </h2>
            <p class="text-xs text-gray-400 mb-4">วางลิงก์รูปภาพ (URL) — จะใช้เหมือนกันทุกภารกิจ</p>

            {/* Preview */}
            <Show when={avatarInput().trim()}>
              <div class="flex justify-center mb-4">
                <img
                  src={avatarInput().trim()}
                  alt="preview"
                  class="w-20 h-20 rounded-full object-cover shadow-md"
                  style={{ border: `3px solid ${editingAvatar() === "left" ? LEFT_COLOR : RIGHT_COLOR}` }}
                  onError={(e) => { (e.currentTarget as HTMLImageElement).style.opacity = "0.3"; }}
                />
              </div>
            </Show>

            <input
              type="url"
              class="w-full rounded-xl border-2 px-3 py-2 text-sm outline-none mb-4"
              style={{ "border-color": editingAvatar() === "left" ? "#B8DCEF" : "#F0B8D4" }}
              placeholder="https://example.com/photo.jpg"
              value={avatarInput()}
              onInput={(e) => setAvatarInput(e.currentTarget.value)}
            />

            <div class="flex gap-2">
              <button
                onClick={saveAvatar}
                disabled={avatarSaving()}
                class="flex-1 py-2 rounded-full text-sm font-semibold text-white disabled:opacity-50"
                style={{ background: editingAvatar() === "left" ? LEFT_COLOR : RIGHT_COLOR }}
              >
                {avatarSaving() ? "กำลังบันทึก..." : "บันทึก"}
              </button>
              <button
                onClick={() => clearAvatar(editingAvatar()!)}
                class="py-2 px-4 rounded-full text-sm font-semibold bg-gray-100 text-gray-500 hover:bg-gray-200"
                title="ลบรูป (ใช้ตัวอักษรแทน)"
              >
                ลบรูป
              </button>
              <button
                onClick={() => setEditingAvatar(null)}
                class="py-2 px-3 rounded-full text-sm bg-gray-100 text-gray-400 hover:bg-gray-200"
              >
                ✕
              </button>
            </div>
          </div>
        </div>
      </Show>

      {/* ── Delete confirmation modal ───────────────────────── */}
      <Modal
        show={deleteTarget() !== null}
        title="ยืนยันการลบข้อความ"
        message={deleteTarget() ? `ลบข้อความของ ${deleteTarget()!.displayName}?` : ""}
        type="confirm"
        variant="danger"
        confirmText="ลบ"
        cancelText="ยกเลิก"
        onConfirm={() => {
          const target = deleteTarget();
          if (target) void deleteMsg(target.id);
        }}
        onClose={() => setDeleteTarget(null)}
      />

      {/* ── Header ─────────────────────────────────────────── */}
      <header
        class="px-5 py-4 flex items-center justify-between gap-3 rounded-b-3xl shadow-lg flex-wrap"
        style={{ background: "linear-gradient(135deg, #2A2A2A 0%, #1A2030 100%)" }}
      >
        {/* Left: title + avatars */}
        <div class="flex items-center gap-3">
          <h1
            class="text-white font-bold tracking-wide"
            style={{ "font-family": "'Cormorant Garamond', serif", "font-size": "clamp(1rem, 4vw, 1.35rem)" }}
          >
            💍 Marry Me, Mary!
          </h1>

          {/* Avatar edit shortcuts */}
          <div class="flex items-center gap-1.5 ml-1">
            {/* Left avatar */}
            <div class="mmm-avatar-wrap" onClick={() => openAvatarEdit("left")} title={`แก้ไขรูป ${LEFT_NAME}`}>
              <Show
                when={leftAvatar()}
                fallback={
                  <div class="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold"
                    style={{ background: LEFT_COLOR }}>
                    {initials(LEFT_NAME)}
                  </div>
                }
              >
                <img src={leftAvatar()} alt={LEFT_NAME} class="w-8 h-8 rounded-full object-cover"
                  style={{ border: `2px solid ${LEFT_COLOR}` }} />
              </Show>
              <span class="mmm-avatar-edit-badge">✏️</span>
            </div>

            {/* Right avatar */}
            <div class="mmm-avatar-wrap" onClick={() => openAvatarEdit("right")} title={`แก้ไขรูป ${RIGHT_NAME}`}>
              <Show
                when={rightAvatar()}
                fallback={
                  <div class="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold"
                    style={{ background: RIGHT_COLOR }}>
                    {initials(RIGHT_NAME)}
                  </div>
                }
              >
                <img src={rightAvatar()} alt={RIGHT_NAME} class="w-8 h-8 rounded-full object-cover"
                  style={{ border: `2px solid ${RIGHT_COLOR}` }} />
              </Show>
              <span class="mmm-avatar-edit-badge">✏️</span>
            </div>
          </div>
        </div>

        <select
          class="mmm-select bg-sky-100 text-sky-700 font-semibold rounded-2xl px-5 py-2.5 text-sm sm:text-base border-2 border-sky-200 cursor-pointer"
          value={missionId() ?? ""}
          onChange={(e) => {
            const v = parseInt(e.currentTarget.value);
            if (isNaN(v)) {
              setMissionId(null);
              setMsgs([]);
              setEditingId(null);
            } else {
              setMissionId(v);
              setEditingId(null);
              fetchMsgs(v);
            }
          }}
        >
          <option value="">--เลือกภารกิจ--</option>
          <For each={MISSIONS as unknown as Array<{ id: number; label: string }>}>
            {(m) => <option value={m.id}>{m.label}</option>}
          </For>
        </select>
      </header>

      {/* ── Error banner ───────────────────────────────────── */}
      <Show when={appError()}>
        <div class="max-w-2xl mx-auto mt-3 px-4">
          <div class="bg-red-50 border border-red-200 text-red-600 rounded-xl px-4 py-2 text-sm flex items-center justify-between">
            <span>⚠️ {appError()}</span>
            <button onClick={() => setAppError(null)} class="ml-3 font-bold text-lg leading-none hover:text-red-800">×</button>
          </div>
        </div>
      </Show>

      {/* ── Empty state (no mission selected) ─────────────── */}
      <Show when={missionId() === null}>
        <div class="flex flex-col items-center justify-center min-h-[65vh] text-gray-300 select-none">
          <div class="text-7xl mb-4 opacity-60">💌</div>
          <p class="text-base font-medium" style={{ color: "#C8ADBA" }}>เลือกภารกิจเพื่อเริ่มบันทึกความทรงจำ</p>
        </div>
      </Show>

      {/* ── Chat area ──────────────────────────────────────── */}
      <Show when={missionId() !== null}>
        <main class="max-w-2xl mx-auto px-4 py-6">

          {/* Loading */}
          <Show when={loading()}>
            <div class="text-center py-16 text-gray-300">
              <div class="text-4xl animate-pulse mb-3">💕</div>
              <p class="text-sm">กำลังโหลด...</p>
            </div>
          </Show>

          {/* Empty mission */}
          <Show when={!loading() && pairs().length === 0}>
            <div class="text-center py-14 text-gray-300">
              <div class="text-4xl mb-3">📝</div>
              <p class="text-sm">ยังไม่มีข้อความสำหรับภารกิจนี้</p>
              <p class="text-xs mt-1 opacity-60">กด + ด้านล่างเพื่อเพิ่มคู่แชทแรก</p>
            </div>
          </Show>

          {/* Pairs */}
          <div class="space-y-5">
            <For each={pairs()}>
              {(pair) => (
                <div class="mmm-pair space-y-3">

                  {/* Left message (blue) */}
                  <Show when={pair.left !== undefined}>
                    <div class="flex items-start gap-3">
                      <Avatar side="left" />
                      <Bubble msg={pair.left!} />
                    </div>
                  </Show>

                  {/* Right message (pink) */}
                  <Show when={pair.right !== undefined}>
                    <div class="flex items-start gap-3 flex-row-reverse">
                      <Avatar side="right" />
                      <Bubble msg={pair.right!} />
                    </div>
                  </Show>

                </div>
              )}
            </For>
          </div>

          {/* Add pair button */}
          <div class="flex justify-center pt-8 pb-12">
            <button
              onClick={addPair}
              class="mmm-add-btn bg-white border-2 border-gray-200 text-gray-500 font-semibold px-9 py-3 rounded-full text-sm"
            >
              + เพิ่มคู่แชทใหม่
            </button>
          </div>

        </main>
      </Show>

    </div>
  );
}

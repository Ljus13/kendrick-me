// ============================================================
// ChatPanel — In-game chat via Supabase Broadcast (ephemeral)
// No database, no history — just real-time messaging
// ============================================================
import { createSignal, createEffect, Show, For, onMount } from "solid-js";
import { sessionId } from "../../stores/playerStore";
import { sendChat, chatMessages, unreadChat, setChatOpenState } from "../../stores/gameStore";
import type { ChatMessage } from "../../stores/gameStore";

const QUICK_EMOJIS = ["😂", "🤣", "😎", "🥳", "😱", "🤢", "❤️", "👏", "🔥", "💀", "🫠", "✨"];

interface Props {
  open: boolean;
  onToggle: () => void;
}

export default function ChatPanel(props: Props) {
  const [text, setText] = createSignal("");
  const [showEmojis, setShowEmojis] = createSignal(false);
  let messagesEnd: HTMLDivElement | undefined;

  // Auto-scroll to bottom when new messages arrive
  createEffect(() => {
    chatMessages(); // track dependency
    if (props.open) {
      setTimeout(() => messagesEnd?.scrollIntoView({ behavior: "smooth" }), 50);
    }
  });

  // Mark chat as open/closed for unread tracking
  createEffect(() => {
    setChatOpenState(props.open);
  });

  function handleSend() {
    const msg = text().trim();
    if (!msg) return;
    sendChat(msg);
    setText("");
    setShowEmojis(false);
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  function insertEmoji(emoji: string) {
    setText((t) => t + emoji);
    setShowEmojis(false);
  }

  function formatTime(ts: number): string {
    const d = new Date(ts);
    return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
  }

  return (
    <>
      {/* ── Toggle Button (always visible) ───────── */}
      <button
        onClick={props.onToggle}
        class={`fixed bottom-4 right-4 z-40 w-12 h-12 rounded-full shadow-lg transition-all
                flex items-center justify-center text-xl
                ${props.open
                  ? "bg-[#b1a59a]/20 border border-[#b1a59a]/30 text-[#b1a59a]"
                  : "bg-amber-600/90 hover:bg-amber-600 text-white hover:scale-110"
                }`}
        title={props.open ? "ปิดแชท" : "เปิดแชท"}
      >
        {props.open ? "✕" : "💬"}
        <Show when={!props.open && unreadChat() > 0}>
          <span class="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-[10px] font-bold
                       rounded-full flex items-center justify-center">
            {unreadChat() > 9 ? "9+" : unreadChat()}
          </span>
        </Show>
      </button>

      {/* ── Chat Panel ────────────────────────────── */}
      <Show when={props.open}>
        <div class="fixed bottom-20 right-4 z-40 w-80 max-w-[calc(100vw-2rem)]
                    bg-[#151723]/95 backdrop-blur-md border border-[#b1a59a]/20 rounded-xl
                    shadow-2xl flex flex-col overflow-hidden"
             style="max-height: 400px">
          {/* Header */}
          <div class="px-4 py-2.5 border-b border-[#b1a59a]/10 flex items-center justify-between shrink-0">
            <span class="text-sm font-semibold font-display">💬 แชท</span>
            <span class="text-[10px] opacity-40">ไม่เก็บประวัติ</span>
          </div>

          {/* Messages */}
          <div class="flex-1 overflow-y-auto p-3 space-y-2 min-h-[120px]" style="max-height: 260px">
            <Show when={chatMessages().length === 0}>
              <div class="text-center text-xs opacity-30 py-8">
                ยังไม่มีข้อความ — พิมพ์อะไรสักอย่าง! 💬
              </div>
            </Show>
            <For each={chatMessages()}>
              {(msg: ChatMessage) => {
                const isMe = () => msg.from === sessionId();
                return (
                  <div class={`flex flex-col ${isMe() ? "items-end" : "items-start"}`}>
                    <div class="flex items-center gap-1.5 mb-0.5">
                      <span class={`text-[10px] font-medium ${isMe() ? "text-amber-400/70" : "opacity-50"}`}>
                        {isMe() ? "คุณ" : msg.name}
                      </span>
                      <span class="text-[9px] opacity-30">{formatTime(msg.ts)}</span>
                    </div>
                    <div
                      class={`px-3 py-1.5 rounded-xl text-sm max-w-[85%] break-words leading-relaxed
                        ${isMe()
                          ? "bg-amber-600/30 text-amber-100 rounded-tr-sm"
                          : "bg-[#b1a59a]/10 text-[#b1a59a] rounded-tl-sm"
                        }`}
                    >
                      {msg.text}
                    </div>
                  </div>
                );
              }}
            </For>
            <div ref={messagesEnd} />
          </div>

          {/* Quick Emoji Picker */}
          <Show when={showEmojis()}>
            <div class="px-3 py-2 border-t border-[#b1a59a]/10 shrink-0">
              <div class="grid grid-cols-6 gap-1">
                <For each={QUICK_EMOJIS}>
                  {(emoji) => (
                    <button
                      onClick={() => insertEmoji(emoji)}
                      class="py-1 rounded-lg text-lg hover:bg-[#b1a59a]/10 hover:scale-110 transition-all"
                    >
                      {emoji}
                    </button>
                  )}
                </For>
              </div>
            </div>
          </Show>

          {/* Input Area */}
          <div class="px-3 py-2 border-t border-[#b1a59a]/10 flex items-center gap-2 shrink-0">
            <button
              onClick={() => setShowEmojis((s) => !s)}
              class={`text-lg shrink-0 hover:scale-110 transition-transform
                ${showEmojis() ? "opacity-100" : "opacity-50 hover:opacity-80"}`}
              title="อีโมจิ"
            >
              😊
            </button>
            <input
              type="text"
              value={text()}
              onInput={(e) => setText(e.currentTarget.value)}
              onKeyDown={handleKeyDown}
              placeholder="พิมพ์ข้อความ..."
              maxLength={200}
              class="flex-1 bg-[#10141d] border border-[#b1a59a]/15 rounded-lg px-3 py-1.5
                     text-sm text-[#b1a59a] placeholder:text-[#b1a59a]/30
                     focus:outline-none focus:border-amber-500/40 transition-colors"
            />
            <button
              onClick={handleSend}
              disabled={!text().trim()}
              class="shrink-0 w-8 h-8 rounded-lg bg-amber-600/80 hover:bg-amber-600
                     disabled:opacity-30 disabled:cursor-not-allowed
                     text-white text-sm flex items-center justify-center transition-colors"
            >
              ➤
            </button>
          </div>
        </div>
      </Show>
    </>
  );
}

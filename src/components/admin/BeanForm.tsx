import { createSignal, Show } from "solid-js";
import { supabase } from "../../lib/supabase";
import type { Bean } from "../../types/database";
import FileUploader from "./FileUploader";

interface Props {
  bean: Bean | null; // null = add mode, Bean = edit mode
  onDone: () => void;
  onCancel: () => void;
}

export default function BeanForm(props: Props) {
  const isEdit = () => props.bean !== null;

  const [flavor, setFlavor] = createSignal(props.bean?.flavor ?? "");
  const [flavorTh, setFlavorTh] = createSignal(props.bean?.flavor_th ?? "");
  const [points, setPoints] = createSignal(props.bean?.points ?? 0);
  const [imgRevealed, setImgRevealed] = createSignal(props.bean?.img_revealed ?? "");
  const [saving, setSaving] = createSignal(false);
  const [error, setError] = createSignal("");

  async function handleSubmit(e: SubmitEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);

    const payload = {
      flavor: flavor(),
      flavor_th: flavorTh(),
      points: points(),
      img_revealed: imgRevealed() || null,
    };

    try {
      if (isEdit()) {
        const { error: err } = await supabase
          .from("beans_master")
          .update(payload)
          .eq("id", props.bean!.id);
        if (err) throw err;
      } else {
        const { error: err } = await supabase
          .from("beans_master")
          .insert(payload);
        if (err) throw err;
      }
      props.onDone();
    } catch (err: any) {
      setError(err.message || "บันทึกไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div class="bg-[#151723] rounded-xl border border-[#b1a59a]/10 p-6">
      <h3 class="text-lg font-semibold mb-4">
        {isEdit() ? `แก้ไข: ${props.bean!.flavor_th}` : "เพิ่มเยลลี่รสชาติใหม่"}
      </h3>

      <Show when={error()}>
        <div class="bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-lg px-4 py-2 mb-4">
          {error()}
        </div>
      </Show>

      <form onSubmit={handleSubmit} class="space-y-4">
        {/* Row 1: Names */}
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div class="space-y-1">
            <label class="text-sm text-[#b1a59a]/70">ชื่อรสชาติ (ไทย) *</label>
            <input
              type="text"
              required
              value={flavorTh()}
              onInput={(e) => setFlavorTh(e.currentTarget.value)}
              class="w-full px-4 py-2 rounded-lg bg-[#10141d] border border-[#b1a59a]/15 text-[#b1a59a] focus:outline-none focus:border-[#b1a59a]/40 transition-colors"
              placeholder="เช่น เชอร์รี่"
            />
          </div>
          <div class="space-y-1">
            <label class="text-sm text-[#b1a59a]/70">ชื่อรสชาติ (อังกฤษ) *</label>
            <input
              type="text"
              required
              value={flavor()}
              onInput={(e) => setFlavor(e.currentTarget.value)}
              class="w-full px-4 py-2 rounded-lg bg-[#10141d] border border-[#b1a59a]/15 text-[#b1a59a] focus:outline-none focus:border-[#b1a59a]/40 transition-colors"
              placeholder="e.g. Cherry"
            />
          </div>
        </div>

        {/* Row 2: Points */}
        <div class="space-y-1 max-w-xs">
          <label class="text-sm text-[#b1a59a]/70">คะแนน (บวก = ดี, ลบ = ประหลาด) *</label>
          <input
            type="number"
            required
            value={points()}
            onInput={(e) => setPoints(parseInt(e.currentTarget.value) || 0)}
            class="w-full px-4 py-2 rounded-lg bg-[#10141d] border border-[#b1a59a]/15 text-[#b1a59a] focus:outline-none focus:border-[#b1a59a]/40 transition-colors font-mono"
            placeholder="0"
          />
        </div>

        {/* Row 3: Images — hidden is global (see admin panel), revealed is per-bean */}
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Hidden: info-only, managed globally */}
          <div class="space-y-2">
            <label class="text-sm text-[#b1a59a]/70">รูปก่อนเปิด (Hidden) 🔒</label>
            <div class="flex items-center gap-3 px-3 py-2 rounded-lg bg-[#10141d] border border-[#b1a59a]/10">
              <span class="text-2xl">🔒</span>
              <span class="text-xs text-[#b1a59a]/40 leading-relaxed">
                ใช้รูป Global เดียวกันทุกเม็ด<br />
                เปลี่ยนได้ในหน้า Admin → รูปปกเยลลี่
              </span>
            </div>
          </div>

          <FileUploader
            label="รูปหลังเปิด (Revealed) ✨"
            folder="revealed"
            currentUrl={imgRevealed()}
            onUploaded={setImgRevealed}
          />
        </div>

        {/* Actions */}
        <div class="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={saving()}
            class="px-6 py-2 rounded-lg bg-[#b1a59a] text-[#10141d] font-semibold text-sm hover:bg-[#c4b8ad] disabled:opacity-50 transition-colors"
          >
            {saving() ? "กำลังบันทึก..." : isEdit() ? "อัปเดต" : "เพิ่ม"}
          </button>
          <button
            type="button"
            onClick={props.onCancel}
            class="px-6 py-2 rounded-lg border border-[#b1a59a]/20 text-sm hover:bg-[#b1a59a]/10 transition-colors"
          >
            ยกเลิก
          </button>
        </div>
      </form>
    </div>
  );
}

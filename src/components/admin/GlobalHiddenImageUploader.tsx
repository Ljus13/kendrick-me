import { createSignal, onMount, Show } from "solid-js";
import { supabase } from "../../lib/supabase";

// Fixed storage path — always overwrite this one file
const GLOBAL_PATH = "hidden/global-hidden-bean";

export function getGlobalHiddenUrl(): string {
  const { data } = supabase.storage.from("bean-images").getPublicUrl(GLOBAL_PATH);
  return data.publicUrl;
}

export default function GlobalHiddenImageUploader() {
  const [preview, setPreview] = createSignal("");
  const [uploading, setUploading] = createSignal(false);
  const [successMsg, setSuccessMsg] = createSignal("");
  const [errorMsg, setErrorMsg] = createSignal("");

  onMount(() => {
    // Compute the deterministic public URL (no network request)
    setPreview(getGlobalHiddenUrl());
  });

  async function handleFile(e: Event) {
    const input = e.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    setUploading(true);
    setSuccessMsg("");
    setErrorMsg("");

    // Show local preview immediately
    const localUrl = URL.createObjectURL(file);
    setPreview(localUrl);

    try {
      // Always upload to fixed path without extension (Supabase uses Content-Type, not ext)
      const { error } = await supabase.storage
        .from("bean-images")
        .upload(GLOBAL_PATH, file, { upsert: true, contentType: file.type });

      if (error) throw error;

      const { data } = supabase.storage
        .from("bean-images")
        .getPublicUrl(GLOBAL_PATH);

      // Add cache-buster so browser reloads the new image
      setPreview(data.publicUrl + "?t=" + Date.now());
      setSuccessMsg("✅ อัปโหลดสำเร็จ! ทุกเม็ดจะใช้รูปนี้");
    } catch (err: any) {
      setErrorMsg("อัปโหลดไม่สำเร็จ: " + err.message);
      setPreview(getGlobalHiddenUrl()); // revert to last known
    } finally {
      setUploading(false);
      // reset input
      input.value = "";
    }
  }

  return (
    <div class="bg-[#151723] rounded-xl border border-[#b1a59a]/10 p-5">
      <div class="flex items-center gap-2 mb-4">
        <span class="text-base font-semibold">🔒 รูปเยลลี่ก่อนเปิด (Global)</span>
        <span class="text-xs text-[#b1a59a]/40 bg-[#b1a59a]/5 px-2 py-0.5 rounded-full border border-[#b1a59a]/10">
          ใช้รูปเดียวกันทุกเม็ด
        </span>
      </div>

      <div class="flex items-center gap-6">
        {/* Preview box — fixed 1:1 ratio */}
        <div class="w-24 h-24 rounded-xl bg-[#10141d] border border-[#b1a59a]/15 overflow-hidden flex items-center justify-center shrink-0">
          <Show
            when={preview()}
            fallback={<span class="text-4xl">🫘</span>}
          >
            <img
              src={preview()}
              alt="global hidden bean"
              class="w-full h-full object-contain"
              onError={() => setPreview("")}
            />
          </Show>
        </div>

        {/* Right: info + upload button */}
        <div class="flex flex-col gap-2">
          <p class="text-xs text-[#b1a59a]/50 leading-relaxed">
            รูปนี้จะแสดงแทนเยลลี่ทุกเม็ด<br />
            ที่ยังไม่ถูกพลิกในเกม
          </p>

          <label
            class={`inline-flex items-center gap-2 px-4 py-2 rounded-lg border text-sm cursor-pointer transition-colors w-fit ${
              uploading()
                ? "border-[#b1a59a]/10 text-[#b1a59a]/30 cursor-wait"
                : "border-[#b1a59a]/25 hover:bg-[#b1a59a]/10 text-[#b1a59a]/80"
            }`}
          >
            <span>{uploading() ? "⏳ กำลังอัปโหลด..." : "📁 เปลี่ยนรูป"}</span>
            <input
              type="file"
              accept="image/*"
              class="hidden"
              onChange={handleFile}
              disabled={uploading()}
            />
          </label>

          {/* Messages */}
          <Show when={successMsg()}>
            <p class="text-xs text-emerald-400">{successMsg()}</p>
          </Show>
          <Show when={errorMsg()}>
            <p class="text-xs text-red-400">{errorMsg()}</p>
          </Show>
        </div>
      </div>
    </div>
  );
}

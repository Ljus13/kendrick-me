import { createSignal, Show } from "solid-js";
import { supabase } from "../../lib/supabase";
import Modal from "../ui/Modal";

interface Props {
  label: string;
  folder: string; // subfolder in bean-images bucket (e.g. "hidden", "revealed")
  currentUrl: string;
  onUploaded: (url: string) => void;
}

export default function FileUploader(props: Props) {
  const [uploading, setUploading] = createSignal(false);
  const [preview, setPreview] = createSignal(props.currentUrl);
  const [errorMsg, setErrorMsg] = createSignal("");

  async function handleFile(e: Event) {
    const input = e.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    // Show local preview immediately
    setPreview(URL.createObjectURL(file));
    setUploading(true);

    try {
      const ext = file.name.split(".").pop() ?? "png";
      const path = `${props.folder}/${crypto.randomUUID()}.${ext}`;

      const { error } = await supabase.storage
        .from("bean-images")
        .upload(path, file, { upsert: true });

      if (error) throw error;

      const { data } = supabase.storage
        .from("bean-images")
        .getPublicUrl(path);

      props.onUploaded(data.publicUrl);
      setPreview(data.publicUrl);
    } catch (err: any) {
      setErrorMsg("อัปโหลดไม่สำเร็จ: " + err.message);
      setPreview(props.currentUrl); // revert
    } finally {
      setUploading(false);
    }
  }

  return (
    <div class="space-y-2">
      <label class="text-sm text-[#b1a59a]/70">{props.label}</label>
      <div class="flex items-center gap-3">
        {/* Preview */}
        <Show
          when={preview()}
          fallback={
            <div class="w-16 h-16 rounded-lg bg-[#10141d] border border-dashed border-[#b1a59a]/20 flex items-center justify-center text-[#b1a59a]/30 text-xs">
              ไม่มี
            </div>
          }
        >
          <img
            src={preview()!}
            alt={props.label}
            class="w-16 h-16 rounded-lg object-cover border border-[#b1a59a]/10"
          />
        </Show>

        {/* Upload button */}
        <label
          class={`px-4 py-2 rounded-lg border text-sm cursor-pointer transition-colors ${
            uploading()
              ? "border-[#b1a59a]/10 text-[#b1a59a]/30 cursor-wait"
              : "border-[#b1a59a]/20 hover:bg-[#b1a59a]/10 text-[#b1a59a]/70"
          }`}
        >
          {uploading() ? "กำลังอัปโหลด..." : "เลือกไฟล์"}
          <input
            type="file"
            accept="image/*"
            class="hidden"
            onChange={handleFile}
            disabled={uploading()}
          />
        </label>
      </div>
      <Modal
        show={!!errorMsg()}
        title="เกิดข้อผิดพลาด"
        message={errorMsg()}
        type="alert"
        onClose={() => setErrorMsg("")}
      />
    </div>
  );
}

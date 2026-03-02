import { Show } from "solid-js";

export interface ModalConfig {
  title: string;
  message: string;
  type?: "confirm" | "alert";
  variant?: "danger" | "info";
  confirmText?: string;
  cancelText?: string;
  onConfirm?: () => void;
}

interface ModalProps extends ModalConfig {
  show: boolean;
  onClose: () => void;
}

export default function Modal(props: ModalProps) {
  const isConfirm = () => (props.type ?? "confirm") === "confirm";

  const btnClass = () => {
    if (props.variant === "danger")
      return "bg-red-600 hover:bg-red-500 text-white";
    return "bg-[#b1a59a] hover:bg-[#c4b8ad] text-[#10141d]";
  };

  return (
    <Show when={props.show}>
      <div class="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <div class="absolute inset-0 bg-black/60" onClick={props.onClose} />

        {/* Card */}
        <div class="relative bg-[#1a1e2e] border border-[#b1a59a]/20 rounded-xl shadow-2xl max-w-sm w-full p-6 space-y-4">
          <h3 class="text-base font-bold text-[#b1a59a]">{props.title}</h3>
          <p class="text-sm text-[#b1a59a]/70 whitespace-pre-line leading-relaxed">
            {props.message}
          </p>

          <div class="flex justify-end gap-2 pt-2">
            <Show when={isConfirm()}>
              <button
                onClick={props.onClose}
                class="px-4 py-2 rounded-lg border border-[#b1a59a]/20 text-sm text-[#b1a59a]/60 hover:bg-[#b1a59a]/10 transition-colors"
              >
                {props.cancelText ?? "ยกเลิก"}
              </button>
            </Show>
            <button
              onClick={() => {
                props.onConfirm?.();
                props.onClose();
              }}
              class={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${btnClass()}`}
            >
              {props.confirmText ?? (isConfirm() ? "ยืนยัน" : "ตกลง")}
            </button>
          </div>
        </div>
      </div>
    </Show>
  );
}

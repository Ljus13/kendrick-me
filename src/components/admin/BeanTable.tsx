import { For, Show } from "solid-js";
import type { Bean } from "../../types/database";

interface Props {
  beans: Bean[];
  onEdit: (bean: Bean) => void;
  onDelete: (bean: Bean) => void;
}

export default function BeanTable(props: Props) {
  return (
    <div class="overflow-x-auto rounded-xl border border-[#b1a59a]/10">
      <table class="w-full text-sm">
        <thead>
          <tr class="bg-[#151723] text-left text-[#b1a59a]/60">
            <th class="px-4 py-3 font-medium">รูป</th>
            <th class="px-4 py-3 font-medium">ชื่อ (TH)</th>
            <th class="px-4 py-3 font-medium">ชื่อ (EN)</th>
            <th class="px-4 py-3 font-medium text-right">คะแนน</th>
            <th class="px-4 py-3 font-medium text-center">จัดการ</th>
          </tr>
        </thead>
        <tbody>
          <For each={props.beans}>
            {(bean) => (
              <tr class="border-t border-[#b1a59a]/5 hover:bg-[#151723]/60 transition-colors">
                {/* Thumbnail */}
                <td class="px-4 py-3">
                  <div class="flex gap-2 items-center">
                    {/* Hidden: always same mystery image */}
                    <div class="w-10 h-10 rounded bg-[#151723] border border-[#b1a59a]/10 flex items-center justify-center text-xl" title="รูปก่อนเปิด (เหมือนกันทุกเม็ด)">
                      🫘
                    </div>
                    {/* Revealed: per-bean */}
                    <Show
                      when={bean.img_revealed}
                      fallback={<div class="w-10 h-10 rounded bg-[#151723] flex items-center justify-center text-xs text-[#b1a59a]/30">?</div>}
                    >
                      <img src={bean.img_revealed!} alt="revealed" class="w-10 h-10 rounded object-cover" />
                    </Show>
                  </div>
                </td>

                {/* Names */}
                <td class="px-4 py-3 font-medium">{bean.flavor_th}</td>
                <td class="px-4 py-3 text-[#b1a59a]/60">{bean.flavor}</td>

                {/* Points */}
                <td class="px-4 py-3 text-right font-mono">
                  <span class={bean.points >= 0 ? "text-green-400" : "text-red-400"}>
                    {bean.points > 0 ? "+" : ""}{bean.points}
                  </span>
                </td>

                {/* Actions */}
                <td class="px-4 py-3 text-center">
                  <div class="flex justify-center gap-2">
                    <button
                      onClick={() => props.onEdit(bean)}
                      class="px-3 py-1 text-xs rounded border border-[#b1a59a]/20 hover:bg-[#b1a59a]/10 transition-colors"
                    >
                      แก้ไข
                    </button>
                    <button
                      onClick={() => props.onDelete(bean)}
                      class="px-3 py-1 text-xs rounded border border-red-500/20 text-red-400 hover:bg-red-500/10 transition-colors"
                    >
                      ลบ
                    </button>
                  </div>
                </td>
              </tr>
            )}
          </For>
        </tbody>
      </table>
    </div>
  );
}

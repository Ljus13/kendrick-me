import { createSignal, createResource, Show } from "solid-js";
import { useNavigate } from "@solidjs/router";
import { signOut } from "../../stores/authStore";
import { supabase } from "../../lib/supabase";
import type { Bean } from "../../types/database";
import BeanTable from "../../components/admin/BeanTable";
import BeanForm from "../../components/admin/BeanForm";
import StatsOverview from "../../components/admin/StatsOverview";

async function fetchBeans(): Promise<Bean[]> {
  const { data, error } = await supabase
    .from("beans_master")
    .select("*")
    .order("points", { ascending: false });
  if (error) throw error;
  return data as Bean[];
}

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [beans, { refetch }] = createResource(fetchBeans);
  const [editingBean, setEditingBean] = createSignal<Bean | null>(null);
  const [showForm, setShowForm] = createSignal(false);

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

  async function handleDelete(bean: Bean) {
    if (!confirm(`ลบ "${bean.flavor_th}" จริงหรือไม่?`)) return;

    // Delete images from storage if they exist
    const filesToDelete: string[] = [];
    if (bean.img_hidden) filesToDelete.push(extractPath(bean.img_hidden));
    if (bean.img_revealed) filesToDelete.push(extractPath(bean.img_revealed));
    if (filesToDelete.length > 0) {
      await supabase.storage.from("bean-images").remove(filesToDelete);
    }

    const { error } = await supabase.from("beans_master").delete().eq("id", bean.id);
    if (error) {
      alert("ลบไม่สำเร็จ: " + error.message);
      return;
    }
    refetch();
  }

  function handleFormDone() {
    setShowForm(false);
    setEditingBean(null);
    refetch();
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

        {/* Form modal */}
        <Show when={showForm()}>
          <BeanForm
            bean={editingBean()}
            onDone={handleFormDone}
            onCancel={() => { setShowForm(false); setEditingBean(null); }}
          />
        </Show>

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
      </main>
    </div>
  );
}

/** Extract storage path from full public URL */
function extractPath(url: string): string {
  const marker = "/object/public/bean-images/";
  const idx = url.indexOf(marker);
  return idx >= 0 ? url.slice(idx + marker.length) : url;
}

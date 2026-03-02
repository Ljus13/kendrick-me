import { createSignal, Show } from "solid-js";
import { useNavigate } from "@solidjs/router";
import { signIn, session } from "../../stores/authStore";

export default function AdminLogin() {
  const navigate = useNavigate();
  const [email, setEmail] = createSignal("");
  const [password, setPassword] = createSignal("");
  const [error, setError] = createSignal("");
  const [submitting, setSubmitting] = createSignal(false);

  // If already logged in, redirect
  if (session()) navigate("/admin/dashboard", { replace: true });

  async function handleSubmit(e: SubmitEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await signIn(email(), password());
      navigate("/admin/dashboard", { replace: true });
    } catch (err: any) {
      setError(err.message || "เข้าสู่ระบบไม่สำเร็จ");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main class="min-h-screen bg-[#10141d] flex items-center justify-center px-4">
      <form
        onSubmit={handleSubmit}
        class="w-full max-w-sm bg-[#151723] rounded-xl p-8 space-y-5 border border-[#b1a59a]/10 shadow-2xl"
      >
        <div class="text-center">
          <h1 class="text-2xl font-bold text-[#b1a59a]">🔐 Admin Login</h1>
          <p class="text-sm text-[#b1a59a]/50 mt-1">Bertie Bott's CMS</p>
        </div>

        <Show when={error()}>
          <div class="bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-lg px-4 py-2">
            {error()}
          </div>
        </Show>

        <div class="space-y-1">
          <label class="text-sm text-[#b1a59a]/70">Email</label>
          <input
            type="email"
            required
            value={email()}
            onInput={(e) => setEmail(e.currentTarget.value)}
            class="w-full px-4 py-2.5 rounded-lg bg-[#10141d] border border-[#b1a59a]/15 text-[#b1a59a] placeholder-[#b1a59a]/30 focus:outline-none focus:border-[#b1a59a]/40 transition-colors"
            placeholder="admin@example.com"
          />
        </div>

        <div class="space-y-1">
          <label class="text-sm text-[#b1a59a]/70">Password</label>
          <input
            type="password"
            required
            value={password()}
            onInput={(e) => setPassword(e.currentTarget.value)}
            class="w-full px-4 py-2.5 rounded-lg bg-[#10141d] border border-[#b1a59a]/15 text-[#b1a59a] placeholder-[#b1a59a]/30 focus:outline-none focus:border-[#b1a59a]/40 transition-colors"
            placeholder="••••••••"
          />
        </div>

        <button
          type="submit"
          disabled={submitting()}
          class="w-full py-2.5 rounded-lg bg-[#b1a59a] text-[#10141d] font-semibold hover:bg-[#c4b8ad] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {submitting() ? "กำลังเข้าสู่ระบบ..." : "เข้าสู่ระบบ"}
        </button>

        <a href="/" class="block text-center text-xs text-[#b1a59a]/40 hover:text-[#b1a59a]/60 transition-colors">
          ← กลับหน้าหลัก
        </a>
      </form>
    </main>
  );
}

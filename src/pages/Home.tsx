export default function Home() {
  return (
    <main class="min-h-screen bg-[#10141d] text-[#b1a59a] flex items-center justify-center">
      <div class="text-center space-y-6">
        <h1 class="text-4xl font-bold">🍬 Bertie Bott's Every Flavour Beans</h1>
        <p class="text-lg opacity-70">เร็วๆ นี้ — เกมเสี่ยงดวงเลือกเยลลี่สไตล์ Harry Potter</p>
        <a
          href="/admin/login"
          class="inline-block px-6 py-2 rounded bg-[#151723] hover:bg-[#1e2035] border border-[#b1a59a]/20 text-sm transition-colors"
        >
          Admin Login →
        </a>
      </div>
    </main>
  );
}

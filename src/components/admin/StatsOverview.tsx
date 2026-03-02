import type { Bean } from "../../types/database";

interface Props {
  beans: Bean[];
}

export default function StatsOverview(props: Props) {
  const totalFlavors = () => props.beans.length;

  const avgPoints = () => {
    if (props.beans.length === 0) return 0;
    const sum = props.beans.reduce((acc, b) => acc + b.points, 0);
    return Math.round(sum / props.beans.length);
  };

  const goodCount = () => props.beans.filter((b) => b.points > 0).length;
  const badCount = () => props.beans.filter((b) => b.points < 0).length;
  const neutralCount = () => props.beans.filter((b) => b.points === 0).length;

  const withImages = () =>
    props.beans.filter((b) => b.img_hidden && b.img_revealed).length;

  const stats = () => [
    { label: "รสชาติทั้งหมด", value: totalFlavors(), color: "text-[#b1a59a]" },
    { label: "รสดี", value: goodCount(), color: "text-green-400" },
    { label: "รสประหลาด", value: badCount(), color: "text-red-400" },
    { label: "คะแนนเฉลี่ย", value: avgPoints(), color: avgPoints() >= 0 ? "text-green-400" : "text-red-400" },
    { label: "มีรูปครบ", value: `${withImages()}/${totalFlavors()}`, color: "text-[#b1a59a]" },
  ];

  return (
    <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
      {stats().map((s) => (
        <div class="bg-[#151723] rounded-xl border border-[#b1a59a]/10 p-4 text-center">
          <div class={`text-2xl font-bold font-mono ${s.color}`}>{s.value}</div>
          <div class="text-xs text-[#b1a59a]/50 mt-1">{s.label}</div>
        </div>
      ))}
    </div>
  );
}

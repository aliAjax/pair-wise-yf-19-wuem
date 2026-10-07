import { useStore } from "../store";
import { slotOccupancy, waitlistQueue } from "../logic";

export function Metrics() {
  const { state } = useStore();
  const inQueue = state.catalog.filter((c) => !c.已出柜 && c.压制状态 !== "已入库").length;
  const waiting = waitlistQueue(state.catalog).length;
  const pendingDet = state.catalog.filter((c) => c.鉴定状态 === "待鉴定").length;
  const occupied = state.slots.reduce(
    (sum, s) => sum + slotOccupancy(state.catalog, s.id),
    0
  );
  const capacity = state.slots.reduce((sum, s) => sum + s.容量, 0);
  const sites = new Set(
    state.catalog.map((c) => c.采集地点).filter(Boolean)
  ).size;

  const cards = [
    { label: "入库队列（压制流程中）", value: inQueue, sub: `柜位候补 ${waiting} 份` },
    { label: "待鉴定", value: pendingDet, sub: "编目库中未定名份数" },
    { label: "柜位占用", value: `${occupied}/${capacity}`, sub: "份 / 总容量" },
    { label: "采集点", value: sites, sub: "按采集地点归集" },
  ];

  return (
    <section className="metrics">
      {cards.map((c) => (
        <article key={c.label}>
          <small>{c.label}</small>
          <strong>{c.value}</strong>
          <span>{c.sub}</span>
        </article>
      ))}
    </section>
  );
}

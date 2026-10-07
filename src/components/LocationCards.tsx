import { useMemo } from "react";
import { useStore } from "../store";
import type { CatalogRecord } from "../types";
import { Badge } from "./Badge";

function altitudeAvg(recs: CatalogRecord[]): string {
  const nums = recs
    .map((r) => parseInt(r.海拔.replace(/[^\d]/g, ""), 10))
    .filter((n) => !Number.isNaN(n));
  if (nums.length === 0) return "—";
  return `${Math.round(nums.reduce((a, b) => a + b, 0) / nums.length)}m`;
}

export function LocationCards({
  onOpen,
}: {
  onOpen: (r: CatalogRecord) => void;
}) {
  const { state } = useStore();

  const groups = useMemo(() => {
    const map = new Map<string, CatalogRecord[]>();
    for (const c of state.catalog) {
      const key = c.采集地点 || "未登记地点";
      const arr = map.get(key) ?? [];
      arr.push(c);
      map.set(key, arr);
    }
    return [...map.entries()]
      .map(([site, recs]) => ({
        site,
        recs: recs.sort(
          (a, b) =>
            new Date(a.采集时间).getTime() - new Date(b.采集时间).getTime()
        ),
      }))
      .sort((a, b) => b.recs.length - a.recs.length);
  }, [state.catalog]);

  return (
    <section className="panel">
      <div className="heading">
        <div>
          <p className="eyebrow">采集地点信息卡</p>
          <h2>按采集点归集</h2>
        </div>
      </div>
      <div className="location-grid">
        {groups.map((g) => {
          const pending = g.recs.filter((r) => r.鉴定状态 === "待鉴定").length;
          const habitats = new Set(g.recs.map((r) => r.生境).filter(Boolean));
          const collectors = new Set(g.recs.map((r) => r.采集人).filter(Boolean));
          return (
            <article key={g.site} className="location-card">
              <header>
                <h3>{g.site}</h3>
                <Badge tone="teal">{g.recs.length} 份</Badge>
              </header>
              <ul className="loc-stats">
                <li>
                  <span>平均海拔</span>
                  <b>{altitudeAvg(g.recs)}</b>
                </li>
                <li>
                  <span>待鉴定</span>
                  <b>{pending}</b>
                </li>
                <li>
                  <span>生境类型</span>
                  <b>{habitats.size}</b>
                </li>
                <li>
                  <span>采集人</span>
                  <b>{[...collectors].join("、") || "—"}</b>
                </li>
              </ul>
              <div className="loc-habitats">
                {[...habitats].slice(0, 3).map((h) => (
                  <span key={h}>{h}</span>
                ))}
              </div>
              <div className="loc-specimens">
                {g.recs.slice(0, 4).map((r) => (
                  <button key={r.id} onClick={() => onOpen(r)}>
                    {r.采集号} · {r.物种}
                  </button>
                ))}
                {g.recs.length > 4 && <em>等 {g.recs.length} 份</em>}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

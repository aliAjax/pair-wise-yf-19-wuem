import { useStore } from "../store";
import { slotOccupancy } from "../logic";
import type { CatalogRecord } from "../types";

export function Cabinets({ onOpen }: { onOpen: (r: CatalogRecord) => void }) {
  const { state, dispatch } = useStore();

  return (
    <section className="panel">
      <div className="heading">
        <div>
          <p className="eyebrow">馆藏柜位记录</p>
          <h2>柜位占用</h2>
        </div>
      </div>

      <div className="cabinet-grid">
        {state.slots.map((s) => {
          const used = slotOccupancy(state.catalog, s.id);
          const full = used >= s.容量;
          const holders = state.catalog.filter(
            (c) => c.柜位 === s.id && !c.已出柜
          );
          return (
            <article key={s.id} className={`cabinet ${full ? "full" : ""}`}>
              <header>
                <div>
                  <b>
                    {s.柜号} · {s.层位}
                  </b>
                  <small>{s.id}</small>
                </div>
                <span className={`cap ${full ? "cap-full" : ""}`}>
                  {used}/{s.容量} 份
                </span>
              </header>
              <div className="slots">
                {Array.from({ length: s.容量 }).map((_, i) => {
                  const holder = holders[i];
                  return (
                    <div
                      key={i}
                      className={holder ? "slot occupied" : "slot free"}
                      onClick={() => holder && onOpen(holder)}
                      title={holder ? `${holder.采集号} ${holder.物种}` : "空位"}
                    >
                      {holder ? (
                        <>
                          <b>{holder.采集号}</b>
                          <small>{holder.物种}</small>
                          <button
                            className="slot-out"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (
                                confirm(
                                  `将 ${holder.采集号} 移出柜位？腾出空位后候补自动补位。`
                                )
                              ) {
                                dispatch({
                                  type: "VACATE_SLOT",
                                  id: holder.id,
                                });
                              }
                            }}
                          >
                            腾出
                          </button>
                        </>
                      ) : (
                        <span className="slot-empty">空位</span>
                      )}
                    </div>
                  );
                })}
              </div>
              {full && <p className="cabinet-note">已满 · 新标本进入候补</p>}
            </article>
          );
        })}
      </div>
    </section>
  );
}

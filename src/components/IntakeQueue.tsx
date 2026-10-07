import { useStore } from "../store";
import { waitlistQueue } from "../logic";
import type { CatalogRecord, PressStatus } from "../types";
import { Badge, detTone, pressTone } from "./Badge";

const PRESS_FLOW: PressStatus[] = ["待压制", "已压制", "已入库"];

function QueueRow({ rec, position }: { rec: CatalogRecord; position?: number }) {
  const { dispatch } = useStore();
  const stage = PRESS_FLOW.indexOf(rec.压制状态);

  return (
    <article className="queue-row">
      <div className="queue-info">
        <div className="draft-head">
          <h3>{rec.采集号}</h3>
          <Badge tone={pressTone(rec.压制状态)}>{rec.压制状态}</Badge>
          <Badge tone={detTone(rec.鉴定状态)}>{rec.鉴定状态}</Badge>
          {position !== undefined && <Badge tone="red">候补第 {position} 位</Badge>}
        </div>
        <p className="draft-meta">
          {rec.物种} · {rec.海拔} · {rec.采集地点} · {rec.采集人}
        </p>
        <div className="stage-bar">
          {PRESS_FLOW.map((s, i) => (
            <span key={s} className={i <= stage ? "stage on" : "stage"}>
              {s}
            </span>
          ))}
        </div>
      </div>
      <div className="queue-actions">
        {rec.压制状态 === "待压制" && (
          <button
            className="mini"
            onClick={() =>
              dispatch({ type: "SET_PRESS", id: rec.id, 压制状态: "已压制" })
            }
          >
            完成压制
          </button>
        )}
        {rec.压制状态 === "已压制" && (
          <button
            className="mini primary"
            onClick={() =>
              dispatch({ type: "SET_PRESS", id: rec.id, 压制状态: "已入库" })
            }
          >
            核验入库（排柜）
          </button>
        )}
      </div>
    </article>
  );
}

export function IntakeQueue() {
  const { state } = useStore();
  const inProcess = state.catalog
    .filter((c) => !c.已出柜 && c.压制状态 !== "已入库")
    .sort((a, b) => new Date(a.采集时间).getTime() - new Date(b.采集时间).getTime());

  const waiting = waitlistQueue(state.catalog);
  const waitPos = new Map(waiting.map((r, i) => [r.id, i + 1]));

  return (
    <section className="panel">
      <div className="heading">
        <div>
          <p className="eyebrow">入库队列</p>
          <h2>压制流程与柜位候补</h2>
        </div>
        <span className="sub-count">
          流程中 {inProcess.length} · 候补 {waiting.length}
        </span>
      </div>
      <p className="rule-note">
        柜位容量满了先排队候补；一旦腾出空位，按标本采集时间从早到晚自动补位。
        外业记录完成“核验入库”前不占用任何柜位。
      </p>
      <div className="draft-list">
        {[...inProcess, ...waiting].length === 0 && (
          <p className="empty">队列空闲：所有标本均已上柜或出柜。</p>
        )}
        {inProcess.map((r) => (
          <QueueRow key={r.id} rec={r} />
        ))}
        {waiting.map((r) => (
          <QueueRow key={r.id} rec={r} position={waitPos.get(r.id)} />
        ))}
      </div>
    </section>
  );
}

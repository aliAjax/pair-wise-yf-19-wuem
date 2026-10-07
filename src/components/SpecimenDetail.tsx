import { useEffect, useState } from "react";
import { useStore } from "../store";
import { fmtTime } from "../logic";
import type { CatalogRecord, PressStatus } from "../types";
import { Badge, detTone, pressTone } from "./Badge";

const PRESS_FLOW: PressStatus[] = ["待压制", "已压制", "已入库"];

export function SpecimenDetail({
  recId,
  onClose,
}: {
  recId: string;
  onClose: () => void;
}) {
  const { state, dispatch } = useStore();
  const rec = state.catalog.find((c) => c.id === recId);
  const [name, setName] = useState("");
  const [detBy, setDetBy] = useState("");

  useEffect(() => {
    setName(rec?.物种 ?? "");
    setDetBy(rec?.鉴定人 ?? "");
  }, [recId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (!rec) return null;

  const relatedDrafts = state.drafts.filter((d) => d.采集号 === rec.采集号);
  const stage = PRESS_FLOW.indexOf(rec.压制状态);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <header className="modal-head">
          <div>
            <p className="eyebrow">单份标本详情</p>
            <h2>{rec.采集号}</h2>
          </div>
          <button className="ghost-btn" onClick={onClose}>
            关闭 ✕
          </button>
        </header>

        <div className="modal-tags">
          <Badge tone={pressTone(rec.压制状态)}>{rec.压制状态}</Badge>
          <Badge tone={detTone(rec.鉴定状态)}>{rec.鉴定状态}</Badge>
          {rec.柜位 ? (
            <Badge tone="green">柜位 {rec.柜位}</Badge>
          ) : rec.已出柜 ? (
            <Badge tone="gray">已出柜</Badge>
          ) : rec.压制状态 === "已入库" ? (
            <Badge tone="red">柜位候补中</Badge>
          ) : (
            <Badge tone="amber">尚未排柜</Badge>
          )}
        </div>

        <div className="detail-grid">
          <div>
            <small>物种名称</small>
            <b>{rec.物种}</b>
          </div>
          <div>
            <small>鉴定人</small>
            <b>{rec.鉴定人 || "—"}</b>
          </div>
          <div>
            <small>采集地点</small>
            <b>{rec.采集地点 || "—"}</b>
          </div>
          <div>
            <small>海拔</small>
            <b>{rec.海拔 || "—"}</b>
          </div>
          <div className="span-2">
            <small>生境描述</small>
            <b>{rec.生境 || "—"}</b>
          </div>
          <div>
            <small>采集人</small>
            <b>{rec.采集人}</b>
          </div>
          <div>
            <small>采集时间</small>
            <b>{fmtTime(rec.采集时间)}</b>
          </div>
          <div className="span-2">
            <small>合并说明</small>
            <b>{rec.合并备注 || "暂无特殊说明"}</b>
          </div>
        </div>

        <section className="detail-block">
          <h3>压制流程</h3>
          <div className="stage-bar big">
            {PRESS_FLOW.map((s, i) => (
              <span key={s} className={i <= stage ? "stage on" : "stage"}>
                {s}
              </span>
            ))}
          </div>
          <div className="inline-actions">
            {rec.压制状态 === "待压制" && (
              <button
                onClick={() =>
                  dispatch({ type: "SET_PRESS", id: rec.id, 压制状态: "已压制" })
                }
              >
                标记已压制
              </button>
            )}
            {rec.压制状态 === "已压制" && (
              <button
                className="primary"
                onClick={() =>
                  dispatch({ type: "SET_PRESS", id: rec.id, 压制状态: "已入库" })
                }
              >
                核验入库（柜位满则候补）
              </button>
            )}
            {rec.柜位 && !rec.已出柜 && (
              <button
                className="warn-btn"
                onClick={() =>
                  confirm("腾出该柜位？候补标本将按采集时间补位。") &&
                  dispatch({ type: "VACATE_SLOT", id: rec.id })
                }
              >
                腾出柜位（外借/出库）
              </button>
            )}
          </div>
        </section>

        <section className="detail-block">
          <h3>馆内鉴定</h3>
          {rec.鉴定状态 === "已鉴定" ? (
            <p className="det-locked">
              已定名「{rec.物种}」（鉴定人：{rec.鉴定人}）。外业合并不会覆盖该结果。
            </p>
          ) : (
            <div className="det-form">
              <input
                value={name}
                placeholder="鉴定物种名称"
                onChange={(e) => setName(e.target.value)}
              />
              <input
                value={detBy}
                placeholder="鉴定人"
                onChange={(e) => setDetBy(e.target.value)}
              />
              <button
                className="primary"
                onClick={() =>
                  name.trim() &&
                  dispatch({
                    type: "IDENTIFY",
                    id: rec.id,
                    物种: name,
                    鉴定人: detBy,
                  })
                }
              >
                确认鉴定
              </button>
            </div>
          )}
        </section>

        {relatedDrafts.length > 0 && (
          <section className="detail-block">
            <h3>外业原始登记（{relatedDrafts.length}）</h3>
            <ul className="draft-refs">
              {relatedDrafts.map((d) => (
                <li key={d.id}>
                  <Badge tone={d.status === "已合并" ? "green" : "amber"}>
                    {d.status}
                  </Badge>
                  <span>
                    外业暂拟「{d.物种 || "未填"}」 · {d.海拔} · {d.生境}
                  </span>
                  <time>{fmtTime(d.updatedAt)}</time>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}

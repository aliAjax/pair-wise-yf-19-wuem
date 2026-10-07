import { useState } from "react";
import { useStore } from "../store";
import { fmtTime, validateDraft } from "../logic";
import type { FieldDraft } from "../types";
import { Badge } from "./Badge";

function statusBadge(d: FieldDraft) {
  if (d.status === "已合并") return <Badge tone="green">已合并</Badge>;
  if (d.status === "校验未过")
    return (
      <Badge tone="red">
        校验未过{d.failReason ? `：${d.failReason}` : ""}
      </Badge>
    );
  return <Badge tone="amber">待处理</Badge>;
}

function DraftRow({ draft }: { draft: FieldDraft }) {
  const { dispatch } = useStore();
  const [editing, setEditing] = useState(false);
  const [patch, setPatch] = useState({
    物种: draft.物种,
    海拔: draft.海拔,
    生境: draft.生境,
    采集人: draft.采集人,
  });

  const save = () => {
    dispatch({ type: "UPDATE_DRAFT", id: draft.id, patch });
    setEditing(false);
  };

  return (
    <article className={`draft-row draft-${draft.status}`}>
      <div className="draft-main">
        <div className="draft-head">
          <h3>{draft.采集号}</h3>
          {statusBadge(draft)}
        </div>
        {editing ? (
          <div className="draft-edit">
            <input
              value={patch.物种}
              placeholder="物种"
              onChange={(e) => setPatch({ ...patch, 物种: e.target.value })}
            />
            <input
              value={patch.海拔}
              placeholder="海拔"
              onChange={(e) => setPatch({ ...patch, 海拔: e.target.value })}
            />
            <input
              value={patch.生境}
              placeholder="生境"
              onChange={(e) => setPatch({ ...patch, 生境: e.target.value })}
            />
            <input
              value={patch.采集人}
              placeholder="采集人"
              onChange={(e) => setPatch({ ...patch, 采集人: e.target.value })}
            />
            <button className="mini primary" onClick={save}>
              保存并重试
            </button>
            <button className="mini" onClick={() => setEditing(false)}>
              取消
            </button>
          </div>
        ) : (
          <>
            <p className="draft-line">
              <b>{draft.物种 || "（未填物种）"}</b>
              <span>{draft.海拔}</span>
              <span>{draft.生境}</span>
            </p>
            <p className="draft-meta">
              {draft.采集地点} · {draft.采集人} · 采集于 {fmtTime(draft.采集时间)}
              {" · "}登记 {fmtTime(draft.updatedAt)}
            </p>
          </>
        )}
      </div>
      <div className="draft-actions">
        {draft.status !== "已合并" && (
          <button className="mini" onClick={() => setEditing((v) => !v)}>
            {editing ? "收起" : "补录/修改"}
          </button>
        )}
        {draft.status === "校验未过" && (
          <button className="mini" onClick={save}>
            标记重试
          </button>
        )}
        {draft.status === "已合并" ? (
          <button
            className="mini danger"
            onClick={() =>
              confirm("移除该条已合并草稿？编目库记录不受影响。") &&
              dispatch({ type: "REMOVE_DRAFT", id: draft.id })
            }
          >
            清理
          </button>
        ) : (
          <button
            className="mini danger"
            onClick={() =>
              confirm("该草稿尚未合并，确定丢弃？") &&
              dispatch({ type: "REMOVE_DRAFT", id: draft.id })
            }
          >
            丢弃
          </button>
        )}
      </div>
    </article>
  );
}

export function PendingArea() {
  const { state } = useStore();
  // 待处理在前（登记先后），校验未过留档，已合并且在最后
  const order = { 待处理: 0, 校验未过: 1, 已合并: 2 } as const;
  const drafts = [...state.drafts].sort((a, b) => {
    const s = order[a.status] - order[b.status];
    return s !== 0
      ? s
      : new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  });

  const invalid = state.drafts
    .filter((d) => d.status === "待处理")
    .map((d) => ({ d, reason: validateDraft(d) }))
    .filter((x) => x.reason);

  return (
    <section className="panel pending-panel">
      <div className="heading">
        <div>
          <p className="eyebrow">本地待处理区</p>
          <h2>外业合并管线</h2>
        </div>
        <span className="sub-count">
          {state.drafts.filter((d) => d.status === "待处理").length} 条待提交
        </span>
      </div>

      <p className="rule-note">
        断网重试从停下的地方继续：已原子提交的不重放；校验不过的留在本区补录，
        不会写进入库队列，也不产生柜位占用。
      </p>

      {invalid.length > 0 && (
        <div className="preflight">
          <b>预检提示</b>
          {invalid.map(({ d, reason }) => (
            <span key={d.id}>
              {d.采集号 || "（无采集号）"}：{reason}
            </span>
          ))}
        </div>
      )}

      <div className="draft-list">
        {drafts.length === 0 && (
          <p className="empty">待处理区为空，可在左侧填写外业登记。</p>
        )}
        {drafts.map((d) => (
          <DraftRow key={d.id} draft={d} />
        ))}
      </div>
    </section>
  );
}

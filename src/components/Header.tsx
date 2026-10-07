import { useStore } from "../store";

export function Header() {
  const { state, dispatch, startSync } = useStore();
  const pending = state.drafts.filter((d) => d.status === "待处理").length;
  const rejected = state.drafts.filter((d) => d.status === "校验未过").length;
  const merged = state.drafts.filter((d) => d.status === "已合并").length;

  return (
    <header className="app-header">
      <div className="brand">
        <span className="brand-mark">植</span>
        <div>
          <h1>植物标本馆 · 压制标本入库</h1>
          <p>外业离线登记 → 回馆联网合并 → 鉴定编目 → 柜位入库</p>
        </div>
      </div>

      <div className="header-actions">
        <div className={`net-state ${state.online ? "online" : "offline"}`}>
          <i />
          {state.online ? "馆内联网" : "外业离线"}
        </div>
        <button
          className={state.online ? "ghost-btn" : "ghost-btn warn"}
          onClick={() => {
            const next = !state.online;
            dispatch({ type: "SET_ONLINE", online: next });
            if (!next) {
              // 模拟断网：正在合并时立即在当前条停下
              dispatch({ type: "SET_SYNCING", syncing: false });
            }
          }}
        >
          切换到{state.online ? "离线" : "联网"}
        </button>
        <button
          className="primary"
          disabled={!state.online || state.syncing || pending === 0}
          onClick={startSync}
          title={
            !state.online
              ? "离线无法合并，记录安全保留在本地待处理区"
              : state.syncing
              ? "正在逐条合并"
              : "从停下的地方继续合并"
          }
        >
          {state.syncing
            ? "合并中…"
            : pending > 0
            ? `联网合并（${pending} 条待处理）`
            : "待处理已清空"}
        </button>
        <button
          className="ghost-btn"
          onClick={() => {
            if (confirm("恢复为演示数据？当前本地改动将被清空。")) {
              dispatch({ type: "RESET" });
            }
          }}
        >
          重置演示
        </button>
      </div>

      <div className="sync-strip">
        <span>
          合并管线：<b>{pending}</b> 待处理 · <b>{rejected}</b> 校验未过留档 ·{" "}
          <b>{merged}</b> 已合并
        </span>
        {state.syncing && <span className="pulse">正在逐条提交，断网即停…</span>}
        {!state.online && (
          <span className="offline-note">
            离线中：新登记只存本机；恢复联网后从断点继续合并
          </span>
        )}
      </div>
    </header>
  );
}

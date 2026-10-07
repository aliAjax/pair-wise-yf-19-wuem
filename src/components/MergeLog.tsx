import { useStore } from "../store";
import { fmtTime } from "../logic";

const toneOf: Record<string, string> = {
  新增入库: "log-green",
  覆盖更新: "log-teal",
  冲突保护: "log-amber",
  校验未过: "log-red",
};

export function MergeLog() {
  const { state } = useStore();

  return (
    <section className="panel log-panel">
      <div className="heading">
        <div>
          <p className="eyebrow">合并审计</p>
          <h2>合并日志</h2>
        </div>
        <span className="sub-count">{state.logs.length} 条</span>
      </div>
      {state.logs.length === 0 ? (
        <p className="empty">
          暂无合并记录。点右上角“联网合并”，把外业草稿逐条合入编目库。
        </p>
      ) : (
        <ol className="log-list">
          {state.logs.map((l) => (
            <li key={l.id}>
              <span className={`log-kind ${toneOf[l.kind] ?? ""}`}>{l.kind}</span>
              <span className="log-detail">{l.detail}</span>
              <time>{fmtTime(l.time)}</time>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

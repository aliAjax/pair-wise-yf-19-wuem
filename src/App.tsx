import { useMemo, useState } from "react";
import { useHerbarium } from "./store";
import type { FilterKey, Specimen } from "./types";
import "./styles.css";

const STEP_LABELS = ["校验外业记录", "匹配馆内鉴定结果", "写入编目库并入队", "分配柜位"];

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "全部" },
  { key: "pressing", label: "待压制" },
  { key: "identifying", label: "待鉴定" },
  { key: "stored", label: "已入库" },
  { key: "rephoto", label: "需补照" },
];

const EMPTY_FORM = {
  id: "",
  species: "",
  location: "",
  elevation: "",
  habitat: "",
  collector: "",
  collectTime: "",
};

function Badge({ tone, children }: { tone: "green" | "amber" | "gray" | "red" | "blue"; children: React.ReactNode }) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}

function statusTone(s: string): "green" | "amber" | "gray" | "red" | "blue" {
  if (s === "已鉴定" || s === "已压制" || s === "已入库" || s === "已拍照" || s === "merged") return "green";
  if (s === "待鉴定" || s === "待压制" || s === "merging") return "amber";
  if (s === "需补照" || s === "error") return "red";
  return "gray";
}

export default function App() {
  const api = useHerbarium();
  const { specimens, cabinets, online, merging, events, filter, setFilter } = api;
  const [tab, setTab] = useState<"merge" | "queue" | "cabinets" | "locations">("merge");
  const [selectedUid, setSelectedUid] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);

  const fieldRecords = useMemo(
    () => specimens.filter((s) => s.source === "field"),
    [specimens],
  );
  const queue = useMemo(
    () =>
      specimens
        .filter((s) => s.mergeStatus === "merged")
        .sort((a, b) => (a.queueOrder ?? 0) - (b.queueOrder ?? 0)),
    [specimens],
  );
  const waiting = useMemo(
    () => queue.filter((s) => !s.cabinetId).sort((a, b) => a.collectTime.localeCompare(b.collectTime)),
    [queue],
  );
  const filteredQueue = useMemo(() => {
    switch (filter) {
      case "pressing":
        return queue.filter((s) => s.pressing === "待压制");
      case "identifying":
        return queue.filter((s) => s.identification === "待鉴定");
      case "stored":
        return queue.filter((s) => !!s.cabinetId);
      case "rephoto":
        return queue.filter((s) => s.photo === "需补照");
      default:
        return queue;
    }
  }, [queue, filter]);

  const metrics = useMemo(
    () => [
      { label: "入库队列", value: queue.length },
      { label: "待鉴定", value: queue.filter((s) => s.identification === "待鉴定").length },
      { label: "已上柜", value: queue.filter((s) => !!s.cabinetId).length },
      { label: "采集点", value: new Set(specimens.map((s) => s.location).filter(Boolean)).size },
    ],
    [queue, specimens],
  );

  const selected = selectedUid ? specimens.find((s) => s.uid === selectedUid) : null;

  const submitForm = () => {
    if (!form.id.trim() || !form.species.trim()) return;
    api.addFieldRecord({
      ...form,
      id: form.id.trim(),
      species: form.species.trim(),
      location: form.location.trim() || "野外采集",
      elevation: form.elevation.trim() || "海拔未填",
      habitat: form.habitat.trim() || "生境未填",
      collector: form.collector.trim() || "未填",
      collectTime: form.collectTime || new Date().toISOString().slice(0, 10),
    });
    setForm(EMPTY_FORM);
  };

  const occupantsOf = (cabinetId: string) => queue.filter((s) => s.cabinetId === cabinetId);

  return (
    <main className="app">
      <section className="hero">
        <div className="hero-top">
          <div>
            <p>hxyfront-62007 · 植物标本馆入库</p>
            <h1>压制标本外业合并台</h1>
            <span>
              外业离线登记采集号、物种、海拔、生境与采集人，压制状态先记待压制；回馆联网后合并进编目库。
              同号已有鉴定结果的，物种名称与鉴定状态按馆内，海拔与生境保留外业最后改动。
              断网从停下的检查点续传，未合上的留待处理区；柜位满员先候补，腾出空位按采集时间安排。
            </span>
          </div>
          <div className={`net-pill ${online ? "online" : "offline"}`}>
            <span className="dot" />
            {online ? "联网中" : "已断网"}
          </div>
        </div>
        <div className="hero-actions">
          <button className={online ? "" : "primary"} onClick={api.toggleOnline}>
            {online ? "模拟断网" : "恢复联网"}
          </button>
          <button onClick={api.resetAll}>重置演示数据</button>
        </div>
      </section>

      <section className="metrics">
        {metrics.map((m) => (
          <article key={m.label}>
            <small>{m.label}</small>
            <strong>{m.value}</strong>
          </article>
        ))}
      </section>

      <nav className="tabs">
        <button className={tab === "merge" ? "active" : ""} onClick={() => setTab("merge")}>
          外业合并
          {fieldRecords.some((s) => s.mergeStatus !== "merged") && (
            <em className="tab-dot">{fieldRecords.filter((s) => s.mergeStatus !== "merged").length}</em>
          )}
        </button>
        <button className={tab === "queue" ? "active" : ""} onClick={() => setTab("queue")}>
          入库队列
        </button>
        <button className={tab === "cabinets" ? "active" : ""} onClick={() => setTab("cabinets")}>
          馆藏柜位
          {waiting.length > 0 && <em className="tab-dot amber">{waiting.length}</em>}
        </button>
        <button className={tab === "locations" ? "active" : ""} onClick={() => setTab("locations")}>
          采集地点
        </button>
      </nav>

      {tab === "merge" && (
        <section className="workspace">
          <aside className="panel">
            <div className="heading">
              <div>
                <p>离线登记</p>
                <h2>外业采集记录</h2>
              </div>
            </div>
            <div className="form-grid">
              <label>
                <span>采集号 *</span>
                <input
                  value={form.id}
                  placeholder="如 HX-240620-01"
                  onChange={(e) => setForm({ ...form, id: e.target.value })}
                />
              </label>
              <label>
                <span>物种名称 *</span>
                <input
                  value={form.species}
                  placeholder="如 报春花科"
                  onChange={(e) => setForm({ ...form, species: e.target.value })}
                />
              </label>
              <label>
                <span>采集地点</span>
                <input
                  value={form.location}
                  placeholder="如 秦岭·南坡"
                  onChange={(e) => setForm({ ...form, location: e.target.value })}
                />
              </label>
              <label>
                <span>海拔</span>
                <input
                  value={form.elevation}
                  placeholder="如 海拔2100m"
                  onChange={(e) => setForm({ ...form, elevation: e.target.value })}
                />
              </label>
              <label>
                <span>生境描述</span>
                <input
                  value={form.habitat}
                  placeholder="如 高山草甸"
                  onChange={(e) => setForm({ ...form, habitat: e.target.value })}
                />
              </label>
              <label>
                <span>采集人</span>
                <input
                  value={form.collector}
                  placeholder="如 野外采集组"
                  onChange={(e) => setForm({ ...form, collector: e.target.value })}
                />
              </label>
              <label>
                <span>采集时间</span>
                <input
                  type="date"
                  value={form.collectTime}
                  onChange={(e) => setForm({ ...form, collectTime: e.target.value })}
                />
              </label>
            </div>
            <button className="primary form-submit" onClick={submitForm}>
              离线登记（待压制）
            </button>
            <p className="form-hint">
              外业断网时仅写入本机，压制状态先记「待压制」；回馆联网后在右侧合并进编目库。
            </p>
          </aside>

          <section className="panel">
            <div className="heading">
              <div>
                <p>待处理区</p>
                <h2>外业记录合并</h2>
              </div>
              <button
                className="primary"
                disabled={merging || fieldRecords.every((s) => s.mergeStatus === "merged")}
                onClick={api.runMerge}
              >
                {merging ? "合并中…" : online ? "开始 / 续传合并" : "断网中"}
              </button>
            </div>

            <div className="merge-rules">
              <p>合并规则：</p>
              <ul>
                <li>同采集号已有鉴定结果 → 物种名称、鉴定状态按馆内；海拔、生境保留外业最后改动</li>
                <li>断网从停下的检查点续传，未合上的留在待处理区</li>
                <li>半截数据在提交前不进入入库队列、不占用柜位</li>
                <li>柜位满员先候补，腾出空位按采集时间安排上柜</li>
              </ul>
            </div>

            <div className="merge-list">
              {fieldRecords.length === 0 && <p className="empty">暂无外业记录</p>}
              {fieldRecords.map((rec) => (
                <article key={rec.uid} className="merge-card">
                  <div className="merge-card-head">
                    <b>{rec.id}</b>
                    <div className="badges">
                      <Badge tone={statusTone(rec.pressing)}>{rec.pressing}</Badge>
                      <Badge tone={statusTone(rec.mergeStatus)}>
                        {rec.mergeStatus === "merged" ? "已合并" : rec.mergeStatus === "merging" ? "断点续传" : "待合并"}
                      </Badge>
                    </div>
                  </div>
                  <p className="merge-meta">
                    {rec.species} · {rec.elevation} · {rec.habitat} · {rec.collector} · {rec.collectTime}
                  </p>
                  <div className="stepper">
                    {STEP_LABELS.map((label, i) => {
                      const state =
                        rec.mergeStatus === "merged" || rec.mergeStep > i
                          ? "done"
                          : rec.mergeStep === i && rec.mergeStatus === "merging"
                            ? "active"
                            : "todo";
                      return (
                        <div key={label} className={`step ${state}`}>
                          <span className="step-dot">{state === "done" ? "✓" : i + 1}</span>
                          <span className="step-label">{label}</span>
                        </div>
                      );
                    })}
                  </div>
                </article>
              ))}
            </div>

            <div className="log">
              <p className="log-title">合并日志</p>
              {events.length === 0 && <p className="empty">暂无日志</p>}
              {events.map((e) => (
                <p key={e.id} className={`log-line log-${e.kind}`}>
                  <span className="log-time">{e.time}</span> {e.text}
                </p>
              ))}
            </div>
          </section>
        </section>
      )}

      {tab === "queue" && (
        <section className="panel">
          <div className="heading">
            <div>
              <p>编目库</p>
              <h2>入库队列</h2>
            </div>
            <div className="chips">
              {FILTERS.map((f) => (
                <button
                  key={f.key}
                  className={filter === f.key ? "chip-active" : ""}
                  onClick={() => setFilter(f.key)}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
          <div className="queue-table">
            <div className="queue-row queue-head">
              <span>队列位</span>
              <span>采集号</span>
              <span>物种</span>
              <span>海拔 / 生境</span>
              <span>采集人</span>
              <span>状态</span>
              <span>柜位</span>
            </div>
            {filteredQueue.length === 0 && <p className="empty">队列为空</p>}
            {filteredQueue.map((s) => (
              <button key={s.uid} className="queue-row" onClick={() => setSelectedUid(s.uid)}>
                <span className="queue-order">{s.queueOrder ?? "—"}</span>
                <span className="mono">{s.id}</span>
                <span>{s.species}</span>
                <span className="muted">
                  {s.elevation} · {s.habitat}
                </span>
                <span>{s.collector}</span>
                <span className="badges">
                  <Badge tone={statusTone(s.pressing)}>{s.pressing}</Badge>
                  <Badge tone={statusTone(s.identification)}>{s.identification}</Badge>
                  {s.photo === "需补照" && <Badge tone="red">需补照</Badge>}
                </span>
                <span>{s.cabinetId ?? <Badge tone="amber">候补中</Badge>}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {tab === "cabinets" && (
        <section className="panel">
          <div className="heading">
            <div>
              <p>馆藏柜位</p>
              <h2>柜位占用与候补</h2>
            </div>
          </div>
          <div className="cabinet-grid">
            {cabinets.map((c) => {
              const occ = occupantsOf(c.id);
              return (
                <article key={c.id} className="cabinet-card">
                  <div className="cabinet-head">
                    <b>{c.id}</b>
                    <span className="muted">
                      {c.area} · {occ.length}/{c.capacity}
                    </span>
                  </div>
                  <div className="cabinet-slots">
                    {Array.from({ length: c.capacity }).map((_, i) => {
                      const occSpecimen = occ[i];
                      return (
                        <div key={i} className={`slot ${occSpecimen ? "occupied" : "free"}`}>
                          {occSpecimen ? (
                            <>
                              <button
                                className="slot-id"
                                onClick={() => setSelectedUid(occSpecimen.uid)}
                              >
                                {occSpecimen.id}
                              </button>
                              <button
                                className="slot-free"
                                title="腾出柜位"
                                onClick={() => api.freeCabinet(occSpecimen.uid)}
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
                </article>
              );
            })}
          </div>

          <div className="waiting">
            <h3>
              候补队列
              <span className="muted">（柜位满员时按采集时间排队，共 {waiting.length} 份）</span>
            </h3>
            {waiting.length === 0 && <p className="empty">暂无候补标本</p>}
            {waiting.length > 0 && (
              <div className="queue-table">
                <div className="queue-row queue-head">
                  <span>候补序</span>
                  <span>采集号</span>
                  <span>物种</span>
                  <span>采集时间</span>
                  <span>海拔 / 生境</span>
                </div>
                {waiting.map((s, i) => (
                  <button key={s.uid} className="queue-row" onClick={() => setSelectedUid(s.uid)}>
                    <span className="queue-order">{i + 1}</span>
                    <span className="mono">{s.id}</span>
                    <span>{s.species}</span>
                    <span>{s.collectTime}</span>
                    <span className="muted">
                      {s.elevation} · {s.habitat}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {tab === "locations" && (
        <section className="panel">
          <div className="heading">
            <div>
              <p>采集地点</p>
              <h2>采集地点信息卡</h2>
            </div>
          </div>
          <div className="location-grid">
            {Array.from(new Set(specimens.map((s) => s.location).filter(Boolean))).map((loc) => {
              const list = specimens.filter((s) => s.location === loc);
              const elevations = Array.from(new Set(list.map((s) => s.elevation)));
              const habitats = Array.from(new Set(list.map((s) => s.habitat)));
              return (
                <article key={loc} className="location-card">
                  <h3>{loc}</h3>
                  <p className="muted">
                    {list.length} 份标本 · 采集人：{Array.from(new Set(list.map((s) => s.collector))).join("、")}
                  </p>
                  <p>海拔：{elevations.join(" / ")}</p>
                  <p>生境：{habitats.join("、")}</p>
                  <div className="badges">
                    {list.some((s) => s.identification === "已鉴定") && <Badge tone="green">含已鉴定</Badge>}
                    {list.some((s) => s.photo === "需补照") && <Badge tone="red">含需补照</Badge>}
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      )}

      {selected && (
        <DetailPanel
          specimen={selected}
          onClose={() => setSelectedUid(null)}
          onFree={() => {
            api.freeCabinet(selected.uid);
          }}
        />
      )}
    </main>
  );
}

function DetailPanel({
  specimen,
  onClose,
  onFree,
}: {
  specimen: Specimen;
  onClose: () => void;
  onFree: () => void;
}) {
  const s = specimen;
  return (
    <div className="detail-backdrop" onClick={onClose}>
      <aside className="detail-panel" onClick={(e) => e.stopPropagation()}>
        <div className="heading">
          <div>
            <p>单份标本详情</p>
            <h2>{s.id}</h2>
          </div>
          <button onClick={onClose}>关闭</button>
        </div>

        <div className="detail-badges">
          <Badge tone={s.source === "catalog" ? "green" : "gray"}>
            {s.source === "catalog" ? "编目库" : "外业待合并"}
          </Badge>
          <Badge tone={statusTone(s.pressing)}>{s.pressing}</Badge>
          <Badge tone={statusTone(s.identification)}>{s.identification}</Badge>
          <Badge tone={statusTone(s.photo)}>{s.photo}</Badge>
          {s.cabinetId ? <Badge tone="green">柜位 {s.cabinetId}</Badge> : <Badge tone="amber">无柜位</Badge>}
        </div>

        <dl className="detail-grid">
          <div><dt>采集号</dt><dd className="mono">{s.id}</dd></div>
          <div><dt>物种名称</dt><dd>{s.species}</dd></div>
          <div><dt>采集地点</dt><dd>{s.location}</dd></div>
          <div><dt>海拔</dt><dd>{s.elevation}</dd></div>
          <div><dt>生境描述</dt><dd>{s.habitat}</dd></div>
          <div><dt>采集人</dt><dd>{s.collector}</dd></div>
          <div><dt>采集时间</dt><dd>{s.collectTime}</dd></div>
          <div><dt>入库队列位</dt><dd>{s.queueOrder ?? "—"}</dd></div>
          <div><dt>馆藏位置</dt><dd>{s.cabinetId ?? "候补中"}</dd></div>
          <div><dt>最后外业改动</dt><dd>{new Date(s.updatedAt).toLocaleString("zh-CN")}</dd></div>
        </dl>

        <div className="detail-merge">
          <h3>合并进度</h3>
          <div className="stepper">
            {STEP_LABELS.map((label, i) => {
              const state =
                s.mergeStatus === "merged" || s.mergeStep > i
                  ? "done"
                  : s.mergeStep === i && s.mergeStatus === "merging"
                    ? "active"
                    : "todo";
              return (
                <div key={label} className={`step ${state}`}>
                  <span className="step-dot">{state === "done" ? "✓" : i + 1}</span>
                  <span className="step-label">{label}</span>
                </div>
              );
            })}
          </div>
          {s.source === "field" && (
            <p className="muted">该记录为外业离线登记，联网合并后物种与鉴定状态以馆内为准。</p>
          )}
        </div>

        {s.cabinetId && s.mergeStatus === "merged" && (
          <button className="primary" onClick={onFree}>
            腾出柜位 {s.cabinetId}（空位按采集时间安排候补）
          </button>
        )}
      </aside>
    </div>
  );
}

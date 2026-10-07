import { useState } from "react";
import { useStore } from "../store";
import type { PressStatus } from "../types";

const EMPTY = {
  采集号: "",
  物种: "",
  海拔: "",
  生境: "",
  采集人: "",
  采集地点: "",
  采集时间: "",
};

export function FieldForm() {
  const { state, createDraft } = useStore();
  const [form, setForm] = useState({ ...EMPTY });
  const [msg, setMsg] = useState<string | null>(null);

  const set = (k: keyof typeof EMPTY, v: string) =>
    setForm((f) => ({ ...f, [k]: v }));

  const dup = state.drafts.some(
    (d) =>
      d.采集号.trim() === form.采集号.trim() &&
      d.status !== "已合并"
  );

  const submit = () => {
    if (!form.采集号.trim()) {
      setMsg("采集号必填：回馆合并以采集号匹配馆内记录");
      return;
    }
    const 压制状态: PressStatus = "待压制"; // 外业登记一律先记待压制
    createDraft({
      采集号: form.采集号.trim(),
      物种: form.物种.trim(),
      海拔: form.海拔.trim(),
      生境: form.生境.trim(),
      采集人: form.采集人.trim(),
      采集地点: form.采集地点.trim(),
      采集时间: form.采集时间 || new Date().toISOString().slice(0, 16),
      压制状态,
    });
    setMsg(
      state.online
        ? "已登记到待处理区，可点右上角“联网合并”提交"
        : "离线已存本机待处理区，回馆联网后从断点合并"
    );
    setForm({ ...EMPTY });
  };

  const fields: { key: keyof typeof EMPTY; label: string; hint?: string; area?: boolean }[] = [
    { key: "采集号", label: "采集号", hint: "与馆内编目按此号匹配" },
    { key: "物种", label: "物种（外业暂拟名）", hint: "馆内已鉴定时以馆内为准" },
    { key: "采集地点", label: "采集地点" },
    { key: "海拔", label: "海拔", hint: "如 1560m" },
    { key: "采集人", label: "采集人" },
    { key: "采集时间", label: "采集时间" },
    { key: "生境", label: "生境描述", area: true },
  ];

  return (
    <section className="panel form-panel">
      <div className="heading">
        <div>
          <p className="eyebrow">外业离线登记</p>
          <h2>压制标本登记</h2>
        </div>
        <span className="lock-tag">压制状态：待压制（固定）</span>
      </div>

      <div className="field-grid">
        {fields.map((f) => (
          <label key={f.key} className={f.area ? "span-2" : ""}>
            <span>
              {f.label}
              {f.hint && <em>{f.hint}</em>}
            </span>
            {f.area ? (
              <textarea
                rows={2}
                value={form[f.key]}
                placeholder={"填写" + f.label}
                onChange={(e) => set(f.key, e.target.value)}
              />
            ) : (
              <input
                type={f.key === "采集时间" ? "datetime-local" : "text"}
                value={form[f.key]}
                placeholder={"填写" + f.label}
                onChange={(e) => set(f.key, e.target.value)}
              />
            )}
          </label>
        ))}
      </div>

      {dup && (
        <p className="form-warn">
          待处理区已有同采集号草稿；合并时会按最新改动处理，或先在右侧编辑旧草稿。
        </p>
      )}
      <div className="form-foot">
        <button className="primary" onClick={submit}>
          存入待处理区
        </button>
        {msg && <span className="form-msg">{msg}</span>}
      </div>
      <p className="rule-note">
        合并规则：馆内已有鉴定的采集号，物种与鉴定状态以馆内为准；海拔、生境按本次外业最后改动覆盖。
      </p>
    </section>
  );
}

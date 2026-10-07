import { useState } from "react";
import { useStore } from "../store";
import type { CatalogRecord, DetStatus } from "../types";
import { Badge, detTone, pressTone } from "./Badge";

type Filter = "全部" | DetStatus;

export function CatalogList({
  onOpen,
}: {
  onOpen: (rec: CatalogRecord) => void;
}) {
  const { state } = useStore();
  const [filter, setFilter] = useState<Filter>("全部");
  const [q, setQ] = useState("");

  const list = state.catalog
    .filter((c) => (filter === "全部" ? true : c.鉴定状态 === filter))
    .filter((c) => {
      const k = q.trim();
      if (!k) return true;
      return (
        c.采集号.includes(k) ||
        c.物种.includes(k) ||
        c.采集地点.includes(k) ||
        c.采集人.includes(k)
      );
    })
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

  const filters: Filter[] = ["全部", "待鉴定", "已鉴定"];
  const count = (f: Filter) =>
    f === "全部"
      ? state.catalog.length
      : state.catalog.filter((c) => c.鉴定状态 === f).length;

  return (
    <section className="panel">
      <div className="heading">
        <div>
          <p className="eyebrow">馆内编目库</p>
          <h2>标本编目（权威数据）</h2>
        </div>
        <input
          className="search"
          placeholder="搜索采集号 / 物种 / 地点 / 采集人"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      <div className="filter-bar">
        {filters.map((f) => (
          <button
            key={f}
            className={filter === f ? "chip active" : "chip"}
            onClick={() => setFilter(f)}
          >
            {f} <em>{count(f)}</em>
          </button>
        ))}
      </div>

      <div className="catalog-table">
        <div className="catalog-row catalog-head">
          <span>采集号</span>
          <span>物种 / 鉴定</span>
          <span>海拔 · 生境</span>
          <span>压制</span>
          <span>柜位</span>
          <span />
        </div>
        {list.map((c) => (
          <div key={c.id} className="catalog-row">
            <span className="cell-no">{c.采集号}</span>
            <span>
              <b>{c.物种}</b>
              <small>
                <Badge tone={detTone(c.鉴定状态)}>{c.鉴定状态}</Badge>
                {c.鉴定人 && <> · {c.鉴定人}</>}
              </small>
            </span>
            <span className="cell-habitat">
              {c.海拔}
              <small>{c.生境}</small>
            </span>
            <span>
              <Badge tone={pressTone(c.压制状态)}>{c.压制状态}</Badge>
            </span>
            <span>
              {c.已出柜 ? (
                <Badge tone="gray">已出柜</Badge>
              ) : c.柜位 ? (
                <b className="slot-no">{c.柜位}</b>
              ) : c.压制状态 === "已入库" ? (
                <Badge tone="red">候补中</Badge>
              ) : (
                <span className="muted">未排柜</span>
              )}
            </span>
            <span>
              <button className="mini" onClick={() => onOpen(c)}>
                详情
              </button>
            </span>
          </div>
        ))}
        {list.length === 0 && <p className="empty">没有符合筛选的编目记录。</p>}
      </div>
    </section>
  );
}

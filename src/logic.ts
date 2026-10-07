// 合并引擎：外业记录 -> 编目库（纯函数，单条原子提交，绝无半截写入）
import type {
  AppState,
  CatalogRecord,
  FieldDraft,
  MergeLog,
} from "./types";

export const now = () => new Date().toISOString();

export function fmtTime(iso?: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(
    d.getHours()
  )}:${p(d.getMinutes())}`;
}

export function shortId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}`;
}

/** 外业端必填校验：缺字段不进合并，留待处理区 */
export function validateDraft(d: FieldDraft): string | null {
  if (!d.采集号.trim()) return "缺少采集号";
  if (!d.物种.trim()) return "缺少物种名称";
  if (!d.海拔.trim()) return "缺少海拔";
  if (!d.生境.trim()) return "缺少生境";
  if (!d.采集人.trim()) return "缺少采集人";
  return null;
}

/** 柜位占用：只有在馆且已入库的标本才占层位容量 */
export function slotOccupancy(catalog: CatalogRecord[], slotId: string): number {
  return catalog.filter(
    (c) => c.柜位 === slotId && !c.已出柜 && c.压制状态 === "已入库"
  ).length;
}

/**
 * 标本到达“已入库”时安排柜位：有空位直接入柜；
 * 柜位满则排队候补（候补时间取首次进入时刻，不反复刷新）
 */
export function assignOrWaitlist(
  catalog: CatalogRecord[],
  slots: AppState["slots"],
  rec: CatalogRecord
): CatalogRecord {
  if (rec.压制状态 !== "已入库" || rec.柜位 || rec.已出柜) return rec;
  const occupied = new Map<string, number>();
  for (const c of catalog) {
    if (c.柜位 && !c.已出柜 && c.压制状态 === "已入库") {
      occupied.set(c.柜位, (occupied.get(c.柜位) ?? 0) + 1);
    }
  }
  for (const s of slots) {
    if ((occupied.get(s.id) ?? 0) < s.容量) {
      return { ...rec, 柜位: s.id, waitlistSince: undefined };
    }
  }
  return { ...rec, waitlistSince: rec.waitlistSince ?? now() };
}

interface MergeResult {
  catalog: CatalogRecord[];
  log: MergeLog;
  kind: MergeLog["kind"];
  detail: string;
}

/**
 * 合并一条外业记录：
 * - 同采集号且馆内已有鉴定结果：物种名称与鉴定状态按馆内（外业不覆盖）；
 *   海拔、生境按最后一次外业改动保留，采集人/地点/时间同步刷新。
 * - 同采集号未鉴定：外业定名可覆盖。
 * - 新采集号：先进编目库走压制流程，核验入库时再排柜位，满则候补。
 */
export function mergeOne(
  state: AppState,
  draft: FieldDraft
): MergeResult {
  const ts = now();
  const idx = state.catalog.findIndex(
    (c) => c.采集号 === draft.采集号.trim()
  );

  let catalog: CatalogRecord[];
  let kind: MergeLog["kind"];
  let detail: string;

  if (idx >= 0) {
    const existing = state.catalog[idx];
    const protectedSpecies =
      existing.鉴定状态 === "已鉴定" && existing.物种.trim() !== "";

    const merged: CatalogRecord = {
      ...existing,
      物种: protectedSpecies ? existing.物种 : draft.物种.trim(),
      鉴定状态: existing.鉴定状态, // 鉴定状态永远按馆内
      鉴定人: existing.鉴定人,
      // 海拔/生境：最后一次外业改动保留（空值不清空馆内数据）
      海拔: draft.海拔.trim() || existing.海拔,
      生境: draft.生境.trim() || existing.生境,
      采集人: draft.采集人.trim() || existing.采集人,
      采集地点: draft.采集地点.trim() || existing.采集地点,
      采集时间: draft.采集时间 || existing.采集时间,
      updatedAt: ts,
      合并备注: protectedSpecies
        ? `外业更新已保留馆内鉴定「${existing.物种}」；海拔、生境按外业最新改动覆盖`
        : "外业更新覆盖未定名记录",
    };

    catalog = state.catalog.map((c, i) => (i === idx ? merged : c));
    kind = protectedSpecies ? "冲突保护" : "覆盖更新";
    detail = protectedSpecies
      ? `采集号 ${draft.采集号}：沿用馆内鉴定「${existing.物种}（${existing.鉴定状态}）」，海拔/生境更新为 ${draft.海拔} / ${draft.生境}`
      : `采集号 ${draft.采集号}：未定名记录按外业更新为「${draft.物种}」`;
  } else {
    // 新记录先进编目库走压制/入库流程，不占柜位；标记已入库时再排柜
    const created: CatalogRecord = {
      id: shortId("CAT"),
      采集号: draft.采集号.trim(),
      物种: draft.物种.trim(),
      鉴定状态: "待鉴定",
      海拔: draft.海拔.trim(),
      生境: draft.生境.trim(),
      采集人: draft.采集人.trim(),
      采集地点: draft.采集地点.trim(),
      采集时间: draft.采集时间,
      压制状态: draft.压制状态,
      updatedAt: ts,
    };
    catalog = [...state.catalog, created];
    kind = "新增入库";
    detail = `采集号 ${draft.采集号} 新入编目库（${draft.物种}），待压制完成后安排柜位`;
  }

  return {
    catalog,
    kind,
    detail,
    log: { id: shortId("LOG"), time: ts, 采集号: draft.采集号, kind, detail },
  };
}

/** 腾出柜位后：候补（已入库但无柜位）按采集时间从早到晚依次补位 */
export function promoteWaitlist(catalog: CatalogRecord[], slots: AppState["slots"]) {
  const next = [...catalog];
  const promoted: CatalogRecord[] = [];

  for (let guard = 0; guard < next.length; guard++) {
    const waiting = next
      .map((rec, i) => ({ rec, i }))
      .filter(
        ({ rec }) =>
          rec.压制状态 === "已入库" && !rec.柜位 && !rec.已出柜
      )
      .sort((a, b) => {
        const ta = new Date(a.rec.采集时间).getTime() || 0;
        const tb = new Date(b.rec.采集时间).getTime() || 0;
        return ta - tb;
      });
    if (waiting.length === 0) break;

    const candidate = waiting[0];
    const occupied = new Map<string, number>();
    for (const c of next) {
      if (c.柜位 && !c.已出柜 && c.压制状态 === "已入库") {
        occupied.set(c.柜位, (occupied.get(c.柜位) ?? 0) + 1);
      }
    }
    const slot = slots.find((s) => (occupied.get(s.id) ?? 0) < s.容量);
    if (!slot) break;

    const moved: CatalogRecord = {
      ...candidate.rec,
      柜位: slot.id,
      waitlistSince: undefined,
      updatedAt: now(),
      合并备注: "候补按采集时间补位入柜",
    };
    next[candidate.i] = moved;
    promoted.push(moved);
  }
  return { catalog: next, promoted };
}

/** 候补队列：已入库但未排上柜位，按采集时间排序 */
export function waitlistQueue(catalog: CatalogRecord[]): CatalogRecord[] {
  return catalog
    .filter(
      (c) => c.压制状态 === "已入库" && !c.柜位 && !c.已出柜
    )
    .slice()
    .sort((a, b) => {
      const ta = new Date(a.采集时间).getTime() || 0;
      const tb = new Date(b.采集时间).getTime() || 0;
      return ta - tb;
    });
}

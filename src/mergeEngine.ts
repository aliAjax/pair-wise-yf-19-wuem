import type { Cabinet, Specimen } from "./types";

export const STEP_LABELS = ["校验外业记录", "匹配馆内鉴定结果", "写入编目库并入队", "分配柜位"];

/** 合并检查点推进：每一步都是原子状态更新，断网时只停在检查点上。
 *  未提交前不触碰入库队列与柜位占用。
 *  若同采集号已有馆内记录，外业记录在提交时并入该记录（absorbed=true），
 *  物种与鉴定状态保持馆内结果，海拔与生境保留外业最后改动。 */
export function advanceOneStep(
  rec: Specimen,
  all: Specimen[],
  cabinets: Cabinet[],
): {
  rec: Specimen;
  absorbed: boolean;
  event: { text: string; kind: "info" | "success" | "warn" | "error" };
} {
  const occupants = (cabinetId: string) =>
    all.filter((s) => s.cabinetId === cabinetId).length;

  switch (rec.mergeStep) {
    case 0: {
      const missing = [
        !rec.id && "采集号",
        !rec.species && "物种",
        !rec.elevation && "海拔",
        !rec.habitat && "生境",
        !rec.collector && "采集人",
      ].filter(Boolean) as string[];
      if (missing.length) {
        return {
          rec: { ...rec, mergeStatus: "merging" },
          absorbed: false,
          event: { text: `校验未通过：缺少${missing.join("、")}，已留待处理区`, kind: "error" },
        };
      }
      return {
        rec: { ...rec, mergeStep: 1, mergeStatus: "merging" },
        absorbed: false,
        event: { text: `校验通过：${rec.id} 外业记录完整`, kind: "info" },
      };
    }
    case 1: {
      // 同一采集号馆内已有鉴定结果：物种名称和鉴定状态按馆内的，海拔和生境照最后一次外业改动保留
      const match = all.find(
        (s) => s.source === "catalog" && s.id === rec.id && s.identification === "已鉴定",
      );
      if (match) {
        return {
          rec: {
            ...rec,
            species: match.species,
            identification: "已鉴定",
            mergeStep: 2,
            mergeStatus: "merging",
          },
          absorbed: false,
          event: {
            text: `同号 ${rec.id} 已有鉴定结果：物种名称与鉴定状态按馆内（${match.species}），海拔生境保留外业最后改动`,
            kind: "success",
          },
        };
      }
      return {
        rec: { ...rec, mergeStep: 2, mergeStatus: "merging" },
        absorbed: false,
        event: {
          text: `同号 ${rec.id} 馆内无鉴定结果：物种按外业记录，鉴定状态待鉴定`,
          kind: "info",
        },
      };
    }
    case 2: {
      const existing = all.find((s) => s.source === "catalog" && s.id === rec.id);
      if (existing) {
        // 并入已有馆内记录：物种、鉴定状态、照片保持馆内；海拔、生境等外业最后改动覆盖
        const updated: Specimen = {
          ...existing,
          elevation: rec.elevation,
          habitat: rec.habitat,
          location: rec.location || existing.location,
          collector: rec.collector,
          collectTime: rec.collectTime,
          pressing: rec.pressing === "待压制" ? existing.pressing : rec.pressing,
          updatedAt: rec.updatedAt,
          mergeStep: 3,
          mergeStatus: "merging",
          mergedAt: Date.now(),
        };
        return {
          rec: updated,
          absorbed: true,
          event: {
            text: `已并入编目库：${rec.id} 海拔生境按外业最后改动更新，物种与鉴定保持馆内结果`,
            kind: "success",
          },
        };
      }
      // 事务提交：此刻才改入库队列，此前断点不触碰队列与柜位
      const maxQueue = all.reduce((m, s) => Math.max(m, s.queueOrder ?? 0), 0);
      return {
        rec: {
          ...rec,
          source: "catalog",
          queueOrder: maxQueue + 1,
          mergeStep: 3,
          mergeStatus: "merging",
          mergedAt: Date.now(),
        },
        absorbed: false,
        event: { text: `已写入编目库，${rec.id} 进入入库队列（第 ${maxQueue + 1} 位）`, kind: "success" },
      };
    }
    case 3: {
      const free = cabinets.find((c) => occupants(c.id) < c.capacity);
      if (free) {
        return {
          rec: { ...rec, cabinetId: free.id, mergeStep: 4, mergeStatus: "merged" },
          absorbed: false,
          event: { text: `柜位 ${free.id} 有空位，${rec.id} 已上柜`, kind: "success" },
        };
      }
      return {
        rec: { ...rec, cabinetId: null, mergeStep: 4, mergeStatus: "merged" },
        absorbed: false,
        event: {
          text: `柜位容量已满，${rec.id} 进入候补，按采集时间（${rec.collectTime}）排队`,
          kind: "warn",
        },
      };
    }
    default:
      return {
        rec,
        absorbed: false,
        event: { text: `${rec.id} 合并已完成`, kind: "info" },
      };
  }
}

/** 候补队列：已合并但无柜位，按采集时间排序 */
export function waitingList(specimens: Specimen[]): Specimen[] {
  return specimens
    .filter((s) => s.mergeStatus === "merged" && !s.cabinetId)
    .sort((a, b) => a.collectTime.localeCompare(b.collectTime));
}

/** 腾出柜位后，空位按采集时间安排候补标本上柜。返回新数组与日志（若有）。 */
export function assignFreedSlot(
  specimens: Specimen[],
  cabinets: Cabinet[],
  freedUid: string,
): { specimens: Specimen[]; assigned: Specimen | null; cabinetId: string | null } {
  const freed = specimens.map((s) => (s.uid === freedUid ? { ...s, cabinetId: null } : s));
  // 腾出空位的标本本身回到候补池，但不参与本次自动分配（本次只安排原本就在候补的标本）
  const waiting = waitingList(freed).filter((s) => s.uid !== freedUid);
  const cabinet = cabinets.find(
    (c) => freed.filter((s) => s.cabinetId === c.id).length < c.capacity,
  );
  if (cabinet && waiting.length > 0) {
    const next = waiting[0];
    return {
      specimens: freed.map((s) => (s.uid === next.uid ? { ...s, cabinetId: cabinet.id } : s)),
      assigned: next,
      cabinetId: cabinet.id,
    };
  }
  return { specimens: freed, assigned: null, cabinetId: null };
}

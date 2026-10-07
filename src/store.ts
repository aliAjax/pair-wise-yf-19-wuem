import { useCallback, useEffect, useRef, useState } from "react";
import type {
  Cabinet,
  FilterKey,
  MergeEvent,
  Specimen,
} from "./types";
import { seedCabinets, seedFieldRecords, seedSpecimens } from "./seed";
import { STEP_LABELS, advanceOneStep, assignFreedSlot } from "./mergeEngine";

const STORAGE_KEY = "herbarium-press-store-v1";
const STEP_DELAY = 650;

interface PersistShape {
  specimens: Specimen[];
  cabinets: Cabinet[];
  online: boolean;
}

function loadState(): PersistShape {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as PersistShape;
      if (Array.isArray(parsed.specimens) && Array.isArray(parsed.cabinets)) {
        return parsed;
      }
    }
  } catch {
    // 损坏的缓存直接忽略，回到种子数据
  }
  return {
    specimens: [...seedSpecimens, ...seedFieldRecords],
    cabinets: seedCabinets,
    online: true,
  };
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const nowText = () =>
  new Date().toLocaleTimeString("zh-CN", { hour12: false });

export function useHerbarium() {
  const initial = useRef<PersistShape | null>(null);
  if (initial.current === null) initial.current = loadState();

  const [specimens, setSpecimens] = useState<Specimen[]>(initial.current.specimens);
  const [cabinets] = useState<Cabinet[]>(initial.current.cabinets);
  const [online, setOnline] = useState(initial.current.online);
  const [merging, setMerging] = useState(false);
  const [events, setEvents] = useState<MergeEvent[]>([]);
  const [filter, setFilter] = useState<FilterKey>("all");
  const eventId = useRef(0);

  const specimensRef = useRef(specimens);
  const cabinetsRef = useRef(cabinets);
  const onlineRef = useRef(online);
  const mergingRef = useRef(merging);
  specimensRef.current = specimens;
  cabinetsRef.current = cabinets;
  onlineRef.current = online;
  mergingRef.current = merging;

  useEffect(() => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ specimens, cabinets, online } satisfies PersistShape),
    );
  }, [specimens, cabinets, online]);

  const log = useCallback((text: string, kind: MergeEvent["kind"]) => {
    setEvents((prev) => [
      { id: ++eventId.current, time: nowText(), text, kind },
      ...prev,
    ].slice(0, 30));
  }, []);

  /** 外业离线登记：只写本地，压制状态先记待压制 */
  const addFieldRecord = useCallback(
    (data: {
      id: string;
      species: string;
      location: string;
      elevation: string;
      habitat: string;
      collector: string;
      collectTime: string;
    }) => {
      const rec: Specimen = {
        uid: `field-${Date.now()}-${data.id}`,
        ...data,
        pressing: "待压制",
        identification: "待鉴定",
        photo: "需补照",
        cabinetId: null,
        queueOrder: null,
        source: "field",
        mergeStatus: "pending",
        mergeStep: 0,
        updatedAt: Date.now(),
      };
      setSpecimens((prev) => [rec, ...prev]);
      log(`外业已离线登记：${rec.id}（压制状态：待压制），联网后合并`, "info");
    },
    [log],
  );

  const toggleOnline = useCallback(() => {
    setOnline((o) => {
      const next = !o;
      onlineRef.current = next;
      log(next ? "已恢复联网，可从断点继续合并" : "已断网：合并将在最近检查点暂停", next ? "success" : "warn");
      return next;
    });
  }, [log]);

  /** 合并外业记录：断网从停下的检查点续传，未合上的留待处理区，
   *  半截数据在提交前不会改入库队列和柜位占用 */
  const runMerge = useCallback(async () => {
    if (mergingRef.current) return;
    if (!onlineRef.current) {
      log("当前断网，无法合并：外业记录保留在待处理区", "warn");
      return;
    }
    setMerging(true);
    log("开始合并外业记录…", "info");

    const pending = specimensRef.current
      .filter((s) => s.source === "field" && s.mergeStatus !== "merged")
      .sort((a, b) => a.collectTime.localeCompare(b.collectTime));

    for (const startRec of pending) {
      const fieldUid = startRec.uid;
      let current = specimensRef.current.find((s) => s.uid === fieldUid);
      if (!current || current.mergeStatus === "merged") continue;

      while (current.mergeStep < 4) {
        await delay(STEP_DELAY);
        if (!onlineRef.current) {
          // 断网：停在当前检查点，队列与柜位尚未被触及
          const step = STEP_LABELS[Math.max(current.mergeStep - 1, 0)];
          log(
            `已断网：${current.id} 在「${step}」后暂停，记录留在待处理区，入库队列与柜位占用未变动`,
            "warn",
          );
          setSpecimens((prev) =>
            prev.map((s) =>
              s.uid === current!.uid ? { ...s, mergeStatus: "merging" } : s,
            ),
          );
          setMerging(false);
          return;
        }
        const { rec, event, absorbed } = advanceOneStep(current, specimensRef.current, cabinetsRef.current);
        current = rec;
        log(event.text, event.kind);
        setSpecimens((prev) => {
          if (absorbed) {
            // 并入已有馆内记录：移除外业副本，更新馆内记录
            return prev
              .filter((s) => s.uid !== fieldUid)
              .map((s) => (s.uid === current!.uid ? current! : s));
          }
          return prev.map((s) => (s.uid === current!.uid ? current! : s));
        });
      }
    }

    log("外业记录全部合并完成", "success");
    setMerging(false);
  }, [log]);

  /** 腾出柜位：空位按采集时间安排候补标本上柜 */
  const freeCabinet = useCallback(
    (uid: string) => {
      setSpecimens((prev) => {
        const target = prev.find((s) => s.uid === uid);
        const result = assignFreedSlot(prev, cabinetsRef.current, uid);
        if (result.assigned && result.cabinetId) {
          log(
            `柜位 ${result.cabinetId} 腾出空位，按采集时间安排 ${result.assigned.id}（${result.assigned.collectTime}）上柜`,
            "success",
          );
        } else if (target) {
          log(`已腾出 ${target.id} 的柜位，暂无候补标本`, "warn");
        }
        return result.specimens;
      });
    },
    [log],
  );

  const resetAll = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    const fresh = loadState();
    setSpecimens(fresh.specimens);
    setOnline(fresh.online);
    setEvents([]);
    log("已重置为演示数据", "info");
  }, [log]);

  return {
    specimens,
    cabinets,
    online,
    merging,
    events,
    filter,
    setFilter,
    addFieldRecord,
    toggleOnline,
    runMerge,
    freeCabinet,
    resetAll,
  };
}

export type HerbariumApi = ReturnType<typeof useHerbarium>;

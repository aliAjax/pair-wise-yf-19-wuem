import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  type ReactNode,
} from "react";
import type {
  AppState,
  CatalogRecord,
  FieldDraft,
  MergeLog,
  PressStatus,
} from "./types";
import {
  assignOrWaitlist,
  mergeOne,
  now,
  promoteWaitlist,
  shortId,
  validateDraft,
} from "./logic";
import { initialState } from "./seed";

const STORAGE_KEY = "herbarium-state-v1";

type Action =
  | { type: "ADD_DRAFT"; draft: FieldDraft }
  | { type: "UPDATE_DRAFT"; id: string; patch: Partial<FieldDraft> }
  | { type: "REMOVE_DRAFT"; id: string }
  | {
      type: "MERGE_DRAFT";
      draftId: string;
      catalog: CatalogRecord[];
      log: MergeLog;
    }
  | { type: "REJECT_DRAFT"; draftId: string; reason: string }
  | { type: "SET_ONLINE"; online: boolean }
  | { type: "SET_SYNCING"; syncing: boolean }
  | {
      type: "IDENTIFY";
      id: string;
      物种: string;
      鉴定人: string;
    }
  | { type: "SET_PRESS"; id: string; 压制状态: PressStatus }
  | { type: "VACATE_SLOT"; id: string }
  | { type: "RESET" };

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case "ADD_DRAFT":
      return { ...state, drafts: [...state.drafts, action.draft] };

    case "UPDATE_DRAFT":
      return {
        ...state,
        drafts: state.drafts.map((d) =>
          d.id === action.id
            ? {
                ...d,
                ...action.patch,
                // 重新编辑后回到待处理，可再次参与合并
                status: "待处理",
                failReason: undefined,
                updatedAt: now(),
              }
            : d
        ),
      };

    case "REMOVE_DRAFT":
      return {
        ...state,
        drafts: state.drafts.filter((d) => d.id !== action.id),
      };

    // 单条原子提交：catalog 与 draft 标记同一次 dispatch 完成，不存在半截状态
    case "MERGE_DRAFT": {
      const ts = now();
      return {
        ...state,
        catalog: action.catalog,
        logs: [action.log, ...state.logs].slice(0, 60),
        drafts: state.drafts.map((d) =>
          d.id === action.draftId
            ? { ...d, status: "已合并", mergedAt: ts, failReason: undefined }
            : d
        ),
      };
    }

    case "REJECT_DRAFT":
      return {
        ...state,
        drafts: state.drafts.map((d) =>
          d.id === action.draftId
            ? { ...d, status: "校验未过", failReason: action.reason }
            : d
        ),
      };

    case "SET_ONLINE":
      return { ...state, online: action.online };

    case "SET_SYNCING":
      return { ...state, syncing: action.syncing };

    case "IDENTIFY": {
      const catalog = state.catalog.map((c) =>
        c.id === action.id
          ? {
              ...c,
              物种: action.物种.trim() || c.物种,
              鉴定状态: "已鉴定" as const,
              鉴定人: action.鉴定人.trim() || "未署名",
              updatedAt: now(),
            }
          : c
      );
      return { ...state, catalog };
    }

    case "SET_PRESS": {
      // 进入“已入库”瞬间才尝试占用柜位；满了进候补，绝不产生半截占用
      let catalog = state.catalog.map((c) => {
        if (c.id !== action.id) return c;
        const updated = { ...c, 压制状态: action.压制状态, updatedAt: now() };
        return action.压制状态 === "已入库"
          ? assignOrWaitlist(state.catalog, state.slots, updated)
          : updated;
      });

      const changed = catalog.find((c) => c.id === action.id);
      const logs: MergeLog[] = [];
      if (
        changed &&
        action.压制状态 === "已入库" &&
        !changed.柜位 &&
        !changed.已出柜
      ) {
        logs.push({
          id: shortId("LOG"),
          time: now(),
          采集号: changed.采集号,
          kind: "新增入库",
          detail: `「${changed.物种}」完成入库流程但柜位已满，按采集时间排队候补`,
        });
      }
      return { ...state, catalog, logs: [...logs, ...state.logs].slice(0, 60) };
    }

    // 腾出柜位：标本出柜 -> 释放占用 -> 候补按采集时间补位
    case "VACATE_SLOT": {
      const target = state.catalog.find((c) => c.id === action.id);
      if (!target?.柜位) return state;
      const released: CatalogRecord = {
        ...target,
        已出柜: true,
        柜位: undefined,
        updatedAt: now(),
        合并备注: "标本外借/出柜，柜位释放",
      };
      const stepped = state.catalog.map((c) =>
        c.id === action.id ? released : c
      );
      const { catalog, promoted } = promoteWaitlist(stepped, state.slots);

      const logs: MergeLog[] = promoted.map((p) => ({
        id: shortId("LOG"),
        time: now(),
        采集号: p.采集号,
        kind: "新增入库" as const,
        detail: `柜位 ${target.柜位} 腾空后，候补标本「${p.物种}」按采集时间补位入柜 ${p.柜位}`,
      }));
      return {
        ...state,
        catalog,
        logs: [...logs, ...state.logs].slice(0, 60),
      };
    }

    case "RESET":
      return initialState();

    default:
      return state;
  }
}

function loadState(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as AppState;
      // 刷新后同步一律从“停下的地方”重新开始，不保留运行态
      return { ...parsed, syncing: false };
    }
  } catch {
    /* ignore */
  }
  return initialState();
}

interface Store {
  state: AppState;
  dispatch: React.Dispatch<Action>;
  startSync: () => void;
  stopSync: () => void;
  createDraft: (input: Omit<FieldDraft, "id" | "createdAt" | "updatedAt" | "status">) => void;
}

const StoreContext = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, loadState);
  const stateRef = useRef(state);
  stateRef.current = state;
  const timerRef = useRef<number | null>(null);

  // 持久化：断网刷新页面后待处理记录仍在，合并进度不丢
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      /* ignore */
    }
  }, [state]);

  const stopSync = () => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    dispatch({ type: "SET_SYNCING", syncing: false });
  };

  // 逐条合并：每条之间检查联网状态，断网立即停在当前条，已合上的不回滚
  const startSync = () => {
    if (stateRef.current.syncing) return;
    if (!stateRef.current.online) return;
    dispatch({ type: "SET_SYNCING", syncing: true });

    const step = () => {
      const s = stateRef.current;
      if (!s.syncing) return;
      if (!s.online) {
        // 断网：停在原地，未合的留在待处理区，已合的原子提交不受影响
        stopSync();
        return;
      }
      // 从停下的地方接着合：只取仍待处理的，按登记先后（FIFO）
      const pending = s.drafts
        .filter((d) => d.status === "待处理")
        .sort(
          (a, b) =>
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        );
      const next = pending[0];
      if (!next) {
        stopSync();
        return;
      }

      const reason = validateDraft(next);
      if (reason) {
        dispatch({ type: "REJECT_DRAFT", draftId: next.id, reason });
      } else {
        const result = mergeOne(s, next);
        dispatch({
          type: "MERGE_DRAFT",
          draftId: next.id,
          catalog: result.catalog,
          log: result.log,
        });
      }
      timerRef.current = window.setTimeout(step, 850);
    };

    timerRef.current = window.setTimeout(step, 400);
  };

  useEffect(() => () => stopSync(), []);

  const createDraft: Store["createDraft"] = (input) => {
    const ts = now();
    dispatch({
      type: "ADD_DRAFT",
      draft: {
        ...input,
        id: shortId("DR"),
        createdAt: ts,
        updatedAt: ts,
        status: "待处理",
      },
    });
  };

  const value = useMemo(
    () => ({ state, dispatch, startSync, stopSync, createDraft }),
    [state]
  );

  return (
    <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
  );
}

export function useStore(): Store {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore 必须在 StoreProvider 内使用");
  return ctx;
}

// 植物标本馆入库系统：数据模型

export type PressStatus = "待压制" | "已压制" | "已入库";
export type DetStatus = "待鉴定" | "已鉴定";
export type DraftStatus = "待处理" | "校验未过" | "已合并";

/** 外业离线登记记录 */
export interface FieldDraft {
  id: string;
  采集号: string;
  物种: string; // 外业临时定名
  海拔: string;
  生境: string;
  采集人: string;
  采集地点: string;
  采集时间: string; // ISO
  压制状态: PressStatus;
  createdAt: string;
  updatedAt: string;
  // 合并管线
  status: DraftStatus;
  failReason?: string;
  mergedAt?: string;
}

/** 编目库记录（馆内权威数据） */
export interface CatalogRecord {
  id: string;
  采集号: string;
  物种: string;
  鉴定状态: DetStatus;
  鉴定人?: string;
  海拔: string;
  生境: string;
  采集人: string;
  采集地点: string;
  采集时间: string;
  压制状态: PressStatus;
  柜位?: string; // 已安排的柜位编号
  waitlistSince?: string; // 进入候补队列的时间
  已出柜?: boolean;
  合并备注?: string;
  updatedAt: string;
}

export interface CabinetSlot {
  id: string;
  柜号: string;
  层位: string;
  容量: number; // 每层位可放份数
}

export interface MergeLog {
  id: string;
  time: string;
  采集号: string;
  kind: "新增入库" | "覆盖更新" | "冲突保护" | "校验未过";
  detail: string;
}

export interface AppState {
  drafts: FieldDraft[];
  catalog: CatalogRecord[];
  slots: CabinetSlot[];
  logs: MergeLog[];
  online: boolean;
  syncing: boolean;
  syncCursor: number;
}

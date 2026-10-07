export type PressingStatus = "待压制" | "已压制";
export type IdentificationStatus = "待鉴定" | "已鉴定";
export type PhotoStatus = "已拍照" | "需补照";
export type Source = "field" | "catalog";
export type MergeStatus = "pending" | "merging" | "merged";

/** 压制标本记录：外业离线登记与馆内编目共用同一模型，用 source 区分来源。
 *  uid 为记录唯一键（外业副本与馆内记录可能共用同一采集号），id 为业务采集号。 */
export interface Specimen {
  uid: string; // 记录唯一键
  id: string; // 采集号
  species: string; // 物种名称
  location: string; // 采集地点
  elevation: string; // 海拔
  habitat: string; // 生境描述
  collector: string; // 采集人
  collectTime: string; // 采集时间 YYYY-MM-DD，用于候补排队
  pressing: PressingStatus; // 压制状态（外业先记待压制）
  identification: IdentificationStatus; // 鉴定状态
  photo: PhotoStatus; // 照片状态
  cabinetId: string | null; // 馆藏柜位
  queueOrder: number | null; // 入库队列序号
  source: Source; // field=外业离线登记，catalog=编目库
  mergeStatus: MergeStatus; // 合并状态：待合并 / 合并中(断点) / 已合并
  mergeStep: number; // 合并检查点 0..4，断网后从断点续传
  updatedAt: number; // 最后外业改动时间
  mergedAt?: number; // 合并完成时间
}

export interface Cabinet {
  id: string; // 柜位编号，如 B-12-04
  area: string; // 库区
  capacity: number; // 容量
}

export type EventKind = "info" | "success" | "warn" | "error";

export interface MergeEvent {
  id: number;
  time: string;
  text: string;
  kind: EventKind;
}

/** 鉴定状态筛选 */
export type FilterKey = "all" | "pressing" | "identifying" | "stored" | "rephoto";

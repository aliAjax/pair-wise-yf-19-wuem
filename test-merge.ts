import { seedCabinets, seedFieldRecords, seedSpecimens } from "./src/seed";
import { advanceOneStep, assignFreedSlot, waitingList } from "./src/mergeEngine";
import type { Cabinet, Specimen } from "./src/types";

let pass = 0;
let fail = 0;
function assert(cond: boolean, msg: string) {
  if (cond) {
    pass++;
    console.log(`  ✓ ${msg}`);
  } else {
    fail++;
    console.error(`  ✗ ${msg}`);
  }
}

function mergeOne(initial: Specimen[], start: Specimen, cabinets: Cabinet[]): Specimen[] {
  let all = initial;
  let current = all.find((s) => s.uid === start.uid)!;
  while (current.mergeStep < 4) {
    const { rec, absorbed } = advanceOneStep(current, all, cabinets);
    current = rec;
    if (absorbed) {
      all = all
        .filter((s) => s.uid !== start.uid)
        .map((s) => (s.uid === current.uid ? current : s));
    } else {
      all = all.map((s) => (s.uid === current.uid ? current : s));
    }
  }
  return all;
}

// ---------- 场景 1：完整合并 ----------
console.log("场景1：外业记录完整合并");
let all: Specimen[] = [...seedSpecimens, ...seedFieldRecords];
const cabinets = seedCabinets;

for (const startRec of seedFieldRecords) {
  all = mergeOne(all, startRec, cabinets);
}

const r1501 = all.find((s) => s.id === "HX-240615-01" && s.source === "catalog")!;
assert(all.filter((s) => s.id === "HX-240615-01").length === 1, "HX-240615-01 外业副本已并入馆内（仅一条）");
assert(r1501.mergeStatus === "merged", "HX-240615-01 已合并");
assert(r1501.species === "槭属 Acer sp.", "物种名称按馆内鉴定结果（槭属 Acer sp.）");
assert(r1501.identification === "已鉴定", "鉴定状态按馆内（已鉴定）");
assert(r1501.elevation === "海拔1420m", "海拔保留外业最后改动");
assert(r1501.habitat === "阴坡石缝", "生境保留外业最后改动");
assert(r1501.source === "catalog", "合并后进入编目库");
assert(r1501.queueOrder !== null, "保留入库队列位");

const r1802 = all.find((s) => s.id === "HX-240618-02")!;
const r1805 = all.find((s) => s.id === "HX-240618-05")!;
const r1901 = all.find((s) => s.id === "HX-240619-01")!;
assert(r1802.cabinetId !== null, "柜位有空位：HX-240618-02 已上柜");
assert(r1501.cabinetId !== null, "柜位有空位：HX-240615-01 已上柜");
assert(r1805.cabinetId === null, "柜位满员：HX-240618-05 进入候补");
assert(r1901.cabinetId === null, "柜位满员：HX-240619-01 进入候补");

const waiting = waitingList(all);
assert(waiting[0].id === "HX-240618-05", "候补第1位 HX-240618-05（06-18，早于 06-19）");
assert(waiting[1].id === "HX-240619-01", "候补第2位 HX-240619-01（06-19）");

// ---------- 场景 2：腾出空位按采集时间安排 ----------
console.log("场景2：腾出柜位后按采集时间安排候补");
const before = all.find((s) => s.id === "HX-240618-05")!;
assert(before.cabinetId === null, "腾出前 HX-240618-05 无柜位");
const freed = all.find((s) => s.id === "HX-240615-08")!;
const result = assignFreedSlot(all, cabinets, freed.uid);
assert(result.assigned?.id === "HX-240618-05", "腾出 B-12-04 后按采集时间安排 HX-240618-05 上柜");
assert(result.cabinetId === "B-12-04", "柜位为 B-12-04");
const after = result.specimens.find((s) => s.id === "HX-240618-05")!;
assert(after.cabinetId === "B-12-04", "HX-240618-05 柜位已更新");
const r1901After = result.specimens.find((s) => s.id === "HX-240619-01")!;
assert(r1901After.cabinetId === null, "HX-240619-01 仍在候补");

// ---------- 场景 3：断网续传，半截数据不入库 ----------
console.log("场景3：断网从检查点续传，未合上不留队列/柜位");
let all2: Specimen[] = [...seedSpecimens, ...seedFieldRecords];
const queueBefore = all2.filter((s) => s.queueOrder !== null).length;
const cabinetsUsedBefore = all2.filter((s) => s.cabinetId !== null).length;

// 只推进 HX-240618-02 一步（校验），模拟断网
let rec = all2.find((s) => s.uid === "field-HX-240618-02")!;
let step = advanceOneStep(rec, all2, cabinets);
rec = step.rec;
all2 = all2.map((s) => (s.uid === rec.uid ? rec : s));
assert(rec.mergeStep === 1, "断网时停在检查点 1");
assert(rec.source === "field", "半截记录仍是外业状态，未写入编目库");
assert(rec.queueOrder === null, "半截记录未占入库队列位");
const queueAfter = all2.filter((s) => s.queueOrder !== null).length;
const cabinetsUsedAfter = all2.filter((s) => s.cabinetId !== null).length;
assert(queueAfter === queueBefore, "断网前后入库队列长度不变");
assert(cabinetsUsedAfter === cabinetsUsedBefore, "断网前后柜位占用不变");

// 恢复联网，从检查点续传
while (rec.mergeStep < 4) {
  const r = advanceOneStep(rec, all2, cabinets);
  rec = r.rec;
  all2 = all2.map((s) => (s.uid === rec.uid ? rec : s));
}
assert(rec.mergeStatus === "merged", "续传后 HX-240618-02 合并完成");
assert(rec.queueOrder !== null, "续传完成后获得队列位");

// ---------- 场景 4：无馆内鉴定结果时按外业 ----------
console.log("场景4：同号无馆内鉴定结果");
let all3: Specimen[] = [...seedSpecimens, ...seedFieldRecords];
let rec3 = all3.find((s) => s.uid === "field-HX-240618-02")!;
while (rec3.mergeStep < 4) {
  const r = advanceOneStep(rec3, all3, cabinets);
  rec3 = r.rec;
  all3 = all3.map((s) => (s.uid === rec3.uid ? rec3 : s));
}
assert(rec3.species === "报春花科", "无馆内鉴定：物种按外业记录");
assert(rec3.identification === "待鉴定", "无馆内鉴定：鉴定状态待鉴定");

console.log(`\n${pass} 通过, ${fail} 失败`);
process.exit(fail ? 1 : 0);

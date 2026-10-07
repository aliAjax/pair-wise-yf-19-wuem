import { useState } from "react";
import { StoreProvider } from "./store";
import { Header } from "./components/Header";
import { Metrics } from "./components/Metrics";
import { FieldForm } from "./components/FieldForm";
import { PendingArea } from "./components/PendingArea";
import { IntakeQueue } from "./components/IntakeQueue";
import { CatalogList } from "./components/CatalogList";
import { Cabinets } from "./components/Cabinets";
import { LocationCards } from "./components/LocationCards";
import { MergeLog } from "./components/MergeLog";
import { SpecimenDetail } from "./components/SpecimenDetail";
import type { CatalogRecord } from "./types";
import "./styles.css";

function Workspace() {
  const [openId, setOpenId] = useState<string | null>(null);
  const open = (r: CatalogRecord) => setOpenId(r.id);

  return (
    <main className="app">
      <Header />
      <Metrics />

      <section className="grid-2">
        <FieldForm />
        <PendingArea />
      </section>

      <IntakeQueue />

      <CatalogList onOpen={open} />

      <section className="grid-2">
        <Cabinets onOpen={open} />
        <MergeLog />
      </section>

      <LocationCards onOpen={open} />

      <footer className="app-foot">
        数据保存在浏览器本地（localStorage）：断网登记不丢，恢复联网后从断点继续合并；
        合并逐条原子提交，校验不过的草稿留在待处理区，绝不产生半截入库或柜位占用。
      </footer>

      {openId && <SpecimenDetail recId={openId} onClose={() => setOpenId(null)} />}
    </main>
  );
}

export default function App() {
  return (
    <StoreProvider>
      <Workspace />
    </StoreProvider>
  );
}

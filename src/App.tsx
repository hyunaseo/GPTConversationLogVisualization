import * as React from "react";
import "./styles.css";
import type { Filters, ChatThread } from "./types";
import { mockThreads } from "./lib/mock";
import { ZipImport } from "./components/ZipImport";
import { FiltersBar } from "./components/FiltersBar";
import { ThreadList } from "./components/ThreadList";
import { ThreadViewer } from "./components/ThreadViewer";
import {
  readZipEntries,
  listJsonPaths,
  readJsonText,
  parseJsonSafe,
  type ZipEntries,
} from "./lib/zipJson";
import { summarizeMaybeConversationsJson } from "./lib/summarizeConversationsJson";
import { JsonInspector } from "./components/JsonInspector";
import { scanConversations } from "./lib/scanConversations";
import { parseConversationsToThreads } from "./lib/parseConversations";
import { listMediaPaths, resolveAssetPointerToPath } from "./lib/resolveAssets";

const defaultFilters: Filters = {
  keyword: "",
  dateFrom: "",
  dateTo: "",
  imagesOnly: true,
};

function applyFilters(threads: ChatThread[], f: Filters) {
  return threads.filter((t) => {
    if (f.imagesOnly && !t.hasImages) return false;

    if (f.keyword.trim()) {
      const kw = f.keyword.trim().toLowerCase();
      const hay = (t.title ?? "").toLowerCase();
      if (!hay.includes(kw)) return false;
    }

    if (f.dateFrom) {
      const from = Date.parse(f.dateFrom + "T00:00:00");
      if ((t.startTime ?? 0) < from) return false;
    }
    if (f.dateTo) {
      const to = Date.parse(f.dateTo + "T23:59:59");
      if ((t.endTime ?? 0) > to) return false;
    }

    return true;
  });
}

export default function App() {
  const [zipFile, setZipFile] = React.useState<File | null>(null);
  const [zipEntries, setZipEntries] = React.useState<ZipEntries | null>(null);

  const [status, setStatus] = React.useState<string>("");
  const [filters, setFilters] = React.useState<Filters>(defaultFilters);
  const [jsonSummary, setJsonSummary] = React.useState<string>("");

  const [threads, setThreads] = React.useState<ChatThread[]>(mockThreads);

  const filtered = React.useMemo(() => applyFilters(threads, filters), [threads, filters]);

  const [selectedId, setSelectedId] = React.useState<string | null>(filtered[0]?.id ?? null);

  React.useEffect(() => {
    if (selectedId && filtered.some((t) => t.id === selectedId)) return;
    setSelectedId(filtered[0]?.id ?? null);
  }, [filtered, selectedId]);

  const selected = React.useMemo(
    () => filtered.find((t) => t.id === selectedId) ?? null,
    [filtered, selectedId]
  );

  async function onZipSelected(file: File) {
    setZipFile(file);
    setStatus("ZIP 읽는 중...");
    setJsonSummary("");
    setZipEntries(null);

    try {
      const entries = await readZipEntries(file);
      setZipEntries(entries);

      const jsonPaths = listJsonPaths(entries);
      if (jsonPaths.length === 0) {
        setStatus("ZIP 안에서 .json 파일을 찾지 못했습니다.");
        return;
      }

      const preferred =
        jsonPaths.find((p) => p.toLowerCase().includes("conversations")) ?? jsonPaths[0];

      const text = readJsonText(entries, preferred);
      const parsed = parseJsonSafe(text);

      if (!parsed.ok) {
        setStatus("JSON 파싱 실패");
        setJsonSummary(
          `File: ${preferred}\nJSON.parse error: ${parsed.error}\n\nFirst 2000 chars:\n${text.slice(0, 2000)}`
        );
        return;
      }

      // 1) threads 생성
      const threadsFromJson = parseConversationsToThreads(parsed.value);

      // 2) ZIP 안 이미지 파일 경로 목록 생성
      const mediaPaths = listMediaPaths(entries);
      if (import.meta.env.DEV)
        console.log("mediaPaths:", mediaPaths.length, mediaPaths.slice(0, 30));

      // 3) asset_pointer -> 실제 zip 경로 매핑해서 threads에 imagePaths 추가
      const threadsWithPaths: ChatThread[] = threadsFromJson.map((t) => {
        const pointers = t.imageAssetPointers ?? [];
        if (pointers.length === 0) return t;

        const resolved = pointers
          .map((ap) => resolveAssetPointerToPath(ap, mediaPaths))
          .filter((p): p is string => Boolean(p));

        const unique = Array.from(new Set(resolved));
        return {
          ...t,
          imagePaths: unique.length ? unique : undefined,
        };
      });

      setThreads(threadsWithPaths);

      const imgThreadCount = threadsWithPaths.filter((t) => t.hasImages).length;
      const mappedImgCount = threadsWithPaths.reduce((acc, t) => acc + (t.imagePaths?.length ?? 0), 0);

      // 디버그 요약/스캔
      if (import.meta.env.Dev) {
        const summary = summarizeMaybeConversationsJson(preferred, parsed.value);
        const scan = scanConversations(parsed.value, 10);

        setStatus(
          `완료: 대화 ${threadsWithPaths.length}개 (이미지 대화 ${imgThreadCount}개) · 매핑된 이미지 ${mappedImgCount}개`
        );

        setJsonSummary(
          [
            `JSON files found (${jsonPaths.length}):`,
            ...jsonPaths.slice(0, 50).map((p) => `- ${p}`),
            jsonPaths.length > 50 ? `... (+${jsonPaths.length - 50} more)` : "",
            "",
            "=== Summary (first conversation) ===",
            JSON.stringify(summary, null, 2),
            "",
            "=== Scan (all conversations) ===",
            JSON.stringify(scan, null, 2),
          ]
            .filter(Boolean)
            .join("\n")
        );
      }
      else {
        setJsonSummary("");
      }
    } catch (e: any) {
      console.error(e);
      setStatus(`에러: ${e?.message ?? String(e)}`);
    }
  }

  return (
    <div className="page">
      <header className="header">
        <div>
          <div className="h1">Data Collection for Project NoonChi</div>
          <div className="muted">
            All data is processed locally on your computer and is never transmitted elsewhere.
          </div>
        </div>
      </header>

      <main className="layout">
        {/* 1) Top full-width */}
        <section className="top">
          <ZipImport
            onZipSelected={onZipSelected}
            zipName={zipFile?.name ?? null}
            status={status}
          />
          {import.meta.env.DEV ? <JsonInspector summaryText={jsonSummary} /> : null}
        </section>

        {/* 2~4) Main content */}
        <section className="left">
          <FiltersBar filters={filters} onChange={setFilters} />
          <ThreadList threads={filtered} selectedId={selectedId} onSelect={setSelectedId} />
        </section>

        <section className="right">
          <ThreadViewer thread={selected} entries={zipEntries} />
        </section>
      </main>

      <footer className="footer muted">
        다음 단계: 이미지 썸네일 렌더링 최적화 + 선택 export ZIP
      </footer>
    </div>
  );
}

import * as React from "react";
import "./styles.css";
import type { Filters, ChatThread, SavedThread } from "./types";
import { mockThreads } from "./lib/mock";
import { ZipImport } from "./components/ZipImport";
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
import { SavedThreadGrid } from "./components/SavedThreadGrid";

const defaultFilters: Filters = {
  keyword: "",
  dateFrom: "",
  dateTo: "",
  imagesOnly: true,
};

function applyFilters(threads: ChatThread[], f: Filters, hasZipEntries: boolean) {
  return threads.filter((t) => {
    if (f.imagesOnly) {
      if (!t.hasImages) return false;
      if (hasZipEntries && (t.imagePaths?.length ?? 0) === 0) return false;
    }

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
  const [filters, _setFilters] = React.useState<Filters>(defaultFilters);
  const [jsonSummary, setJsonSummary] = React.useState<string>("");

  const [threads, setThreads] = React.useState<ChatThread[]>(mockThreads);
  const [savedThreads, setSavedThreads] = React.useState<SavedThread[]>([]);
  const [conversationLookup, setConversationLookup] = React.useState<Record<string, any>>({});

  const savedImageCount = React.useMemo(
    () =>
      savedThreads.reduce(
        (acc, thread) =>
          acc +
          (thread.imagePaths?.length ??
            thread.imageAssetPointers?.length ??
            0),
        0
      ),
    [savedThreads]
  );


  const addThreadToSaved = React.useCallback((thread: ChatThread) => {
    setSavedThreads((prev) => {
      if (prev.some((saved) => saved.id === thread.id)) return prev;
      const snapshot: SavedThread = {
        ...thread,
        messages: thread.messages ? [...thread.messages] : undefined,
        imageAssetPointers: thread.imageAssetPointers
          ? [...thread.imageAssetPointers]
          : undefined,
        imagePaths: thread.imagePaths ? [...thread.imagePaths] : undefined,
        savedAt: Date.now(),
      };
      return [snapshot, ...prev];
    });
  }, []);

  const removeThreadFromSaved = React.useCallback((threadId: string) => {
    setSavedThreads((prev) => prev.filter((saved) => saved.id !== threadId));
  }, []);

  const filtered = React.useMemo(
    () => applyFilters(threads, filters, Boolean(zipEntries)),
    [threads, filters, zipEntries]
  );

  const [selectedId, setSelectedId] = React.useState<string | null>(filtered[0]?.id ?? null);

  React.useEffect(() => {
    if (selectedId && filtered.some((t) => t.id === selectedId)) return;
    setSelectedId(filtered[0]?.id ?? null);
  }, [filtered, selectedId]);

  const selected = React.useMemo(
    () => filtered.find((t) => t.id === selectedId) ?? null,
    [filtered, selectedId]
  );

  const selectedIsSaved = React.useMemo(
    () => (selected ? savedThreads.some((saved) => saved.id === selected.id) : false),
    [savedThreads, selected]
  );

  const downloadSavedConversations = React.useCallback(() => {
    const payload = savedThreads
      .map((thread) => conversationLookup[thread.id])
      .filter(Boolean);

    if (payload.length === 0) return;

    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    const dateStamp = new Date().toISOString().slice(0, 10);
    anchor.href = url;
    anchor.download = `saved-conversations-${dateStamp}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }, [conversationLookup, savedThreads]);

  async function onZipSelected(file: File) {
    setZipFile(file);
    setStatus("");
    setJsonSummary("");
    setZipEntries(null);
    setConversationLookup({});

    try {
      const entries = await readZipEntries(file);
      setZipEntries(entries);

      const jsonPaths = listJsonPaths(entries);
      if (jsonPaths.length === 0) {
        setStatus("No .json files found inside the ZIP.");
        return;
      }

      const preferred =
        jsonPaths.find((p) => p.toLowerCase().includes("conversations")) ?? jsonPaths[0];

      const text = readJsonText(entries, preferred);
      const parsed = parseJsonSafe(text);

      if (!parsed.ok) {
        setStatus("JSON parsing failed");
        setJsonSummary(
          `File: ${preferred}\nJSON.parse error: ${parsed.error}\n\nFirst 2000 chars:\n${text.slice(0, 2000)}`
        );
        return;
      }

      const conversationsArray = Array.isArray(parsed.value) ? parsed.value : [];
      const lookup: Record<string, any> = {};
      for (const conv of conversationsArray) {
        const id = String(conv?.id ?? conv?.conversation_id ?? "");
        if (id) lookup[id] = conv;
      }
      setConversationLookup(lookup);

      // 1) threads 생성
      const threadsFromJson = parseConversationsToThreads(conversationsArray);

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
          `Done: ${threadsWithPaths.length} conversations (${imgThreadCount} with images) · ${mappedImgCount} images mapped`
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
          <div className="h1">Project NoonChi를 위한 데이터 수집</div>
          <div className="muted">
            모든 데이터 처리는 참가자의 개인 기기에서만 이루어지며, 그 어떤 정보도 외부로 전송되지 않습니다.
          </div>
        </div>
      </header>

      <main className="layout">
        <section className="tips">
          <aside className="card tipsCard">
            <div className="tipsTitle">Tips!<br /><br /></div>
            <p className="tipsLead">
              실험의 목적 상 아래에 해당하는 이미지는 <span className="tipsEm">수집 대상이 아닙니다!</span>
            </p>
            <ul className="tipsList">
              <li>ChatGPT가 생성한 이미지</li>
              <li>스크린샷 (예: 코딩에 대한 질의)</li>
              <li>개인정보(예: 주민등록번호)가 노출된 이미지<br /><br /></li>
            </ul>
            <p className="tipsLead">다양한 논의를 위해, 다양한 맥락의 이미지일수록 좋아요</p>
            <ul className="tipsList">
              <li>
                모든 데이터가 여기에 대한 것이나, “저게 뭐야?”같은 단순 질의에 대한
                것이면 곤란해요
              </li>
            </ul>
          </aside>
        </section>
        
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
          <ThreadList
            threads={filtered}
            selectedId={selectedId}
            onSelect={setSelectedId}
            entries={zipEntries}
            imagesOnly={filters.imagesOnly}
          />
        <div className="card savedCard">
            <div className="title">Step 4. 저장된 대화를 확인하고 다운로드하세요.</div>
            <div className="muted" style={{ marginTop: 6 }}>
              {savedThreads.length}개 저장됨
            </div>
            {savedThreads.length > 0 ? (
              <SavedThreadGrid
                savedThreads={savedThreads}
                selectedId={selectedId}
                onSelect={setSelectedId}
                entries={zipEntries}
              />
            ) : null}
            <div className="muted" style={{ marginTop: 10 }}>
              {savedThreads.length === 0
                ? "Step 3의 Add 버튼을 눌러 저장하세요."
                : savedThreads.length < 10
                ? "10개 이상의 대화를 추가하세요."
                : "대화를 다운로드하세요."}
            </div>
            {savedImageCount > 0 ? (
              <div className="savedActions">
                <button
                  className="btn savedDownloadBtn"
                  type="button"
                  onClick={downloadSavedConversations}
                >
                  Download
                </button>
              </div>
            ) : null}
          </div>
        </section>

        <section className="right">
          <ThreadViewer
            thread={selected}
            entries={zipEntries}
            onAddThread={addThreadToSaved}
            onDeleteThread={removeThreadFromSaved}
            isAdded={selectedIsSaved}
          />
        </section>
      </main>
    </div>
  );
}

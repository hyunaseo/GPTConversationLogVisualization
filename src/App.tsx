import * as React from "react";
import { strToU8, zipSync } from "fflate";
import "./styles.css";
import type { Filters, ChatThread, SavedThread, Conversation } from "./types";
import { mockThreads } from "./lib/mock";
import { FiltersBar } from "./components/FiltersBar";
import { ZipImport } from "./components/ZipImport";
import { ThreadList } from "./components/ThreadList";
import { ThreadViewer } from "./components/ThreadViewer";
import { SavedThreadGrid } from "./components/SavedThreadGrid";
import { detectProvider } from "./lib/providers/detector";
import { getProvider } from "./lib/providers/factory";
import { ZipManager } from "./lib/ZipManager";

const defaultFilters: Filters = {
  keyword: "",
  dateFrom: "",
  dateTo: "",
};

function applyFilters(threads: ChatThread[], f: Filters) {
  return threads.filter((t) => {
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
  const [zipManager, setZipManager] = React.useState<ZipManager | null>(null);
  const [zipName, setZipName] = React.useState<string | null>(null);

  const [status, setStatus] = React.useState<string>("");
  const [filters, setFilters] = React.useState<Filters>(defaultFilters);
  const [unresolvedImageCount, setUnresolvedImageCount] = React.useState(0);

  const [threads, setThreads] = React.useState<ChatThread[]>(mockThreads);
  const [savedThreads, setSavedThreads] = React.useState<SavedThread[]>([]);
  const [conversationLookup, setConversationLookup] = React.useState<
    Record<string, Conversation>
  >({});

  // Cleanup effect to close zip manager
  React.useEffect(() => {
    return () => {
      zipManager?.close();
    };
  }, [zipManager]);

  const savedImageCount = React.useMemo(
    () =>
      savedThreads.reduce(
        (acc, thread) =>
          acc +
          (thread.imagePaths?.length ?? thread.imageAssetPointers?.length ?? 0),
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
    () => applyFilters(threads, filters),
    [threads, filters]
  );

  const [selectedId, setSelectedId] = React.useState<string | null>(
    filtered[0]?.id ?? null
  );

  React.useEffect(() => {
    if (selectedId && filtered.some((t) => t.id === selectedId)) return;
    setSelectedId(filtered[0]?.id ?? null);
  }, [filtered, selectedId]);

  const selected = React.useMemo(
    () => filtered.find((t) => t.id === selectedId) ?? null,
    [filtered, selectedId]
  );

  const selectedIsSaved = React.useMemo(
    () =>
      selected
        ? savedThreads.some((saved) => saved.id === selected.id)
        : false,
    [savedThreads, selected]
  );

  const downloadSavedConversations = React.useCallback(async () => {
    if (!zipManager) return;

    const payload = savedThreads
      .map((thread) => {
        // Check if this is a Gemini thread (needs synthetic structure)
        if (thread.provider === "gemini") {
          const imagePaths = thread.imagePaths ?? [];
          const exportImagePaths = imagePaths.map((path) => `images/${path}`);
          return {
            id: thread.id,
            title: thread.title,
            provider: "gemini",
            create_time: thread.startTime,
            update_time: thread.endTime,
            messages: thread.messages?.map((m) => ({
              id: m.id,
              role: m.role,
              content: { text: m.text },
              created_at: m.createdAt,
            })),
            image_paths: exportImagePaths.length ? exportImagePaths : undefined,
            image_asset_pointers: thread.imageAssetPointers?.length
              ? [...thread.imageAssetPointers]
              : undefined,
          };
        } else {
          // ChatGPT: use original structure from conversationLookup
          const conversation = conversationLookup[thread.id] as Conversation;
          if (!conversation) return null;

          const imagePaths = thread.imagePaths ?? [];
          const exportImagePaths = imagePaths.map((path) => `images/${path}`);
          return {
            id: conversation.id,
            title: conversation.title,
            create_time: conversation.create_time,
            update_time: conversation.update_time,
            mapping: conversation.mapping,
            image_paths: exportImagePaths.length ? exportImagePaths : undefined,
            image_asset_pointers: thread.imageAssetPointers?.length
              ? [...thread.imageAssetPointers]
              : undefined,
          };
        }
      })
      .filter(Boolean);

    if (payload.length === 0) return;
    const dateStamp = new Date().toISOString().slice(0, 10);

    const imageEntries: Record<string, Uint8Array> = {};
    const uniquePaths = new Set(
      savedThreads.flatMap((thread) => thread.imagePaths ?? [])
    );

    for (const path of uniquePaths) {
      // This is inefficient, but simpler than tracking blob urls
      const blob = await zipManager.readBlobUrl(path);
      if (blob) {
        const resp = await fetch(blob);
        const buffer = await resp.arrayBuffer();
        imageEntries[`images/${path}`] = new Uint8Array(buffer);
        URL.revokeObjectURL(blob);
      }
    }

    const anchor = document.createElement("a");
    let blob: Blob;
    if (Object.keys(imageEntries).length > 0) {
      const jsonName = `saved-conversations-${dateStamp}.json`;
      const zipData = zipSync({
        [jsonName]: strToU8(JSON.stringify(payload, null, 2)),
        ...imageEntries,
      });
      const zipArray = new Uint8Array(zipData);
      blob = new Blob([zipArray.buffer], { type: "application/zip" });
      anchor.download = `saved-conversations-${dateStamp}.zip`;
    } else {
      blob = new Blob([JSON.stringify(payload, null, 2)], {
        type: "application/json",
      });
      anchor.download = `saved-conversations-${dateStamp}.json`;
    }

    const url = URL.createObjectURL(blob);

    anchor.href = url;

    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }, [conversationLookup, savedThreads, zipManager]);

  async function onZipSelected(file: File) {
    // Clean up previous manager if it exists
    if (zipManager) {
      await zipManager.close();
    }

    setZipName(file.name);
    setStatus("");
    setConversationLookup({});
    setThreads(mockThreads); // Reset to mock/empty state

    try {
      setStatus("Reading ZIP file...");
      const manager = new ZipManager(file);
      setZipManager(manager);

      // 1. DETECT PROVIDER
      setStatus("Detecting format...");
      const entryPaths = (await manager.getEntries()).map((e) => e.filename);
      const providerType = detectProvider(entryPaths);

      if (providerType === "unknown") {
        setStatus("Unknown format. Please upload ChatGPT or Gemini export.");
        manager.close();
        setZipManager(null);
        return;
      }

      setStatus(`Detected ${providerType.toUpperCase()} format. Parsing...`);

      // 2. GET PROVIDER
      const provider = getProvider(providerType);

      // 3. PARSE (this may take a while for large Gemini exports)
      const { threads, conversationLookup } = await provider.parse(manager);
      setConversationLookup(conversationLookup);

      setStatus("Resolving images...");

      // 4. RESOLVE ASSETS
      const threadsWithPaths = await provider.resolveAssets(threads, manager);
      console.log(`Setting ${threadsWithPaths.length} threads in state...`);
      setThreads(threadsWithPaths);

      // 5. UPDATE STATUS
      const imgThreadCount = threadsWithPaths.filter((t) => t.hasImages).length;
      const mappedImgCount = threadsWithPaths.reduce(
        (acc, t) => acc + (t.imagePaths?.length ?? 0),
        0
      );
      const totalImageCount = threads.reduce(
        (acc, t) => acc + (t.imageAssetPointers?.length ?? 0),
        0
      );
      setUnresolvedImageCount(totalImageCount - mappedImgCount);

      console.log(
        `Processing complete: ${threadsWithPaths.length} threads, ${imgThreadCount} with images, ${mappedImgCount} images`
      );

      setStatus(
        `${providerType.toUpperCase()}: ${
          threadsWithPaths.length
        } conversations ` +
          `(${imgThreadCount} with images) · ${mappedImgCount} images mapped`
      );

      console.log("Upload processing complete!");
    } catch (e: unknown) {
      console.error(e);
      setStatus(`Error: ${e instanceof Error ? e.message : String(e)}`);
      if (zipManager) {
        await zipManager.close();
      }
      setZipManager(null);
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
            zipName={zipName}
            status={status}
          />
          <FiltersBar filters={filters} onFiltersChange={setFilters} />
        </section>

        {/* 2~4) Main content */}
        <section className="left">
          <ThreadList
            threads={filtered}
            selectedId={selectedId}
            onSelect={setSelectedId}
            zipManager={zipManager}
            unresolvedImageCount={unresolvedImageCount}
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
                zipManager={zipManager}
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
            zipManager={zipManager}
            onAddThread={addThreadToSaved}
            onDeleteThread={removeThreadFromSaved}
            isAdded={selectedIsSaved}
          />
        </section>
      </main>
    </div>
  );
}
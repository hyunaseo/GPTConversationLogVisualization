import React from "react";

type Props = {
  onZipSelected: (file: File) => void;
  zipName?: string | null;
  status?: string;
};

export function ZipImport({ onZipSelected, zipName, status }: Props) {
  const inputRef = React.useRef<HTMLInputElement | null>(null);

  return (
    <div className="card">
      <div className="row">
        <div>
          <div className="title">1) Import ChatGPT Export (ZIP)</div>
          <div className="muted">
            로컬에서만 처리됩니다. (현재는 UI만 있고 파싱은 아직 미구현)
          </div>
        </div>

        <button
          className="btn"
          onClick={() => inputRef.current?.click()}
          type="button"
        >
          ZIP 선택
        </button>

        <input
          ref={inputRef}
          type="file"
          accept=".zip"
          style={{ display: "none" }}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onZipSelected(f);
          }}
        />
      </div>

      <div className="muted" style={{ marginTop: 10 }}>
        {zipName ? (
          <>
            선택됨: <b>{zipName}</b>
          </>
        ) : (
          "아직 ZIP이 선택되지 않았습니다."
        )}
      </div>

      {status ? (
        <div className="muted" style={{ marginTop: 6 }}>
          상태: {status}
        </div>
      ) : null}
    </div>
  );
}

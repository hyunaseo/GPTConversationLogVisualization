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
          <div className="title">Step 1. Upload the ZIP file downloaded from ChatGPT.</div>
          <div className="muted">
            ChatGPT → Settings → Data Controls → Export Data → Receive the ZIP file by email (may take up to 12 hours)
          </div>
        </div>

        <button
          className="btn"
          onClick={() => inputRef.current?.click()}
          type="button"
        >
          Upload
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
            Selected: <b>{zipName}</b>
          </>
        ) : (
          ""
        )}
      </div>

      {status ? (
        <div className="muted" style={{ marginTop: 6 }}>
          Status: {status}
        </div>
      ) : null}
    </div>
  );
}

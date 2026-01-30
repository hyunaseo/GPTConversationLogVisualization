

export function listMediaPaths(paths: string[]): string[] {
  return paths.filter((p) => /\.(png|jpe?g|webp)$/i.test(p));
}

// asset_pointer에서 file_... 토큰을 찾아봄
export function extractFileToken(assetPointer: string): string | null {
  const m = assetPointer.match(/file_[0-9a-f]+/i);
  return m ? m[0] : null;
}

// mediaPaths에서 토큰을 포함하는 경로를 찾음
export function resolveAssetPointerToPath(
  assetPointer: string, // This is expected to be a filename, e.g., "image_abc.png"
  mediaPaths: string[] // These are full paths, e.g., "Takeout/My Activity/Gemini Apps/image_abc.png"
): string | null {
  const targetFilename = assetPointer.toLowerCase();

  // Try to find an exact filename match first
  const exactMatch = mediaPaths.find((p) => {
    const filename = p.split("/").pop()?.toLowerCase();
    return filename === targetFilename;
  });
  if (exactMatch) return exactMatch;

  // Fallback to token matching (original logic, but less preferred)
  const token = extractFileToken(assetPointer);
  if (token) {
    const preferred = mediaPaths.find((p) => p.includes(token) && p.includes("sanitized"));
    if (preferred) return preferred;

    const any = mediaPaths.find((p) => p.includes(token));
    if (any) return any;
  }

  // Fallback: asset_pointer 일부를 경로에서 찾아보기 (original logic)
  const tail = assetPointer.slice(-24);
  const byTail = mediaPaths.find((p) => p.includes(tail));
  if (byTail) return byTail;

  return null;
}

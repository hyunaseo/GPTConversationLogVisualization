import type { ZipEntries } from "./zipJson";

export function listMediaPaths(entries: ZipEntries): string[] {
  return Object.keys(entries).filter((p) => /\.(png|jpe?g|webp)$/i.test(p));
}

// asset_pointer에서 file_... 토큰을 찾아봄
export function extractFileToken(assetPointer: string): string | null {
  const m = assetPointer.match(/file_[0-9a-f]+/i);
  return m ? m[0] : null;
}

// mediaPaths에서 토큰을 포함하는 경로를 찾음
export function resolveAssetPointerToPath(
  assetPointer: string,
  mediaPaths: string[]
): string | null {
  const token = extractFileToken(assetPointer);

  if (token) {
    // 우선 sanitized 먼저, 없으면 아무거나
    const preferred = mediaPaths.find((p) => p.includes(token) && p.includes("sanitized"));
    if (preferred) return preferred;

    const any = mediaPaths.find((p) => p.includes(token));
    if (any) return any;
  }

  // fallback: asset_pointer 일부를 경로에서 찾아보기
  // (너무 비싸지 않게 마지막 24자만)
  const tail = assetPointer.slice(-24);
  const byTail = mediaPaths.find((p) => p.includes(tail));
  if (byTail) return byTail;

  return null;
}

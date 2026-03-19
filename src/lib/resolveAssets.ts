export function extractFileToken(assetPointer: string): string | null {
  const m = assetPointer.match(/file_[0-9a-f]+/i);
  return m ? m[0] : null;
}

export function resolveAssetPointerToPath(
  assetPointer: string,
  mediaPaths: string[]
): string | null {
  const token = extractFileToken(assetPointer);

  if (token) {
    const preferred = mediaPaths.find((p) => p.includes(token) && p.includes("sanitized"));
    if (preferred) return preferred;

    const any = mediaPaths.find((p) => p.includes(token));
    if (any) return any;
  }

  const tail = assetPointer.slice(-24);
  const byTail = mediaPaths.find((p) => p.includes(tail));
  if (byTail) return byTail;

  return null;
}

// The data files are trusted inputs with known shapes. When a lookup can only
// come back empty if a file is malformed, req() turns the silent undefined
// into a loud error instead of letting NaN or "undefined" reach the map.
export function req<T>(v: T | null | undefined, what = "value"): T {
  if (v == null) throw new Error(`missing ${what}`);
  return v;
}

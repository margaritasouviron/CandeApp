/** Expo Router puede devolver string | string[] (sobre todo en web). */
export function firstSearchParam(value: string | string[] | undefined): string | undefined {
  if (value == null) return undefined;
  if (Array.isArray(value)) return value[0];
  return value;
}

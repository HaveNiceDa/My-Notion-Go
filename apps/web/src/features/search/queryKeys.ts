export function documentSearchQueryKey(query: string) {
  return ["documents", "search", query] as const;
}

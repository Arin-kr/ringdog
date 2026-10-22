/** "#동물"처럼 #으로 시작하는 검색어는 태그 정확 일치 검색이다. 아니면 null. */
export function parseTagQuery(query: string): string | null {
  const q = query.trim();
  if (!q.startsWith("#")) return null;
  const tag = q.slice(1).trim();
  return tag || null;
}

/** OpenSearch 상품 검색 본문 (최신순). */
export function buildSearchBody(query: string, from: number, size: number) {
  const q = query.trim();
  const tag = parseTagQuery(q);
  let body: Record<string, unknown>;
  if (tag) {
    body = { term: { tags: tag } };
  } else if (q) {
    body = {
      bool: {
        should: [
          { match: { name: { query: q, fuzziness: "AUTO" } } },
          { match: { description: { query: q } } },
          { terms: { tags: [q] } },
        ],
        minimum_should_match: 1,
      },
    };
  } else {
    body = { match_all: {} };
  }
  return { from, size, query: body, sort: [{ createdAt: { order: "desc" } }] };
}

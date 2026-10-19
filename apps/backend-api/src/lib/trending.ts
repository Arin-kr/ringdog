import { prisma } from "@ringdog/db";

export interface TrendingItem {
  id: string;
  name: string;
  price: number;
  imageUrl: string | null;
  tags: string[];
  sold: number;
}

interface TrendingRow {
  id: string;
  name: string;
  price: string;
  image_url: string | null;
  tags: string[];
  sold: bigint;
}

/**
 * 최근 1시간 주문 기준 인기상품 8개.
 *
 * 데모 시나리오 ①의 원인 ①: orders(created_at)·order_items(order_id) 인덱스가 없어서
 * 대량 데이터(주문 50만·항목 150만)를 매번 Seq Scan + Hash Join 한다. 근본 수정(인덱스 추가)은
 * 시연 중 MCP로 PR만 만들고 머지하지 않는다 (docs/design/specs/2026-10-15-demo-flash-sale-db-design.md).
 */
export async function queryTrending(): Promise<TrendingItem[]> {
  const rows = await prisma.$queryRaw<TrendingRow[]>`
    SELECT p.id, p.name, p.price::text AS price, p.image_url, p.tags, s.sold
    FROM (
      SELECT oi.product_id, SUM(oi.quantity) AS sold
      FROM order_items oi
      JOIN orders o ON o.id = oi.order_id
      WHERE o.created_at > now() - interval '1 hour'
      GROUP BY oi.product_id
      ORDER BY sold DESC
      LIMIT 8
    ) s
    JOIN products p ON p.id = s.product_id
    ORDER BY s.sold DESC`;

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    price: Number(row.price),
    imageUrl: row.image_url,
    tags: row.tags,
    sold: Number(row.sold),
  }));
}

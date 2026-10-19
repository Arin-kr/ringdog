-- 원인 ① 근본 수정 적용. 시연 중 MCP가 만든 PR(demo/fix-index-*)과 같은 이름·같은 인덱스.
-- PR은 main에 머지하지 않고, reset이 이 인덱스를 지운다.
-- CONCURRENTLY를 쓰지 않는 이유: CONCURRENTLY는 열려 있는 모든 트랜잭션(= 세일가 반영 배치)이
-- 끝날 때까지 기다려 멈춘다. 일반 CREATE INDEX는 orders·order_items 쓰기만 잠시 막고,
-- 배치가 잡은 products 행 락과는 겹치지 않는다 (그 시점 결제는 어차피 실패 중).
SET lock_timeout = '30s';
CREATE INDEX IF NOT EXISTS orders_created_at_idx ON orders (created_at);
CREATE INDEX IF NOT EXISTS order_items_order_id_idx ON order_items (order_id);
ANALYZE orders;
ANALYZE order_items;
\echo 'fix-index: orders_created_at_idx, order_items_order_id_idx ready'

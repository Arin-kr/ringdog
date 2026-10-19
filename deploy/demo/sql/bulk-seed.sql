-- 시나리오 ① 대량 데이터 (cd.yml이 마이그레이션 다음에 매번 실행, 수동: demo-control seed). 이미 했으면 건너뛴다.
-- 상품 1,200개(기존 60 + 1,140), 주문 50만(최근 90일 분산), 주문 항목 150만(앞쪽 상품에 몰리게).
SELECT EXISTS (SELECT 1 FROM users WHERE email = 'bulk-seed@ringdog.demo') AS seeded \gset
\if :seeded
  \echo 'bulk seed: already done, skipping'
  \quit
\endif

BEGIN;

INSERT INTO users (id, email, password_hash, role, created_at)
VALUES (gen_random_uuid(), 'bulk-seed@ringdog.demo', '!', 'customer', now());

-- 기존 60개보다 오래된 것으로 넣어 홈 화면(최신순)에는 기존 상품이 먼저 보이게 한다.
INSERT INTO products (id, name, description, price, stock, tags, created_at)
SELECT gen_random_uuid(),
       format('세일 키링 #%s', 60 + n),
       '타임세일 데모용 대량 상품입니다.',
       5000 + ((n * 1500) % 45000),
       100000,
       ARRAY['미니', '별'],
       now() - interval '1 day' - n * interval '1 minute'
FROM generate_series(1, 1140) AS n;

-- k6가 계속 구매해도 재고가 바닥나지 않게 (재고 부족은 409)
UPDATE products SET stock = 100000;

INSERT INTO orders (id, user_id, total_amount, status, created_at)
SELECT gen_random_uuid(), u.id, 10000, 'PAID', now() - random() * interval '90 days'
FROM generate_series(1, 500000), (SELECT id FROM users WHERE email = 'bulk-seed@ringdog.demo') u;

CREATE TEMP TABLE seed_products ON COMMIT DROP AS
SELECT id, price, row_number() OVER (ORDER BY created_at DESC, id) AS rn FROM products;

INSERT INTO order_items (id, order_id, product_id, quantity, unit_price)
SELECT gen_random_uuid(), x.order_id, p.id, x.qty, p.price
FROM (
  SELECT o.id AS order_id,
         1 + floor(power(random(), 3) * (SELECT count(*) FROM seed_products))::int AS rn,
         1 + floor(random() * 3)::int AS qty
  FROM orders o
  CROSS JOIN generate_series(1, 3)
  WHERE o.user_id = (SELECT id FROM users WHERE email = 'bulk-seed@ringdog.demo')
  OFFSET 0 -- 서브쿼리를 먼저 계산해 random()이 행마다 한 번만 평가되게 한다
) x
JOIN seed_products p ON p.rn = x.rn;

COMMIT;

ANALYZE products;
ANALYZE orders;
ANALYZE order_items;
\echo 'bulk seed: done'

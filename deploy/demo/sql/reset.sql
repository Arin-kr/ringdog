-- 다음 시연자가 같은 상태에서 시작하도록 되돌린다. 새 환경에서도, 두 번 실행해도 오류 없이 끝나야 한다.
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE application_name = 'inventory-batch' AND pid <> pg_backend_pid();

-- 안전 모드가 커밋한 세일가·재고를 원래 값으로
DO $$
BEGIN
  IF to_regclass('public.demo_price_backup') IS NOT NULL THEN
    UPDATE products p SET price = b.price, stock = b.stock
    FROM demo_price_backup b
    WHERE p.id = b.product_id;
    DROP TABLE demo_price_backup;
  END IF;
END $$;

-- 원인 ① 근본 수정 인덱스(fix-index가 만든 것) 제거 → 다음 시연도 인덱스 없이 시작 (MCP PR은 머지하지 않는다)
DROP INDEX IF EXISTS orders_created_at_idx;
DROP INDEX IF EXISTS order_items_order_id_idx;

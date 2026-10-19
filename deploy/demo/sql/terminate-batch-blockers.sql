-- 2차 대처: 세일가 반영 배치 세션만 끊는다. 대상은 Job 실행 시점에 다시 조회한다 (Workflow가 PID를 넘기지 않음).
-- 조건: application_name = 'inventory-batch' + 다른 세션을 막고 있음 + 자기 트랜잭션이 30초 넘게 열려 있음.
-- (Agent custom query ringdog.db.blocking_sessions와 같은 판정에 이름 조건만 더한 것)
-- 지표는 일부러 더 넓다(이름 조건 없음 — 어떤 세션이 막아도 보이게). 끊는 대상은 세 조건을 모두 만족하는 배치 세션뿐.
WITH blockers AS (
  SELECT DISTINCT unnest(pg_blocking_pids(pid)) AS pid
  FROM pg_stat_activity
  WHERE wait_event_type = 'Lock'
)
SELECT a.pid,
       a.application_name,
       date_trunc('second', now() - a.xact_start) AS xact_age,
       pg_terminate_backend(a.pid) AS terminated
FROM blockers b
JOIN pg_stat_activity a ON a.pid = b.pid
WHERE a.application_name = 'inventory-batch'
  AND now() - a.xact_start > interval '30 seconds';

-- Datadog DBM 준비 (Postgres 16 / RDS). cd.yml이 마스터 계정으로 매 배포 실행 — 여러 번 실행해도 안전.
-- 사용: psql -v ON_ERROR_STOP=1 -v dd_password=<비밀번호> -f datadog-setup.sql
SELECT format('CREATE ROLE datadog WITH LOGIN PASSWORD %L', :'dd_password')
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'datadog') \gexec
ALTER ROLE datadog WITH LOGIN PASSWORD :'dd_password';
ALTER ROLE datadog INHERIT;
GRANT pg_monitor TO datadog;

CREATE SCHEMA IF NOT EXISTS datadog;
GRANT USAGE ON SCHEMA datadog TO datadog;
GRANT USAGE ON SCHEMA public TO datadog;

CREATE EXTENSION IF NOT EXISTS pg_stat_statements SCHEMA public;

-- Explain Plan 수집용 (Datadog 문서의 함수 그대로)
CREATE OR REPLACE FUNCTION datadog.explain_statement(
   l_query TEXT,
   OUT explain JSON
)
RETURNS SETOF JSON AS
$$
DECLARE
curs REFCURSOR;
plan JSON;

BEGIN
   OPEN curs FOR EXECUTE pg_catalog.concat('EXPLAIN (FORMAT JSON) ', l_query);
   FETCH curs INTO plan;
   CLOSE curs;
   RETURN QUERY SELECT plan;
END;
$$
LANGUAGE 'plpgsql'
RETURNS NULL ON NULL INPUT
SECURITY DEFINER;

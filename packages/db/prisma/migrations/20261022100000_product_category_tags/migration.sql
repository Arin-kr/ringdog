-- 기존 기본 상품(시드 60개)에 카테고리 이름 태그를 단다. 새 DB는 seed.ts가 처음부터 단다.
-- 대량 시드 "세일 키링 #N"은 카테고리에 넣지 않는다. 자동차·자전거는 카테고리 없음.
WITH mapping(subject, category) AS (
  VALUES ('고양이', '동물'), ('강아지', '동물'), ('곰돌이', '동물'),
         ('로켓', '우주'), ('우주비행사', '우주'), ('별', '우주'), ('지구본', '우주'),
         ('커피컵', '일상'), ('책', '일상'), ('카메라', '일상'),
         ('에어팟', '테크'), ('축구공', '스포츠'), ('꽃', '꽃')
)
UPDATE "products" p
SET "tags" = array_append(p."tags", m.category)
FROM mapping m
WHERE m.subject = ANY (p."tags")
  AND NOT (m.category = ANY (p."tags"))
  AND p."name" NOT LIKE '세일 키링 #%';

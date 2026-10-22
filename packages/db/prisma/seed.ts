import { PrismaClient } from "../generated/client";

const prisma = new PrismaClient();

const ADJECTIVES = [
  "가죽", "미니멀", "빈티지", "우드", "메탈", "실리콘", "레트로", "홀로그램",
  "파스텔", "캔버스", "니트", "투명", "각인", "야광", "미니",
];

const SUBJECTS = [
  "에어팟", "고양이", "강아지", "곰돌이", "우주비행사", "자동차", "꽃",
  "별", "지구본", "카메라", "축구공", "책", "커피컵", "자전거", "로켓",
];

// 모양 → 카테고리 이름 태그 (프론트 apps/frontend/src/lib/categories.ts와 같게 유지). 자동차·자전거는 카테고리 없음.
const SUBJECT_CATEGORY: Record<string, string> = {
  고양이: "동물", 강아지: "동물", 곰돌이: "동물",
  로켓: "우주", 우주비행사: "우주", 별: "우주", 지구본: "우주",
  커피컵: "일상", 책: "일상", 카메라: "일상",
  에어팟: "테크", 축구공: "스포츠", 꽃: "꽃",
};

function toProduct(index: number) {
  const adjective = ADJECTIVES[index % ADJECTIVES.length];
  const subject = SUBJECTS[index % SUBJECTS.length];
  const category = SUBJECT_CATEGORY[subject];
  const name = `${adjective} ${subject} 키링 #${index + 1}`;
  const price = 5000 + ((index * 1500) % 45000);

  return {
    name,
    description: `${adjective} 소재로 만든 ${subject} 모양 키링. RingDog 데모용 샘플 상품입니다.`,
    price,
    stock: 20 + (index % 30),
    tags: category && category !== subject ? [adjective, subject, category] : [adjective, subject],
    imageUrl: null,
  };
}

async function main() {
  const existing = await prisma.product.count();
  if (existing > 0) {
    console.log(`Skip seed: ${existing} products already exist.`);
    return;
  }

  const products = Array.from({ length: 60 }, (_, i) => toProduct(i));

  for (const product of products) {
    await prisma.product.create({ data: product });
  }

  console.log(`Seeded ${products.length} products.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

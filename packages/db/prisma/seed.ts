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

function toProduct(index: number) {
  const adjective = ADJECTIVES[index % ADJECTIVES.length];
  const subject = SUBJECTS[index % SUBJECTS.length];
  const name = `${adjective} ${subject} 키링 #${index + 1}`;
  const price = 5000 + ((index * 1500) % 45000);

  return {
    name,
    description: `${adjective} 소재로 만든 ${subject} 모양 키링. RingDog 데모용 샘플 상품입니다.`,
    price,
    stock: 20 + (index % 30),
    tags: [adjective, subject],
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

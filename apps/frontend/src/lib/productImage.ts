// 모양 태그별 상품 사진 풀. 파일과 출처는 public/images/CREDITS.md 참고.
import { hashString } from "./hash";

export const SUBJECT_IMAGES: Record<string, string[]> = {
  에어팟: ["/images/products/airpods-1.webp", "/images/products/airpods-2.webp", "/images/products/airpods-3.webp"],
  고양이: ["/images/products/cat-1.webp", "/images/products/cat-2.webp"],
  강아지: ["/images/products/dog-1.webp", "/images/products/dog-2.webp", "/images/products/dog-3.webp"],
  곰돌이: ["/images/products/bear-1.webp", "/images/products/bear-2.webp", "/images/products/bear-3.webp"],
  우주비행사: ["/images/products/astronaut-1.webp", "/images/products/astronaut-2.webp", "/images/products/astronaut-3.webp"],
  자동차: ["/images/products/car-1.webp", "/images/products/car-2.webp"],
  꽃: ["/images/products/flower-1.webp", "/images/products/flower-2.webp"],
  별: ["/images/products/star-1.webp", "/images/products/star-2.webp"],
  지구본: ["/images/products/globe-1.webp", "/images/products/globe-2.webp", "/images/products/globe-3.webp"],
  카메라: ["/images/products/camera-1.webp"],
  축구공: ["/images/products/soccer-1.webp", "/images/products/soccer-2.webp"],
  책: ["/images/products/book-1.webp", "/images/products/book-2.webp"],
  커피컵: ["/images/products/coffee-1.webp", "/images/products/coffee-2.webp", "/images/products/coffee-3.webp"],
  자전거: ["/images/products/bicycle-1.webp", "/images/products/bicycle-2.webp", "/images/products/bicycle-3.webp"],
  로켓: ["/images/products/rocket-1.webp"],
};

export const ALL_PRODUCT_IMAGES: string[] = Object.values(SUBJECT_IMAGES).flat();

export const BANNER_IMAGES: string[] = ["/images/banners/banner-1.webp","/images/banners/banner-2.webp","/images/banners/banner-3.webp"];

type ImageProduct = { id: string; name: string; tags: string[]; imageUrl: string | null };

/** 상품 사진 경로를 count개 돌려준다(항상 1개 이상, id마다 결정적). */
export function productImages(p: ImageProduct, count = 1): string[] {
  if (p.imageUrl) return [p.imageUrl];
  const bulk = p.name.startsWith("세일 키링 #");
  const subject = bulk ? undefined : p.tags.find((t) => SUBJECT_IMAGES[t]);
  const pool = subject ? SUBJECT_IMAGES[subject] : ALL_PRODUCT_IMAGES;
  const start = hashString(p.id);
  const picked: string[] = [];
  for (let i = 0; i < pool.length && picked.length < count; i++) {
    picked.push(pool[(start + i) % pool.length]);
  }
  // 풀이 count보다 작으면 전체 풀에서 이어서 채운다.
  for (let i = 0; i < ALL_PRODUCT_IMAGES.length && picked.length < count; i++) {
    const img = ALL_PRODUCT_IMAGES[(start + i) % ALL_PRODUCT_IMAGES.length];
    if (!picked.includes(img)) picked.push(img);
  }
  return picked;
}

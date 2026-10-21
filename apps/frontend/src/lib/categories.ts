// 모양 태그를 묶은 상품 카테고리. 대표 사진은 상품 사진 풀을 재사용한다.
import { SUBJECT_IMAGES } from "./productImage";

export interface Category {
  slug: string;
  label: string;
  subjects: string[];
  image: string;
}

function make(slug: string, label: string, subjects: string[]): Category {
  return { slug, label, subjects, image: SUBJECT_IMAGES[subjects[0]][0] };
}

export const CATEGORIES: Category[] = [
  make("animals", "동물", ["고양이", "강아지", "곰돌이"]),
  make("vehicles", "탈것", ["자동차", "자전거"]),
  make("space", "우주", ["로켓", "우주비행사", "별", "지구본"]),
  make("daily", "일상", ["커피컵", "책", "카메라"]),
  make("tech", "테크", ["에어팟"]),
  make("sports", "스포츠", ["축구공"]),
  make("flower", "꽃", ["꽃"]),
];

/** 태그 중 처음 일치하는 모양과 그 카테고리를 돌려준다. 없으면 null. */
export function categoryForTags(tags: string[]): { category: Category; subject: string } | null {
  for (const tag of tags) {
    const category = CATEGORIES.find((c) => Object.hasOwn(SUBJECT_IMAGES, tag) && c.subjects.includes(tag));
    if (category) return { category, subject: tag };
  }
  return null;
}

export function subjectSearchHref(subject: string): string {
  return `/?q=${encodeURIComponent(subject)}`;
}

/** 검색 API는 공백으로 구분된 여러 모양을 OR로 처리한다(실환경 확인). */
export function categorySearchHref(category: Category): string {
  return subjectSearchHref(category.subjects.join(" "));
}

// 상품 카테고리. 상품에는 카테고리 이름(label)과 같은 태그가 달려 있다(시드·마이그레이션).
// subjects는 그 카테고리에 속하는 모양 태그, 대표 사진은 상품 사진 풀을 재사용한다.
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
  make("space", "우주", ["로켓", "우주비행사", "별", "지구본"]),
  make("daily", "일상", ["커피컵", "책", "카메라"]),
  make("tech", "테크", ["에어팟"]),
  make("sports", "스포츠", ["축구공"]),
  make("flower", "꽃", ["꽃"]),
];

/** 카테고리 이름 태그로 카테고리와 그 안의 모양을 찾는다. 없으면 null. */
export function categoryForTags(tags: string[]): { category: Category; subject: string } | null {
  const category = CATEGORIES.find((c) => tags.includes(c.label));
  const subject = category && tags.find((t) => category.subjects.includes(t));
  return category && subject ? { category, subject } : null;
}

/** 태그 정확 일치 검색("#동물"). 백엔드가 #으로 시작하는 검색어를 태그 검색으로 처리한다. */
export function tagSearchHref(tag: string): string {
  return `/?q=${encodeURIComponent(`#${tag}`)}`;
}

export function subjectSearchHref(subject: string): string {
  return tagSearchHref(subject);
}

export function categorySearchHref(category: Category): string {
  return tagSearchHref(category.label);
}

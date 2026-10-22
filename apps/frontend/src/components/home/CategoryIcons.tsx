import Link from "next/link";

import { CATEGORIES, categorySearchHref } from "@/lib/categories";

export function CategoryIcons(): JSX.Element {
  return (
    <nav aria-label="카테고리" className="mb-8">
      <ul className="grid grid-cols-3 gap-y-4 sm:grid-cols-6">
        {CATEGORIES.map((category) => (
          <li key={category.slug}>
            <Link href={categorySearchHref(category)} className="group flex flex-col items-center gap-2 text-inherit no-underline">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={category.image}
                alt=""
                className="h-16 w-16 rounded-full border border-stone-200 object-cover transition group-hover:border-primary-400 sm:h-[72px] sm:w-[72px]"
              />
              <span className="text-[15px] text-stone-700 group-hover:text-primary-600">{category.label}</span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

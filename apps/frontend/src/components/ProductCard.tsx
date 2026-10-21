import Link from "next/link";
import { Product } from "@ringdog/shared";

import { displayMeta, formatWon } from "@/lib/displayMeta";
import { productImages } from "@/lib/productImage";

export type ProductCardProps = Pick<Product, "id" | "name" | "price" | "imageUrl" | "tags"> & {
  onAddToCart?: () => void;
};

export function ProductCard({ id, name, price, imageUrl, tags, onAddToCart }: ProductCardProps): JSX.Element {
  const meta = displayMeta(id, price);
  const [image] = productImages({ id, name, tags, imageUrl });
  return (
    <div className="flex flex-col">
      <Link href={`/products/${id}`} className="text-inherit no-underline">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={image} alt={name} loading="lazy" className="aspect-square w-full rounded-lg bg-stone-100 object-cover" />
        <div className="mt-2 line-clamp-2 min-h-[2.8rem] text-[15px] leading-snug text-stone-800">{name}</div>
        <div className="mt-1 flex flex-wrap items-baseline gap-x-1.5">
          {meta.discountRate > 0 && <span className="text-base font-bold text-primary-600">{meta.discountRate}%</span>}
          <span className="text-lg font-bold text-stone-900">{formatWon(price)}</span>
        </div>
        {meta.discountRate > 0 && (
          <div className="text-sm text-stone-400 line-through">{formatWon(meta.originalPrice)}</div>
        )}
        <div className="mt-1 flex items-center gap-1 text-sm text-stone-500">
          <span className="text-amber-500">★</span>
          <span>{meta.rating.toFixed(1)}</span>
          <span>({meta.reviewCount.toLocaleString("ko-KR")})</span>
        </div>
        <span className="mt-1 inline-block rounded bg-sky-50 px-1.5 py-0.5 text-xs font-medium text-sky-700">
          {meta.shipping}
        </span>
      </Link>
      {onAddToCart && (
        <button
          type="button"
          className="mt-2 w-full rounded border border-primary-500 bg-white px-3 py-2 text-[15px] font-medium text-primary-600 transition hover:bg-primary-50"
          onClick={onAddToCart}
        >
          장바구니
        </button>
      )}
    </div>
  );
}

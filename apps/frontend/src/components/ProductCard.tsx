import Link from "next/link";
import { Product } from "@ringdog/shared";

import { ProductIcon } from "@/components/ProductIcon";

export type ProductCardProps = Pick<Product, "id" | "name" | "price" | "imageUrl" | "tags"> & {
  onAddToCart?: () => void;
};

function formatPrice(price: number): string {
  return new Intl.NumberFormat("ko-KR", { style: "currency", currency: "KRW" }).format(price);
}

export function ProductCard({ id, name, price, imageUrl, tags, onAddToCart }: ProductCardProps): JSX.Element {
  return (
    <div className="flex flex-col rounded-2xl bg-white p-3 shadow-soft transition hover:-translate-y-1 hover:shadow-soft-lg">
      <Link href={`/products/${id}`} className="text-inherit no-underline">
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imageUrl} alt={name} className="aspect-square w-full rounded-xl object-cover" />
        ) : (
          <ProductIcon tags={tags} name={name} className="aspect-square w-full" />
        )}
        <div className="mt-2 truncate font-medium text-stone-800">{name}</div>
        <div className="text-stone-500">{formatPrice(price)}</div>
      </Link>
      {onAddToCart && (
        <button
          type="button"
          className="mt-2 w-full rounded-full bg-primary-500 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-primary-600"
          onClick={onAddToCart}
        >
          장바구니
        </button>
      )}
    </div>
  );
}

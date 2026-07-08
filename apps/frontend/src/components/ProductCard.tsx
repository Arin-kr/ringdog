import { Product } from "@ringdog/shared";

export type ProductCardProps = Pick<Product, "id" | "name" | "price" | "imageUrl"> & {
  onAddToCart?: () => void;
};

function formatPrice(price: number): string {
  return new Intl.NumberFormat("ko-KR", { style: "currency", currency: "KRW" }).format(price);
}

export function ProductCard({ name, price, imageUrl, onAddToCart }: ProductCardProps): JSX.Element {
  return (
    <div className="product-card">
      {imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={imageUrl} alt={name} className="product-card__image" />
      ) : (
        <div className="product-card__image product-card__image--placeholder" aria-hidden />
      )}
      <div className="product-card__name">{name}</div>
      <div className="product-card__price">{formatPrice(price)}</div>
      {onAddToCart && (
        <button type="button" className="button button--small product-card__add" onClick={onAddToCart}>
          장바구니
        </button>
      )}
    </div>
  );
}

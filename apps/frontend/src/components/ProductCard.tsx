import { Product } from "@ringdog/shared";

export type ProductCardProps = Pick<Product, "name" | "price" | "imageUrl">;

/**
 * Presentational stub — TODO(M2): link to the product detail page and wire
 * up "add to cart" once the cart API is consumed here.
 */
export function ProductCard({ name, price, imageUrl }: ProductCardProps): JSX.Element {
  return (
    <div className="product-card">
      {imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={imageUrl} alt={name} className="product-card__image" />
      ) : (
        <div className="product-card__image product-card__image--placeholder" />
      )}
      <div className="product-card__name">{name}</div>
      <div className="product-card__price">${price.toFixed(2)}</div>
    </div>
  );
}

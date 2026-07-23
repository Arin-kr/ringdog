import { DEMO_COUPON_CODE } from "@ringdog/shared";

export interface OrderTotalItem {
  price: number;
  quantity: number;
}

export interface OrderTotalResult {
  subtotal: number;
  totalAmount: number;
  isDemoCoupon: boolean;
}

export function calculateOrderTotal(
  items: OrderTotalItem[],
  couponCode: string | undefined,
): OrderTotalResult {
  const isDemoCoupon = couponCode === DEMO_COUPON_CODE;
  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const totalAmount = isDemoCoupon ? 0 : subtotal;
  return { subtotal, totalAmount, isDemoCoupon };
}

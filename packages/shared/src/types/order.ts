import { Product } from "./product";

export type OrderStatus = "PENDING" | "PAID" | "SHIPPED" | "CANCELLED";

export interface OrderItem {
  id: string;
  orderId: string;
  productId: string;
  quantity: number;
  unitPrice: number;
  product?: Pick<Product, "id" | "name" | "imageUrl">;
}

export interface Order {
  id: string;
  userId: string;
  totalAmount: number;
  couponCode: string | null;
  status: OrderStatus;
  createdAt: string;
  items?: OrderItem[];
}

export interface CheckoutInput {
  couponCode?: string;
}

export interface CheckoutResult {
  orderId: string;
  status: OrderStatus;
  totalAmount: number;
}

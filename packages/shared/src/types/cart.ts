export interface CartItem {
  id: string;
  userId: string;
  productId: string;
  quantity: number;
  createdAt: string;
}

export interface AddCartItemInput {
  productId: string;
  quantity: number;
}

export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  stock: number;
  tags: string[];
  imageUrl: string | null;
  createdAt: string;
}

export interface ProductSearchQuery {
  q: string;
  page?: number;
  limit?: number;
}

export interface PaginatedResult<T> {
  items: T[];
  page: number;
  limit: number;
  total: number;
}

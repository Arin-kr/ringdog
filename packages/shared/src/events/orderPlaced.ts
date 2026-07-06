import { OrderStatus } from "../types/order";

/** Published to KAFKA_TOPICS.ORDERS by backend-api, consumed by order-consumer. */
export interface OrderPlacedEvent {
  eventId: string;
  orderId: string;
  userId: string;
  amount: number;
  status: OrderStatus;
  createdAt: string;
}

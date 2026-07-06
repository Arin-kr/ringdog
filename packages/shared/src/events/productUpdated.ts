export type ProductUpdatedAction = "created" | "updated" | "deleted";

/** Published to KAFKA_TOPICS.CATALOG by backend-api, consumed by the OpenSearch indexer. */
export interface ProductUpdatedEvent {
  eventId: string;
  productId: string;
  action: ProductUpdatedAction;
  payload: Record<string, unknown>;
  createdAt: string;
}

function optional(name: string, fallback: string): string {
  const value = process.env[name];
  return value === undefined || value === "" ? fallback : value;
}

export const env = {
  nodeEnv: optional("NODE_ENV", "development"),
  healthPort: Number(optional("ORDER_CONSUMER_HEALTH_PORT", "4002")),

  databaseUrl: optional(
    "DATABASE_URL",
    "postgresql://ringdog:ringdog@localhost:5432/ringdog?schema=public",
  ),

  kafkaBrokers: optional("KAFKA_BROKERS", "localhost:9092").split(","),
  kafkaClientId: optional("KAFKA_CLIENT_ID", "ringdog"),
  kafkaConsumerGroupOrders: optional("KAFKA_CONSUMER_GROUP_ORDERS", "ringdog-order-consumer"),
};

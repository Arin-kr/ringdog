/**
 * Small env-var helper with sane local-dev defaults.
 * Mirrors the contract defined in the repo-root `.env.example`.
 */

function optional(name: string, fallback: string): string {
  const value = process.env[name];
  return value === undefined || value === "" ? fallback : value;
}

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (value === undefined || value === "") {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const env = {
  nodeEnv: optional("NODE_ENV", "development"),
  port: Number(optional("BACKEND_API_PORT", "4000")),

  databaseUrl: required(
    "DATABASE_URL",
    "postgresql://ringdog:ringdog@localhost:5432/ringdog?schema=public",
  ),

  jwtSecret: required("JWT_SECRET", "dev-only-change-me"),
  jwtExpiresIn: optional("JWT_EXPIRES_IN", "1h"),

  kafkaBrokers: optional("KAFKA_BROKERS", "localhost:9092").split(","),
  kafkaClientId: optional("KAFKA_CLIENT_ID", "ringdog"),

  opensearchNode: optional("OPENSEARCH_NODE", "http://localhost:9200"),
  opensearchIndexProducts: optional("OPENSEARCH_INDEX_PRODUCTS", "products"),

  demoCouponCode: optional("DEMO_COUPON_CODE", "RINGDOG100"),
};

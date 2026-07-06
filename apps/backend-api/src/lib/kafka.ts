import { Kafka, Producer } from "kafkajs";
import { KAFKA_TOPICS, OrderPlacedEvent } from "@ringdog/shared";

import { env } from "../config/env";

const kafka = new Kafka({
  clientId: env.kafkaClientId,
  brokers: env.kafkaBrokers,
});

let producer: Producer | undefined;

async function getProducer(): Promise<Producer> {
  if (!producer) {
    producer = kafka.producer();
    await producer.connect();
  }
  return producer;
}

/**
 * Publishes an OrderPlaced event to KAFKA_TOPICS.ORDERS (FR-ORDER-002).
 *
 * TODO(M2): add retry/backoff + a dead-letter fallback per PRD
 * `sync_strategy.failure_handling` — for now a publish failure just throws
 * and is logged by the caller.
 */
export async function publishOrderPlaced(event: OrderPlacedEvent): Promise<void> {
  const activeProducer = await getProducer();
  await activeProducer.send({
    topic: KAFKA_TOPICS.ORDERS,
    messages: [
      {
        key: event.orderId,
        value: JSON.stringify(event),
      },
    ],
  });
}

export async function disconnectKafka(): Promise<void> {
  if (producer) {
    await producer.disconnect();
    producer = undefined;
  }
}

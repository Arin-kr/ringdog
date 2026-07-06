import { Consumer } from "kafkajs";
import { prisma } from "@ringdog/db";
import { KAFKA_TOPICS, OrderPlacedEvent } from "@ringdog/shared";

import { kafka } from "../lib/kafka";
import { env } from "../config/env";

let consumer: Consumer | undefined;

/**
 * Consumes OrderPlaced events and simulates payment completion by moving
 * the order from PENDING to PAID. This is the async counterpart to
 * backend-api's `/api/orders/checkout`, which publishes the event right
 * after committing the order (PRD `application_components.order_consumer`).
 */
export async function startOrderPlacedConsumer(): Promise<void> {
  consumer = kafka.consumer({ groupId: env.kafkaConsumerGroupOrders });
  await consumer.connect();
  await consumer.subscribe({ topic: KAFKA_TOPICS.ORDERS, fromBeginning: false });

  await consumer.run({
    eachMessage: async ({ message }) => {
      if (!message.value) {
        return;
      }

      try {
        const event = JSON.parse(message.value.toString()) as OrderPlacedEvent;

        await prisma.order.updateMany({
          where: { id: event.orderId, status: "PENDING" },
          data: { status: "PAID" },
        });

        // eslint-disable-next-line no-console
        console.log(
          JSON.stringify({ level: "info", message: "Order marked PAID", orderId: event.orderId }),
        );
      } catch (err) {
        // TODO(M4): exponential backoff retry + DLQ topic per PRD
        // sync_strategy.failure_handling instead of just logging.
        // eslint-disable-next-line no-console
        console.error(
          JSON.stringify({ level: "error", message: "Failed to process OrderPlaced event", error: String(err) }),
        );
      }
    },
  });
}

export async function stopOrderPlacedConsumer(): Promise<void> {
  if (consumer) {
    await consumer.disconnect();
    consumer = undefined;
  }
}

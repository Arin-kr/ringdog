import { prisma } from "@ringdog/db";

const GENERIC_CONTEXT = [
  "You are the RingDog support assistant for a keyring/keychain e-commerce store.",
  "Answer general FAQ and product questions helpfully and concisely.",
].join(" ");

/**
 * Builds a short context string to prepend to the LLM prompt.
 *
 * TODO(M3): expand this with real product catalog snippets (top sellers,
 * matching tags) and richer order history once prompt engineering for
 * FR-CHAT-002 is designed. This is intentionally minimal for the M1
 * skeleton.
 */
export async function buildContext(userId?: string): Promise<string> {
  if (!userId) {
    return GENERIC_CONTEXT;
  }

  const lastOrder = await prisma.order.findFirst({
    where: { userId },
    orderBy: { createdAt: "desc" },
    include: { items: true },
  });

  if (!lastOrder) {
    return `${GENERIC_CONTEXT} This user is logged in but has no past orders yet.`;
  }

  return [
    GENERIC_CONTEXT,
    `This user's most recent order is #${lastOrder.id}, status ${lastOrder.status},`,
    `total ${lastOrder.totalAmount}, placed at ${lastOrder.createdAt.toISOString()}.`,
  ].join(" ");
}

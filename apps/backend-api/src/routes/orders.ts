import { randomUUID } from "crypto";

import { NextFunction, Request, Response, Router } from "express";
import { body, validationResult } from "express-validator";
import { prisma } from "@ringdog/db";
import { DEMO_COUPON_CODE, OrderPlacedEvent, OrderStatus, logger } from "@ringdog/shared";

import { requireAuth } from "../middleware/auth";
import { publishOrderPlaced } from "../lib/kafka";

export const ordersRouter: Router = Router();

ordersRouter.use(requireAuth);

/** POST /api/orders/checkout — FR-ORDER-001/002/003 */
ordersRouter.post(
  "/checkout",
  [body("coupon_code").optional({ nullable: true }).isString()],
  async (req: Request, res: Response, next: NextFunction) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ error: { message: "Validation failed", details: errors.array() } });
      return;
    }

    const { coupon_code: couponCode } = req.body as { coupon_code?: string };
    const userId = req.userId as string;

    try {
      const cartItems = await prisma.cartItem.findMany({
        where: { userId },
        include: { product: true },
      });

      if (cartItems.length === 0) {
        res.status(400).json({ error: { message: "Cart is empty" } });
        return;
      }

      const isDemoCoupon = couponCode === DEMO_COUPON_CODE;
      const subtotal = cartItems.reduce(
        (sum, item) => sum + Number(item.product.price) * item.quantity,
        0,
      );
      const totalAmount = isDemoCoupon ? 0 : subtotal;

      // FR-ORDER-001: order + order items are persisted in a single transaction.
      // Status defaults to PENDING; order-consumer asynchronously flips it to
      // PAID after consuming the OrderPlaced event below (simulated payment
      // completion) — this holds for the demo coupon's 0-amount orders too
      // per FR-ORDER-003.
      const order = await prisma.$transaction(async (tx) => {
        const created = await tx.order.create({
          data: {
            userId,
            totalAmount,
            couponCode: isDemoCoupon ? couponCode : null,
            items: {
              create: cartItems.map((item) => ({
                productId: item.productId,
                quantity: item.quantity,
                unitPrice: item.product.price,
              })),
            },
          },
        });

        await tx.cartItem.deleteMany({ where: { userId } });

        return created;
      });

      const event: OrderPlacedEvent = {
        eventId: randomUUID(),
        orderId: order.id,
        userId,
        amount: Number(order.totalAmount),
        status: order.status as OrderStatus,
        createdAt: order.createdAt.toISOString(),
      };

      try {
        await publishOrderPlaced(event);
      } catch (publishError) {
        // TODO(M2): retry/backoff + compensating logic per FR-ORDER-002
        // acceptance criteria — for now we log and still return success
        // since the order itself was committed.
        logger.error("Failed to publish OrderPlaced event", { orderId: order.id });
        void publishError;
      }

      res.status(201).json({
        order_id: order.id,
        status: order.status,
        total_amount: Number(order.totalAmount),
      });
    } catch (err) {
      next(err);
    }
  },
);

/** GET /api/orders */
ordersRouter.get("/", async (req, res, next) => {
  try {
    const orders = await prisma.order.findMany({
      where: { userId: req.userId },
      include: { items: { include: { product: true } } },
      orderBy: { createdAt: "desc" },
    });
    res.status(200).json({ items: orders });
  } catch (err) {
    next(err);
  }
});

/** GET /api/orders/:id */
ordersRouter.get("/:id", async (req, res, next) => {
  try {
    const order = await prisma.order.findUnique({
      where: { id: req.params.id },
      include: { items: { include: { product: true } } },
    });

    if (!order || order.userId !== req.userId) {
      res.status(404).json({ error: { message: "Order not found" } });
      return;
    }

    res.status(200).json(order);
  } catch (err) {
    next(err);
  }
});

// Orders already in SHIPPED/CANCELLED are past the point a demo shopper
// should be able to back out of.
const CANCELLABLE_STATUSES: OrderStatus[] = ["PENDING", "PAID"];

/** PATCH /api/orders/:id/cancel */
ordersRouter.patch("/:id/cancel", async (req, res, next) => {
  try {
    const order = await prisma.order.findUnique({ where: { id: req.params.id } });

    if (!order || order.userId !== req.userId) {
      res.status(404).json({ error: { message: "Order not found" } });
      return;
    }

    if (!CANCELLABLE_STATUSES.includes(order.status as OrderStatus)) {
      res.status(409).json({ error: { message: `Cannot cancel an order that is already ${order.status}` } });
      return;
    }

    const cancelled = await prisma.order.update({
      where: { id: order.id },
      data: { status: "CANCELLED" },
      include: { items: { include: { product: true } } },
    });

    res.status(200).json(cancelled);
  } catch (err) {
    next(err);
  }
});

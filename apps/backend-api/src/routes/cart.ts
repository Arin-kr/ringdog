import { Router } from "express";
import { body, validationResult } from "express-validator";
import { prisma } from "@ringdog/db";

import { requireAuth } from "../middleware/auth";

export const cartRouter = Router();

cartRouter.use(requireAuth);

/** GET /api/cart — FR-CART-001 */
cartRouter.get("/", async (req, res, next) => {
  try {
    const items = await prisma.cartItem.findMany({
      where: { userId: req.userId },
      include: { product: true },
      orderBy: { createdAt: "asc" },
    });
    res.status(200).json({ items });
  } catch (err) {
    next(err);
  }
});

/** POST /api/cart/items — FR-CART-001 */
cartRouter.post(
  "/items",
  [
    body("product_id").isString().notEmpty().withMessage("product_id is required"),
    body("quantity").isInt({ min: 1 }).withMessage("quantity must be a positive integer"),
  ],
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ error: { message: "Validation failed", details: errors.array() } });
      return;
    }

    const { product_id: productId, quantity } = req.body as { product_id: string; quantity: number };

    try {
      const product = await prisma.product.findUnique({ where: { id: productId } });
      if (!product) {
        res.status(404).json({ error: { message: "Product not found" } });
        return;
      }

      const cartItem = await prisma.cartItem.upsert({
        where: { userId_productId: { userId: req.userId as string, productId } },
        update: { quantity: { increment: quantity } },
        create: { userId: req.userId as string, productId, quantity },
      });

      res.status(201).json(cartItem);
    } catch (err) {
      next(err);
    }
  },
);

/** DELETE /api/cart/items/:id — FR-CART-001 */
cartRouter.delete("/items/:id", async (req, res, next) => {
  try {
    const cartItem = await prisma.cartItem.findUnique({ where: { id: req.params.id } });
    if (!cartItem || cartItem.userId !== req.userId) {
      res.status(404).json({ error: { message: "Cart item not found" } });
      return;
    }

    await prisma.cartItem.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

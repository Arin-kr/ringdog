import bcrypt from "bcrypt";
import { Router } from "express";
import { body, validationResult } from "express-validator";
import jwt, { SignOptions } from "jsonwebtoken";
import { prisma } from "@ringdog/db";
import { AuthTokenPayload } from "@ringdog/shared";

import { env } from "../config/env";

export const authRouter = Router();

const BCRYPT_SALT_ROUNDS = 10;

// NFR-SEC-001/003: validate email format + minimum password length before
// touching the database.
const credentialValidators = [
  body("email").isEmail().withMessage("A valid email is required").normalizeEmail(),
  body("password").isString().isLength({ min: 8 }).withMessage("Password must be at least 8 characters"),
];

/** POST /api/auth/signup — FR-AUTH-001 */
authRouter.post("/signup", credentialValidators, async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ error: { message: "Validation failed", details: errors.array() } });
    return;
  }

  const { email, password } = req.body as { email: string; password: string };

  try {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      res.status(409).json({ error: { message: "Email is already registered" } });
      return;
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);
    const user = await prisma.user.create({
      data: { email, passwordHash },
    });

    res.status(201).json({
      id: user.id,
      email: user.email,
      role: user.role,
      created_at: user.createdAt,
    });
  } catch (err) {
    next(err);
  }
});

/** POST /api/auth/login — FR-AUTH-002 */
authRouter.post("/login", credentialValidators, async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ error: { message: "Validation failed", details: errors.array() } });
    return;
  }

  const { email, password } = req.body as { email: string; password: string };

  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      res.status(401).json({ error: { message: "Invalid email or password" } });
      return;
    }

    const passwordMatches = await bcrypt.compare(password, user.passwordHash);
    if (!passwordMatches) {
      res.status(401).json({ error: { message: "Invalid email or password" } });
      return;
    }

    const payload: AuthTokenPayload = {
      userId: user.id,
      email: user.email,
      role: user.role,
    };

    const signOptions: SignOptions = {
      expiresIn: env.jwtExpiresIn as SignOptions["expiresIn"],
    };
    const token = jwt.sign(payload, env.jwtSecret, signOptions);

    res.status(200).json({ token, expires_in: env.jwtExpiresIn });
  } catch (err) {
    next(err);
  }
});

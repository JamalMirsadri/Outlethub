import crypto from "node:crypto";

export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function createRandomToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString("hex");
}

export function createNumericCode(length = 6): string {
  const digits = Array.from({ length }, () => crypto.randomInt(0, 10).toString());
  return digits.join("");
}

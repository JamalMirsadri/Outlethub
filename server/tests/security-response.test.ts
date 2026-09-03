import { before, test } from "node:test";
import assert from "node:assert/strict";
import { ErrorLogSeverity } from "@prisma/client";

import { computeRiskScore, normalizeConfidence } from "../src/modules/system-logs/risk-scoring.js";
import { detectBodyThreat } from "../src/modules/system-logs/security-detection.js";
import { sanitizeSensitiveData } from "../src/modules/system-logs/system-logs.service.js";

type Resolver = (
  request: unknown,
  modeOverride?: "none" | "forwarded" | "cloudflare",
  trustedProxies?: string[],
) => { ip: string; version: string; source: string };

let resolveClientIp: Resolver;

before(async () => {
  // client-ip.ts transitively loads env.ts, which validates required keys.
  process.env.DATABASE_URL = process.env.DATABASE_URL ?? "postgres://user:pass@localhost:5432/test";
  process.env.JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET ?? "a".repeat(32);
  process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET ?? "b".repeat(32);

  const mod = await import("../src/modules/system-logs/client-ip.js");
  resolveClientIp = mod.resolveClientIp as Resolver;
});

test("risk scoring: single low-confidence scanner stays low", () => {
  const score = computeRiskScore({
    severity: ErrorLogSeverity.LOW,
    confidence: "HIGH",
    attackType: "CMS_SCANNER",
    repeatCount: 1,
    distinctPaths: 1,
    distinctCategories: 1,
    priorBlockCount: 0,
  });

  assert.equal(score, 22);
});

test("risk scoring: high-confidence path traversal reaches block threshold", () => {
  const score = computeRiskScore({
    severity: ErrorLogSeverity.HIGH,
    confidence: "HIGH",
    attackType: "PATH_TRAVERSAL",
    repeatCount: 1,
    distinctPaths: 1,
    distinctCategories: 1,
    priorBlockCount: 0,
  });

  assert.equal(score, 74);
  assert.ok(score >= 60);
});

test("risk scoring: repeated scanner escalates into rate-limit band", () => {
  const score = computeRiskScore({
    severity: ErrorLogSeverity.LOW,
    confidence: "HIGH",
    attackType: "CMS_SCANNER",
    repeatCount: 8,
    distinctPaths: 3,
    distinctCategories: 2,
    priorBlockCount: 0,
  });

  assert.equal(score, 51);
  assert.ok(score >= 35 && score < 60);
});

test("confidence normalization clamps unknown values", () => {
  assert.equal(normalizeConfidence("HIGH"), "HIGH");
  assert.equal(normalizeConfidence("MEDIUM"), "MEDIUM");
  assert.equal(normalizeConfidence("LOW"), "LOW");
  assert.equal(normalizeConfidence("anything"), "LOW");
});

test("ip resolver: forwarded mode trusts rightmost x-forwarded-for from trusted peer", () => {
  const request = { headers: { "x-forwarded-for": "6.6.6.6, 1.2.3.4" }, socket: { remoteAddress: "10.0.0.1" } };

  const result = resolveClientIp(request, "forwarded", ["10.0.0.0/8"]);

  assert.equal(result.ip, "1.2.3.4");
  assert.equal(result.source, "x-forwarded-for");
});

test("ip resolver: forwarded mode ignores spoofed headers from untrusted peer", () => {
  const request = { headers: { "x-forwarded-for": "6.6.6.6" }, socket: { remoteAddress: "203.0.113.7" } };

  const result = resolveClientIp(request, "forwarded", ["10.0.0.0/8"]);

  assert.equal(result.ip, "203.0.113.7");
  assert.equal(result.source, "socket");
});

test("ip resolver: none mode ignores all spoofable headers", () => {
  const request = {
    headers: { "x-forwarded-for": "6.6.6.6", "cf-connecting-ip": "5.6.7.8" },
    socket: { remoteAddress: "10.0.0.1" },
  };

  const result = resolveClientIp(request, "none");

  assert.equal(result.ip, "10.0.0.1");
  assert.equal(result.source, "socket");
});

test("ip resolver: cloudflare mode prefers cf-connecting-ip from trusted peer", () => {
  const request = {
    headers: { "cf-connecting-ip": "5.6.7.8", "x-forwarded-for": "6.6.6.6" },
    socket: { remoteAddress: "10.0.0.1" },
  };

  const result = resolveClientIp(request, "cloudflare", ["10.0.0.0/8"]);

  assert.equal(result.ip, "5.6.7.8");
  assert.equal(result.source, "cf-connecting-ip");
});

test("ip resolver: cloudflare mode ignores cf-connecting-ip from untrusted peer", () => {
  const request = { headers: { "cf-connecting-ip": "5.6.7.8" }, socket: { remoteAddress: "203.0.113.7" } };

  const result = resolveClientIp(request, "cloudflare", ["10.0.0.0/8"]);

  assert.equal(result.ip, "203.0.113.7");
  assert.equal(result.source, "socket");
});

test("body detection: detects SQL injection in JSON body", () => {
  const detection = detectBodyThreat({ q: "1' OR '1'='1" });
  assert.ok(detection);
  assert.equal(detection.attackType, "SQL_INJECTION");
});

test("body detection: detects XSS in JSON body", () => {
  const detection = detectBodyThreat({ q: "<script>alert(1)</script>" });
  assert.ok(detection);
  assert.equal(detection.attackType, "XSS");
});

test("body detection: detects traversal in JSON body", () => {
  const detection = detectBodyThreat({ q: "../../etc/passwd" });
  assert.ok(detection);
  assert.equal(detection.attackType, "PATH_TRAVERSAL");
});

test("body detection: ignores benign JSON body", () => {
  const detection = detectBodyThreat({ q: "hello world", n: 1 });
  assert.equal(detection, null);
});

test("log sanitization: redacts token/api_key/code query values", () => {
  const token = sanitizeSensitiveData("/reset?token=abc123");
  assert.ok(token?.includes("[REDACTED]"));
  assert.ok(!token?.includes("abc123"));

  const apiKey = sanitizeSensitiveData("/x?api_key=SECRET");
  assert.ok(apiKey?.includes("[REDACTED]"));
  assert.ok(!apiKey?.includes("SECRET"));

  const code = sanitizeSensitiveData("/cb?code=XYZ123");
  assert.ok(code?.includes("[REDACTED]"));
  assert.ok(!code?.includes("XYZ123"));
});

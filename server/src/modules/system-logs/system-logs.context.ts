import type { Request } from "express";

import { resolveClientIp } from "./client-ip.js";

export function getClientIp(request: Request): string | null {
  return resolveClientIp(request).ip ?? null;
}

export function parseUserAgent(userAgent?: string): {
  browser: string | null;
  os: string | null;
  device: string | null;
} {
  if (!userAgent) {
    return { browser: null, os: null, device: null };
  }

  let device = "desktop";
  if (/Tablet|iPad/i.test(userAgent)) {
    device = "tablet";
  } else if (/Mobi|Android|iPhone|iPod|BlackBerry|Opera Mini/i.test(userAgent)) {
    device = "mobile";
  }

  let os: string | null = null;
  if (/Windows NT/i.test(userAgent)) {
    os = "Windows";
  } else if (/Mac OS X/i.test(userAgent)) {
    os = "macOS";
  } else if (/Android/i.test(userAgent)) {
    os = "Android";
  } else if (/iPhone|iPad|iPod/i.test(userAgent)) {
    os = "iOS";
  } else if (/Linux/i.test(userAgent)) {
    os = "Linux";
  }

  let browser: string | null = null;
  if (/Edg\//i.test(userAgent)) {
    browser = "Edge";
  } else if (/OPR\/|Opera/i.test(userAgent)) {
    browser = "Opera";
  } else if (/Chrome\//i.test(userAgent) && !/Chromium/i.test(userAgent)) {
    browser = "Chrome";
  } else if (/Firefox\//i.test(userAgent)) {
    browser = "Firefox";
  } else if (/Safari\//i.test(userAgent) && !/Chrome/i.test(userAgent)) {
    browser = "Safari";
  }

  return { browser, os, device };
}

export function buildRequestContext(request: Request) {
  const auth = request.auth;
  const rawUserAgent = request.headers["user-agent"];
  const parsed = parseUserAgent(typeof rawUserAgent === "string" ? rawUserAgent : undefined);
  const requestId =
    request.id ?? (typeof request.headers["x-request-id"] === "string" ? request.headers["x-request-id"] : null);

  return {
    ip: getClientIp(request),
    browser: parsed.browser,
    os: parsed.os,
    device: parsed.device,
    userId: auth?.userId ?? null,
    userEmail: auth?.email ?? null,
    userRole: auth?.role ?? null,
    requestId: requestId ?? null,
  };
}

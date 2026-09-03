import { BlockList, isIP } from "node:net";
import type { NextFunction, Request, Response } from "express";

import { env } from "../../config/env.js";

/**
 * Centralized, trusted client-IP resolver.
 *
 * The origin may sit behind a reverse proxy (Render's edge, Nginx, and/or
 * Cloudflare). `request.socket.remoteAddress` is therefore the *proxy* IP, not
 * the end-user IP, and spoofable headers (`x-forwarded-for`, `x-real-ip`,
 * `forwarded`, `cf-connecting-ip`) must never be trusted from an untrusted
 * peer.
 *
 * Trust rules (explicit and safe-by-default):
 *   - `TRUSTED_PROXY_MODE`:
 *       "none"       -> never trust headers (use socket only). Default.
 *       "forwarded"  -> trust `x-forwarded-for` only when the direct peer is in
 *                       `TRUSTED_PROXY_IPS`.
 *       "cloudflare" -> prefer `cf-connecting-ip`, fall back to `x-forwarded-for`,
 *                       only when the direct peer is in `TRUSTED_PROXY_IPS`.
 *   - `TRUSTED_PROXY_IPS`: comma-separated IPs/CIDRs of the trusted edge(s).
 *
 * When the peer is trusted, the real client is the *rightmost* `x-forwarded-for`
 * entry (the one appended by the trusted edge) — this is correct for both
 * `$proxy_add_x_forwarded_for` (append) and overwrite configurations, and
 * prevents a client from spoofing by injecting left-most entries.
 */
export type TrustedProxyMode = "none" | "forwarded" | "cloudflare";

export interface ResolvedClientIp {
  ip: string;
  version: "IPv4" | "IPv6";
  source: "socket" | "x-forwarded-for" | "cf-connecting-ip";
}

function normalizeIp(raw: string): string | null {
  const trimmed = raw?.trim();
  if (!trimmed) {
    return null;
  }

  // Strip IPv4-mapped IPv6 prefix (::ffff:1.2.3.4) for consistent storage.
  const candidate = trimmed.replace(/^::ffff:/i, "");
  if (!isIP(candidate)) {
    return null;
  }

  return candidate;
}

function headerValue(request: Request, name: string): string | null {
  const value = request.headers[name];
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return typeof value === "string" ? value : null;
}

function lastForwardedIp(header: string | null): string | null {
  if (!header) {
    return null;
  }

  const parts = header.split(",");
  for (let index = parts.length - 1; index >= 0; index -= 1) {
    const part = parts[index];
    if (part === undefined) {
      continue;
    }

    const ip = normalizeIp(part);
    if (ip) {
      return ip;
    }
  }

  return null;
}

function toVersion(ip: string): "IPv4" | "IPv6" {
  return isIP(ip) === 6 ? "IPv6" : "IPv4";
}

function buildTrustedProxyBlockList(entries: string[]): BlockList | null {
  const list = new BlockList();
  let added = false;

  for (const rawEntry of entries) {
    const entry = rawEntry.trim();
    if (!entry) {
      continue;
    }

    const slashIndex = entry.indexOf("/");
    const address = slashIndex >= 0 ? entry.slice(0, slashIndex) : entry;
    const version = isIP(address);
    if (!version) {
      continue;
    }

    const type = version === 6 ? "ipv6" : "ipv4";
    if (slashIndex >= 0) {
      const prefix = Number(entry.slice(slashIndex + 1));
      if (Number.isInteger(prefix) && prefix >= 0) {
        list.addSubnet(address, prefix, type);
        added = true;
      }
    } else {
      list.addAddress(address, type);
      added = true;
    }
  }

  return added ? list : null;
}

function isTrustedProxy(ip: string, list: BlockList | null): boolean {
  if (!list) {
    return false;
  }

  const version = isIP(ip);
  if (!version) {
    return false;
  }

  return list.check(ip, version === 6 ? "ipv6" : "ipv4");
}

const trustedProxyList = buildTrustedProxyBlockList((env.TRUSTED_PROXY_IPS ?? "").split(","));

export function resolveClientIp(
  request: Request,
  modeOverride?: TrustedProxyMode,
  trustedProxiesOverride?: string[],
): ResolvedClientIp {
  const mode: TrustedProxyMode = modeOverride ?? env.TRUSTED_PROXY_MODE;
  const trusted =
    trustedProxiesOverride !== undefined ? buildTrustedProxyBlockList(trustedProxiesOverride) : trustedProxyList;

  const socketIp = normalizeIp(request.socket?.remoteAddress ?? "") ?? "unknown";
  const socketResult: ResolvedClientIp = { ip: socketIp, version: socketIp.includes(":") ? "IPv6" : "IPv4", source: "socket" };

  if (mode === "none") {
    return socketResult;
  }

  // Never trust spoofable headers unless the direct peer is a trusted proxy.
  if (!isTrustedProxy(socketIp, trusted)) {
    return socketResult;
  }

  if (mode === "cloudflare") {
    const cfIp = normalizeIp(headerValue(request, "cf-connecting-ip") ?? "");
    if (cfIp) {
      return { ip: cfIp, version: toVersion(cfIp), source: "cf-connecting-ip" };
    }
  }

  const forwardedIp = lastForwardedIp(headerValue(request, "x-forwarded-for"));
  if (forwardedIp) {
    return { ip: forwardedIp, version: toVersion(forwardedIp), source: "x-forwarded-for" };
  }

  return socketResult;
}

/**
 * Resolves and attaches the trusted client IP to the request for downstream
 * security middleware and logging.
 */
export function trustedClientIpMiddleware(request: Request, _response: Response, next: NextFunction): void {
  request.clientIp = resolveClientIp(request);
  next();
}

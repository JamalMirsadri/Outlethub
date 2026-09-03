import { ErrorLogSeverity } from "@prisma/client";

/**
 * Canonical attack taxonomy. Values are stored in ErrorLog.attackType and are
 * stable, machine-readable strings so future response actions (IP blocking,
 * rate limiting, fail2ban, reputation scoring) can key off them safely.
 */
export type AttackType =
  | "SQL_INJECTION"
  | "XSS"
  | "PATH_TRAVERSAL"
  | "RCE"
  | "BRUTE_FORCE"
  | "CREDENTIAL_STUFFING"
  | "AUTH_ABUSE"
  | "API_ABUSE"
  | "SENSITIVE_FILE_PROBE"
  | "CMS_SCANNER"
  | "BOT_SCANNER"
  | "TECH_PROBE";

export type Confidence = "HIGH" | "MEDIUM" | "LOW";

export interface ThreatDetection {
  attackType: AttackType;
  confidence: Confidence;
  severity: ErrorLogSeverity;
  source: string;
}

function threat(
  attackType: AttackType,
  source: string,
  confidence: Confidence,
  severity: ErrorLogSeverity,
): ThreatDetection {
  return { attackType, source, confidence, severity };
}

export function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

const SQLI_PATTERNS: RegExp[] = [
  /'[^']{0,20}or[^']{0,20}'1'='1/i,
  /'[^']{0,20}or[^']{0,20}1=1/i,
  /"[^"]{0,20}or[^"]{0,20}"1"="1/i,
  /union\s+(all\s+)?select\b/i,
  /\bselect\b.{0,20}\bfrom\b.{0,20}\bwhere\b/i,
  /\binformation_schema\b/i,
  /\bsleep\s*\(\s*\d/i,
  /\bbenchmark\s*\(/i,
  /\bpg_sleep\s*\(/i,
  /\bxp_cmdshell\b/i,
  /\bwaitfor\s+delay\b/i,
  /;--/,
  /\bor\s+1\s*=\s*1\s*--/i,
];

const XSS_PATTERNS: RegExp[] = [
  /<script\b/i,
  /<\/script\b/i,
  /javascript\s*:/i,
  /\bonerror\s*=/i,
  /\bonload\s*=/i,
  /\bonclick\s*=/i,
  /<img\b[^>]*\bon/i,
  /<svg\b[^>]*\bon/i,
  /\balert\s*\(/i,
  /document\.cookie/i,
  /<iframe\b/i,
];

const TRAVERSAL_PATTERNS: RegExp[] = [
  /\.\.\//,
  /\.\.\\/,
  /%2e%2e%2f/i,
  /%2e%2e%5c/i,
  /\.\.%2f/i,
  /\.\.%5c/i,
  /%252e%252e/i,
  /%00/i,
  /\u0000/,
];

const RCE_PATTERNS: RegExp[] = [
  /[;|&]+\s*(wget|curl|cat|ls|id|uname|whoami|ping|nc|bash|sh|python|perl|php)\b/i,
  /\$\{/,
  /\$\(/,
  /`[^`]{1,80}`/,
  /\bcmd\.exe\b/i,
  /\bpowershell\b/i,
  /\/bin\/(sh|bash)\b/i,
  /\bwget\s+http/i,
  /\bcurl\s+http/i,
  /\bnc\s+-e\b/i,
  /\bsystem\s*\(/i,
  /\bpassthru\s*\(/i,
  /\bexec\s*\(/i,
];

const SENSITIVE_FILE_PATTERNS: RegExp[] = [
  /(^|\/)\.env($|\.|\/|\?)/i,
  /(^|\/)\.git(\/|$)/i,
  /(^|\/)\.aws(\/|$)/i,
  /(^|\/)\.ssh(\/|$)/i,
  /(^|\/)\.config(\/|$)/i,
  /(^|\/)\.htaccess/i,
  /(^|\/)\.htpasswd/i,
  /(^|\/)\.npmrc($|\/|\?)/i,
  /(^|\/)(id_rsa|id_dsa|id_ecdsa|id_ed25519|known_hosts)($|\/|\?)/i,
  /package-lock\.json($|\?|\/)/i,
  /web\.config($|\/|\?)/i,
  /\.(sql|sqlite|db|bak|backup|old|dump|swp|save)(\?|$|\/)/i,
  /\.(pem|key|crt|cer|p12|pfx|ovpn)(\?|$|\/)/i,
  /database\.(sqlite|db)($|\?|\/)/i,
  /(^|\/)(credentials?|secrets?)(\.[a-z0-9]+)?(\/|$|\?)/i,
  /(^|\/)(config|settings)\.(json|ya?ml|ini|conf|env|xml|properties|toml)(\?|$|\/)/i,
  /\/(backup|backups)(\/|$|\?)/i,
];

const CMS_PATTERNS: RegExp[] = [
  /\/wp-(admin|content|includes|login|signup|cron|config)(\/|$)/i,
  /\/xmlrpc\.php/i,
  /\/wordpress(\/|$)/i,
  /\.php(\/|\?|$)/i,
];

const TECH_PATTERNS: RegExp[] = [
  /\/actuator(\/|$)/i,
  /\/phpmyadmin(\/|$)/i,
  /\/adminer(\/|$)/i,
  /\/\.well-known(\/|$)/i,
  /\/server-status/i,
  /\/manager\/html/i,
  /\/jenkins(\/|$)/i,
  /\/solr(\/|$)/i,
  /\/grafana(\/|$)/i,
  /\/console(\/|$)/i,
];

const BOT_UA_PATTERNS: RegExp[] = [
  /\bsqlmap\b/i,
  /\bnmap\b/i,
  /\bnikto\b/i,
  /\bmasscan\b/i,
  /\bzgrab\b/i,
  /\bgobuster\b/i,
  /\bdirbuster\b/i,
  /\bwpscan\b/i,
  /\bacunetix\b/i,
  /\bnessus\b/i,
  /\bhydra\b/i,
  /\bpython-requests\b/i,
  /\bgo-http-client\b/i,
  /\bscrapy\b/i,
  /\blibwww-perl\b/i,
];

function matches(patterns: RegExp[], value: string): boolean {
  return patterns.some((pattern) => pattern.test(value));
}

export function hasTraversalAttempt(value: string): boolean {
  return matches(TRAVERSAL_PATTERNS, value);
}

export function isSensitiveFilePath(path: string): boolean {
  return matches(SENSITIVE_FILE_PATTERNS, path);
}

/**
 * Stateless, conservative threat detection for a single HTTP request. Only
 * returns a detection when a clear attack signature is present; normal
 * application traffic is intentionally never matched.
 */
export function detectThreat(input: {
  path: string;
  query: string;
  method: string;
  userAgent: string | null;
}): ThreatDetection | null {
  const rawUrl = `${input.path}${input.query ? `?${input.query}` : ""}`;
  const decoded = safeDecode(rawUrl);
  const userAgent = input.userAgent ?? "";

  // Bot / scanner user-agent (checked on the raw header, not decoded).
  if (matches(BOT_UA_PATTERNS, userAgent)) {
    return threat("BOT_SCANNER", "Bot scanner", "HIGH", ErrorLogSeverity.LOW);
  }

  if (matches(SENSITIVE_FILE_PATTERNS, decoded)) {
    return threat("SENSITIVE_FILE_PROBE", "Sensitive file probe", "HIGH", ErrorLogSeverity.MEDIUM);
  }

  if (matches(CMS_PATTERNS, decoded)) {
    const source = /\.php(\/|\?|$)/i.test(decoded) && !/\/wp-/.test(decoded) ? "PHP scan" : "WordPress scan";
    return threat("CMS_SCANNER", source, "HIGH", ErrorLogSeverity.LOW);
  }

  if (matches(TRAVERSAL_PATTERNS, rawUrl) || matches(TRAVERSAL_PATTERNS, decoded)) {
    return threat("PATH_TRAVERSAL", "Path traversal", "HIGH", ErrorLogSeverity.HIGH);
  }

  if (matches(SQLI_PATTERNS, decoded)) {
    return threat("SQL_INJECTION", "SQL injection", "HIGH", ErrorLogSeverity.HIGH);
  }

  if (matches(XSS_PATTERNS, decoded)) {
    return threat("XSS", "XSS", "MEDIUM", ErrorLogSeverity.MEDIUM);
  }

  if (matches(RCE_PATTERNS, decoded)) {
    return threat("RCE", "RCE", "HIGH", ErrorLogSeverity.HIGH);
  }

  if (matches(TECH_PATTERNS, decoded)) {
    return threat("TECH_PROBE", "Tech probe", "MEDIUM", ErrorLogSeverity.MEDIUM);
  }

  return null;
}

const BODY_STRINGIFY_MAX_LENGTH = 8000;

function stringifyBody(body: unknown): string | null {
  if (body == null) {
    return null;
  }

  if (typeof body === "string") {
    return body.slice(0, BODY_STRINGIFY_MAX_LENGTH);
  }

  try {
    const json = JSON.stringify(body);
    if (typeof json !== "string" || json.length === 0) {
      return null;
    }

    return json.length > BODY_STRINGIFY_MAX_LENGTH ? json.slice(0, BODY_STRINGIFY_MAX_LENGTH) : json;
  } catch {
    return null;
  }
}

/**
 * Detects high-risk content signatures in a parsed request body (SQL injection,
 * RCE, path traversal and XSS). The body is stringified with a hard length cap
 * and is never logged. Used as a second detection pass after body parsing.
 */
export function detectBodyThreat(body: unknown): ThreatDetection | null {
  const value = stringifyBody(body);
  if (!value) {
    return null;
  }

  const decoded = safeDecode(value);

  if (matches(TRAVERSAL_PATTERNS, decoded)) {
    return threat("PATH_TRAVERSAL", "Path traversal (body)", "HIGH", ErrorLogSeverity.HIGH);
  }

  if (matches(SQLI_PATTERNS, decoded)) {
    return threat("SQL_INJECTION", "SQL injection (body)", "HIGH", ErrorLogSeverity.HIGH);
  }

  if (matches(RCE_PATTERNS, decoded)) {
    return threat("RCE", "RCE (body)", "HIGH", ErrorLogSeverity.HIGH);
  }

  if (matches(XSS_PATTERNS, decoded)) {
    return threat("XSS", "XSS (body)", "MEDIUM", ErrorLogSeverity.MEDIUM);
  }

  return null;
}

import type { ErrorLogView } from "./system-logs.service.js";

const CSV_COLUMNS = [
  "timestamp",
  "severity",
  "type",
  "message",
  "source",
  "endpoint",
  "page",
  "method",
  "statusCode",
  "occurrences",
  "ip",
  "browser",
  "os",
  "device",
  "userEmail",
  "userId",
  "resolved",
] as const;

function escapeCsvCell(value: unknown): string {
  const stringValue = value == null ? "" : String(value);

  if (/[",\n\r]/.test(stringValue)) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }

  return stringValue;
}

function toRow(log: ErrorLogView): string {
  return [
    log.createdAt.toISOString(),
    log.severity,
    log.type,
    log.message,
    log.source ?? "",
    log.endpoint ?? "",
    log.page ?? "",
    log.method ?? "",
    log.statusCode ?? "",
    log.occurrences,
    log.ip ?? "",
    log.browser ?? "",
    log.os ?? "",
    log.device ?? "",
    log.userEmail ?? "",
    log.userId ?? "",
    log.resolved ? "resolved" : "open",
  ]
    .map(escapeCsvCell)
    .join(",");
}

export function serializeLogsToCsv(items: ErrorLogView[]): string {
  const header = CSV_COLUMNS.join(",");
  const rows = items.map(toRow);
  // Prepend a UTF-8 BOM so spreadsheet apps detect the encoding correctly.
  return `\uFEFF${[header, ...rows].join("\r\n")}`;
}

export function serializeLogsToTxt(items: ErrorLogView[]): string {
  return items
    .map((log) => {
      const lines = [
        `[${log.createdAt.toISOString()}] ${log.severity} · ${log.type}`,
        `  Message:   ${log.message}`,
        `  Source:    ${log.source ?? "-"}`,
        `  Endpoint:  ${log.endpoint ?? "-"}`,
        `  Page:      ${log.page ?? "-"}`,
        `  Method:    ${log.method ?? "-"}`,
        `  Status:    ${log.statusCode != null ? log.statusCode : "-"}${log.resolved ? " (resolved)" : ""}`,
        `  Count:     ${log.occurrences}`,
        `  IP:        ${log.ip ?? "-"}`,
        `  Browser:   ${log.browser ?? "-"}`,
        `  OS:        ${log.os ?? "-"}`,
        `  Device:    ${log.device ?? "-"}`,
        `  User:      ${log.userEmail ?? log.userId ?? "-"}`,
      ];
      return lines.join("\n");
    })
    .join("\n\n");
}

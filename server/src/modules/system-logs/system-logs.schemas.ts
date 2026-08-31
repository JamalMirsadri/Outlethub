import { ErrorLogSeverity, ErrorLogType } from "@prisma/client";
import { z } from "zod";

export const entityIdParamsSchema = z.object({
  id: z.string().cuid(),
});

export const createClientErrorSchema = z.object({
  type: z.nativeEnum(ErrorLogType).default(ErrorLogType.FRONTEND),
  severity: z.nativeEnum(ErrorLogSeverity).optional(),
  message: z.string().min(1, "message is required").max(4000),
  stack: z.string().max(16000).nullish(),
  source: z.string().max(500).nullish(),
  page: z.string().max(500).nullish(),
  endpoint: z.string().max(500).nullish(),
  method: z.string().max(20).nullish(),
  statusCode: z.coerce.number().int().min(100).max(599).nullish(),
  durationMs: z.coerce.number().int().min(0).nullish(),
  userId: z.string().max(200).nullish(),
  userEmail: z.string().max(320).nullish(),
  userRole: z.string().max(40).nullish(),
  browser: z.string().max(500).nullish(),
  os: z.string().max(500).nullish(),
  device: z.string().max(500).nullish(),
  requestId: z.string().max(200).nullish(),
});

export const listErrorLogsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().max(200).optional(),
  severity: z.nativeEnum(ErrorLogSeverity).optional(),
  type: z.nativeEnum(ErrorLogType).optional(),
  resolved: z.coerce.boolean().optional(),
  userId: z.string().max(200).optional(),
  route: z.string().max(500).optional(),
  from: z.string().max(100).optional(),
  to: z.string().max(100).optional(),
  sort: z.enum(["newest", "oldest", "occurrences"]).default("newest"),
});

export const addNoteErrorLogSchema = z.object({
  note: z.string().min(1, "note is required").max(2000),
});

export const exportErrorLogsQuerySchema = z.object({
  format: z.enum(["csv", "txt"]).default("csv"),
  search: z.string().max(200).optional(),
  severity: z.nativeEnum(ErrorLogSeverity).optional(),
  type: z.nativeEnum(ErrorLogType).optional(),
  resolved: z.coerce.boolean().optional(),
  userId: z.string().max(200).optional(),
  route: z.string().max(500).optional(),
  from: z.string().max(100).optional(),
  to: z.string().max(100).optional(),
  sort: z.enum(["newest", "oldest", "occurrences"]).default("newest"),
});

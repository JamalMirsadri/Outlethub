import { ReferralCommissionStatus, ReferralRank } from "@prisma/client";
import { z } from "zod";

export const listCommissionsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  referrerUserId: z.string().max(100).optional(),
  rank: z.nativeEnum(ReferralRank).optional(),
  orderId: z.string().max(100).optional(),
  status: z.nativeEnum(ReferralCommissionStatus).optional(),
  from: z.string().max(100).optional(),
  to: z.string().max(100).optional(),
});

export const updateCommissionConfigSchema = z.object({
  rank: z.nativeEnum(ReferralRank),
  percentage: z.coerce.number().min(0).max(100),
  isActive: z.boolean(),
});

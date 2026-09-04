import { MultiLevelReferralPointStatus } from "@prisma/client";
import { z } from "zod";

export const listPointRewardsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  purchaserUserId: z.string().max(100).optional(),
  beneficiaryUserId: z.string().max(100).optional(),
  level: z.coerce.number().int().min(0).max(3).optional(),
  status: z.nativeEnum(MultiLevelReferralPointStatus).optional(),
  from: z.string().max(100).optional(),
  to: z.string().max(100).optional(),
});

export const updatePointSettingsSchema = z.object({
  purchaserPointsPer10EUR: z.coerce.number().int().min(0),
  level1PointsPer10EUR: z.coerce.number().int().min(0),
  level2PointsPer10EUR: z.coerce.number().int().min(0),
  level3PointsPer10EUR: z.coerce.number().int().min(0),
  maxReferralLevel: z.coerce.number().int().min(1).max(3),
});

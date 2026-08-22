import { randomUUID } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import { basename, resolve, sep } from "node:path";

import { CampaignDisplayType, CampaignPopupDisplayMode, CampaignStatus } from "@prisma/client";

import { env } from "../../config/env.js";
import { prisma } from "../../config/prisma.js";
import { ApiError } from "../../utils/api-error.js";

function mapCampaign(campaign: {
  id: string;
  title: string;
  description: string | null;
  image: string | null;
  displayType: CampaignDisplayType;
  link: string | null;
  status: CampaignStatus;
  startsAt: Date | null;
  endsAt: Date | null;
  popupDisplayMode: CampaignPopupDisplayMode;
  maxDisplaysPerUser: number | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: campaign.id,
    title: campaign.title,
    description: campaign.description,
    image: campaign.image,
    displayType: campaign.displayType,
    link: campaign.link,
    status: campaign.status,
    startsAt: campaign.startsAt,
    endsAt: campaign.endsAt,
    popupDisplayMode: campaign.popupDisplayMode,
    maxDisplaysPerUser: campaign.maxDisplaysPerUser,
    createdAt: campaign.createdAt,
    updatedAt: campaign.updatedAt,
  };
}

function validateCampaignSchedule(input: { startsAt?: string | null; endsAt?: string | null }) {
  if (input.startsAt && input.endsAt && new Date(input.endsAt) < new Date(input.startsAt)) {
    throw new ApiError(400, "Campaign end date must be after the start date.");
  }
}

const CAMPAIGN_IMAGE_MIME_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

const MAX_CAMPAIGN_IMAGE_BYTES = 5 * 1024 * 1024;

function getCampaignUploadDir(): string {
  return resolve(process.cwd(), env.UPLOAD_DIR, "campaigns");
}

function decodeCampaignImageDataUrl(dataUrl: string): { buffer: Buffer; extension: string } {
  const match = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!match || !match[1] || !match[2]) {
    throw new ApiError(400, "Campaign image must be a base64 data URL.");
  }

  const mimeType = match[1].toLowerCase();
  const extension = CAMPAIGN_IMAGE_MIME_TYPES[mimeType];
  if (!extension) {
    throw new ApiError(400, "Campaign image must be JPG, JPEG, PNG, or WEBP.");
  }

  const buffer = Buffer.from(match[2], "base64");
  if (buffer.length === 0 || buffer.length > MAX_CAMPAIGN_IMAGE_BYTES) {
    throw new ApiError(400, "Campaign image must be between 1 byte and 5 MB.");
  }

  return { buffer, extension };
}

function deleteLocalCampaignImage(imageUrl: string | null): void {
  if (!imageUrl || !imageUrl.startsWith("/uploads/campaigns/")) {
    return;
  }

  const filename = basename(imageUrl);
  if (!filename) {
    return;
  }

  const campaignsDir = resolve(getCampaignUploadDir());
  const filePath = resolve(campaignsDir, filename);
  if (!filePath.startsWith(`${campaignsDir}${sep}`)) {
    return;
  }

  void unlink(filePath).catch(() => undefined);
}

export class CampaignService {
  public async getActiveCenterPopup() {
    const now = new Date();

    const campaign = await prisma.campaign.findFirst({
      where: {
        status: CampaignStatus.ACTIVE,
        displayType: CampaignDisplayType.POPUP,
        AND: [
          {
            OR: [{ startsAt: null }, { startsAt: { lte: now } }],
          },
          {
            OR: [{ endsAt: null }, { endsAt: { gte: now } }],
          },
        ],
      },
      orderBy: [{ startsAt: "asc" }, { createdAt: "desc" }],
    });

    return campaign ? mapCampaign(campaign) : null;
  }

  public async getAdminOverview() {
    const campaigns = await prisma.campaign.findMany({
      orderBy: [{ createdAt: "desc" }],
    });

    return {
      summary: {
        totalCampaigns: campaigns.length,
        activeCampaigns: campaigns.filter((campaign) => campaign.status === CampaignStatus.ACTIVE).length,
        scheduledCampaigns: campaigns.filter((campaign) => campaign.startsAt || campaign.endsAt).length,
      },
      campaigns: campaigns.map(mapCampaign),
    };
  }

  public async getById(id: string) {
    const campaign = await prisma.campaign.findUnique({
      where: { id },
    });

    if (!campaign) {
      throw new ApiError(404, "Campaign not found.");
    }

    return mapCampaign(campaign);
  }

  public async create(input: {
    title: string;
    description?: string | null;
    image?: string | null;
    displayType: CampaignDisplayType;
    link?: string | null;
    status?: CampaignStatus;
    startsAt?: string | null;
    endsAt?: string | null;
    popupDisplayMode?: CampaignPopupDisplayMode;
    maxDisplaysPerUser?: number | null;
  }) {
    validateCampaignSchedule(input);

    const created = await prisma.campaign.create({
      data: {
        title: input.title.trim(),
        description: input.description ?? null,
        image: input.image ?? null,
        displayType: input.displayType,
        link: input.link ?? null,
        status: input.status ?? CampaignStatus.DRAFT,
        startsAt: input.startsAt ? new Date(input.startsAt) : null,
        endsAt: input.endsAt ? new Date(input.endsAt) : null,
        popupDisplayMode: input.popupDisplayMode ?? CampaignPopupDisplayMode.ONCE,
        maxDisplaysPerUser: input.maxDisplaysPerUser ?? null,
      },
    });

    return mapCampaign(created);
  }

  public async update(
    id: string,
    input: Partial<{
      title: string;
      description: string | null;
      image: string | null;
      displayType: CampaignDisplayType;
      link: string | null;
      status: CampaignStatus;
      startsAt: string | null;
      endsAt: string | null;
      popupDisplayMode: CampaignPopupDisplayMode;
      maxDisplaysPerUser: number | null;
    }>,
  ) {
    const existing = await prisma.campaign.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new ApiError(404, "Campaign not found.");
    }

    validateCampaignSchedule({
      startsAt: input.startsAt === undefined ? existing.startsAt?.toISOString() ?? null : input.startsAt,
      endsAt: input.endsAt === undefined ? existing.endsAt?.toISOString() ?? null : input.endsAt,
    });

    const updated = await prisma.campaign.update({
      where: { id },
      data: {
        title: input.title?.trim(),
        description: input.description,
        image: input.image,
        displayType: input.displayType,
        link: input.link,
        status: input.status,
        startsAt:
          input.startsAt === undefined ? undefined : input.startsAt === null ? null : new Date(input.startsAt),
        endsAt: input.endsAt === undefined ? undefined : input.endsAt === null ? null : new Date(input.endsAt),
        popupDisplayMode: input.popupDisplayMode,
        maxDisplaysPerUser: input.maxDisplaysPerUser,
      },
    });

    if (input.image !== undefined && input.image !== existing.image) {
      deleteLocalCampaignImage(existing.image);
    }

    return mapCampaign(updated);
  }

  public async uploadImage(input: { dataUrl?: string; imageUrl?: string }) {
    if (input.imageUrl) {
      return { imageUrl: input.imageUrl };
    }

    if (!input.dataUrl) {
      throw new ApiError(400, "No image payload was provided.");
    }

    const { buffer, extension } = decodeCampaignImageDataUrl(input.dataUrl);
    const campaignsDir = getCampaignUploadDir();
    await mkdir(campaignsDir, { recursive: true });

    const filename = `${randomUUID()}.${extension}`;
    await writeFile(resolve(campaignsDir, filename), buffer);

    return { imageUrl: `/uploads/campaigns/${filename}` };
  }

  public async delete(id: string) {
    const existing = await prisma.campaign.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!existing) {
      throw new ApiError(404, "Campaign not found.");
    }

    await prisma.campaign.delete({
      where: { id },
    });
  }
}

export const campaignService = new CampaignService();

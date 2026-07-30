import { CampaignDisplayType, CampaignStatus } from "@prisma/client";

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
    createdAt: campaign.createdAt,
    updatedAt: campaign.updatedAt,
  };
}

function validateCampaignSchedule(input: { startsAt?: string | null; endsAt?: string | null }) {
  if (input.startsAt && input.endsAt && new Date(input.endsAt) < new Date(input.startsAt)) {
    throw new ApiError(400, "Campaign end date must be after the start date.");
  }
}

export class CampaignService {
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
      },
    });

    return mapCampaign(updated);
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

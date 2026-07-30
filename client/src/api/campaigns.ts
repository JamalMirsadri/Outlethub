import { getAccessToken } from "@/services/auth.service";
import { http } from "@/services/http";

function getRequiredToken(): string {
  const token = getAccessToken();

  if (!token) {
    throw new Error("Authentication is required.");
  }

  return token;
}

export type CampaignDisplayType = "POPUP" | "BANNER" | "HERO" | "INLINE";
export type CampaignStatus = "DRAFT" | "ACTIVE" | "DISABLED";

export interface CampaignRecord {
  id: string;
  title: string;
  description: string | null;
  image: string | null;
  displayType: CampaignDisplayType;
  link: string | null;
  status: CampaignStatus;
  startsAt: string | null;
  endsAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CampaignAdminOverviewResponse {
  summary: {
    totalCampaigns: number;
    activeCampaigns: number;
    scheduledCampaigns: number;
  };
  campaigns: CampaignRecord[];
}

export interface CampaignPayload {
  title: string;
  description?: string | null;
  image?: string | null;
  displayType: CampaignDisplayType;
  link?: string | null;
  status?: CampaignStatus;
  startsAt?: string | null;
  endsAt?: string | null;
}

export async function getAdminCampaignOverview() {
  return http<CampaignAdminOverviewResponse>("/admin/campaigns", {
    token: getRequiredToken(),
  });
}

export async function getAdminCampaign(id: string) {
  return http<CampaignRecord>(`/admin/campaigns/${id}`, {
    token: getRequiredToken(),
  });
}

export async function createCampaign(payload: CampaignPayload) {
  return http<CampaignRecord>("/admin/campaigns", {
    method: "POST",
    token: getRequiredToken(),
    body: JSON.stringify(payload),
  });
}

export async function updateCampaign(id: string, payload: Partial<CampaignPayload>) {
  return http<CampaignRecord>(`/admin/campaigns/${id}`, {
    method: "PATCH",
    token: getRequiredToken(),
    body: JSON.stringify(payload),
  });
}

export async function deleteCampaign(id: string) {
  return http<void>(`/admin/campaigns/${id}`, {
    method: "DELETE",
    token: getRequiredToken(),
  });
}

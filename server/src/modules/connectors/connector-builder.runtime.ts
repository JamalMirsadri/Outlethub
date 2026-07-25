import type { Prisma } from "@prisma/client";

import { prisma } from "../../config/prisma.js";
import { ApiError } from "../../utils/api-error.js";
import {
  connectorExecutionEngine,
  type ConnectorPreviewResult,
  type ConnectorRuntimeBundle,
} from "./connector-execution-engine.js";

export const DEFAULT_CONNECTOR_FIELD_MAPPINGS = [
  { externalField: "title", internalField: "name" },
  { externalField: "brand", internalField: "brand" },
  { externalField: "category", internalField: "category" },
  { externalField: "price", internalField: "price" },
  { externalField: "oldPrice", internalField: "oldPrice" },
  { externalField: "image", internalField: "imageUrl" },
  { externalField: "link", internalField: "sourceUrl" },
  { externalField: "id", internalField: "sourceProductId" },
  { externalField: "currency", internalField: "currency" },
];

export class ConnectorBuilderRuntime {
  public async resolveByBrandSourceId(brandSourceId: string) {
    const bundle = await prisma.connectorConfiguration.findUnique({
      where: { brandSourceId },
      include: {
        brandSource: true,
        template: true,
        fieldMappings: {
          orderBy: { createdAt: "asc" },
        },
        executionProfile: true,
        scraperSource: true,
      },
    });

    if (!bundle) {
      throw new ApiError(404, "Connector configuration not found for this brand source.");
    }

    return bundle;
  }

  public async resolveByScraperSourceId(scraperSourceId: string) {
    const bundle = await prisma.connectorConfiguration.findUnique({
      where: { scraperSourceId },
      include: {
        brandSource: true,
        template: true,
        fieldMappings: {
          orderBy: { createdAt: "asc" },
        },
        executionProfile: true,
        scraperSource: true,
      },
    });

    if (!bundle) {
      throw new ApiError(404, "Dynamic connector configuration not found.");
    }

    return bundle;
  }

  public async previewByBrandSourceId(brandSourceId: string): Promise<ConnectorPreviewResult> {
    const bundle = await this.resolveByBrandSourceId(brandSourceId);
    return this.previewBundle(bundle);
  }

  public async previewByScraperSourceId(scraperSourceId: string): Promise<ConnectorPreviewResult> {
    const bundle = await this.resolveByScraperSourceId(scraperSourceId);
    return this.previewBundle(bundle);
  }

  public async previewBundle(bundle: ConnectorRuntimeBundle): Promise<ConnectorPreviewResult> {
    return connectorExecutionEngine.previewBundle(bundle);
  }

  public async diagnoseByBrandSourceId(brandSourceId: string) {
    const bundle = await this.resolveByBrandSourceId(brandSourceId);
    return this.diagnoseBundle(bundle);
  }

  public async diagnoseBundle(bundle: ConnectorRuntimeBundle) {
    return connectorExecutionEngine.diagnoseBundle(bundle);
  }

  public buildScraperConfiguration(bundle: ConnectorRuntimeBundle) {
    return connectorExecutionEngine.buildScraperConfiguration(bundle);
  }
}

export const connectorBuilderRuntime = new ConnectorBuilderRuntime();

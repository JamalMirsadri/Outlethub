import { ImportSourceType } from "@prisma/client";

import { ApiError } from "../../../utils/api-error.js";
import { importNormalizer, type NormalizeContext } from "../import-normalizer.js";
import type { ImportParser, ImportParserInput } from "./import-parser.js";

function getPathValue(payload: unknown, path: string | undefined): unknown {
  if (!path) {
    return undefined;
  }

  return path.split(".").reduce<unknown>((currentValue, key) => {
    if (Array.isArray(currentValue)) {
      const index = Number(key);
      return Number.isInteger(index) ? currentValue[index] : undefined;
    }

    if (!currentValue || typeof currentValue !== "object") {
      return undefined;
    }

    return (currentValue as Record<string, unknown>)[key];
  }, payload);
}

function extractRecords(payload: unknown, recordPath: string | undefined): unknown[] {
  const fromConfiguredPath = getPathValue(payload, recordPath);
  if (Array.isArray(fromConfiguredPath)) {
    return fromConfiguredPath;
  }

  if (Array.isArray(payload)) {
    return payload;
  }

  if (!payload || typeof payload !== "object") {
    throw new ApiError(400, "JSON import content must be an array or object.");
  }

  const candidate = payload as Record<string, unknown>;
  for (const key of ["items", "products", "data", "records"]) {
    if (Array.isArray(candidate[key])) {
      return candidate[key] as unknown[];
    }
  }

  throw new ApiError(400, "Unable to locate JSON import records.");
}

export class JsonImportParser implements ImportParser {
  public readonly supportedTypes = [ImportSourceType.JSON_FEED, ImportSourceType.MANUAL] as const;

  public async validate(input: ImportParserInput): Promise<void> {
    if (!input.content.trim()) {
      throw new ApiError(400, "Import content is empty.");
    }

    try {
      JSON.parse(input.content);
    } catch {
      throw new ApiError(400, "Invalid JSON import payload.");
    }
  }

  public async parse(input: ImportParserInput): Promise<unknown[]> {
    const payload = JSON.parse(input.content) as unknown;
    return extractRecords(payload, input.configuration?.recordPath);
  }

  public async normalize(records: unknown[], context: NormalizeContext) {
    return importNormalizer.normalizeRecords(records, context);
  }
}

export const jsonImportParser = new JsonImportParser();

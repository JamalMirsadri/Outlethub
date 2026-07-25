import { XMLParser } from "fast-xml-parser";
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

  if (fromConfiguredPath && typeof fromConfiguredPath === "object") {
    return [fromConfiguredPath];
  }

  if (!payload || typeof payload !== "object") {
    throw new ApiError(400, "Unable to parse XML import records.");
  }

  const findRecordContainer = (value: unknown): unknown[] | null => {
    if (Array.isArray(value)) {
      return value;
    }

    if (!value || typeof value !== "object") {
      return null;
    }

    const record = value as Record<string, unknown>;
    for (const key of ["product", "item", "entry"]) {
      const directValue = record[key];
      if (Array.isArray(directValue)) {
        return directValue;
      }

      if (directValue && typeof directValue === "object") {
        return [directValue];
      }
    }

    for (const nestedValue of Object.values(record)) {
      const result = findRecordContainer(nestedValue);
      if (result?.length) {
        return result;
      }
    }

    return null;
  };

  const candidate = payload as Record<string, unknown>;
  for (const key of ["products", "items", "catalog", "feed"]) {
    const value = candidate[key];
    if (Array.isArray(value)) {
      return value;
    }

    if (value && typeof value === "object") {
      for (const nestedKey of ["product", "item", "entry"]) {
        const nestedValue = (value as Record<string, unknown>)[nestedKey];
        if (Array.isArray(nestedValue)) {
          return nestedValue;
        }
      }
    }
  }

  const fallbackResult = findRecordContainer(payload);
  if (fallbackResult?.length) {
    return fallbackResult;
  }

  throw new ApiError(400, "Unable to locate XML import records.");
}

export class XmlImportParser implements ImportParser {
  public readonly supportedTypes = [ImportSourceType.XML_FEED] as const;

  private readonly parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "",
    parseTagValue: true,
    trimValues: true,
  });

  public async validate(input: ImportParserInput): Promise<void> {
    if (!input.content.trim()) {
      throw new ApiError(400, "Import content is empty.");
    }

    try {
      this.parser.parse(input.content);
    } catch {
      throw new ApiError(400, "Invalid XML import payload.");
    }
  }

  public async parse(input: ImportParserInput): Promise<unknown[]> {
    const payload = this.parser.parse(input.content) as unknown;
    return extractRecords(payload, input.configuration?.recordPath);
  }

  public async normalize(records: unknown[], context: NormalizeContext) {
    return importNormalizer.normalizeRecords(records, context);
  }
}

export const xmlImportParser = new XmlImportParser();

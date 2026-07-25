import { ImportSourceType } from "@prisma/client";

import { ApiError } from "../../utils/api-error.js";
import { jsonImportParser } from "./parsers/json-import.parser.js";
import type { ImportParser } from "./parsers/import-parser.js";
import { xmlImportParser } from "./parsers/xml-import.parser.js";

export class ImportParserRegistry {
  private readonly parsers: ImportParser[];

  public constructor(parsers: ImportParser[]) {
    this.parsers = parsers;
  }

  public getBySourceType(sourceType: ImportSourceType): ImportParser {
    const parser = this.parsers.find((candidate) => candidate.supportedTypes.includes(sourceType));
    if (!parser) {
      throw new ApiError(400, `No parser is registered for source type ${sourceType}.`);
    }

    return parser;
  }

  public getByUploadFormat(format: "json" | "xml"): ImportParser {
    return format === "json" ? jsonImportParser : xmlImportParser;
  }
}

export const importParserRegistry = new ImportParserRegistry([jsonImportParser, xmlImportParser]);

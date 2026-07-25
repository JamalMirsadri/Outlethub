import { ImportSourceType } from "@prisma/client";

import type {
  ImportSourceConfiguration,
  NormalizeContext,
  NormalizedImportProduct,
} from "../import-normalizer.js";

export interface ImportParserInput {
  sourceType: ImportSourceType;
  content: string;
  configuration?: ImportSourceConfiguration | null;
  sourceStore?: string | null;
  website?: string | null;
}

export interface ImportParser {
  readonly supportedTypes: readonly ImportSourceType[];
  validate(input: ImportParserInput): Promise<void>;
  parse(input: ImportParserInput): Promise<unknown[]>;
  normalize(records: unknown[], context: NormalizeContext): Promise<NormalizedImportProduct[]>;
}

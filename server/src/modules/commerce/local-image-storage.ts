import { randomUUID } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import { basename, resolve, sep } from "node:path";

import { env } from "../../config/env.js";
import { ApiError } from "../../utils/api-error.js";

const LOCAL_IMAGE_MIME_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

const MAX_LOCAL_IMAGE_BYTES = 5 * 1024 * 1024;

function getSubfolderDir(subfolder: string): string {
  return resolve(process.cwd(), env.UPLOAD_DIR, subfolder);
}

function decodeImageDataUrl(dataUrl: string, label: string): { buffer: Buffer; extension: string } {
  const match = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!match || !match[1] || !match[2]) {
    throw new ApiError(400, `${label} must be a base64 data URL.`);
  }

  const mimeType = match[1].toLowerCase();
  const extension = LOCAL_IMAGE_MIME_TYPES[mimeType];
  if (!extension) {
    throw new ApiError(400, `${label} must be JPG, JPEG, PNG, or WEBP.`);
  }

  const buffer = Buffer.from(match[2], "base64");
  if (buffer.length === 0 || buffer.length > MAX_LOCAL_IMAGE_BYTES) {
    throw new ApiError(400, `${label} must be between 1 byte and 5 MB.`);
  }

  return { buffer, extension };
}

export async function saveLocalImage(
  dataUrl: string,
  subfolder: string,
  label = "Image",
): Promise<{ publicUrl: string }> {
  const { buffer, extension } = decodeImageDataUrl(dataUrl, label);
  const targetDir = getSubfolderDir(subfolder);
  await mkdir(targetDir, { recursive: true });

  const filename = `${randomUUID()}.${extension}`;
  await writeFile(resolve(targetDir, filename), buffer);

  return { publicUrl: `/uploads/${subfolder}/${filename}` };
}

export function deleteLocalImage(publicUrl: string | null, subfolder: string): void {
  const prefix = `/uploads/${subfolder}/`;
  if (!publicUrl || !publicUrl.startsWith(prefix)) {
    return;
  }

  const filename = basename(publicUrl);
  if (!filename) {
    return;
  }

  const targetDir = resolve(getSubfolderDir(subfolder));
  const filePath = resolve(targetDir, filename);
  if (!filePath.startsWith(`${targetDir}${sep}`)) {
    return;
  }

  void unlink(filePath).catch(() => undefined);
}

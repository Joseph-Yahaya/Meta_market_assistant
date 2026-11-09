"use client";
import { sniffImageType } from "./image";

// Browser step of the upload pipeline: validate by content, resize to at
// most 1280 px on the longest side, and re-encode as JPEG. Re-encoding
// drops hidden metadata such as location tags.
export const MAX_PRODUCT_PHOTO_PX = 1280;
export const MAX_PRODUCT_PHOTO_INPUT = 20_000_000;
export async function prepareProductPhoto(blob: Blob): Promise<{ bytes: Uint8Array; mime: "image/jpeg" }> {
  if (blob.size > MAX_PRODUCT_PHOTO_INPUT) throw new Error("IMAGE_TOO_LARGE");
  const raw = new Uint8Array(await blob.arrayBuffer());
  if (!sniffImageType(raw)) throw new Error("IMAGE_TYPE_UNSUPPORTED");
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(blob);
  } catch {
    throw new Error("IMAGE_UNREADABLE");
  }
  try {
    const scale = Math.min(1, MAX_PRODUCT_PHOTO_PX / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("IMAGE_UNREADABLE");
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const out: Blob | null = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
    if (!out) throw new Error("IMAGE_UNREADABLE");
    return { bytes: new Uint8Array(await out.arrayBuffer()), mime: "image/jpeg" };
  } finally {
    bitmap.close();
  }
}

// Simple center-square crop for buyer demand photos. The caller shows the
// preview URL and sends the bytes only after the buyer confirms them.
export async function squareCropJpeg(bytes: Uint8Array): Promise<{ bytes: Uint8Array<ArrayBuffer>; url: string }> {
  const copy = new Uint8Array(bytes);
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(new Blob([copy], { type: "image/jpeg" }));
  } catch {
    throw new Error("IMAGE_UNREADABLE");
  }
  try {
    const side = Math.min(bitmap.width, bitmap.height);
    const canvas = document.createElement("canvas");
    canvas.width = side;
    canvas.height = side;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("IMAGE_UNREADABLE");
    ctx.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, side, side);
    const out: Blob | null = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
    if (!out) throw new Error("IMAGE_UNREADABLE");
    return { bytes: new Uint8Array(await out.arrayBuffer()), url: URL.createObjectURL(out) };
  } finally {
    bitmap.close();
  }
}

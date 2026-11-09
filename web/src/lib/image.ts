// Shared image checks for the upload pipeline (Feature Q). Pure byte
// inspection and metadata stripping: safe in the browser and on the server.
export const MAX_IMAGE_BYTES = 5_000_000;
export type SniffedImage = "jpeg" | "png" | "webp";

// File type by content, never by file name.
export function sniffImageType(bytes: Uint8Array): SniffedImage | null {
  if (bytes.length > 12 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "jpeg";
  if (
    bytes.length > 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 &&
    bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a
  )
    return "png";
  if (
    bytes.length > 12 && bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
  )
    return "webp";
  return null;
}

// True when the bytes still carry an EXIF metadata segment.
export function hasExifData(bytes: Uint8Array, type: SniffedImage): boolean {
  if (type === "jpeg") {
    let o = 2;
    while (o + 4 <= bytes.length && bytes[o] === 0xff) {
      const marker = bytes[o + 1];
      if (marker === 0xda || marker === 0xd9) return false;
      if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
        o += 2;
        continue;
      }
      const size = (bytes[o + 2] << 8) | bytes[o + 3];
      if (size < 2 || o + 2 + size > bytes.length) return false;
      if (
        marker === 0xe1 && size >= 8 && bytes[o + 4] === 0x45 && bytes[o + 5] === 0x78 &&
        bytes[o + 6] === 0x69 && bytes[o + 7] === 0x66 && bytes[o + 8] === 0 && bytes[o + 9] === 0
      )
        return true;
      o += 2 + size;
    }
    return false;
  }
  if (type === "png") {
    let o = 8;
    while (o + 12 <= bytes.length) {
      const size = (bytes[o] << 24) | (bytes[o + 1] << 16) | (bytes[o + 2] << 8) | bytes[o + 3];
      const name = String.fromCharCode(bytes[o + 4], bytes[o + 5], bytes[o + 6], bytes[o + 7]);
      if (name === "eXIf") return true;
      if (name === "IEND") return false;
      if (size < 0 || o + 12 + size > bytes.length) return false;
      o += 12 + size;
    }
    return false;
  }
  let o = 12;
  const riffEnd = 8 + (bytes[4] | (bytes[5] << 8) | (bytes[6] << 16) | (bytes[7] << 24));
  while (o + 8 <= Math.min(bytes.length, riffEnd)) {
    const name = String.fromCharCode(bytes[o], bytes[o + 1], bytes[o + 2], bytes[o + 3]);
    const size = bytes[o + 4] | (bytes[o + 5] << 8) | (bytes[o + 6] << 16) | (bytes[o + 7] << 24);
    if (name === "EXIF") return true;
    if (size < 0) return false;
    o += 8 + size + (size % 2);
  }
  return false;
}

// Remove hidden metadata segments. JPEG and PNG are rewritten without them;
// WebP with EXIF is refused because safe in-place rewriting is unreliable.
export function stripImageMetadata(bytes: Uint8Array, type: SniffedImage): Uint8Array {
  if (type === "webp") {
    if (hasExifData(bytes, type)) throw new Error("IMAGE_METADATA_PRESENT");
    return bytes;
  }
  if (type === "jpeg") {
    const out: number[] = [0xff, 0xd8];
    let o = 2;
    while (o + 4 <= bytes.length && bytes[o] === 0xff) {
      const marker = bytes[o + 1];
      if (marker === 0xda) {
        for (let i = o; i < bytes.length; i++) out.push(bytes[i]);
        return Uint8Array.from(out);
      }
      if (marker === 0xd9) {
        out.push(0xff, 0xd9);
        return Uint8Array.from(out);
      }
      if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
        out.push(0xff, marker);
        o += 2;
        continue;
      }
      const size = (bytes[o + 2] << 8) | bytes[o + 3];
      if (size < 2 || o + 2 + size > bytes.length) throw new Error("IMAGE_UNREADABLE");
      const drop = (marker >= 0xe0 && marker <= 0xef) || marker === 0xfe;
      if (!drop) for (let i = o; i < o + 2 + size; i++) out.push(bytes[i]);
      o += 2 + size;
    }
    throw new Error("IMAGE_UNREADABLE");
  }
  const out: number[] = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  let o = 8;
  while (o + 12 <= bytes.length) {
    const size = (bytes[o] << 24) | (bytes[o + 1] << 16) | (bytes[o + 2] << 8) | bytes[o + 3];
    const name = String.fromCharCode(bytes[o + 4], bytes[o + 5], bytes[o + 6], bytes[o + 7]);
    if (size < 0 || o + 12 + size > bytes.length) throw new Error("IMAGE_UNREADABLE");
    if (name === "IHDR" || name === "PLTE" || name === "tRNS" || name === "IDAT" || name === "IEND")
      for (let i = o; i < o + 12 + size; i++) out.push(bytes[i]);
    o += 12 + size;
    if (name === "IEND") return Uint8Array.from(out);
  }
  throw new Error("IMAGE_UNREADABLE");
}

// Short signature of photo bytes so a rejected photo cannot be re-sent
// unchanged: the trader and buyer flows share this guard to save credits.
export function photoSignature(bytes: Uint8Array): string {
  return `${bytes.length}:${Array.from(bytes.slice(0, 8)).join(",")}`;
}
export function isRepeatRejection(signature: string, rejected: string | null): boolean {
  return rejected !== null && signature === rejected;
}
export function validateImageBytes(bytes: Uint8Array): { type: SniffedImage } {
  if (bytes.length > MAX_IMAGE_BYTES) throw new Error("IMAGE_TOO_LARGE");
  const type = sniffImageType(bytes);
  if (!type) throw new Error("IMAGE_TYPE_UNSUPPORTED");
  return { type };
}

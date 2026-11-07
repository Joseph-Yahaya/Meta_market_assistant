// Key and image gate: one tiny generated test image to the Meta API.
// Prints only pass/fail, whether image input is accepted, and the model.
// Never prints the key, the image bytes, or the full provider response.
//
// Usage: node --env-file-if-exists=.env.local scripts/check-image.mjs
// Env: MODEL_API_KEY (required), META_API_BASE_URL, META_TEXT_MODEL.
// The reference documents input_image blocks with base64 data URLs for
// muse-spark (checked 7 November 2026). No output-token cap parameter was
// found in the reference, so cost is bounded by a 32x32 image and a
// one-sentence prompt instead.
import { deflateSync } from "node:zlib";

const key = process.env.MODEL_API_KEY;
const base = (process.env.META_API_BASE_URL || "https://api.meta.ai/v1").replace(/\/$/, "");
const model = process.env.META_TEXT_MODEL || "muse-spark-1.3";
if (!key?.trim()) {
  console.error("FAIL: set MODEL_API_KEY first. No request was made.");
  process.exit(1);
}
if (new URL(base).origin !== "https://api.meta.ai") {
  console.error("FAIL: refusing unexpected API base URL. No request was made.");
  process.exit(1);
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();
function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, "ascii");
  data.copy(out, 8);
  const check = Buffer.alloc(4 + data.length);
  check.write(type, 0, "ascii");
  data.copy(check, 4);
  out.writeUInt32BE(crc32(check), 8 + data.length);
  return out;
}
// 32x32 generated test pattern: red left half, blue right half. No real data.
function testPng() {
  const w = 32, h = 32, row = 1 + w * 3, raw = Buffer.alloc(row * h);
  for (let y = 0; y < h; y++) {
    raw[y * row] = 0;
    for (let x = 0; x < w; x++) {
      const o = y * row + 1 + x * 3, left = x < w / 2;
      raw[o] = left ? 220 : 40;
      raw[o + 1] = left ? 40 : 80;
      raw[o + 2] = left ? 40 : 220;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}
function verifyPng(png) {
  if (png.length < 60 || png[0] !== 137 || png[1] !== 80 || png.toString("ascii", 12, 16) !== "IHDR") return false;
  let offset = 8;
  while (offset + 12 <= png.length) {
    const size = png.readUInt32BE(offset), type = png.toString("ascii", offset + 4, offset + 8);
    if (offset + 12 + size > png.length) return false;
    const check = Buffer.alloc(4 + size);
    check.write(type, 0, "ascii");
    png.subarray(offset + 8, offset + 8 + size).copy(check, 4);
    if (png.readUInt32BE(offset + 8 + size) !== crc32(check)) return false;
    offset += 12 + size;
    if (type === "IEND") return offset === png.length;
  }
  return false;
}

const png = testPng();
if (!verifyPng(png)) {
  console.error("FAIL: generated test image did not verify. No request was made.");
  process.exit(1);
}
try {
  const response = await fetch(`${base}/responses`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      input: [
        {
          type: "message",
          role: "user",
          content: [
            { type: "input_text", text: "What two colors fill the left and right halves of this test image? Reply in one short sentence." },
            { type: "input_image", image_url: `data:image/png;base64,${png.toString("base64")}` },
          ],
        },
      ],
    }),
    signal: AbortSignal.timeout(60000),
  });
  let data = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }
  if (!response.ok) {
    console.error(`FAIL: image input not accepted by ${model} (HTTP ${response.status}, ${data?.error?.code || data?.error?.type || "no code"}).`);
    process.exit(1);
  }
  if (data?.status && data.status !== "completed") {
    console.error(`FAIL: image input not accepted by ${model} (response ${data.status}).`);
    process.exit(1);
  }
  const text =
    data?.output_text ||
    data?.output
      ?.flatMap((item) => (item.type === "message" ? (item.content || []).filter((p) => p.type === "output_text").map((p) => p.text || "") : []))
      .join("");
  if (typeof text !== "string" || !text.trim()) {
    console.error(`FAIL: image input not accepted by ${model} (no description returned).`);
    process.exit(1);
  }
  console.log(`PASS: image input accepted by ${model} (description returned, ${text.trim().length} chars).`);
} catch (error) {
  console.error(`FAIL: image probe could not finish (${error?.name === "TimeoutError" ? "timeout" : "network error"}).`);
  process.exit(1);
}

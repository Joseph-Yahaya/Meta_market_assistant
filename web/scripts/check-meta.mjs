// Task 01 smoke check. Never prints keys, request headers or response bodies.
const apiKey = process.env.MODEL_API_KEY;
if (!apiKey?.trim()) {
  console.error("Meta check not run: set MODEL_API_KEY in web/.env.local first.");
  process.exit(1);
}
const base = process.env.META_API_BASE_URL || "https://api.meta.ai/v1";
const endpoint = new URL(`${base.replace(/\/$/, "")}/responses`);
if (endpoint.origin !== "https://api.meta.ai") {
  console.error("Meta check not run: URL must use https://api.meta.ai.");
  process.exit(1);
}
try {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: process.env.META_TEXT_MODEL || "muse-spark-1.3", input: "Reply with OK." }),
    signal: AbortSignal.timeout(30000),
  });
  if (!response.ok) {
    console.error(`Meta check failed: HTTP ${response.status}. Check access, credits and model selection in the Meta dashboard.`);
    process.exit(1);
  }
  const data = await response.json();
  const hasText = (typeof data.output_text === "string" && data.output_text.trim().length > 0)
    || data.output?.some((item) => item.type === "message" && item.content?.some((part) => part.type === "output_text" && part.text?.trim()));
  if (!hasText || (data.status && data.status !== "completed")) {
    console.error("Meta check returned no completed text response. Inspect the provider dashboard.");
    process.exit(1);
  }
  console.log("Meta text check passed. Voice quality and stock extraction need separate checks.");
} catch {
  console.error("Meta check could not finish. Check network access and try again.");
  process.exit(1);
}

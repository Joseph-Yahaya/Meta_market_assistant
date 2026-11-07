// Local-origin guard for maintainer scripts: hosted addresses must never
// be the default or an accident.
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);
export function isLocalOrigin(value: string): boolean {
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") return false;
    return LOCAL_HOSTS.has(url.hostname.toLowerCase());
  } catch {
    return false;
  }
}

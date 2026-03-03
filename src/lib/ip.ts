// ============================================================
// IP Detection Utility — Get public IP for device identification
// Used for same-device/different-browser detection (2.1)
// ============================================================

const IP_CACHE_KEY = "bb_client_ip";

/** Fetch public IP (cached in sessionStorage for the browser session) */
export async function getPublicIP(): Promise<string> {
  const cached = sessionStorage.getItem(IP_CACHE_KEY);
  if (cached) return cached;

  try {
    const res = await fetch("https://api.ipify.org?format=json", {
      signal: AbortSignal.timeout(5000),
    });
    const data = await res.json();
    const ip = data.ip as string;
    if (ip) sessionStorage.setItem(IP_CACHE_KEY, ip);
    return ip ?? "";
  } catch {
    // Fallback: empty string (IP detection failed)
    return "";
  }
}

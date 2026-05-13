"use server";

export async function fetchRobotsTxt(domain: string): Promise<{
  content: string | null;
  url: string;
  error: string | null;
}> {
  const url = `https://${domain}/robots.txt`;
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(15000),
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
        "Accept": "text/plain, */*",
      },
      cache: "no-store",
    });
    if (!res.ok) {
      return { content: null, url, error: `HTTP ${res.status} — could not load robots.txt` };
    }
    const text = await res.text();
    if (!text.trim()) {
      return { content: null, url, error: "robots.txt is empty" };
    }
    return { content: text, url, error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return { content: null, url, error: message };
  }
}

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({
      ok: false,
      error: "Method not allowed",
    });
  }

  const url = "https://api.opet.com.tr/api/fuelprices/provinces";

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
        "Accept-Language": "tr-TR",
        Channel: "Web",
        Origin: "https://www.opet.com.tr",
        Referer: "https://www.opet.com.tr/",
      },
      signal: controller.signal,
    });

    clearTimeout(timer);

    const text = await response.text();

    return res.status(response.ok ? 200 : 502).json({
      ok: response.ok,
      upstreamStatus: response.status,
      upstreamBytes: text.length,
      source: "api.opet.com.tr",
    });
  } catch (error) {
    return res.status(502).json({
      ok: false,
      source: "api.opet.com.tr",
      error: error?.message || String(error),
      cause: error?.cause?.message || null,
    });
  }
};
export default async function handler(req, res) {
    // CORS
    if (req.method === "OPTIONS") {
        res.setHeader("Access-Control-Allow-Origin", "*");
        res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
        res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
        return res.status(204).end();
    }

    if (req.method !== "POST") {
        return res.status(405).json({ error: "Method not allowed" });
    }

    try {
        const upstream = await fetch(
            "https://tms.odaklojistik.com.tr/api/tmsdespatchincomeexpenses/addincome",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    // Frontend’den gelen Authorization header’ýný aynen iletelim
                    Authorization: req.headers.authorization || "",
                },
                body: JSON.stringify(req.body),
            }
        );

        const text = await upstream.text();
        res.setHeader("Access-Control-Allow-Origin", "*");
        res.status(upstream.status).send(text);
    } catch (e) {
        res.status(502).json({ error: "Upstream error", detail: String(e) });
    }
}

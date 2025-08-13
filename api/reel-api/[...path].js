export default async function handler(req, res) {
    const { path = [] } = req.query; // ör: ["tmsdespatchincomeexpenses","addincome"]
    const url = "https://tms.odaklojistik.com.tr/api/" + path.join("/");

    // CORS (preflight)
    if (req.method === "OPTIONS") {
        res.setHeader("Access-Control-Allow-Origin", "*");
        res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
        res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
        return res.status(204).end();
    }

    // Güvenli baþlýklarý ileri taþý
    const headers = new Headers();
    if (req.headers["authorization"]) headers.set("authorization", req.headers["authorization"]);
    if (req.headers["content-type"]) headers.set("content-type", req.headers["content-type"]);

    // Body hazýrlýðý (JSON dýþý içerikleri bozma)
    let body;
    if (!["GET", "HEAD"].includes(req.method)) {
        if (req.headers["content-type"]?.includes("application/json")) {
            body = JSON.stringify(req.body ?? {});
        } else {
            body = req.body; // raw/form-data vs.
        }
    }

    const init = { method: req.method, headers, body };

    try {
        const upstream = await fetch(url, init);
        const text = await upstream.text();
        const ct = upstream.headers.get("content-type") || "application/json";

        // CORS baþlýklarý her yanýtta
        res.setHeader("Access-Control-Allow-Origin", "*");
        res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
        res.setHeader("Content-Type", ct);

        res.status(upstream.status).send(text);
    } catch (e) {
        res.setHeader("Access-Control-Allow-Origin", "*");
        res.status(502).json({ error: "Upstream error", detail: String(e) });
    }
}

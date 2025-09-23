export default async function handler(req, res) {

    if (req.method === "OPTIONS") {
        res.setHeader("Access-Control-Allow-Origin", "*");
        res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
        res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
        return res.status(204).end();
    }


    const parts = Array.isArray(req.query.slug) ? req.query.slug : [];


    if (parts.length === 1 && parts[0] === "_health") {
        res.setHeader("Access-Control-Allow-Origin", "*");
        return res.status(200).json({ ok: true });
    }

    const upstreamUrl = "https://tms.odaklojistik.com.tr/api/" + parts.join("/");
    const headers = new Headers();
    if (req.headers["authorization"]) headers.set("authorization", req.headers["authorization"]);
    if (req.headers["content-type"]) headers.set("content-type", req.headers["content-type"]);

    const init = {
        method: req.method,
        headers,
        body: /^(GET|HEAD)$/i.test(req.method) ? undefined : JSON.stringify(req.body ?? {}),
    };

    try {
        const upstream = await fetch(upstreamUrl, init);
        const text = await upstream.text();

        res.setHeader("Access-Control-Allow-Origin", "*");
        res.setHeader("Content-Type", upstream.headers.get("content-type") || "application/json; charset=utf-8");

        res.status(upstream.status).send(text);
    } catch (e) {
        res.status(502).json({ error: "Upstream error", detail: String(e) });
    }
}

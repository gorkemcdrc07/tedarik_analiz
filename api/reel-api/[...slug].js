export default async function handler(req, res) {
    // CORS preflight
    if (req.method === "OPTIONS") {
        res.setHeader("Access-Control-Allow-Origin", "*");
        res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
        res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
        return res.status(204).end();
    }

    // Saðlýk kontrolü (kolay test)
    const slug = Array.isArray(req.query.slug)
        ? req.query.slug
        : (req.query.slug ? [req.query.slug] : []);
    if (slug[0] === "__health") {
        res.setHeader("Access-Control-Allow-Origin", "*");
        return res.status(200).send("ok");
    }

    const url = "https://tms.odaklojistik.com.tr/api/" + slug.join("/");

    const headers = new Headers();
    if (req.headers["authorization"]) headers.set("authorization", req.headers["authorization"]);
    if (req.headers["content-type"]) headers.set("content-type", req.headers["content-type"]);

    const init = {
        method: req.method,
        headers,
        body: ["GET", "HEAD"].includes(req.method) ? undefined : JSON.stringify(req.body ?? {}),
    };

    try {
        const upstream = await fetch(url, init);
        const text = await upstream.text();
        res.setHeader("Access-Control-Allow-Origin", "*");
        res.status(upstream.status).send(text);
    } catch (e) {
        res.status(502).json({ error: "Upstream error", detail: String(e) });
    }
}

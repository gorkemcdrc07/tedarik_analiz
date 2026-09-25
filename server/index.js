const express = require("express");
const fetch = require("node-fetch");
const cors = require("cors");
const path = require("path");
// .env dosyasÄ±nÄ± process.cwd() yerine doÄŸrudan server klasÃ¶rÃ¼nden yÃ¼kle.
// BÃ¶ylece `npm --prefix server start` ve farklÄ± Ã§alÄ±ÅŸma dizinlerinde aynÄ± davranÄ±r.
const envPath = path.resolve(__dirname, ".env");
require("dotenv").config({ path: envPath, override: true });

const app = express();
app.use(cors({
  origin: function (origin, callback) {
    const allowedOrigins = [
      "http://localhost:3000",
      "http://127.0.0.1:3000",
      process.env.FRONTEND_URL
    ].filter(Boolean);

    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    return callback(new Error("CORS tarafindan izin verilmeyen origin."));
  },
  credentials: true
}));
app.use(express.json());

// GÃ¼venli giriÅŸ: kullanÄ±cÄ± adÄ±/ÅŸifre + e-posta OTP
require("./auth2fa").install(app);

const PORT = process.env.PORT || 5000;
console.log(`ğŸ” Supabase env: URL=${Boolean(process.env.SUPABASE_URL)} KEY=${Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY)}`);

// ===============================
// 1) TMS PROD / ADD EXPENSE
// ===============================
app.post("/api/reel-api/tmsdespatchincomeexpenses/addexpense", async (req, res) => {
    try {
        const upstream = await fetch(
            "https://tms.odaklojistik.com.tr/api/tmsdespatchincomeexpenses/addexpense",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: req.headers.authorization || "",
                },
                body: JSON.stringify(req.body),
            }
        );

        const text = await upstream.text();
        res.status(upstream.status).send(text);
    } catch (err) {
        res.status(500).json({ error: "Proxy error", detail: err.message });
    }
});

// ===============================
// 2) TMS PROD / ADD INCOME
// ===============================
app.post("/api/reel-api/tmsdespatchincomeexpenses/addincome", async (req, res) => {
    try {
        const upstream = await fetch(
            "https://tms.odaklojistik.com.tr/api/tmsdespatchincomeexpenses/addincome",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: req.headers.authorization || "",
                },
                body: JSON.stringify(req.body),
            }
        );

        const text = await upstream.text();
        res.status(upstream.status).send(text);
    } catch (err) {
        res.status(500).json({ error: "Proxy error", detail: err.message });
    }
});

// ===============================
// 3) TMS PROD / ADD ORDER  âœ… YENÄ°
// ===============================
app.post("/api/reel-api/tmsorders/add", async (req, res) => {
    try {
        const upstream = await fetch(
            "https://tms.odaklojistik.com.tr/api/tmsorders/add",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: req.headers.authorization || "",
                },
                body: JSON.stringify(req.body),
            }
        );

        const text = await upstream.text();
        res.status(upstream.status).send(text);
    } catch (err) {
        res.status(500).json({ error: "Order proxy error", detail: err.message });
    }
});

// ===============================
// 4) TMS AUTH LOGIN (PROD)
// ===============================
app.post("/reel-auth/api/auth/login", async (req, res) => {
    try {
        const upstream = await fetch("https://tms.odaklojistik.com.tr/api/auth/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(req.body ?? {}),
        });

        const text = await upstream.text();
        res.status(upstream.status).send(text);
    } catch (err) {
        res.status(500).json({ error: "Auth proxy error", detail: err.message });
    }
});


// ===============================
// 5) PETROL OFISI / FUEL PRICE CHECK
// ===============================
const trAscii = (value = "") => String(value)
    .trim()
    .toLocaleUpperCase("tr-TR")
    .replace(/Ä°/g, "I").replace(/IÌ‡/g, "I")
    .replace(/Å/g, "S").replace(/Ä/g, "G")
    .replace(/Ãœ/g, "U").replace(/Ã–/g, "O").replace(/Ã‡/g, "C")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "");

const citySlug = (value = "") => trAscii(value)
    .toLocaleLowerCase("en-US")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const decodeHtml = (value = "") => String(value)
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&ccedil;/gi, "Ã§").replace(/&Ccedil;/gi, "Ã‡")
    .replace(/&ouml;/gi, "Ã¶").replace(/&Ouml;/gi, "Ã–")
    .replace(/&uuml;/gi, "Ã¼").replace(/&Uuml;/gi, "Ãœ")
    .replace(/&#287;/g, "ÄŸ").replace(/&#286;/g, "Ä")
    .replace(/&#351;/g, "ÅŸ").replace(/&#350;/g, "Å")
    .replace(/&#305;/g, "Ä±").replace(/&#304;/g, "Ä°");

const textOnly = (html = "") => decodeHtml(html)
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const firstPrice = (value = "") => {
    const m = String(value).match(/(\d{1,3}(?:[.,]\d{1,2}))/);
    return m ? Number(m[1].replace(",", ".")) : NaN;
};

function parsePetrolOfisiPrice(html, district, fuel, city = "", vatIncluded = true) {
    const wantedDistrict = trAscii(district);
    // Petrol Ofisi bazÄ± illerde merkez satÄ±rÄ±nÄ± "MERKEZ" yerine doÄŸrudan il adÄ±yla yayÄ±mlÄ±yor.
    // Ã–rn: EskiÅŸehir merkez = ESKISEHIR, Adana merkez = ADANA.
    const acceptedDistricts = new Set([wantedDistrict]);
    if (wantedDistrict === "MERKEZ" && city) acceptedDistricts.add(trAscii(city));
    const rows = [...html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)];
    for (const row of rows) {
        const cells = [...row[1].matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)].map(m => textOnly(m[1]));
        if (cells.length < 4 || !acceptedDistricts.has(trAscii(cells[0]))) continue;
        const index = fuel === "Benzin" ? 1 : fuel === "Motorin" ? 2 : fuel === "LPG" ? 6 : -1;
        if (index < 0 || !cells[index]) throw new Error(`Desteklenmeyen yakÄ±t tÃ¼rÃ¼: ${fuel}`);
        const matches = String(cells[index]).match(/\d{1,3}(?:[.,]\d{1,2})/g) || [];
        // Petrol Ofisi hÃ¼cresinde ilk deÄŸer KDV dahil, ikinci deÄŸer +KDV (KDV hariÃ§) olarak yayÄ±nlanÄ±r.
        // BÄ°M sÃ¶zleÅŸmesi iÃ§in "KDV dahil fiyatlar gÃ¶sterilsin" kapalÄ± olduÄŸundan ikinci deÄŸer kullanÄ±lÄ±r.
        const grossRaw = matches[0];
        const grossPrice = grossRaw ? Number(grossRaw.replace(",", ".")) : NaN;
        // KDV kapalÄ± gÃ¶rÃ¼nÃ¼mde PO'nun +KDV (net) deÄŸeri kullanÄ±lÄ±r. BazÄ± upstream HTML
        // cevaplarÄ±nda ikinci deÄŸer gizli/dinamik geldiÄŸi iÃ§in tek deÄŸer gÃ¶rÃ¼lÃ¼rse brÃ¼t fiyatÄ±
        // %20 KDV'den arÄ±ndÄ±rÄ±p PO ekranÄ±ndaki kuruÅŸ yukarÄ± yuvarlama davranÄ±ÅŸÄ±yla Ã¼retiriz.
        const netFromGross = Number.isFinite(grossPrice) ? Math.ceil((grossPrice / 1.20) * 100 - 1e-9) / 100 : NaN;
        const raw = (!vatIncluded && matches.length > 1) ? matches[matches.length - 1] : grossRaw;
        const parsed = raw ? Number(raw.replace(",", ".")) : NaN;
        const price = !vatIncluded && matches.length === 1 ? netFromGross : parsed;
        if (!Number.isFinite(price)) throw new Error(`${district} iÃ§in ${fuel} fiyatÄ± ayrÄ±ÅŸtÄ±rÄ±lamadÄ±.`);
        return price;
    }
    throw new Error(`${district} ilÃ§esi Petrol Ofisi fiyat tablosunda bulunamadÄ±.`);
}

function shellProductCode(data, fuel) {
    const products = Array.isArray(data?.products) ? data.products : [];
    const wanted = fuel === "Motorin" ? ["vp diesel", "v-power diesel", "motorin", "diesel"]
        : fuel === "Benzin" ? ["v-power", "k.benzin", "benzin", "95 oktan"]
        : ["lpg", "autogas", "otogaz"];

    const product = products.find((p) => {
        const text = trAscii(`${p?.fepProductName || ""} ${p?.webProductName || ""} ${p?.genProductName || ""}`);
        return wanted.some((name) => text.includes(trAscii(name)));
    });
    if (!product?.fepProductCode) {
        throw new Error(`Shell Ã¼rÃ¼n kodu bulunamadÄ±: ${fuel}`);
    }
    return String(product.fepProductCode);
}

function parseShellApiPrice(data, city, district, fuel) {
    const groups = Array.isArray(data?.groups) ? data.groups : [];
    const wantedCity = trAscii(city);
    const wantedDistrict = trAscii(district);
    const cityNode = groups.find((g) => trAscii(g?.cityName || "") === wantedCity);
    if (!cityNode) throw new Error(`Shell resmi API yanÄ±tÄ±nda ${city} ili bulunamadÄ±.`);

    const counties = Array.isArray(cityNode.counties) ? cityNode.counties : [];
    const county = counties.find((c) => trAscii(c?.countyName || "") === wantedDistrict);
    if (!county) throw new Error(`Shell resmi API yanÄ±tÄ±nda ${city} / ${district} ilÃ§esi bulunamadÄ±.`);

    const productCode = shellProductCode(data, fuel);
    const prices = county.prices || {};
    let rawPrice = prices[productCode];
    if (rawPrice == null) {
        const normalizedCode = productCode.trim();
        const key = Object.keys(prices).find((k) => String(k).trim() === normalizedCode);
        if (key) rawPrice = prices[key];
    }
    const price = Number(rawPrice);
    if (!Number.isFinite(price)) {
        throw new Error(`Shell resmi API yanÄ±tÄ±nda ${city} / ${district} / ${fuel} fiyatÄ± bulunamadÄ±.`);
    }
    return price;
}

async function fetchShellPrice(city, district, fuel) {
    const url = "https://pompafiyat.turkiyeshell.com/api/Public/prices";
    const upstream = await fetch(url, {
        headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/153 Safari/537.36",
            "Accept": "application/json, text/plain, */*",
            "Accept-Language": "tr-TR,tr;q=0.9,en;q=0.7",
            "Referer": "https://pompafiyat.turkiyeshell.com/prices",
            "Origin": "https://pompafiyat.turkiyeshell.com"
        },
        redirect: "follow"
    });
    const raw = await upstream.text();
    if (!upstream.ok) throw new Error(`Shell resmi fiyat API'si HTTP ${upstream.status} dÃ¶ndÃ¼rdÃ¼.`);
    let data;
    try { data = JSON.parse(raw); }
    catch (_) { throw new Error("Shell resmi fiyat API'si JSON dÃ¶ndÃ¼rmedi."); }
    const price = parseShellApiPrice(data, city, district, fuel);
    return { price, sourceUrl: url };
}

app.get("/api/fuel-check", async (req, res) => {
    res.set("Cache-Control", "no-store");
    try {
        const provider = String(req.query.provider || "");
        const city = String(req.query.city || "").trim();
        const district = String(req.query.district || "").trim();
        const fuel = String(req.query.fuel || "Motorin").trim();
        const vatIncluded = String(req.query.vatIncluded ?? "true").toLowerCase() !== "false";
        if (!city || !district) return res.status(400).json({ ok: false, error: "Ä°l ve ilÃ§e zorunludur." });

        let sourceUrl, price, providerName, sourceLabel;
        if (provider === "petrol-ofisi") {
            const slug = citySlug(city);
            sourceUrl = `https://www.petrolofisi.com.tr/akaryakit-fiyatlari/${slug}-akaryakit-fiyatlari`;
            providerName = "Petrol Ofisi";
            sourceLabel = "Petrol Ofisi resmi fiyat sayfasÄ±";
        } else if (provider === "shell") {
            sourceUrl = "https://www.shell.com.tr/suruculer/shell-yakitlari/akaryakit-pompa-satis-fiyatlari.html";
            providerName = "Shell";
            sourceLabel = "Shell resmi pompa fiyat API'si";
        } else {
            return res.status(400).json({ ok: false, error: "Bilinmeyen akaryakÄ±t saÄŸlayÄ±cÄ±sÄ±." });
        }

        if (provider === "shell") {
            const shellResult = await fetchShellPrice(city, district, fuel);
            price = shellResult.price;
            sourceUrl = shellResult.sourceUrl;
        } else {
            const upstream = await fetch(sourceUrl, {
                headers: {
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131 Safari/537.36",
                    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                    "Accept-Language": "tr-TR,tr;q=0.9,en;q=0.7",
                },
                redirect: "follow",
            });
            const html = await upstream.text();
            if (!upstream.ok) throw new Error(`${providerName} fiyat sayfasÄ± HTTP ${upstream.status} dÃ¶ndÃ¼rdÃ¼.`);
            price = parsePetrolOfisiPrice(html, district, fuel, city, vatIncluded);
        }
        return res.json({ ok: true, provider: providerName, city, district, fuel, price, vatIncluded: provider === "petrol-ofisi" ? vatIncluded : null, priceMode: provider === "petrol-ofisi" ? (vatIncluded ? "KDV dahil" : "KDV hariÃ§ (+KDV)") : "Pompa fiyatÄ±", sourceUrl, sourceLabel, checkedAt: new Date().toISOString() });
    } catch (err) {
        console.error("[fuel-check]", err);
        return res.status(502).json({ ok: false, error: err.message || "Fiyat kontrolÃ¼ baÅŸarÄ±sÄ±z." });
    }
});


// ===============================
// 6) MERKEZI YAKIT OTOMASYONU V5
// ===============================
const { installFuelAutomation } = require("./fuelAutomation");
async function getAutomationFuelPrice(ref) {
    if (ref.provider === "Shell") return (await fetchShellPrice(ref.city, ref.district, ref.fuel)).price;
    const url = `https://www.petrolofisi.com.tr/akaryakit-fiyatlari/${citySlug(ref.city)}-akaryakit-fiyatlari`;
    const upstream = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0", "Accept": "text/html", "Accept-Language": "tr-TR,tr;q=0.9" }, redirect: "follow" });
    const html = await upstream.text();
    if (!upstream.ok) throw new Error(`Petrol Ofisi HTTP ${upstream.status}`);
    // BÄ°M iÃ§in Supabase'teki eski kural kaydÄ±nda vatIncluded alanÄ± olmasa bile
    // sÃ¶zleÅŸme gereÄŸi KDV dahil seÃ§eneÄŸi HER ZAMAN kapalÄ±dÄ±r.
    const isBim = String(ref.customer || "").trim().toLocaleUpperCase("tr-TR") === "BÄ°M" || String(ref.customer || "").trim().toUpperCase() === "BIM";
    const vatIncluded = isBim ? false : ref.vatIncluded !== false;
    return parsePetrolOfisiPrice(html, ref.district, ref.fuel, ref.city, vatIncluded);
}
installFuelAutomation(app, getAutomationFuelPrice);

// API isteklerinde HTML 404 yerine her zaman JSON dÃ¶ndÃ¼r.
app.use('/api', (req, res) => {
    res.status(404).json({ error: 'API endpoint bulunamadÄ±.', path: req.originalUrl });
});

app.listen(PORT, () => {
    console.log(`ğŸš€ Backend Ã§alÄ±ÅŸÄ±yor: http://localhost:${PORT}`);
});

// src/auth/tokenManager.js
const STORAGE_KEY = "reel_api_token_v1";
const SKEW_MS = 60 * 1000; // token bitmeden 60 sn önce yenile
let current = null;        // { token, exp }
let refreshInFlight = null;
let timerId = null;

/**
 * ✅ Local (CRA + setupProxy) vs Prod (Vercel API Route)
 * Local:  http://localhost:3000/reel-auth/api/auth/login  (setupProxy)
 * Prod:   https://domainin.com/api/reel-auth/login       (Vercel API route)
 */
const TOKEN_URL =
    process.env.NODE_ENV === "production"
        ? "/api/reel-auth/login"
        : "/reel-auth/api/auth/login";

// ------------------------
// Yardımcılar
// ------------------------
const safeParse = (s, fallback = null) => {
    try { return JSON.parse(s); } catch { return fallback; }
};

function getReelCreds() {
    const userFromLS = localStorage.getItem("Reel_kullanici") || "";
    const passFromLS = localStorage.getItem("Reel_sifre") || "";
    if (userFromLS && passFromLS) return { userName: userFromLS, password: passFromLS };

    const kullanici = safeParse(localStorage.getItem("kullanici") || "{}", {});
    const userName =
        kullanici?.Reel_kullanici ??
        kullanici?.reel_kullanici ?? "";
    const password =
        kullanici?.Reel_sifre ??
        kullanici?.reel_sifre ?? "";
    return { userName, password };
}

function loadFromStorage() {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const obj = safeParse(raw);
    if (obj?.token && obj?.exp && obj.exp > Date.now()) {
        current = obj;
        console.log("%c[REEL] Mevcut token storage’dan kullanılıyor.", "color:#3b82f6");
        scheduleRefresh();
    } else {
        sessionStorage.removeItem(STORAGE_KEY);
    }
}

function saveToStorage(obj) {
    if (!obj) { sessionStorage.removeItem(STORAGE_KEY); return; }
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(obj));
}

function scheduleRefresh() {
    if (timerId) clearTimeout(timerId);
    if (!current?.exp) return;
    const delay = Math.max(current.exp - Date.now() - SKEW_MS, 5_000);
    timerId = setTimeout(() => { refreshToken().catch(() => { }); }, delay);
}

// Sunucu yanıtından token + ttl çek
function extractTokenAndTtl(responseJson) {
    const d = responseJson || {};
    const nested = d.data || {};

    const token =
        d.token || d.access_token || d.accessToken ||
        nested.token || nested.access_token || nested.accessToken;

    const ttlSec =
        d.expires_in ?? d.expiresIn ??
        nested.expires_in ?? nested.expiresIn ?? 300;

    return { token, ttlSec: Number(ttlSec) };
}

// ------------------------
// Token alma / yenileme
// ------------------------
async function requestNewToken() {
    const { userName, password } = getReelCreds();
    if (!userName || !password) throw new Error("REEL kullanıcı bilgileri bulunamadı (localStorage).");

    let res;
    try {
        res = await fetch(TOKEN_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userName, password }),
        });
    } catch (err) {
        throw new Error("Login isteği atılamadı (ağ/SSL): " + String(err));
    }

    if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`Token alınamadı (${res.status}) ${text}`);
    }

    const data = await res.json().catch(() => ({}));
    const { token, ttlSec } = extractTokenAndTtl(data);
    if (!token) throw new Error("Yanıt içinde token bulunamadı.");

    const exp = Date.now() + (Number.isFinite(ttlSec) ? ttlSec * 1000 : 300_000);
    current = { token, exp };
    saveToStorage(current);
    scheduleRefresh();

    if (process.env.NODE_ENV !== "production") {
        console.log("%c[REEL] Yeni token alındı:", "color:#10b981", token);
    }
    return token;
}

export async function refreshToken() {
    if (refreshInFlight) return refreshInFlight;
    refreshInFlight = requestNewToken().finally(() => { refreshInFlight = null; });
    return refreshInFlight;
}

export async function getToken() {
    if (!current) loadFromStorage();
    if (current && Date.now() < current.exp - SKEW_MS) return current.token;
    return refreshToken();
}

export function invalidateToken() {
    current = null;
    saveToStorage(null);
    if (timerId) clearTimeout(timerId);
    timerId = null;
}

// ------------------------
// Yetkili istek yardımcıları
// ------------------------
export async function authorizedFetch(input, init = {}) {
    const t = await getToken();
    const headers = new Headers(init.headers || {});
    headers.set("Authorization", `Bearer ${t}`);

    let res = await fetch(input, { ...init, headers });

    if (res.status === 401) {
        console.warn("%c[REEL] 401 alındı, token yenileniyor…", "color:#f59e0b");
        await refreshToken();
        const t2 = await getToken();
        headers.set("Authorization", `Bearer ${t2}`);
        res = await fetch(input, { ...init, headers });
    }
    return res;
}

export async function authorizedJson(url, method, bodyObj) {
    const res = await authorizedFetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: bodyObj === undefined ? undefined : JSON.stringify(bodyObj),
    });
    const text = await res.text();
    let json;
    try { json = JSON.parse(text); } catch { json = { raw: text }; }
    if (!res.ok) {
        const msg = (json && (json.message || json.error)) || text || "İstek başarısız";
        throw new Error(`${res.status}: ${msg}`);
    }
    return json;
}

export async function debugLogToken() {
    const t = await getToken();
    console.log("%c[REEL] Aktif token:", "color:#a855f7", t);
    return t;
}

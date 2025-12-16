// src/tokenManager.js
// --------------------------------------------------------------
// TMS API ile uyumlu token yönetimi
// REEL token sistemi kaldırıldı.
// Artık token tamamen TMS login endpoint'inden alınıyor.
// --------------------------------------------------------------

const STORAGE_KEY = "tms_api_token_v1";
const SKEW_MS = 60 * 1000; // Token 1 dk kala yenilensin
let current = null;
let refreshInFlight = null;
let timerId = null;

// 🎯 TMS TOKEN ENDPOINT — DOĞRU OLAN BU!
const TOKEN_URL = "/reel-auth/api/auth/login";

console.log("[TMS] TOKEN_URL:", TOKEN_URL);

// Yardımcılar
const safeParse = (s, fallback = null) => {
    try { return JSON.parse(s); } catch { return fallback; }
};

// LocalStorage'dan kullanıcı adı/şifreyi alır
function getUserCredentials() {
    const u = localStorage.getItem("Reel_kullanici") || "";
    const p = localStorage.getItem("Reel_sifre") || "";

    if (!u || !p) {
        throw new Error("Kullanıcı bilgileri LocalStorage'da bulunamadı.");
    }
    return { userName: u, password: p };
}

// Storage'dan token yükle
function loadFromStorage() {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return;

    const obj = safeParse(raw);
    if (obj?.token && obj?.exp > Date.now()) {
        current = obj;
        console.log("%c[TMS] Geçerli token storage'dan kullanılıyor.", "color:#3b82f6");
        scheduleRefresh();
    } else {
        sessionStorage.removeItem(STORAGE_KEY);
    }
}

// Token storage'a kaydet
function saveToStorage(obj) {
    if (!obj) {
        sessionStorage.removeItem(STORAGE_KEY);
        return;
    }
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(obj));
}

// Token yenileme zamanlayıcısı
function scheduleRefresh() {
    if (timerId) clearTimeout(timerId);
    if (!current?.exp) return;

    const delay = Math.max(current.exp - Date.now() - SKEW_MS, 5000);
    timerId = setTimeout(() => {
        refreshToken().catch(() => { });
    }, delay);
}

// Token alma
async function requestNewToken() {
    const { userName, password } = getUserCredentials();

    let res;
    try {
        res = await fetch(TOKEN_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userName, password })
        });
    } catch (e) {
        throw new Error("TMS login isteği başarısız: " + e);
    }

    if (!res.ok) {
        const t = await res.text().catch(() => "");
        throw new Error(`TMS token alınamadı (${res.status}) ${t}`);
    }

    const data = await res.json().catch(() => ({}));

    const token = data?.token || data?.access_token || data?.accessToken;
    const ttlSec = data?.expires_in || data?.expiresIn || 300;

    if (!token) {
        throw new Error("TMS login yanıtında token bulunamadı.");
    }

    const exp = Date.now() + ttlSec * 1000;
    current = { token, exp };
    saveToStorage(current);
    scheduleRefresh();

    console.log("%c[TMS] Yeni token alındı:", "color:#10b981", token);
    return token;
}

export async function refreshToken() {
    if (refreshInFlight) return refreshInFlight;
    refreshInFlight = requestNewToken().finally(() => refreshInFlight = null);
    return refreshInFlight;
}

// Geçerli token'ı getir
export async function getToken() {
    if (!current) loadFromStorage();
    if (current && Date.now() < current.exp - SKEW_MS) return current.token;
    return refreshToken();
}

// Token sıfırlama
export function invalidateToken() {
    current = null;
    saveToStorage(null);
    if (timerId) clearTimeout(timerId);
    timerId = null;
}

// ------------- AUTHORIZED FETCH -----------------

export async function authorizedFetch(url, init = {}) {
    const token = await getToken();

    const headers = new Headers(init.headers || {});
    headers.set("Authorization", `Bearer ${token}`);

    let res = await fetch(url, { ...init, headers });

    // Token süresi dolarsa yeniden dene
    if (res.status === 401) {
        console.warn("%c[TMS] 401 → Token yenileniyor…", "color:#f59e0b");

        await refreshToken();
        const token2 = await getToken();

        headers.set("Authorization", `Bearer ${token2}`);
        res = await fetch(url, { ...init, headers });
    }

    return res;
}

// JSON dönen istek
export async function authorizedJson(url, method = "GET", bodyObj = undefined) {
    const res = await authorizedFetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: bodyObj !== undefined ? JSON.stringify(bodyObj) : undefined,
    });

    const text = await res.text();
    let json;
    try { json = JSON.parse(text); } catch { json = { raw: text }; }

    if (!res.ok) {
        const msg = json?.message || json?.error || text;
        throw new Error(`${res.status}: ${msg}`);
    }

    return json;
}

// Debug için mevcut token'ı yazdır
export async function debugLogToken() {
    const t = await getToken();
    console.log("%c[TMS] Aktif token:", "color:#a855f7", t);
    return t;
}

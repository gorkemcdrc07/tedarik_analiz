const TMS_AUTH_URL =
    "https://tedarik-analiz-backend.onrender.com/reel-auth/api/auth/login";

export async function getTmsToken() {
    const res = await fetch(TMS_AUTH_URL, {
        method: "POST",
        credentials: "include",
        headers: {
            "Content-Type": "application/json",
        },
    });

    const text = await res.text();

    if (!res.ok) {
        throw new Error(`Token hatas?: ${res.status} - ${text}`);
    }

    const data = JSON.parse(text);
    return data.token || data.accessToken || data;
}

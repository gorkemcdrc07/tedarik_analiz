export async function getTmsToken() {
    const res = await fetch(process.env.REACT_APP_TMS_AUTH_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            userName: "Müsteri",
            password: "013777+-?.1905+3+0",
        }),
    });

    const text = await res.text();

    if (!res.ok) {
        throw new Error(`Token hatası: ${res.status} - ${text}`);
    }

    const data = JSON.parse(text);
    return data.token || data.accessToken || data;
}
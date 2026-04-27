export async function getTmsToken() {
    const res = await fetch("http://localhost:5000/reel-auth/api/auth/login", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            userName: "Müsteri",
            password: "013777+-?.1905+3+0",
        }),
    });

    if (!res.ok) {
        const text = await res.text();
        throw new Error(`Token hatası: ${res.status} - ${text}`);
    }

    const data = await res.json();

    return data.token || data.accessToken || data;
}
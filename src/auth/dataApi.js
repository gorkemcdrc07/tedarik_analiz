const API_BASE = String(
    process.env.REACT_APP_API_BASE_URL || ""
).replace(/\/+$/, "");

async function request(path, options = {}) {
    const response = await fetch(
        `${API_BASE}/api/data${path}`,
        {
            ...options,
            credentials: "include",
            cache: "no-store",
            headers: {
                Accept: "application/json",
                ...(options.body
                    ? { "Content-Type": "application/json" }
                    : {}),
                ...(options.headers || {}),
            },
        }
    );

    let body = null;

    try {
        body = await response.json();
    } catch {
        body = null;
    }

    if (!response.ok) {
        const error = new Error(
            body?.error ||
            `API isteği başarısız (${response.status})`
        );

        error.status = response.status;
        throw error;
    }

    return body;
}

export async function getFirmalar() {
    const result = await request("/firmalar");

    return Array.isArray(result?.data)
        ? result.data
        : [];
}

export async function getHesapAdlari() {
    const result = await request("/hesap-adlari");

    return Array.isArray(result?.data)
        ? result.data
        : [];
}

export async function getProjeOptions() {
    const result = await request(
        "/projeler/options"
    );

    return Array.isArray(result?.data)
        ? result.data
        : [];
}
export async function getProjeler() {
    const result = await request("/projeler");

    return Array.isArray(result?.data)
        ? result.data
        : [];
}

export async function createProje(payload) {
    const result = await request(
        "/projeler",
        {
            method: "POST",
            body: JSON.stringify(payload),
        }
    );

    return result?.data ?? null;
}

export async function updateProje(id, payload) {
    const safeId = encodeURIComponent(
        String(id)
    );

    const result = await request(
        `/projeler/${safeId}`,
        {
            method: "PATCH",
            body: JSON.stringify(payload),
        }
    );

    return result?.data ?? null;
}

export async function deleteProje(id) {
    const safeId = encodeURIComponent(
        String(id)
    );

    return request(
        `/projeler/${safeId}`,
        {
            method: "DELETE",
        }
    );
}

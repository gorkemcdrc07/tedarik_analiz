const API_BASE = String(
    process.env.REACT_APP_API_BASE_URL || "https://tedarik-analiz-backend.onrender.com"
).replace(/\/+$/, "");

async function adminRequest(path = "", options = {}) {
    if (!API_BASE) {
        throw new Error("Backend API adresi tanimli degil.");
    }

    const response = await fetch(
        `${API_BASE}/api/admin/users${path}`,
        {
            credentials: "include",
            cache: "no-store",
            ...options,
            headers: {
                Accept: "application/json",
                ...(options.body
                    ? { "Content-Type": "application/json" }
                    : {}),
                ...(options.headers || {}),
            },
        }
    );

    const raw = await response.text();
    let data = {};

    if (raw) {
        try {
            data = JSON.parse(raw);
        } catch {
            data = {};
        }
    }

    if (!response.ok) {
        const error = new Error(
            data?.error || `HTTP ${response.status}`
        );

        error.status = response.status;
        error.data = data;

        throw error;
    }

    return data;
}

export async function getAdminUsers() {
    const data = await adminRequest("", {
        method: "GET",
    });

    return Array.isArray(data?.users)
        ? data.users
        : [];
}

export async function createAdminUser(payload) {
    const data = await adminRequest("", {
        method: "POST",
        body: JSON.stringify(payload),
    });

    return data?.user || null;
}

export async function updateAdminUser(id, payload) {
    const data = await adminRequest(
        `/${encodeURIComponent(id)}`,
        {
            method: "PATCH",
            body: JSON.stringify(payload),
        }
    );

    return data?.user || null;
}

export async function changeAdminUserPassword(id, password) {
    return adminRequest(
        `/${encodeURIComponent(id)}/password`,
        {
            method: "PUT",
            body: JSON.stringify({ password }),
        }
    );
}

export async function deleteAdminUser(id) {
    return adminRequest(
        `/${encodeURIComponent(id)}`,
        {
            method: "DELETE",
        }
    );
}
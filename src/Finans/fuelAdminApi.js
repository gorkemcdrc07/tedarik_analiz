const API_BASE = String(
    process.env.REACT_APP_API_BASE_URL || ""
).replace(/\/+$/, "");

export async function getAdminUsers() {
    const response = await fetch(
        `${API_BASE}/api/admin/users`,
        {
            method: "GET",
            credentials: "include",
            cache: "no-store",
            headers: {
                Accept: "application/json",
            },
        }
    );

    const raw = await response.text();

    let data = {};

    if (raw) {
        try {
            data = JSON.parse(raw);
        } catch {
            data = {
                error: "Sunucudan gecersiz yanit alindi.",
            };
        }
    }

    if (!response.ok) {
        const error = new Error(
            data?.error ||
            `HTTP ${response.status}`
        );

        error.status = response.status;
        error.data = data;

        throw error;
    }

    return Array.isArray(data?.users)
        ? data.users
        : [];
}

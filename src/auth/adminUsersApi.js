const API_BASE = String(
    process.env.REACT_APP_API_BASE_URL || ""
).replace(/\/+$/, "");

const adminUrl = (path = "") =>
    `${API_BASE}/api/admin/users${path}`;

async function request(path = "", options = {}) {
    const response = await fetch(
        adminUrl(path),
        {
            ...options,

            /*
             * Localhost -> localhost ve ileride
             * production cookie auth icin gerekli.
             */
            credentials: "include",

            headers: {
                Accept: "application/json",
                ...(options.body
                    ? {
                        "Content-Type":
                            "application/json",
                    }
                    : {}),
                ...(options.headers || {}),
            },
        }
    );

    const raw =
        await response.text();

    let data = {};

    if (raw) {
        try {
            data = JSON.parse(raw);
        } catch {
            data = {
                error:
                    "Sunucudan gecersiz yanit alindi.",
            };
        }
    }

    if (!response.ok) {
        const error =
            new Error(
                data?.error ||
                `HTTP ${response.status}`
            );

        error.status =
            response.status;

        error.data =
            data;

        throw error;
    }

    return data;
}

export async function getAdminUsers() {
    const data =
        await request();

    return Array.isArray(data?.users)
        ? data.users
        : [];
}

export async function createAdminUser(payload) {
    const data =
        await request(
            "",
            {
                method: "POST",
                body:
                    JSON.stringify(payload),
            }
        );

    return data?.user || null;
}

export async function updateAdminUser(
    id,
    payload
) {
    const data =
        await request(
            `/${encodeURIComponent(id)}`,
            {
                method: "PATCH",
                body:
                    JSON.stringify(payload),
            }
        );

    return data?.user || null;
}

export async function changeAdminUserPassword(
    id,
    password
) {
    return request(
        `/${encodeURIComponent(id)}/password`,
        {
            method: "PUT",
            body:
                JSON.stringify({
                    password,
                }),
        }
    );
}

export async function deleteAdminUser(id) {
    return request(
        `/${encodeURIComponent(id)}`,
        {
            method: "DELETE",
        }
    );
}
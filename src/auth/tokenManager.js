const API_BASE =
    process.env.REACT_APP_API_BASE_URL || "";

function buildUrl(url) {
    if (
        /^https?:\/\//i.test(url) ||
        !API_BASE
    ) {
        return url;
    }

    return `${API_BASE}${url}`;
}

export async function authorizedFetch(
    url,
    init = {}
) {
    const headers =
        new Headers(init.headers || {});

    const response = await fetch(
        buildUrl(url),
        {
            ...init,
            headers,
            credentials: "include",
            cache: "no-store",
        }
    );

    return response;
}

export async function authorizedJson(
    url,
    method = "GET",
    bodyObj = undefined
) {
    const headers =
        new Headers();

    if (bodyObj !== undefined) {
        headers.set(
            "Content-Type",
            "application/json"
        );
    }

    const response =
        await authorizedFetch(
            url,
            {
                method,
                headers,
                body:
                    bodyObj !== undefined
                        ? JSON.stringify(bodyObj)
                        : undefined,
            }
        );

    const text =
        await response.text();

    let json = {};

    try {
        json =
            text
                ? JSON.parse(text)
                : {};
    } catch {
        json = {
            raw: text,
        };
    }

    if (!response.ok) {
        const message =
            json?.message ||
            json?.error ||
            "TMS istegi basarisiz.";

        throw new Error(
            `${response.status}: ${message}`
        );
    }

    return json;
}
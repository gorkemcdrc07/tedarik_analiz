const API_BASE = String(
    process.env.REACT_APP_API_BASE_URL || ""
).replace(/\/+$/, "");

const FUEL_API_BASE =
    `${API_BASE}/api/yakit-hesaplama`;

async function request(path, options = {}) {
    const response = await fetch(
        `${FUEL_API_BASE}${path}`,
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
            `API istegi basarisiz (${response.status})`
        );

        error.status = response.status;
        throw error;
    }

    return body;
}

export async function getYakitHesaplamaMusteriler() {
    const body = await request(
        "/musteriler"
    );

    return Array.isArray(body?.data)
        ? body.data
        : [];
}

export async function getYakitHesaplamaTarifeler(
    musteriId,
    tip
) {
    const normalizedMusteriId =
        String(musteriId ?? "").trim();

    const normalizedTip =
        String(tip ?? "")
            .trim()
            .toLocaleLowerCase("tr-TR");

    if (!normalizedMusteriId) {
        throw new Error("Yakıt müşteri id gerekli.");
    }

    if (
        normalizedTip !== "alis" &&
        normalizedTip !== "satis"
    ) {
        throw new Error("Yakıt tarife tipi geçersiz.");
    }

    const params = new URLSearchParams({
        musteriId: normalizedMusteriId,
        tip: normalizedTip,
    });

    const body = await request(
        `/tarifeler?${params.toString()}`
    );

    return Array.isArray(body?.data)
        ? body.data
        : [];
}

export async function getYakitHesaplamaGecmis(
    musteriId,
    limit
) {
    const normalizedMusteriId =
        String(musteriId ?? "").trim();

    if (!normalizedMusteriId) {
        throw new Error("Yakıt müşteri id gerekli.");
    }

    const params = new URLSearchParams({
        musteriId: normalizedMusteriId,
    });

    if (
        limit !== undefined &&
        limit !== null &&
        String(limit).trim() !== ""
    ) {
        const numericLimit = Number(limit);

        if (
            !Number.isSafeInteger(numericLimit) ||
            numericLimit < 1 ||
            numericLimit > 5000
        ) {
            throw new Error(
                "Yakıt geçmiş limiti geçersiz."
            );
        }

        params.set(
            "limit",
            String(numericLimit)
        );
    }

    const body = await request(
        `/gecmis?${params.toString()}`
    );

    return Array.isArray(body?.data)
        ? body.data
        : [];
}
// EFOR_CAY_CENTRAL_READ_HELPER_V1
export async function getEforCayCentralState(
    musteriId
) {
    const normalizedMusteriId =
        String(musteriId ?? "").trim();

    if (!/^[1-9][0-9]*$/.test(normalizedMusteriId)) {
        throw new Error(
            "Gecerli EFOR CAY musteri id gerekli."
        );
    }

    return request(
        `/efor-cay/${encodeURIComponent(
            normalizedMusteriId
        )}`
    );
}


// YAKIT_HESAPLAMA_CREATE_HELPERS_V1

function normalizeYakitCreateTip(tip) {
    const normalized = String(tip ?? "")
        .trim()
        .toLocaleLowerCase("tr-TR");

    if (
        normalized !== "alis" &&
        normalized !== "satis"
    ) {
        throw new Error(
            "Yakıt tarife tipi geçersiz."
        );
    }

    return normalized;
}

function normalizeYakitCreateMusteriId(musteriId) {
    const normalized =
        String(musteriId ?? "").trim();

    if (!normalized) {
        throw new Error(
            "Yakıt müşteri id gerekli."
        );
    }

    return normalized;
}

export async function createYakitHesaplamaTarife(
    musteriId,
    tip,
    row
) {
    const normalizedMusteriId =
        normalizeYakitCreateMusteriId(
            musteriId
        );

    const normalizedTip =
        normalizeYakitCreateTip(tip);

    return request(
        "/tarifeler",
        {
            method: "POST",
            body: JSON.stringify({
                musteriId:
                    normalizedMusteriId,
                tip: normalizedTip,
                row,
            }),
        }
    );
}

export async function createYakitHesaplamaTarifelerBulk(
    musteriId,
    tip,
    rows
) {
    const normalizedMusteriId =
        normalizeYakitCreateMusteriId(
            musteriId
        );

    const normalizedTip =
        normalizeYakitCreateTip(tip);

    if (
        !Array.isArray(rows) ||
        rows.length < 1 ||
        rows.length > 5000
    ) {
        throw new Error(
            "Yakıt tarife satırları geçersiz."
        );
    }

    return request(
        "/tarifeler/bulk",
        {
            method: "POST",
            body: JSON.stringify({
                musteriId:
                    normalizedMusteriId,
                tip: normalizedTip,
                rows,
            }),
        }
    );
}


// YAKIT_HESAPLAMA_UPDATE_HELPER_V2
export async function updateYakitHesaplamaTarifeler(
    musteriId,
    alisRows,
    satisRows,
    {
        eskiYakitFiyati,
        yeniYakitFiyati,
        yakitDegisimOrani,
        uygulananArtisOrani,
    }
) {
    return request(
        "/tarifeler/guncelle",
        {
            method: "POST",
            body: JSON.stringify({
                musteriId,
                alisRows,
                satisRows,
                eskiYakitFiyati,
                yeniYakitFiyati,
                yakitDegisimOrani,
                uygulananArtisOrani,
            }),
        }
    );
}

// YAKIT_HESAPLAMA_UNDO_HELPER_V1
export async function undoYakitHesaplamaTarifeler(
    musteriId
) {
    const normalizedMusteriId =
        String(musteriId ?? "").trim();

    if (!normalizedMusteriId) {
        throw new Error(
            "Yakıt müşteri id gerekli."
        );
    }

    return request(
        "/tarifeler/geri-al",
        {
            method: "POST",
            body: JSON.stringify({
                musteriId:
                    normalizedMusteriId,
            }),
        }
    );
}

// EFOR_CAY_CENTRAL_WRITE_HELPERS_V1
export async function updateEforCayCentralState(musteriId, yeniYakit) {
    const normalizedMusteriId = String(musteriId ?? "").trim();
    const normalizedYeniYakit = Number(yeniYakit);

    if (!/^[1-9][0-9]*$/.test(normalizedMusteriId)) {
        throw new Error("Gecerli EFOR CAY musteri id gerekli.");
    }

    if (!Number.isFinite(normalizedYeniYakit) || normalizedYeniYakit <= 0) {
        throw new Error("Gecerli yeni yakit fiyati gerekli.");
    }

    return request("/efor-cay/update", {
        method: "POST",
        body: JSON.stringify({
            musteriId: Number(normalizedMusteriId),
            yeniYakit: normalizedYeniYakit,
        }),
    });
}

export async function undoEforCayCentralState(musteriId) {
    const normalizedMusteriId = String(musteriId ?? "").trim();

    if (!/^[1-9][0-9]*$/.test(normalizedMusteriId)) {
        throw new Error("Gecerli EFOR CAY musteri id gerekli.");
    }

    return request("/efor-cay/undo", {
        method: "POST",
        body: JSON.stringify({
            musteriId: Number(normalizedMusteriId),
        }),
    });
}

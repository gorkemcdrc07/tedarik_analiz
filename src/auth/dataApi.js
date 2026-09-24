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
export async function getProjeTanitimKartlari() {
    const result = await request(
        "/proje-tanitim-karti"
    );

    return Array.isArray(result?.data)
        ? result.data
        : [];
}

export async function createProjeTanitimKarti(
    payload
) {
    const result = await request(
        "/proje-tanitim-karti",
        {
            method: "POST",
            body: JSON.stringify(payload),
        }
    );

    return result?.data ?? null;
}
export async function getNextSiparisSayaci(
    musteriAdi,
    tarih
) {
    const result = await request(
        "/siparis-sayaci/next",
        {
            method: "POST",
            body: JSON.stringify({
                musteriAdi,
                tarih,
            }),
        }
    );

    const counter = Number(
        result?.data?.counter
    );

    if (
        !Number.isSafeInteger(counter) ||
        counter <= 0
    ) {
        throw new Error(
            "Geçersiz sipariş sayacı yanıtı."
        );
    }

    return counter;
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


// YENI_SIPARIS_HELPERS_V1

export async function getYeniSiparisMusteriler({
    aktif = true,
} = {}) {
    const params = new URLSearchParams();

    if (typeof aktif === "boolean") {
        params.set("aktif", String(aktif));
    }

    const query = params.toString();

    const result = await request(
        `/musteriler${query ? `?${query}` : ""}`
    );

    return Array.isArray(result?.data)
        ? result.data
        : [];
}

export async function getYeniSiparisMappings({
    aktif = true,
} = {}) {
    const params = new URLSearchParams();

    if (typeof aktif === "boolean") {
        params.set("aktif", String(aktif));
    }

    const query = params.toString();

    const result = await request(
        `/yeni-siparis-mapping${query ? `?${query}` : ""}`
    );

    return Array.isArray(result?.data)
        ? result.data
        : [];
}

// TESLIM_NOKTALARI_HELPERS_V2

export async function getTeslimNoktasiAdresIds() {
    const result = await request(
        "/teslim-noktalari?mode=ids"
    );

    return Array.isArray(result?.data)
        ? result.data
        : [];
}

export async function getTeslimNoktalariAll() {
    const result = await request(
        "/teslim-noktalari?mode=all"
    );

    return Array.isArray(result?.data)
        ? result.data
        : [];
}

export async function searchTeslimNoktalari({
    adresQ = "",
    cariQ = "",
} = {}) {
    const params = new URLSearchParams({
        mode: "search",
    });

    const normalizedAdres =
        String(adresQ || "").trim();

    const normalizedCari =
        String(cariQ || "").trim();

    if (normalizedAdres) {
        params.set(
            "adresQ",
            normalizedAdres
        );
    }

    if (normalizedCari) {
        params.set(
            "cariQ",
            normalizedCari
        );
    }

    const result = await request(
        `/teslim-noktalari?${params.toString()}`
    );

    return Array.isArray(result?.data)
        ? result.data
        : [];
}

export async function createTeslimNoktalariBulk(rows) {
    if (!Array.isArray(rows)) {
        throw new Error(
            "Teslim noktaları listesi geçersiz."
        );
    }

    if (rows.length === 0) {
        return {
            data: [],
            count: 0,
            requestedCount: 0,
            skippedCount: 0,
        };
    }

    const chunkSize = 1000;

    const summary = {
        data: [],
        count: 0,
        requestedCount: 0,
        skippedCount: 0,
    };

    for (
        let offset = 0;
        offset < rows.length;
        offset += chunkSize
    ) {
        const chunk =
            rows.slice(offset, offset + chunkSize);

        const result = await request(
            "/teslim-noktalari/bulk",
            {
                method: "POST",
                body: JSON.stringify({
                    rows: chunk,
                }),
            }
        );

        if (Array.isArray(result?.data)) {
            summary.data.push(...result.data);
        }

        summary.count +=
            Number(result?.count) || 0;

        summary.requestedCount +=
            Number(result?.requestedCount) || 0;

        summary.skippedCount +=
            Number(result?.skippedCount) || 0;
    }

    return summary;
}

// YENI_SIPARIS_CUSTOMER_MUTATION_HELPERS_V1

export async function createYeniSiparisMusteri(payload) {
    const body = await request("/musteriler", {
        method: "POST",
        body: JSON.stringify(payload),
    });

    return body?.data ?? null;
}

export async function updateYeniSiparisMusteri(id, payload) {
    if (!id) {
        throw new Error("Musteri id gerekli.");
    }

    const body = await request(`/musteriler/${encodeURIComponent(id)}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
    });

    return body?.data ?? null;
}

export async function archiveYeniSiparisMusteri(id) {
    if (!id) {
        throw new Error("Musteri id gerekli.");
    }

    const body = await request(
        `/musteriler/${encodeURIComponent(id)}/archive`,
        {
            method: "PATCH",
            body: JSON.stringify({}),
        }
    );

    return body?.data ?? null;
}

export async function bulkUpsertYeniSiparisMusteriler(rows) {
    if (!Array.isArray(rows) || rows.length === 0) {
        throw new Error("Musteri listesi bos.");
    }

    return request("/musteriler/bulk", {
        method: "POST",
        body: JSON.stringify({ rows }),
    });
}

// YENI_SIPARIS_MAPPING_MUTATION_HELPERS_V1

export async function createYeniSiparisMapping(payload) {
    const body = await request("/yeni-siparis-mapping", {
        method: "POST",
        body: JSON.stringify(payload),
    });

    return body?.data ?? null;
}

export async function updateYeniSiparisMapping(id, payload) {
    if (!id) {
        throw new Error("Mapping id gerekli.");
    }

    const body = await request(
        `/yeni-siparis-mapping/${encodeURIComponent(id)}`,
        {
            method: "PATCH",
            body: JSON.stringify(payload),
        }
    );

    return body?.data ?? null;
}

export async function archiveYeniSiparisMapping(id) {
    if (!id) {
        throw new Error("Mapping id gerekli.");
    }

    const body = await request(
        `/yeni-siparis-mapping/${encodeURIComponent(id)}/archive`,
        {
            method: "PATCH",
            body: JSON.stringify({}),
        }
    );

    return body?.data ?? null;
}

export async function bulkCreateYeniSiparisMappings(rows) {
    if (!Array.isArray(rows) || rows.length === 0) {
        throw new Error("Mapping listesi bos.");
    }

    return request("/yeni-siparis-mapping/bulk", {
        method: "POST",
        body: JSON.stringify({ rows }),
    });
}
// SIPARIS_OLUSTUR_PROJECT_ROWS_HELPER_V1

export async function getSiparisOlusturProjectRows(projeAdi) {
    const normalized = String(projeAdi ?? "")
        .replace(/\s+/g, " ")
        .trim();

    if (!normalized) {
        return [];
    }

    const params = new URLSearchParams({
        projeAdi: normalized,
    });

    const body = await request(
        `/siparis-olustur/project-rows?${params.toString()}`
    );

    return Array.isArray(body?.data)
        ? body.data
        : [];
}

// SIPARIS_OLUSTUR_BALLOG_HELPERS_V1

export async function getSiparisOlusturTeslimNoktalariAll() {
    const data = await request(
        "/siparis-olustur/teslim-noktalari"
    );

    return Array.isArray(data?.data)
        ? data.data
        : [];
}
export async function getSiparisOlusturBallogTeslimNoktalari() {
    const body = await request(
        "/siparis-olustur/ballog-teslim-noktalari"
    );

    return Array.isArray(body?.data)
        ? body.data
        : [];
}

export async function createSiparisOlusturBallogTeslimNoktalariBulk(rows) {
    const safeRows = Array.isArray(rows)
        ? rows
        : [];

    if (!safeRows.length) {
        return {
            inserted: 0,
            skipped: 0,
            data: [],
        };
    }

    const body = await request(
        "/siparis-olustur/ballog-teslim-noktalari/bulk",
        {
            method: "POST",
            body: JSON.stringify({
                rows: safeRows,
            }),
        }
    );

    return {
        inserted: Number(body?.inserted ?? 0),
        skipped: Number(body?.skipped ?? 0),
        data: Array.isArray(body?.data)
            ? body.data
            : [],
    };
}
// YAKIT_HESAPLAMA_READ_HELPERS_V1

export async function getYakitHesaplamaMusteriler() {
    const body = await request(
        "/yakit-hesaplama/musteriler"
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
        `/yakit-hesaplama/tarifeler?${params.toString()}`
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
        `/yakit-hesaplama/gecmis?${params.toString()}`
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
        `/yakit-hesaplama/efor-cay/${encodeURIComponent(
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
        "/yakit-hesaplama/tarifeler",
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
        "/yakit-hesaplama/tarifeler/bulk",
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
        "/yakit-hesaplama/tarifeler/guncelle",
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
        "/yakit-hesaplama/tarifeler/geri-al",
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

    return request("/yakit-hesaplama/efor-cay/update", {
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

    return request("/yakit-hesaplama/efor-cay/undo", {
        method: "POST",
        body: JSON.stringify({
            musteriId: Number(normalizedMusteriId),
        }),
    });
}

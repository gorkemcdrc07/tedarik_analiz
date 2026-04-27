import { useRef, useState } from "react";
import * as XLSX from "xlsx";
import supabase from "../supabaseClient";
import "./TeslimNoktalari.css";

const columnMap = [
    { excel: "Vergi/T.C. No", db: "vkn" },
    { excel: "Cari Hesap ID", db: "cari_hesap_id" },
    { excel: "Ünvan", db: "cari" },
    { excel: "Id", db: "adres_id" },
    { excel: "Adres Adı", db: "adres_adi" },
    { excel: "İl", db: "il" },
    { excel: "İlçe", db: "ilce" },
    { excel: "Adres", db: "adres" },
];

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export default function TeslimNoktalari() {
    const inputRef = useRef(null);

    const [dragActive, setDragActive] = useState(false);
    const [importing, setImporting] = useState(false);
    const [fileName, setFileName] = useState("");
    const [showResult, setShowResult] = useState(false);
    const [phase, setPhase] = useState("idle");

    const [summary, setSummary] = useState({
        total: 0,
        valid: 0,
        added: 0,
        skipped: 0,
    });

    const [status, setStatus] = useState({
        type: "idle",
        title: "Hazır",
        text: "Excel dosyanı bekliyorum.",
    });

    function openPicker() {
        if (!importing) inputRef.current?.click();
    }

    function getValue(row, key) {
        return String(row[key] ?? "").trim();
    }

    function normalizeExcelRow(row) {
        return {
            vkn: getValue(row, "Vergi/T.C. No"),
            cari_hesap_id: getValue(row, "Cari Hesap ID"),
            cari: getValue(row, "Ünvan"),
            adres_id: getValue(row, "Id"),
            adres_adi: getValue(row, "Adres Adı"),
            il: getValue(row, "İl"),
            ilce: getValue(row, "İlçe"),
            adres: getValue(row, "Adres"),
        };
    }

    async function getAllExistingAdresIds() {
        const existingIds = new Set();
        const pageSize = 1000;
        let from = 0;
        let hasMore = true;

        while (hasMore) {
            const { data, error } = await supabase
                .from("Teslim_Noktalari")
                .select("adres_id")
                .not("adres_id", "is", null)
                .range(from, from + pageSize - 1);

            if (error) throw error;

            (data || []).forEach((item) => {
                const id = String(item.adres_id ?? "").trim();
                if (id) existingIds.add(id);
            });

            hasMore = data && data.length === pageSize;
            from += pageSize;
        }

        return existingIds;
    }

    async function processFile(file) {
        const isExcel = [".xlsx", ".xls"].some((ext) =>
            file.name.toLowerCase().endsWith(ext)
        );

        if (!isExcel) {
            setPhase("error");
            setStatus({
                type: "error",
                title: "Geçersiz dosya",
                text: "Sadece Excel dosyası yükleyebilirsin.",
            });
            setShowResult(true);
            return;
        }

        setImporting(true);
        setShowResult(true);
        setFileName(file.name);
        setSummary({ total: 0, valid: 0, added: 0, skipped: 0 });

        try {
            setPhase("open");
            setStatus({
                type: "loading",
                title: "Excel açıldı",
                text: "Dosya işleme alındı.",
            });
            await wait(700);

            const buffer = await file.arrayBuffer();
            const workbook = XLSX.read(buffer);
            const sheet = workbook.Sheets[workbook.SheetNames[0]];
            const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });

            setPhase("read");
            setStatus({
                type: "loading",
                title: "Okunuyor",
                text: "Satırlar analiz ediliyor.",
            });
            await wait(850);

            const cleanRecords = rows
                .map(normalizeExcelRow)
                .filter((item) => item.adres_id);

            if (cleanRecords.length === 0) {
                setPhase("error");
                setSummary({
                    total: rows.length,
                    valid: 0,
                    added: 0,
                    skipped: rows.length,
                });
                setStatus({
                    type: "error",
                    title: "Uygun kayıt yok",
                    text: "Aktarılabilir adres_id bulunamadı.",
                });
                return;
            }

            setPhase("match");
            setStatus({
                type: "loading",
                title: "Eşleşiyor",
                text: "Excel kolonları tablo alanlarıyla eşleşiyor.",
            });
            await wait(850);

            const excelUniqueMap = new Map();

            cleanRecords.forEach((record) => {
                const adresId = String(record.adres_id ?? "").trim();
                if (adresId && !excelUniqueMap.has(adresId)) {
                    excelUniqueMap.set(adresId, { ...record, adres_id: adresId });
                }
            });

            const uniqueExcelRecords = Array.from(excelUniqueMap.values());

            setPhase("filter");
            setStatus({
                type: "loading",
                title: "Ayıklanıyor",
                text: "Sistemde kayıtlı adres_id değerleri kontrol ediliyor.",
            });
            await wait(850);

            const existingIds = await getAllExistingAdresIds();

            const recordsToInsert = uniqueExcelRecords.filter((item) => {
                return !existingIds.has(String(item.adres_id ?? "").trim());
            });

            const uniqueCount = uniqueExcelRecords.length;
            const addedCount = recordsToInsert.length;
            const skippedCount = uniqueCount - addedCount;

            if (recordsToInsert.length === 0) {
                setPhase("success");
                setSummary({
                    total: rows.length,
                    valid: uniqueCount,
                    added: 0,
                    skipped: skippedCount,
                });
                setStatus({
                    type: "success",
                    title: "Zaten hepsi var",
                    text: `${skippedCount} kayıt zaten sistemde vardı. Yeni veri yok.`,
                });
                return;
            }

            setPhase("insert");
            setStatus({
                type: "loading",
                title: "Kaydediliyor",
                text: "Yeni kayıtlar tabloya aktarılıyor.",
            });
            await wait(700);

            const { error: insertError } = await supabase
                .from("Teslim_Noktalari")
                .insert(recordsToInsert);

            if (insertError) {
                if (insertError.code === "23505") {
                    setPhase("success");
                    setSummary({
                        total: rows.length,
                        valid: uniqueCount,
                        added: 0,
                        skipped: uniqueCount,
                    });
                    setStatus({
                        type: "success",
                        title: "Zaten kayıtlı",
                        text: "Bu kayıtlar işlem sırasında zaten mevcut görünüyor.",
                    });
                    return;
                }

                throw insertError;
            }

            setPhase("success");
            setSummary({
                total: rows.length,
                valid: uniqueCount,
                added: recordsToInsert.length,
                skipped: skippedCount,
            });

            setStatus({
                type: "success",
                title: "Aktarım tamamlandı",
                text: `${recordsToInsert.length} yeni kayıt bulundu ve eklendi.`,
            });
        } catch (err) {
            setPhase("error");
            setStatus({
                type: "error",
                title: "Aktarım başarısız",
                text: err.message || "Bir hata oluştu.",
            });
        } finally {
            setImporting(false);
        }
    }

    function handleDragOver(e) {
        e.preventDefault();
        setDragActive(true);
    }

    function handleDragLeave(e) {
        e.preventDefault();
        setDragActive(false);
    }

    function handleDrop(e) {
        e.preventDefault();
        setDragActive(false);

        const file = e.dataTransfer.files?.[0];
        if (file) processFile(file);
    }

    function handleFileSelect(e) {
        const file = e.target.files?.[0];
        if (file) processFile(file);
        e.target.value = "";
    }

    return (
        <main className="import-page">
            {showResult && (
                <div className="result-overlay">
                    <div className={`result-modal ${status.type} ${phase}`}>
                        {!importing && (
                            <button
                                type="button"
                                className="close-result"
                                onClick={() => setShowResult(false)}
                            >
                                ×
                            </button>
                        )}

                        <div className={`orbit-scene ${phase}`}>
                            <div className="orbit-excel">
                                <div className="excel-top">
                                    <span>XLSX</span>
                                </div>
                                <div className="excel-lines">
                                    <i /><i /><i /><i /><i /><i />
                                </div>
                            </div>

                            <div className="dot-field">
                                {Array.from({ length: 26 }).map((_, index) => (
                                    <span key={index} />
                                ))}
                            </div>

                            <div className="result-orbit">
                                <div className="orbit-ring ring-one" />
                                <div className="orbit-ring ring-two" />
                                <div className="orbit-ring ring-three" />

                                <div className="orbit-dot dot-one" />
                                <div className="orbit-dot dot-two" />
                                <div className="orbit-dot dot-three" />

                                <div className="result-circle">
                                    <small>Sonuç</small>
                                    <strong>{summary.added}</strong>
                                    <em>yeni kayıt</em>
                                </div>
                            </div>
                        </div>

                        <div className="flow-steps">
                            <div className={["open", "read", "match", "filter", "insert", "success"].includes(phase) ? "active" : ""}>Dosya</div>
                            <div className={["read", "match", "filter", "insert", "success"].includes(phase) ? "active" : ""}>Okuma</div>
                            <div className={["match", "filter", "insert", "success"].includes(phase) ? "active" : ""}>Eşleşme</div>
                            <div className={["filter", "insert", "success"].includes(phase) ? "active" : ""}>Ayıklama</div>
                            <div className={["insert", "success"].includes(phase) ? "active" : ""}>Kayıt</div>
                        </div>

                        <span>{status.title}</span>
                        <p>{status.text}</p>

                        <div className="result-mini-grid">
                            <div>
                                <small>Excel Satırı</small>
                                <b>{summary.total}</b>
                            </div>
                            <div>
                                <small>Geçerli</small>
                                <b>{summary.valid}</b>
                            </div>
                            <div>
                                <small>Zaten Var</small>
                                <b>{summary.skipped}</b>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <section className="import-card">
                <div className="top-bar">
                    <div>
                        <span className="mini-label">Teslim Noktaları</span>
                        <h1>Excel Aktarım</h1>
                    </div>

                    <div className={`status-badge ${status.type}`}>
                        <span />
                        {status.title}
                    </div>
                </div>

                <div className="content-grid">
                    <div
                        className={`drop-area ${dragActive ? "active" : ""} ${importing ? "loading" : ""}`}
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                        onClick={openPicker}
                    >
                        <input
                            ref={inputRef}
                            type="file"
                            accept=".xlsx,.xls"
                            hidden
                            disabled={importing}
                            onChange={handleFileSelect}
                        />

                        <div className="upload-mark">
                            {importing ? <i /> : "↥"}
                        </div>

                        <strong>
                            {importing ? "İşleniyor" : "Excel’i buraya bırak"}
                        </strong>

                        <p>{fileName || "veya dosya seçmek için tıkla"}</p>

                        <button type="button" disabled={importing}>
                            Dosya Seç
                        </button>
                    </div>

                    <aside className="side-panel">
                        <div className="result-card main">
                            <small>Eklenen Kayıt</small>
                            <strong>{summary.added}</strong>
                        </div>

                        <div className="result-grid">
                            <div className="result-card">
                                <small>Excel Satırı</small>
                                <strong>{summary.total}</strong>
                            </div>

                            <div className="result-card">
                                <small>Geçerli Kayıt</small>
                                <strong>{summary.valid}</strong>
                            </div>

                            <div className="result-card">
                                <small>Zaten Var</small>
                                <strong>{summary.skipped}</strong>
                            </div>
                        </div>

                        <div className="mapping-card">
                            <div className="mapping-head">
                                <span>Alan Eşleşmeleri</span>
                                <b>{columnMap.length} kolon</b>
                            </div>

                            <div className="mapping-list">
                                {columnMap.map((item) => (
                                    <div className="mapping-row" key={item.db}>
                                        <span>{item.excel}</span>
                                        <em>{item.db}</em>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </aside>
                </div>
            </section>
        </main>
    );
}
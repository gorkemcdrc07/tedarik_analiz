import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import {
  FileSpreadsheet,
  Plus,
  Printer,
  RotateCcw,
  Trash2,
  Upload,
  X,
  CheckCircle2,
  AlertCircle,
  Settings,
} from "lucide-react";
import "./Irsaliye.css";
import PrintSettings from "./PrintSettings";
import { loadLayout, SETTINGS_KEY, validateLayout, openPrintPreview } from "./dotMatrixPrint";

import odakLogo from "./odak-lojistik-logo.png";
import resmiLogo from "./resmi-logo.png";

const createEmptyRow = () => ({
  irsaliyeNo: "",
  alici: "",
  aliciIlce: "",
  paletTipi: "",
  miktar: "",
  birim: "",
});

const initialForm = {
  ilKodu: "34",
  seriSiraNo: "",
  seferNo: "",
  duzenlemeTarihi: "",
  fiiliSevkTarihiSaati: "",
  faturaNo: "",
  cikisMerkezi: "",
  gonderen: "",
  tevdiEden: "",

  soforeTeslimEden: "",
  soforeTeslimTarihSaat: "",
  soforImza: "",
  teslimAlan: "",
  teslimAlanTarihSaat: "",
  not: "",

  sahibi: "",
  plaka: "",
  ruhsatNo: "",
  verYeri: "",

  surucuAdSoyad: "",
  ehliyetNo: "",
  ehliyetVerildigiYer: "",

  teslimEdenImza: "",
  teslimAlanImza: "",
  plakaNo: "",
  romorkPlakasi: "",
  teslimAlanSurucu: "",

  nakliyeTutari: "",
  kdv: "",
  toplam: "",
  motorinAvansi: "",
  nakitAvans: "",
  sigorta: "",
  bakiye: "",
  yaziIle: "",
};

const normalizeHeader = (value) =>
  String(value ?? "")
    .trim()
    .toLocaleUpperCase("tr-TR")
    .replace(/[İI]/g, "I")
    .replace(/[Ş]/g, "S")
    .replace(/[Ğ]/g, "G")
    .replace(/[Ü]/g, "U")
    .replace(/[Ö]/g, "O")
    .replace(/[Ç]/g, "C")
    .replace(/\s*\/\s*/g, "/")
    .replace(/\s*:\s*/g, ":")
    .replace(/\s+/g, " ");

const HEADER_ALIASES = {
  irsaliyeNo: ["IRSALIYE NO", "IRSALIYE NO.", "BELGE NO", "IRSALIYE NUMARASI"],
  alici: ["ALICI", "ALICI ADI", "ALICI FIRMA", "MUSTERI", "MUSTERI ADI"],
  aliciIlce: [
    "ALICI/ILCE",
    "ALICI / ILCE",
    "ALICI ILCE",
    "ALICI/IL",
    "ALICI / IL",
    "IL/ILCE",
    "IL / ILCE",
    "TESLIM YERI",
    "VARIS",
  ],
  paletTipi: ["PALET TIPI", "URUN", "URUN TIPI", "YUK TIPI", "MALZEME"],
  miktar: ["MIKTAR", "ADET", "KG", "KILO", "AGIRLIK"],
  birim: ["BIRIM", "MIKTAR BIRIMI"],

  seferNo: ["SEFER NO", "SEFER NO.", "SEFER NUMARASI"],
  duzenlemeTarihi: ["DUZENLEME TARIHI", "BELGE TARIHI"],
  fiiliSevkTarihiSaati: [
    "FIILI SEVK TARIHI/SAATI",
    "FIILI SEVK TARIH/SAAT",
    "SEVK TARIHI",
    "SEVK TARIH SAAT",
  ],
  faturaNo: ["FATURA NO", "FATURA NO."],
  cikisMerkezi: ["CIKIS MERKEZI", "CIKIS YERI", "YUKLEME YERI"],
  gonderen: ["GONDEREN", "GONDERICI"],
  plaka: ["PLAKA", "CEKICI", "CEKICI PLAKA"],
  romorkPlakasi: ["Y. ROMORK PLAKASI", "ROMORK PLAKASI", "DORSE", "DORSE PLAKA"],
  surucuAdSoyad: [
    "SURUCU",
    "SOFOR",
    "SOFOR AD SOYAD",
    "SURUCU AD SOYAD",
    "SOFOR ADI VE SOYADI",
    "ŞOFÖR ADI VE SOYADI",
  ],

  soforeTeslimTarihSaat: [
    "SOFORE MALI TESLIM EDEN TARIH VE SAAT",
    "SOFORE MAL TESLIM EDEN TARIH VE SAAT",
    "ŞOFÖRE MALI TESLİM EDEN TARİH VE SAAT",
    "TESLIM EDEN TARIH VE SAAT",
  ],

  plakaNo: [
    "PLAKA NO",
    "PLAKA NO.",
    "PLAKA",
    "CEKICI",
    "CEKICI PLAKA",
  ],

  teslimAlanSurucu: [
    "TESLIM ALAN - SURUCU",
    "TESLIM ALAN SURUCU",
    "TESLİM ALAN - SÜRÜCÜ",
  ],

  nakliyeTutari: [
    "NAKLIYE TUTARI",
    "NAKLİYE TUTARI",
  ],

  kdv: ["KDV", "KDV."],

  toplam: ["TOPLAM"],
};

const findValueByAliases = (row, aliases) => {
  if (!row) return "";
  const entries = Object.entries(row);

  for (const alias of aliases) {
    const target = normalizeHeader(alias);
    const found = entries.find(([key]) => normalizeHeader(key) === target);
    if (found) return found[1] ?? "";
  }

  return "";
};

const asText = (value) => {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toLocaleDateString("tr-TR");
  return String(value).trim();
};

const normalizeExcelDate = (value, includeTime = false) => {
  if (value === null || value === undefined || value === "") return "";

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const dd = String(value.getDate()).padStart(2, "0");
    const mm = String(value.getMonth() + 1).padStart(2, "0");
    const yyyy = value.getFullYear();

    if (!includeTime) return `${dd}.${mm}.${yyyy}`;

    const hh = String(value.getHours()).padStart(2, "0");
    const min = String(value.getMinutes()).padStart(2, "0");
    return `${dd}.${mm}.${yyyy} ${hh}:${min}`;
  }

  const raw = String(value).trim();
  if (!raw) return "";

  // Saat kısmını ayır: 08.26.2026 18:30 / 8/26/26 18:30 gibi.
  const dateTimeMatch = raw.match(
    /^(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{2,4})(?:\s+(\d{1,2}):(\d{2})(?::\d{2})?)?$/
  );

  if (!dateTimeMatch) return raw;

  let first = Number(dateTimeMatch[1]);
  let second = Number(dateTimeMatch[2]);
  let year = Number(dateTimeMatch[3]);
  const hour = dateTimeMatch[4] ?? "";
  const minute = dateTimeMatch[5] ?? "";

  if (year < 100) year += 2000;

  let day;
  let month;

  // 08.26.2026 => AA.GG.YYYY
  if (second > 12 && first <= 12) {
    month = first;
    day = second;
  }
  // 26.08.2026 => GG.AA.YYYY
  else if (first > 12 && second <= 12) {
    day = first;
    month = second;
  }
  // "/" ile gelen Excel/US görünümünde ay/gün kabul et.
  else if (raw.includes("/")) {
    month = first;
    day = second;
  }
  // Belirsiz noktalı tarihte Türkçe düzeni koru.
  else {
    day = first;
    month = second;
  }

  const dd = String(day).padStart(2, "0");
  const mm = String(month).padStart(2, "0");
  const yyyy = String(year);

  if (includeTime && hour !== "" && minute !== "") {
    return `${dd}.${mm}.${yyyy} ${String(hour).padStart(2, "0")}:${minute}`;
  }

  return `${dd}.${mm}.${yyyy}`;
};

function PlainInput({ value, onChange, className = "", ariaLabel = "" }) {
  return (
    <input
      className={`irs-plain-input ${className}`}
      value={value}
      aria-label={ariaLabel}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

function FitInput({
  value,
  onChange,
  className = "",
  ariaLabel = "",
  maxFontSize = 7.2,
  minFontSize = 3.2,
}) {
  const inputRef = useRef(null);

  useLayoutEffect(() => {
    const input = inputRef.current;
    if (!input) return;

    const fitText = () => {
      const text = String(value ?? "");

      // Önce maksimum fontu uygula.
      input.style.setProperty(
        "font-size",
        `${maxFontSize}px`,
        "important"
      );

      if (!text) return;

      // Tarayıcının input içeriğinin gerçek genişliğini kullan.
      let fontSize = maxFontSize;

      // Birkaç frame sonra ölçmek layout stabilitesi için daha güvenli.
      const availableWidth = Math.max(
        input.getBoundingClientRect().width - 2,
        4
      );

      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d");

      if (!context) return;

      const fontFamily = "Arial, Helvetica, sans-serif";

      const measure = (size) => {
        context.font = `400 ${size}px Arial`;
        return context.measureText(text).width;
      };

      // Hızlı oran hesabı.
      const initialWidth = measure(fontSize);

      if (initialWidth > availableWidth) {
        fontSize = Math.max(
          minFontSize,
          fontSize * (availableWidth / initialWidth) * 0.96
        );
      }

      // Son ince ayar.
      while (
        fontSize > minFontSize &&
        measure(fontSize) > availableWidth
      ) {
        fontSize -= 0.1;
      }

      input.style.setProperty(
        "font-size",
        `${Math.max(fontSize, minFontSize).toFixed(2)}px`,
        "important"
      );
    };

    fitText();

    const raf = requestAnimationFrame(fitText);

    const resizeObserver = new ResizeObserver(() => {
      fitText();
    });

    resizeObserver.observe(input);

    return () => {
      cancelAnimationFrame(raf);
      resizeObserver.disconnect();
    };
  }, [value, maxFontSize, minFontSize]);

  return (
    <input
      ref={inputRef}
      className={`irs-fit-input ${className}`}
      value={value}
      aria-label={ariaLabel}
      title={String(value ?? "")}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

function LabeledLine({ label, value, onChange, className = "" }) {
  return (
    <label className={`irs-line ${className}`}>
      <span>{label}</span>
      <i>:</i>
      <PlainInput value={value} onChange={onChange} ariaLabel={label} />
    </label>
  );
}

export default function Irsaliye() {
  const [form, setForm] = useState(initialForm);
  const [rows, setRows] = useState([createEmptyRow()]);
  const [message, setMessage] = useState(null);
  const [importInfo, setImportInfo] = useState(null);
  const [printSettingsOpen, setPrintSettingsOpen] = useState(false);
  const [printLayout, setPrintLayout] = useState(() => {
    try { return loadLayout(window.localStorage); } catch (_) { return loadLayout({ getItem: () => null }); }
  });
  useEffect(() => {
    document.body.classList.add('irs-print-active');
    const help = document.createElement('p');
    help.className = 'irs-native-print-help';
    help.textContent = 'İrsaliye ekranındaki OKI Önizle / Yazdır düğmesini kullanın. Sabit ölçülü veri baskısı ayrı önizleme penceresinde hazırlanır.';
    document.body.appendChild(help);
    return () => { document.body.classList.remove('irs-print-active'); help.remove(); };
  }, []);
  const fileInputRef = useRef(null);

  const updateForm = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const updateRow = (index, key, value) => {
    setRows((prev) =>
      prev.map((row, i) =>
        i === index ? { ...row, [key]: value } : row
      )
    );
  };

  const addRow = () => {
    setRows((prev) => [...prev, createEmptyRow()]);
  };

  const removeRow = (index) => {
    setRows((prev) => {
      if (prev.length <= 1) return prev;
      return prev.filter((_, i) => i !== index);
    });
  };

  const savePrintCalibration = () => {
    const errors = validateLayout(printLayout);
    if (errors.length) { setMessage({ type: 'error', text: errors.join(' ') }); return; }
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(printLayout));
      setMessage({ type: 'success', text: 'Baskı ayarları bu tarayıcıya kaydedildi.' });
    } catch (_) { setMessage({ type: 'error', text: 'Ayarlar saklanamadı. Mevcut ayarlarla önizleme açabilirsiniz.' }); }
  };
  const printPreprintedForm = (calibration = false) => {
    try {
      const count = openPrintPreview(form, rows, printLayout, calibration);
      setMessage({ type: 'success', text: count + ' sayfalık baskı önizlemesi açıldı.' });
    } catch (error) { setMessage({ type: 'error', text: error.message }); }
  };

  const clearAll = () => {
    if (!window.confirm("İrsaliye üzerindeki tüm alanlar temizlensin mi?")) return;

    setForm(initialForm);
    setRows([createEmptyRow()]);
    setImportInfo(null);
    setMessage({
      type: "success",
      text: "İrsaliye ekranı temizlendi.",
    });

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const filledRowCount = useMemo(
    () =>
      rows.filter((row) =>
        [
          row.irsaliyeNo,
          row.alici,
          row.aliciIlce,
          row.paletTipi,
          row.miktar,
        ].some((value) => String(value || "").trim())
      ).length,
    [rows]
  );

  const downloadExcelTemplate = () => {
    const headers = [
      "Sefer No",
      "Düzenleme Tarihi",
      "Fiili Sevk Tarihi/Saati",
      "Fatura No",
      "Çıkış Merkezi",
      "Gönderen",
      "İrsaliye No",
      "Alıcı",
      "Alıcı/İlçe",
      "Palet Tipi",
      "Miktar",
      "Şoföre Malı Teslim Eden Tarih ve Saat",
      "Şoför Adı ve Soyadı",
      "Plaka No",
      "Teslim Alan - Sürücü",
      "Nakliye Tutarı",
      "KDV",
      "Toplam",
    ];

    const exampleRow = [
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
    ];

    const worksheet = XLSX.utils.aoa_to_sheet([
      headers,
      exampleRow,
    ]);

    worksheet["!cols"] = [
      { wch: 15 },
      { wch: 17 },
      { wch: 23 },
      { wch: 16 },
      { wch: 20 },
      { wch: 22 },
      { wch: 18 },
      { wch: 25 },
      { wch: 22 },
      { wch: 17 },
      { wch: 12 },
      { wch: 34 },
      { wch: 24 },
      { wch: 16 },
      { wch: 24 },
      { wch: 17 },
      { wch: 12 },
      { wch: 17 },
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      workbook,
      worksheet,
      "İrsaliye Şablonu"
    );

    const instructionRows = [
      ["İRSALİYE EXCEL ŞABLONU"],
      [],
      ["Kullanım"],
      [
        "Her satır bir irsaliye kaydıdır. Aynı sefere ait birden fazla irsaliye varsa üst bilgi alanlarını her satırda aynı değerlerle tekrar edebilirsiniz.",
      ],
      [
        "Düzenleme Tarihi: GG.AA.YYYY",
      ],
      [
        "Fiili Sevk Tarihi/Saati: GG.AA.YYYY SS:DD",
      ],
      [
        "Şoföre Malı Teslim Eden Tarih ve Saat: GG.AA.YYYY SS:DD",
      ],
      [
        "Nakliye Tutarı, KDV ve Toplam alanlarını sayısal girin.",
      ],
      [
        "Excel İçe Aktar butonundan dosyayı seçtiğiniz anda bilgiler otomatik olarak irsaliye formuna yerleşir.",
      ],
    ];

    const instructionSheet =
      XLSX.utils.aoa_to_sheet(instructionRows);

    instructionSheet["!cols"] = [{ wch: 110 }];

    XLSX.utils.book_append_sheet(
      workbook,
      instructionSheet,
      "Açıklama"
    );

    XLSX.writeFile(
      workbook,
      "Irsaliye_Excel_Sablonu.xlsx"
    );
  };

  const importExcel = async (file) => {
    if (!file) return;

    try {
      setMessage(null);

      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, {
        type: "array",
        cellDates: true,
      });

      const firstSheetName = workbook.SheetNames?.[0];

      if (!firstSheetName) {
        throw new Error("Excel dosyasında çalışma sayfası bulunamadı.");
      }

      const worksheet = workbook.Sheets[firstSheetName];

      const data = XLSX.utils.sheet_to_json(worksheet, {
        defval: "",
        raw: false,
      });

      if (!data.length) {
        throw new Error("Excel dosyasında aktarılacak veri bulunamadı.");
      }

      const mappedRows = data
        .map((item) => ({
          irsaliyeNo: asText(
            findValueByAliases(item, HEADER_ALIASES.irsaliyeNo)
          ),
          alici: asText(
            findValueByAliases(item, HEADER_ALIASES.alici)
          ),
          aliciIlce: asText(
            findValueByAliases(item, HEADER_ALIASES.aliciIlce)
          ),
          paletTipi: asText(
            findValueByAliases(item, HEADER_ALIASES.paletTipi)
          ),
          miktar: asText(
            findValueByAliases(item, HEADER_ALIASES.miktar)
          ),
          birim: asText(
            findValueByAliases(item, HEADER_ALIASES.birim)
          ),
        }))
        .filter((row) =>
          [
            row.irsaliyeNo,
            row.alici,
            row.aliciIlce,
            row.paletTipi,
            row.miktar,
          ].some((value) => String(value || "").trim())
        );

      const first = data[0];

      setForm((prev) => ({
        ...prev,

        seferNo:
          asText(findValueByAliases(first, HEADER_ALIASES.seferNo)) ||
          prev.seferNo,

        duzenlemeTarihi:
          normalizeExcelDate(
            findValueByAliases(first, HEADER_ALIASES.duzenlemeTarihi),
            false
          ) || prev.duzenlemeTarihi,

        fiiliSevkTarihiSaati:
          normalizeExcelDate(
            findValueByAliases(first, HEADER_ALIASES.fiiliSevkTarihiSaati),
            true
          ) || prev.fiiliSevkTarihiSaati,

        faturaNo:
          asText(findValueByAliases(first, HEADER_ALIASES.faturaNo)) ||
          prev.faturaNo,

        cikisMerkezi:
          asText(
            findValueByAliases(first, HEADER_ALIASES.cikisMerkezi)
          ) || prev.cikisMerkezi,

        gonderen:
          asText(findValueByAliases(first, HEADER_ALIASES.gonderen)) ||
          prev.gonderen,

        // Sol alttaki araç bilgileri içindeki "Plaka" alanına
        // Excel import sırasında otomatik veri yazmıyoruz.
        plaka: prev.plaka,

        plakaNo:
          asText(findValueByAliases(first, HEADER_ALIASES.plakaNo)) ||
          asText(findValueByAliases(first, HEADER_ALIASES.plaka)) ||
          prev.plakaNo,

        romorkPlakasi:
          asText(
            findValueByAliases(first, HEADER_ALIASES.romorkPlakasi)
          ) || prev.romorkPlakasi,

        soforeTeslimTarihSaat:
          normalizeExcelDate(
            findValueByAliases(
              first,
              HEADER_ALIASES.soforeTeslimTarihSaat
            ),
            true
          ) || prev.soforeTeslimTarihSaat,

        surucuAdSoyad:
          asText(
            findValueByAliases(first, HEADER_ALIASES.surucuAdSoyad)
          ) || prev.surucuAdSoyad,

        teslimAlanSurucu:
          asText(
            findValueByAliases(first, HEADER_ALIASES.teslimAlanSurucu)
          ) ||
          asText(
            findValueByAliases(first, HEADER_ALIASES.surucuAdSoyad)
          ) ||
          prev.teslimAlanSurucu,

        nakliyeTutari:
          asText(
            findValueByAliases(first, HEADER_ALIASES.nakliyeTutari)
          ) || prev.nakliyeTutari,

        kdv:
          asText(
            findValueByAliases(first, HEADER_ALIASES.kdv)
          ) || prev.kdv,

        toplam:
          asText(
            findValueByAliases(first, HEADER_ALIASES.toplam)
          ) || prev.toplam,
      }));

      setRows(mappedRows.length ? mappedRows : [createEmptyRow()]);

      setImportInfo({
        fileName: file.name,
        rowCount: mappedRows.length,
        sheetName: firstSheetName,
      });

      setMessage({
        type: "success",
        text: `${mappedRows.length} satır irsaliyeye yerleştirildi.`,
      });
    } catch (error) {
      console.error("İrsaliye Excel import error:", error);

      setMessage({
        type: "error",
        text: error?.message || "Excel dosyası okunamadı.",
      });
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  return (
    <div className="irs-screen">
      <section className="irs-control-panel no-print">
        <div className="irs-control-main">
          <div className="irs-control-icon">
            <FileSpreadsheet size={21} />
          </div>

          <div className="irs-control-copy">
            <strong>İrsaliye Hazırla</strong>
            <span>
              Excel’den içeri aktarın veya alanları doldurun. OKI önizlemesinde hazır kağıda yalnızca seçili veriler basılır.
            </span>
          </div>

          <div className="irs-control-stats">
            <span>
              <b>{filledRowCount}</b>
              Satır
            </span>

            {importInfo && (
              <span className="irs-file-chip">
                <FileSpreadsheet size={14} />
                {importInfo.fileName}
              </span>
            )}
          </div>
        </div>

        <div className="irs-toolbar">
          <input
            ref={fileInputRef}
            className="irs-file-input"
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={(e) => importExcel(e.target.files?.[0])}
          />

          <button
            type="button"
            className="irs-template-button"
            onClick={downloadExcelTemplate}
          >
            <FileSpreadsheet size={16} />
            Excel Şablonu
          </button>

          <button
            type="button"
            className="irs-import-button"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload size={16} />
            Excel İçe Aktar
          </button>

          <button type="button" onClick={addRow}>
            <Plus size={16} />
            Satır Ekle
          </button>

          <button type="button" onClick={clearAll}>
            <RotateCcw size={16} />
            Temizle
          </button>

          <button
            type="button"
            className="irs-settings-button"
            onClick={() => setPrintSettingsOpen((prev) => !prev)}
          >
            <Settings size={16} />
            Yerleşim / Baskı Ayarı
          </button>

          <button
            type="button"
            className="irs-print-button"
            onClick={() => printPreprintedForm()}
          >
            <Printer size={16} />
            OKI Önizle / Yazdır
          </button>
        </div>

        {printSettingsOpen && <PrintSettings form={form} rows={rows} layout={printLayout} onChange={setPrintLayout} onSave={savePrintCalibration} onTest={() => printPreprintedForm(true)} />}

        {message && (
          <div className={`irs-message irs-message--${message.type}`}>
            {message.type === "success" ? (
              <CheckCircle2 size={16} />
            ) : (
              <AlertCircle size={16} />
            )}

            <span>{message.text}</span>

            <button
              type="button"
              onClick={() => setMessage(null)}
              aria-label="Mesajı kapat"
            >
              <X size={14} />
            </button>
          </div>
        )}
      </section>

      <main className="irs-paper" id="irsaliye-print">
        <header className="irs-header">
          <section className="irs-brand">
            <img
              className="irs-logo-image"
              src={odakLogo}
              alt="ODAK Lojistik"
            />

            <div className="irs-company">
              <strong>ODAK TEDARİK ZİNCİRİ VE LOJİSTİK A.Ş.</strong>
              <span>Yamanevler Mah. Ahmet Tevfik İleri Cad.</span>
              <span>Onur Ofis Park İş Merkezi B1 Blok 10 C 3</span>
              <span>Ümraniye İstanbul</span>
              <span>
                Alemdağ VD.:6340954050 &nbsp; Tic.Sicil No:288042-5
              </span>
              <span>
                Tel: 0216 594 09 99 &nbsp;&nbsp; Faks: 0216 594 09 98
              </span>
            </div>
          </section>

          <section className="irs-seal-section">
            <img
              className="irs-official-logo"
              src={resmiLogo}
              alt=""
            />

            <label className="irs-il-code">
              <span>İL KODU :</span>

              <PlainInput
                value={form.ilKodu}
                onChange={(value) =>
                  updateForm("ilKodu", value)
                }
                ariaLabel="İl Kodu"
              />
            </label>

            <label className="irs-serial">
              <span>
                Seri <strong>A</strong> Sıra No
              </span>

              <PlainInput
                value={form.seriSiraNo}
                onChange={(value) =>
                  updateForm("seriSiraNo", value)
                }
                ariaLabel="Seri A Sıra No"
              />
            </label>
          </section>

          <section className="irs-title-section">
            <h1>TAŞIMA İRSALİYESİ (TOPLU)</h1>

            <div className="irs-header-fields">
              <LabeledLine
                label="Sefer No."
                value={form.seferNo}
                onChange={(v) => updateForm("seferNo", v)}
              />

              <LabeledLine
                label="Düzenleme Tarihi"
                value={form.duzenlemeTarihi}
                onChange={(v) =>
                  updateForm("duzenlemeTarihi", v)
                }
              />

              <LabeledLine
                label="Fiili Sevk Tarihi/Saati"
                value={form.fiiliSevkTarihiSaati}
                onChange={(v) =>
                  updateForm("fiiliSevkTarihiSaati", v)
                }
              />

              <LabeledLine
                label="Fatura No."
                value={form.faturaNo}
                onChange={(v) =>
                  updateForm("faturaNo", v)
                }
              />

              <LabeledLine
                label="Çıkış Merkezi"
                value={form.cikisMerkezi}
                onChange={(v) =>
                  updateForm("cikisMerkezi", v)
                }
              />

              <LabeledLine
                label="Gönderen"
                value={form.gonderen}
                onChange={(v) =>
                  updateForm("gonderen", v)
                }
              />
            </div>
          </section>
        </header>

        <section className="irs-cargo-box">
          <table className="irs-cargo-table">
            <thead>
              <tr>
                <th>İRSALİYE NO.</th>
                <th>ALICI</th>
                <th>ALICI / İLÇE</th>
                <th>PALET TİPİ</th>
                <th>MİKTAR</th>
              </tr>
            </thead>

            <tbody>
              {rows.map((row, index) => (
                <tr key={index}>
                  <td>
                    <FitInput
                      value={row.irsaliyeNo}
                      onChange={(v) =>
                        updateRow(index, "irsaliyeNo", v)
                      }
                      maxFontSize={7.2}
                      minFontSize={3.2}
                    />
                  </td>

                  <td>
                    <FitInput
                      value={row.alici}
                      onChange={(v) =>
                        updateRow(index, "alici", v)
                      }
                      maxFontSize={7.0}
                      minFontSize={3.0}
                    />
                  </td>

                  <td>
                    <FitInput
                      value={row.aliciIlce}
                      onChange={(v) =>
                        updateRow(index, "aliciIlce", v)
                      }
                      maxFontSize={7.0}
                      minFontSize={3.0}
                    />
                  </td>

                  <td>
                    <FitInput
                      value={row.paletTipi}
                      onChange={(v) =>
                        updateRow(index, "paletTipi", v)
                      }
                      maxFontSize={7.0}
                      minFontSize={3.0}
                    />
                  </td>

                  <td className="irs-qty-cell">
                    <div className="irs-qty-wrap">
                      <FitInput
                        value={row.miktar}
                        onChange={(v) =>
                          updateRow(index, "miktar", v)
                        }
                        maxFontSize={7.0}
                        minFontSize={3.2}
                      />

                      <FitInput
                        className="irs-unit"
                        value={row.birim}
                        onChange={(v) =>
                          updateRow(index, "birim", v)
                        }
                        maxFontSize={6.8}
                        minFontSize={3.2}
                      />
                    </div>

                    {rows.length > 1 && (
                      <button
                        type="button"
                        className="irs-row-remove no-print"
                        onClick={() => removeRow(index)}
                        title="Satırı sil"
                      >
                        <Trash2 size={12} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="irs-tevdi">
            <span className="irs-tevdi-label">
              MALIN KİMİN TARAFINDAN TEVDİ EDİLDİĞİ,
            </span>
            <span className="irs-tevdi-value">
              {form.gonderen}
            </span>
          </div>
        </section>

        <section className="irs-signatures">
          <div className="irs-sign-cell">
            <span>Şoföre Mal Teslim Eden / İmza</span>

            <PlainInput
              className="irs-sign-main"
              value={form.soforeTeslimEden}
              onChange={(v) =>
                updateForm("soforeTeslimEden", v)
              }
            />

            <span>Tarih ve Saat</span>

            <PlainInput
              value={form.soforeTeslimTarihSaat}
              onChange={(v) =>
                updateForm("soforeTeslimTarihSaat", v)
              }
            />
          </div>

          <div className="irs-sign-cell">
            <span>Şoför / İmza</span>

            <PlainInput
              className="irs-sign-main"
              value={form.soforImza}
              onChange={(v) =>
                updateForm("soforImza", v)
              }
            />
          </div>

          <div className="irs-sign-cell">
            <span>Teslim Alan / İmza</span>

            <PlainInput
              className="irs-sign-main"
              value={form.teslimAlan}
              onChange={(v) =>
                updateForm("teslimAlan", v)
              }
            />

            <span>Tarih ve Saat</span>

            <PlainInput
              value={form.teslimAlanTarihSaat}
              onChange={(v) =>
                updateForm("teslimAlanTarihSaat", v)
              }
            />
          </div>

          <div className="irs-sign-cell irs-note-cell">
            <span>Not:</span>

            <textarea
              value={form.not}
              onChange={(e) =>
                updateForm("not", e.target.value)
              }
            />
          </div>
        </section>

        <section className="irs-bottom">
          <div className="irs-bottom-left">
            <div className="irs-vehicle-driver">
              <div className="irs-vehicle-fields">
                <LabeledLine
                  label="Sahibi"
                  value={form.sahibi}
                  onChange={(v) =>
                    updateForm("sahibi", v)
                  }
                />

                <LabeledLine
                  label="Plaka"
                  value={form.plaka}
                  onChange={(v) =>
                    updateForm("plaka", v)
                  }
                />

                <LabeledLine
                  label="Ruhsat No"
                  value={form.ruhsatNo}
                  onChange={(v) =>
                    updateForm("ruhsatNo", v)
                  }
                />

                <LabeledLine
                  label="Ver. Yer."
                  value={form.verYeri}
                  onChange={(v) =>
                    updateForm("verYeri", v)
                  }
                />
              </div>

              <div className="irs-driver-area">
                <div className="irs-driver-side-title">
                  Şoför ile ilgili bilgiler
                </div>

                <div className="irs-driver-fields">
                  <LabeledLine
                    label="Ad ve Soyadı"
                    value={form.surucuAdSoyad}
                    onChange={(v) =>
                      updateForm("surucuAdSoyad", v)
                    }
                  />

                  <LabeledLine
                    label="Ehliyet No."
                    value={form.ehliyetNo}
                    onChange={(v) =>
                      updateForm("ehliyetNo", v)
                    }
                  />

                  <LabeledLine
                    label="Verildiği Yer"
                    value={form.ehliyetVerildigiYer}
                    onChange={(v) =>
                      updateForm(
                        "ehliyetVerildigiYer",
                        v
                      )
                    }
                  />
                </div>
              </div>
            </div>

            <div className="irs-legal">
              Şoför, belge muhtevası malzemeyi alıcıya eksiksiz ve
              kusursuz teslim mükelleftir.
              <br />
              Alıcının malın tesellümünü gösteren kaşe ve imzası
              alınmadıkça şoförün nakliye bedelleri ödenmez.
            </div>

            <div className="irs-delivery-grid">
              <div className="irs-delivery-cell">
                <div className="irs-delivery-title">
                  <strong>TESLİM EDEN -</strong>
                  <span> İsim/İmza</span>
                </div>

                <PlainInput
                  value={form.teslimEdenImza}
                  onChange={(v) =>
                    updateForm("teslimEdenImza", v)
                  }
                />
              </div>

              <div className="irs-delivery-cell">
                <div className="irs-delivery-title">
                  <strong>TESLİM ALAN -</strong>
                  <span> İsim/İmza</span>
                </div>

                <PlainInput
                  value={form.teslimAlanImza}
                  onChange={(v) =>
                    updateForm("teslimAlanImza", v)
                  }
                />
              </div>

              <div className="irs-plate-cell">
                <label>
                  <strong>PLAKA NO.</strong>

                  <PlainInput
                    value={form.plakaNo}
                    onChange={(v) =>
                      updateForm("plakaNo", v)
                    }
                  />
                </label>

                <label>
                  <strong>Y. RÖMORK PLAKASI</strong>

                  <PlainInput
                    value={form.romorkPlakasi}
                    onChange={(v) =>
                      updateForm("romorkPlakasi", v)
                    }
                  />
                </label>

                <label>
                  <strong>TESLİM ALAN -</strong>
                  <span> SÜRÜCÜ</span>

                  <PlainInput
                    value={form.teslimAlanSurucu}
                    onChange={(v) =>
                      updateForm(
                        "teslimAlanSurucu",
                        v
                      )
                    }
                  />
                </label>
              </div>
            </div>
          </div>

          <div className="irs-finance">
            <LabeledLine
              label="NAKLİYE TUTARI"
              value={form.nakliyeTutari}
              onChange={(v) =>
                updateForm("nakliyeTutari", v)
              }
            />

            <LabeledLine
              label="KDV."
              value={form.kdv}
              onChange={(v) =>
                updateForm("kdv", v)
              }
            />

            <LabeledLine
              label="TOPLAM"
              value={form.toplam}
              onChange={(v) =>
                updateForm("toplam", v)
              }
            />

            <LabeledLine
              label="MOTORİN AVANSI"
              value={form.motorinAvansi}
              onChange={(v) =>
                updateForm("motorinAvansi", v)
              }
            />

            <LabeledLine
              label="NAKİT AVANS"
              value={form.nakitAvans}
              onChange={(v) =>
                updateForm("nakitAvans", v)
              }
            />

            <LabeledLine
              label="SİGORTA"
              value={form.sigorta}
              onChange={(v) =>
                updateForm("sigorta", v)
              }
            />

            <LabeledLine
              label="BAKİYE"
              value={form.bakiye}
              onChange={(v) =>
                updateForm("bakiye", v)
              }
            />

            <LabeledLine
              label="YAZI İLE (Bakiyesi)"
              value={form.yaziIle}
              onChange={(v) =>
                updateForm("yaziIle", v)
              }
            />
          </div>
        </section>

        <footer className="irs-footer">
          <span>
            B.Yeri: akbantform Matbaacılık San.Tic.Ltd.Şti.-Litros
            Yolu 2.Mat.Sit. 2NA6-8-10 Topkapı-İSTANBUL
          </span>

          <span>Bu belge 1 Asıl 2 Surettir.</span>
        </footer>
      </main>


    </div>
  );
}

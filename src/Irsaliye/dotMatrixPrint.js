// Millimetres on paper; screen form styling is deliberately independent.
export const SETTINGS_KEY = 'irsaliye.dotMatrix.v1';
const field = (key, label, x, y, width, height = 7.2, enabled = true, align = 'left') =>
  ({ key, label, x, y, width, height, enabled, align });
export const DEFAULT_LAYOUT = {
  pageWidth: 210, pageHeight: 297, offsetX: 0, offsetY: 0,
  fontWeight: 700, inkBoost: 0.25, fontSize: 10, lineHeight: 3.6, rowTop: 57.5, rowBottom: 240, rowGap: 1.6,
  fields: [
    field('seferNo', 'Sefer No', 164, 7.5, 39),
    field('duzenlemeTarihi', 'Düzenleme tarihi', 164, 14.8, 39),
    field('fiiliSevkTarihiSaati', 'Fiili sevk tarihi / saati', 164, 22.1, 39),
    field('faturaNo', 'Fatura No', 164, 29.4, 39),
    field('cikisMerkezi', 'Çıkış merkezi', 164, 36.7, 39),
    field('gonderen', 'Gönderen', 164, 44, 39),
    field('soforeTeslimTarihSaat', 'Şoföre teslim tarihi / saati', 17, 250, 42),
    field('surucuAdSoyad', 'Sürücü adı soyadı', 103, 267.5, 45),
    field('plakaNo', 'Plaka No', 103, 276.5, 35),
    field('teslimAlanSurucu', 'Teslim alan sürücü', 103, 285.5, 45),
    field('nakliyeTutari', 'Nakliye tutarı', 178, 266, 27, 6.8, true, 'right'),
    field('kdv', 'KDV', 178, 273, 27, 6.8, true, 'right'),
    field('toplam', 'Toplam', 178, 280, 27, 6.8, true, 'right'),
    field('romorkPlakasi', 'Römork plakası', 103, 281, 35, 4, false),
    field('seriSiraNo', 'Seri sıra No', 90, 35, 45, 7.2, false),
    field('ilKodu', 'İl kodu', 90, 25, 20, 7.2, false),
    field('soforeTeslimEden', 'Şoföre teslim eden', 17, 242, 42, 7.2, false),
    field('teslimAlan', 'Teslim alan', 103, 242, 45, 7.2, false),
    field('teslimAlanTarihSaat', 'Teslim alma tarihi', 103, 250, 45, 7.2, false),
    field('not', 'Not', 155, 242, 50, 18, false),
  ],
  columns: [
    field('irsaliyeNo', 'İrsaliye No', 17, 0, 35),
    field('alici', 'Alıcı', 54, 0, 67),
    field('aliciIlce', 'Alıcı / ilçe', 123, 0, 39),
    field('paletTipi', 'Palet tipi', 164, 0, 22),
    field('miktar', 'Miktar ve birim', 188, 0, 17, 7.2, true, 'right'),
  ],
};

export function loadLayout(storage) {
  const fallback = JSON.parse(JSON.stringify(DEFAULT_LAYOUT));
  try {
    const saved = JSON.parse(storage.getItem(SETTINGS_KEY));
    if (saved) {
      for (const key of Object.keys(fallback)) {
        if (typeof fallback[key] === 'number' && Number.isFinite(saved[key])) fallback[key] = saved[key];
      }
      for (const group of ['fields', 'columns']) {
        fallback[group] = fallback[group].map(item => {
          const stored = saved[group]?.find(value => value.key === item.key);
          if (!stored) return item;
          const result = { ...item };
          for (const key of ['x', 'y', 'width', 'height']) if (Number.isFinite(stored[key])) result[key] = stored[key];
          if (typeof stored.enabled === 'boolean') result.enabled = stored.enabled;
          return result;
        });
      }
      if (!validateLayout(fallback).length) return fallback;
      return JSON.parse(JSON.stringify(DEFAULT_LAYOUT));
    }
    for (const [key, legacy] of [['offsetX', 'irsaliyePrintOffsetX'], ['offsetY', 'irsaliyePrintOffsetY'], ['fontSize', 'irsaliyePrintFontSize']]) {
      const raw = storage.getItem(legacy);
      if (raw !== null && raw.trim() !== '' && Number.isFinite(Number(raw))) fallback[key] = Number(raw);
    }
    if (validateLayout(fallback).length) return JSON.parse(JSON.stringify(DEFAULT_LAYOUT));
  } catch (_) { /* Storage may be unavailable; printing still works. */ }
  return fallback;
}

const overlap = (a, b) => a.x < b.x + b.width - 0.01 && a.x + a.width > b.x + 0.01 && a.y < b.y + b.height - 0.01 && a.y + a.height > b.y + 0.01;
export function validateLayout(layout) {
  const errors = [];
  for (const [key, min, max] of [['pageWidth', 100, 500], ['pageHeight', 100, 600], ['offsetX', -50, 50], ['offsetY', -50, 50], ['fontWeight', 400, 700], ['inkBoost', 0, 0.35], ['fontSize', 8, 14], ['lineHeight', 2.8, 10], ['rowTop', 0, 600], ['rowBottom', 0, 600], ['rowGap', 0, 20]]) {
    if (!Number.isFinite(layout[key]) || layout[key] < min || layout[key] > max) errors.push(`${key}: ${min}–${max} aralığında bir sayı girin.`);
  }
  if (layout.lineHeight < layout.fontSize * 25.4 / 72) errors.push('Satır yüksekliği yazı boyutundan küçük olamaz.');
  if (layout.rowBottom <= layout.rowTop + layout.lineHeight) errors.push('Tablo bitişi başlangıcından en az bir satır aşağıda olmalı.');
  const boxes = layout.fields.filter(f => f.enabled).concat(layout.columns.filter(f => f.enabled).map(f => ({ ...f, y: layout.rowTop, height: layout.rowBottom - layout.rowTop })));
  for (const b of boxes) {
    if (![b.x, b.y, b.width, b.height].every(Number.isFinite) || b.width <= 0 || b.height <= 0 || b.x + layout.offsetX < 0 || b.y + layout.offsetY < 0 || b.x + b.width + layout.offsetX > layout.pageWidth || b.y + b.height + layout.offsetY > layout.pageHeight) errors.push(`${b.label}: alan kağıt sınırları dışında veya ölçüsü geçersiz.`);
  }
  boxes.forEach((a, i) => boxes.slice(i + 1).forEach(b => { if (overlap(a, b)) errors.push(`${a.label} / ${b.label}: alanlar çakışıyor.`); }));
  if (!boxes.length) errors.push('En az bir baskı alanı seçin.');
  return errors;
}

export const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
// Never shrink or silently discard text.
export function wrapText(value, capacity) {
  const text = String(value ?? '').replace(/\r\n?/g, '\n').replace(/\t/g, ' ');
  return text.split('\n').flatMap(line => {
    const chars = Array.from(line);
    if (!chars.length) return [''];
    const result = [];
    for (let i = 0; i < chars.length;) {
      let end = Math.min(i + capacity, chars.length);
      if (end < chars.length && chars[end] !== ' ') {
        const space = chars.slice(i, end).lastIndexOf(' ');
        if (space > 0) end = i + space + 1;
      }
      result.push(chars.slice(i, end).join(''));
      i = end;
    }
    return result;
  });
}

// Measure Arial at the actual print size; proportional letters have different widths.
export function wrapPrintText(value, width, layout) {
  if (typeof document === 'undefined') return wrapText(value, Math.max(1, Math.floor((width - 0.5) / (layout.fontSize * 25.4 / 72 * 0.6))));
  const context = document.createElement('canvas').getContext('2d');
  if (!context) return wrapText(value, Math.max(1, Math.floor((width - 0.5) / (layout.fontSize * 25.4 / 72))));
  context.font = (layout.fontWeight ?? 700) + ' ' + (layout.fontSize * 96 / 72) + 'px Arial';
  const available = Math.max(1, (width - 0.5) * 96 / 25.4);
  return String(value ?? '').replace(/\r\n?/g, '\n').replace(/\t/g, ' ').split('\n').flatMap(line => {
    const chars = Array.from(line), result = [];
    if (!chars.length) return [''];
    for (let start = 0; start < chars.length;) {
      let end = start + 1;
      while (end < chars.length && context.measureText(chars.slice(start, end + 1).join('')).width <= available) end++;
      if (end < chars.length && chars[end] !== ' ') {
        const space = chars.slice(start, end).lastIndexOf(' ');
        if (space > 0) end = start + space + 1;
      }
      result.push(chars.slice(start, end).join('')); start = end;
    }
    return result;
  });
}

export function buildPrintDocument(form, rows, layout, calibration = false) {
  const errors = validateLayout(layout);
  if (errors.length) throw new Error(errors.join('\n'));
  const fields = layout.fields.filter(f => f.enabled);
  const columns = layout.columns.filter(f => f.enabled);
  const draw = (f, lines, y = f.y, height = f.height) => `<div class="value" data-label="${escapeHtml(f.label)}" style="left:${f.x + layout.offsetX}mm;top:${y + layout.offsetY}mm;width:${f.width}mm;height:${height}mm;text-align:${f.align}">${escapeHtml(lines.join('\n'))}</div>`;
  const header = fields.map(f => {
    const lines = wrapPrintText(calibration ? "" : form[f.key], f.width, layout);
    if (lines.join('').trim() && lines.length * layout.lineHeight > f.height + 0.01) throw new Error(`${f.label}: değer alana sığmıyor. Baskı ayarından alanı genişletin veya yüksekliğini artırın.`);
    return draw(f, lines);
  }).join('');
  const pages = [];
  let content = '', y = layout.rowTop;
  const printableRows = (calibration ? [] : rows).filter(row => columns.some(c => String(c.key === 'miktar' ? [row.miktar, row.birim].filter(v => v !== '' && v != null).join(' ') : row[c.key] ?? '').trim()));
  for (const [index, row] of printableRows.entries()) {
    const cells = columns.map(c => ({ field: c, lines: wrapPrintText(c.key === 'miktar' ? [row.miktar, row.birim].filter(v => v !== '' && v != null).join(' ') : row[c.key], c.width, layout) }));
    const height = Math.max(1, ...cells.map(c => c.lines.length)) * layout.lineHeight;
    if (height > layout.rowBottom - layout.rowTop) throw new Error(`${index + 1}. satır tek sayfaya sığmıyor. Alan genişliğini veya tablo yüksekliğini artırın.`);
    if (y + height > layout.rowBottom + 0.01) { pages.push(content); content = ''; y = layout.rowTop; }
    const rowY = y;
    content += cells.map(c => draw(c.field, c.lines, rowY, height)).join('');
    y += height + layout.rowGap;
  }
  if (content || !pages.length) pages.push(content);
  if (!calibration && !printableRows.length && !fields.some(f => String(form[f.key] ?? '').trim())) throw new Error('Seçili alanlarda yazdırılacak veri yok.');
  const guides = calibration ? fields.concat(columns.map(c => ({ ...c, y: layout.rowTop, height: layout.rowBottom - layout.rowTop }))).map(f => `<div class="guide" style="left:${f.x + layout.offsetX}mm;top:${f.y + layout.offsetY}mm;width:${f.width}mm;height:${f.height}mm">${escapeHtml(f.label)} (${f.x}, ${f.y})</div>`).join('') : '';
  const html = `<!doctype html><html lang="tr"><head><meta charset="utf-8"><title>OKI İrsaliye — ${calibration ? 'Kalibrasyon' : 'Veri baskısı'}</title><style>
    @page { size: ${layout.pageWidth}mm ${layout.pageHeight}mm; margin: 0; }
    * { box-sizing: border-box; } body { margin:0; background:#e8edf2; color:#111; font:14px Arial,sans-serif; }
    .toolbar { padding:16px; background:white; position:sticky; top:0; z-index:1; } button { padding:10px 20px; cursor:pointer; } #status { white-space:pre-line; }
    .page { position:relative; width:${layout.pageWidth}mm; height:${layout.pageHeight}mm; margin:12px auto; background:white; }
    .value { position:absolute; font:${layout.fontWeight ?? 700} ${layout.fontSize}pt/${layout.lineHeight}mm Arial,Helvetica,sans-serif; white-space:pre; color:#000; -webkit-text-fill-color:#000; -webkit-text-stroke:${layout.inkBoost ?? 0.25}px #000; print-color-adjust:exact; -webkit-print-color-adjust:exact; }
    .guide { position:absolute; border:0.2mm dashed #000; font:7pt monospace; }
    @media print { html,body { margin:0; padding:0; background:white; } .toolbar { display:none; } .page { margin:0; break-after:page; page-break-after:always; } .page:last-child { break-after:auto; page-break-after:auto; } body.blocked .page { display:none; } body.blocked .toolbar { display:block; } body.blocked button { display:none; } }
    </style></head><body class="blocked"><div class="toolbar"><strong>${calibration ? 'KALİBRASYON — boş kağıda basın' : 'Sadece seçili veriler'} · ${pages.length} sayfa</strong><p>Kağıt: ${layout.pageWidth} × ${layout.pageHeight} mm · Ölçek %100 / gerçek boyut · Kenar boşluğu yok · Üstbilgi ve altbilgi kapalı. Her sayfa için ayrı hazır form kullanın; ortak bilgiler ve tutarlar her sayfada tekrarlanır.</p><button id="print" disabled>Yazdır</button> <button id="close">Kapat</button><p id="status" role="status">Yazı tipi ve alanlar kontrol ediliyor…</p></div>${pages.map(p => `<section class="page">${calibration ? guides : header + p}</section>`).join('')}</body></html>`;
  return { html, pageCount: pages.length };
}

export function openPrintPreview(form, rows, layout, calibration = false) {
  const result = buildPrintDocument(form, rows, layout, calibration);
  const popup = window.open('', '_blank', 'width=1000,height=850');
  if (!popup) throw new Error('Baskı önizlemesi açılamadı. Bu site için açılır pencerelere izin verin.');
  popup.document.open(); popup.document.write(result.html); popup.document.close();
  popup.document.getElementById('close').onclick = () => popup.close();
  const check = () => {
    if (popup.closed) return false;
    const overflow = Array.from(popup.document.querySelectorAll('.value')).filter(el => el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1);
    popup.document.body.classList.toggle('blocked', overflow.length > 0);
    popup.document.getElementById('print').disabled = overflow.length > 0;
    popup.document.getElementById('status').textContent = overflow.length ? `Baskı durduruldu: ${[...new Set(overflow.map(el => el.dataset.label))].join(', ')} alanları taşıyor. Ayarları genişletin.` : 'Baskı hazır. Önce boş kağıtta hizalamayı kontrol edin.';
    return overflow.length === 0;
  };
  popup.document.getElementById('print').onclick = () => { if (check()) { popup.focus(); popup.print(); } };
  popup.addEventListener('beforeprint', check);
  Promise.resolve(popup.document.fonts?.ready).then(() => { if (!popup.closed) popup.requestAnimationFrame(check); });
  return result.pageCount;
}

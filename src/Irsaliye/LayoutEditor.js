import React, { useEffect, useRef, useState } from 'react';
import { validateLayout, wrapPrintText } from './dotMatrixPrint';
import './LayoutEditor.css';

const clone = value => JSON.parse(JSON.stringify(value));
const clamp = (n, min, max) => Math.min(max, Math.max(min, n));
const round = n => Math.round(n * 10) / 10;

// Freeze the existing screen form as a blank, non-interactive reference.
// It stays inside the editor and is never passed to the print document.
export function captureFormBackground() {
  const source = document.getElementById('irsaliye-print');
  if (!source) return null;
  const copy = source.cloneNode(true);
  const originals = [source, ...source.querySelectorAll('*')];
  const copies = [copy, ...copy.querySelectorAll('*')];
  originals.forEach((element, index) => {
    const target = copies[index], computed = window.getComputedStyle(element);
    for (const key of computed) target.style.setProperty(key, computed.getPropertyValue(key));
    target.style.setProperty('animation', 'none');
    target.style.setProperty('transition', 'none');
    target.removeAttribute('tabindex');
    if (target.tagName === 'IMG') target.setAttribute('src', element.src);
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) {
      target.setAttribute('value', ''); target.removeAttribute('placeholder');
      if (target.tagName !== 'INPUT') target.textContent = '';
      target.setAttribute('disabled', '');
    }
  });
  copy.querySelectorAll('button,script,.no-print').forEach(element => element.remove());
  copy.querySelectorAll('.irs-tevdi-value').forEach(element => { element.textContent = ''; });
  const width = source.offsetWidth, height = source.offsetHeight;
  if (!width || !height) return null;
  Object.assign(copy.style, { margin: '0', position: 'absolute', left: '0', top: '0', transform: 'none', boxShadow: 'none', width: width + 'px', height: height + 'px' });
  return { html: copy.outerHTML, width, height };
}

export default function LayoutEditor({ layout, onChange, form = {}, rows = [] }) {
  const svg = useRef(null);
  const gesture = useRef(null);
  const [selected, setSelected] = useState(null);
  const [zoom, setZoom] = useState(1);
  const [background, setBackground] = useState('');
  const [formBackground, setFormBackground] = useState(null);
  useEffect(() => { setFormBackground(captureFormBackground()); }, []);
  const [history, setHistory] = useState([]);
  const [imageError, setImageError] = useState('');
  const remember = () => setHistory(h => [...h.slice(-29), clone(layout)]);
  const point = event => {
    const p = svg.current.createSVGPoint(); p.x = event.clientX; p.y = event.clientY;
    return p.matrixTransform(svg.current.getScreenCTM().inverse());
  };
  const begin = (event, group, key, resize = false) => {
    if (event.button !== 0) return;
    event.preventDefault(); event.stopPropagation();
    remember(); setSelected(`${group}:${key}`);
    gesture.current = { start: point(event), base: clone(layout), group, key, resize };
    svg.current.setPointerCapture(event.pointerId);
  };
  const move = event => {
    const drag = gesture.current; if (!drag) return;
    const pos = point(event), dx = pos.x - drag.start.x, dy = pos.y - drag.start.y;
    const next = clone(drag.base);
    if (drag.group === 'table') {
      if (drag.resize) next.rowBottom = round(clamp(next.rowBottom + dy, next.rowTop + next.lineHeight + 0.1, next.pageHeight - next.offsetY));
      else {
        const delta = clamp(dy, -next.offsetY - next.rowTop, next.pageHeight - next.offsetY - next.rowBottom);
        next.rowTop = round(next.rowTop + delta); next.rowBottom = round(next.rowBottom + delta);
      }
    } else {
      const f = next[drag.group].find(item => item.key === drag.key);
      if (drag.resize) {
        f.width = round(clamp(f.width + dx, 3, next.pageWidth - next.offsetX - f.x));
        if (drag.group === 'fields') f.height = round(clamp(f.height + dy, next.lineHeight, next.pageHeight - next.offsetY - f.y));
      } else {
        f.x = round(clamp(f.x + dx, -next.offsetX, next.pageWidth - next.offsetX - f.width));
        if (drag.group === 'fields') f.y = round(clamp(f.y + dy, -next.offsetY, next.pageHeight - next.offsetY - f.height));
      }
    }
    onChange(next);
  };
  const finish = () => { gesture.current = null; };
  const keyboard = (event, group, key) => {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
    event.preventDefault(); remember();
    const next = clone(layout), f = next[group].find(item => item.key === key), step = event.shiftKey ? 1 : 0.1;
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') f.x = round(clamp(f.x + (event.key === 'ArrowRight' ? step : -step), -next.offsetX, next.pageWidth - next.offsetX - f.width));
    else if (group === 'fields') f.y = round(clamp(f.y + (event.key === 'ArrowDown' ? step : -step), -next.offsetY, next.pageHeight - next.offsetY - f.height));
    onChange(next);
  };
  const draw = (f, group) => {
    const x = f.x + layout.offsetX, y = (group === 'columns' ? layout.rowTop : f.y) + layout.offsetY;
    const height = group === 'columns' ? Math.max(layout.lineHeight, 12) : f.height;
    const row = rows.find(r => Object.values(r).some(v => String(v ?? '').trim())) || {};
    const raw = group === 'columns' ? (f.key === 'miktar' ? [row.miktar, row.birim].filter(v => v != null && v !== '').join(' ') : row[f.key]) : form[f.key];
    const lines = wrapPrintText(String(raw ?? '').trim() ? raw : f.label, f.width, layout);
    const active = selected === `${group}:${f.key}`;
    return <g key={f.key} data-field={f.key} data-group={group} tabIndex="0" role="button" aria-label={`${f.label} taşı`} onFocus={() => setSelected(`${group}:${f.key}`)} onKeyDown={event => keyboard(event, group, f.key)} onPointerDown={event => begin(event, group, f.key)} className={`layout-field ${active ? 'selected' : ''}`}>
      <title>{f.label} — sürükleyerek taşıyın; köşeden boyutlandırın</title>
      <rect x={x} y={y} width={f.width} height={height} className="layout-field-box" />
      <svg x={x} y={y} width={f.width} height={height} overflow="hidden" pointerEvents="none">
        <text x={f.align === 'right' ? f.width : 0} y={layout.fontSize * 25.4 / 72 * 0.82} textAnchor={f.align === 'right' ? 'end' : 'start'} fill="#000" fontFamily="Arial, Helvetica, sans-serif" fontWeight={layout.fontWeight ?? 700} fontSize={layout.fontSize * 25.4 / 72} stroke="#000" strokeWidth={(layout.inkBoost ?? 0.25) * 25.4 / 96}>
          {lines.map((line, i) => <tspan key={i} x={f.align === 'right' ? f.width : 0} dy={i ? layout.lineHeight : 0}>{line}</tspan>)}
        </text>
      </svg>
      <rect data-resize={f.key} x={x + f.width - 2} y={y + height - 2} width="3" height="3" className="layout-handle" onPointerDown={event => begin(event, group, f.key, true)} />
    </g>;
  };
  const errors = validateLayout(layout);
  return <section className="layout-editor">
    <h3>Kağıt üzerinde sürükleyerek yerleştirin</h3>
    <p>Alanı tutup taşıyın, sağ alt köşesinden boyutlandırın. Tablo sütunları sağa-sola taşınır; tabloyu mavi tutamacından topluca yukarı-aşağı taşıyın. Seçili alanda ok tuşları ince ayar, Shift + ok daha büyük adım sağlar.</p>
    <div className="layout-tools">
      <label>Yakınlaştırma <select value={zoom} onChange={e => setZoom(Number(e.target.value))}><option value="0.75">%75</option><option value="1">%100</option><option value="1.5">%150</option><option value="2">%200</option></select></label>
      <button type="button" disabled={!history.length} onClick={() => { onChange(history[history.length - 1]); setHistory(h => h.slice(0, -1)); }}>Son hareketi geri al</button>
      <label className="layout-upload">Farklı bir form fotoğrafı seç (isteğe bağlı)<input type="file" accept="image/png,image/jpeg,image/webp" onChange={e => {
        const file = e.target.files?.[0]; if (!file) return;
        if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 15 * 1024 * 1024) { setImageError('PNG, JPG veya WebP seçin (en fazla 15 MB).'); return; }
        const reader = new FileReader(); reader.onload = () => { setBackground(String(reader.result)); setImageError(''); }; reader.onerror = () => setImageError('Görsel okunamadı.'); reader.readAsDataURL(file); e.target.value = '';
      }} /></label>
      {background && <button type="button" onClick={() => setBackground('')}>Mevcut irsaliye görseline dön</button>}
    </div>
    <p className="layout-note">Ekrandaki mevcut irsaliye formu otomatik arka plandır; dosya seçmeniz gerekmez. Boş alanlarda alan adı, dolu alanlarda veriniz gösterilir. Kutular ve arka plan baskıya girmez. Fotoğrafı yalnızca kağıt kenarları kalacak şekilde kırpılmış olarak seçin; bu görsel sadece bu düzenleme oturumunda tutulur.</p>
    {imageError && <p role="alert">{imageError}</p>}
    <div className="layout-scroll"><div style={{ position: 'relative', width: layout.pageWidth * 3.7795 * zoom, height: layout.pageHeight * 3.7795 * zoom }}>
      {formBackground && !background && <iframe title="Mevcut irsaliye formu — otomatik arka plan" sandbox="" tabIndex="-1" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 0, pointerEvents: 'none', opacity: 0.55 }} srcDoc={'<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;padding:0;width:100%;height:100%;overflow:hidden;background:white}.reference{transform-origin:top left;transform:scale(' + layout.pageWidth * 3.7795 * zoom / formBackground.width + ',' + layout.pageHeight * 3.7795 * zoom / formBackground.height + ');}</style></head><body><div class="reference">' + formBackground.html + '</div></body></html>'} />}
      <svg ref={svg} className="layout-sheet" width={layout.pageWidth * 3.7795 * zoom} height={layout.pageHeight * 3.7795 * zoom} viewBox={`0 0 ${layout.pageWidth} ${layout.pageHeight}`} onPointerMove={move} onPointerUp={finish} onPointerCancel={finish} onLostPointerCapture={finish} aria-label="Sürükle bırak irsaliye yerleşimi">
        <defs><pattern id="irs-layout-grid" width="5" height="5" patternUnits="userSpaceOnUse"><path d="M 5 0 L 0 0 0 5" fill="none" stroke="#e2e8f0" strokeWidth="0.15" /></pattern></defs>
        <rect width="100%" height="100%" fill={formBackground && !background ? 'transparent' : 'white'} />
        {background ? <image href={background} width={layout.pageWidth} height={layout.pageHeight} preserveAspectRatio="none" opacity="0.5" /> : !formBackground ? <rect width="100%" height="100%" fill="url(#irs-layout-grid)" /> : null}
        <rect x="0" y={layout.rowTop + layout.offsetY} width={layout.pageWidth} height={layout.rowBottom - layout.rowTop} fill="#dbeafe" fillOpacity="0.15" stroke="#60a5fa" strokeWidth="0.2" pointerEvents="none" />
        <g className="layout-table-grip" data-table="move" onPointerDown={e => begin(e, 'table', 'move')}><rect x="1" y={layout.rowTop + layout.offsetY - 5} width="42" height="4.5" rx="1" fill="#1d4ed8" /><text x="2" y={layout.rowTop + layout.offsetY - 1.8} fontSize="2.6" fill="white">↕ Tabloyu taşı</text></g>
        <g className="layout-table-grip" data-table="resize" onPointerDown={e => begin(e, 'table', 'bottom', true)}><rect x="1" y={layout.rowBottom + layout.offsetY - 2} width="42" height="4" rx="1" fill="#1d4ed8" /><text x="2" y={layout.rowBottom + layout.offsetY + 0.8} fontSize="2.6" fill="white">↕ Tablo bitişi</text></g>
        {layout.fields.filter(f => f.enabled).map(f => draw(f, 'fields'))}
        {layout.columns.filter(f => f.enabled).map(f => draw(f, 'columns'))}
      </svg>
    </div></div>
    {errors.length > 0 && <div className="layout-errors" role="status"><strong>Kaydetmeden / yazdırmadan önce düzeltin:</strong><ul>{errors.map((error, i) => <li key={i}>{error}</li>)}</ul></div>}
    <p>Aşağıdaki “Ayarları kaydet” düğmesi yerleşimi saklar. Gerçek, çok sayfalı çıktıyı “OKI Önizle / Yazdır” ile kontrol edin.</p>
  </section>;
}


import React from 'react';
import { DEFAULT_LAYOUT } from './dotMatrixPrint';
import './PrintSettings.css';
import LayoutEditor from './LayoutEditor';

export default function PrintSettings({ layout, onChange, onSave, onTest, form, rows }) {
  const number = (label, key, step = 0.1) => <label key={key}>{label}<input type="number" step={step} value={layout[key]} onChange={e => onChange({ ...layout, [key]: e.target.value === '' ? '' : Number(e.target.value) })} /></label>;
  const updateField = (group, index, key, value) => onChange({ ...layout, [group]: layout[group].map((f, i) => i === index ? { ...f, [key]: value } : f) });
  return <section className="dot-settings">
    <h3>OKI sabit baskı düzeni</h3>
    <p>Ölçüler milimetredir. Başlangıç düzeni A4'tür; hazır formunuzun ölçülerine göre ayarlayın. Uzun satırlar aynı yazı boyutunda alt satıra geçer. Sığmayan kayıtlar sonraki forma aktarılır.</p>
    <p>Yazı tipi: <strong>Arial</strong>. Önizleme ve baskı aynı yazı tipini kullanır.</p>
    <label>Baskı koyuluğu<select value={layout.inkBoost > 0 ? 'strong' : layout.fontWeight >= 700 ? 'bold' : 'normal'} onChange={e => onChange({ ...layout, fontWeight: e.target.value === 'normal' ? 400 : 700, inkBoost: e.target.value === 'strong' ? 0.25 : 0 })}><option value="strong">Çok koyu (önerilen)</option><option value="bold">Kalın</option><option value="normal">Normal</option></select></label>
    <LayoutEditor layout={layout} onChange={onChange} form={form} rows={rows} />
    <details><summary>Gelişmiş ölçü ayarları (isteğe bağlı)</summary>
    <div className="dot-settings-grid">
      {number('Kağıt genişliği (mm)', 'pageWidth')}{number('Kağıt yüksekliği (mm)', 'pageHeight')}
      {number('Sağa kaydırma (+) / sola (−)', 'offsetX')}{number('Aşağı kaydırma (+) / yukarı (−)', 'offsetY')}
      {number('Yazı boyutu (8–14 pt)', 'fontSize', 0.5)}{number('Metin satır yüksekliği (mm)', 'lineHeight')}
      {number('Tablo başlangıcı Y (mm)', 'rowTop')}{number('Tablo bitişi Y (mm)', 'rowBottom')}{number('Kayıtlar arası boşluk (mm)', 'rowGap')}
    </div>
    </details>
    {['fields', 'columns'].map(group => <details key={group}><summary>{group === 'fields' ? 'Basılacak alanlar ve konumları' : 'Tablo sütunları ve konumları'}</summary><div className="dot-table-scroll"><table><thead><tr><th>Bas</th><th>Alan</th><th>X (mm)</th>{group === 'fields' && <th>Y (mm)</th>}<th>Genişlik (mm)</th>{group === 'fields' && <th>Yükseklik (mm)</th>}</tr></thead><tbody>{layout[group].map((f, index) => <tr key={f.key}>
      <td><input type="checkbox" aria-label={`${f.label} bas`} checked={f.enabled} onChange={e => updateField(group, index, 'enabled', e.target.checked)} /></td><th scope="row">{f.label}</th>
      {(group === 'fields' ? ['x', 'y', 'width', 'height'] : ['x', 'width']).map(key => <td key={key}><input type="number" step="0.1" aria-label={`${f.label} ${key}`} value={f[key]} onChange={e => updateField(group, index, key, e.target.value === '' ? '' : Number(e.target.value))} /></td>)}
    </tr>)}</tbody></table></div></details>)}
    <p>Logo, çizgi, başlık ve matbu metin normal çıktıya eklenmez. Kalibrasyon çıktısı alan sınırlarını gösterir.</p>
    <div className="dot-actions"><button type="button" onClick={onSave}>Ayarları kaydet</button><button type="button" onClick={onTest}>Kalibrasyon önizlemesi</button><button type="button" onClick={() => onChange(JSON.parse(JSON.stringify(DEFAULT_LAYOUT)))}>Varsayılan ölçüler</button></div>
  </section>;
}

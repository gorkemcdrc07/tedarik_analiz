import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, Bug, CheckCircle2, Clock3, FileImage, ImagePlus, Pencil, Plus, Search, Send, Settings2, Sparkles, Trash2, X } from "lucide-react";
import "./TicketCenter.css";

const KEY = "odak_system_tickets_v1";
const readTickets = () => { try { const rows = JSON.parse(localStorage.getItem(KEY) || "[]"); return Array.isArray(rows) ? rows : []; } catch { return []; } };
const saveTickets = (rows) => {
  const limited = rows.slice(0, 40);
  try { localStorage.setItem(KEY, JSON.stringify(limited)); }
  catch {
    const compact = limited.slice(0, 25).map((ticket, index) => index < 8 ? ticket : { ...ticket, attachments: [] });
    localStorage.setItem(KEY, JSON.stringify(compact));
  }
  window.dispatchEvent(new Event("odak-tickets-changed"));
};
const userInfo = () => { try { const user = JSON.parse(localStorage.getItem("loginUser") || "{}"); return { name: user.kullanici || user.kullanici_adi || localStorage.getItem("userName") || "Kullanıcı", role: String(user.rol || localStorage.getItem("userRole") || "kullanici").toLowerCase() }; } catch { return { name: "Kullanıcı", role: "kullanici" }; } };
const categoryMeta = { bug: ["Hata", Bug], update: ["Güncelleme", Settings2], edit: ["Düzenleme", Pencil], feature: ["Yeni özellik", Sparkles] };
const statusText = { open: "Açık", reviewing: "İnceleniyor", progress: "İşlemde", resolved: "Çözüldü", closed: "Kapandı" };
const priorityText = { low: "Düşük", normal: "Normal", high: "Yüksek", critical: "Kritik" };

const compressImage = (file) => new Promise((resolve, reject) => {
  if (!file.type.startsWith("image/")) return reject(new Error("Yalnızca görsel dosyası eklenebilir."));
  const reader = new FileReader();
  reader.onerror = () => reject(new Error("Görsel okunamadı."));
  reader.onload = () => {
    const image = new Image();
    image.onload = () => {
      const max = 1200, scale = Math.min(1, max / Math.max(image.width, image.height));
      const canvas = document.createElement("canvas"); canvas.width = Math.round(image.width * scale); canvas.height = Math.round(image.height * scale);
      canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);
      resolve({ name: file.name || `ekran-${Date.now()}.jpg`, type: "image/jpeg", data: canvas.toDataURL("image/jpeg", .7), width: canvas.width, height: canvas.height });
    };
    image.onerror = () => reject(new Error("Görsel açılamadı.")); image.src = reader.result;
  };
  reader.readAsDataURL(file);
});

const blankForm = (path) => ({ category: "bug", priority: "normal", title: "", description: "", steps: "", expected: "", page: path, attachments: [] });

export default function TicketCenter({ open, onClose, currentPath }) {
  const inputRef = useRef(null);
  const { name, role } = useMemo(userInfo, []);
  const [tickets, setTickets] = useState(readTickets);
  const [view, setView] = useState("list");
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [form, setForm] = useState(() => blankForm(currentPath));
  const [editingId, setEditingId] = useState(null);
  const [selected, setSelected] = useState(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (open) { setTickets(readTickets()); setForm((old) => ({ ...old, page: currentPath })); } }, [open, currentPath]);
  useEffect(() => { const refresh = () => setTickets(readTickets()); window.addEventListener("odak-tickets-changed", refresh); return () => window.removeEventListener("odak-tickets-changed", refresh); }, []);
  useEffect(() => { if (!open) return undefined; const paste = async (event) => { const files = [...(event.clipboardData?.files || [])].filter((file) => file.type.startsWith("image/")); if (!files.length || view !== "form") return; event.preventDefault(); await addImages(files); }; window.addEventListener("paste", paste); return () => window.removeEventListener("paste", paste); });

  const visible = tickets.filter((ticket) => (role === "admin" || ticket.created_by === name) && (filter === "all" || ticket.status === filter) && `${ticket.code} ${ticket.title} ${ticket.description}`.toLocaleLowerCase("tr-TR").includes(query.toLocaleLowerCase("tr-TR")));
  const openCount = tickets.filter((ticket) => (role === "admin" || ticket.created_by === name) && !["resolved", "closed"].includes(ticket.status)).length;

  const addImages = async (files) => {
    setError("");
    const available = Math.max(0, 3 - form.attachments.length);
    if (!available) return setError("En fazla 3 görsel ekleyebilirsiniz.");
    try { const images = await Promise.all(files.slice(0, available).map(compressImage)); setForm((old) => ({ ...old, attachments: [...old.attachments, ...images] })); }
    catch (err) { setError(err.message); }
  };
  const startNew = () => { setEditingId(null); setForm(blankForm(currentPath)); setError(""); setView("form"); };
  const editTicket = (ticket) => { setEditingId(ticket.id); setForm({ category: ticket.category, priority: ticket.priority, title: ticket.title, description: ticket.description, steps: ticket.steps || "", expected: ticket.expected || "", page: ticket.page, attachments: ticket.attachments || [] }); setView("form"); };
  const submit = () => {
    if (form.title.trim().length < 5 || form.description.trim().length < 10) return setError("Başlık en az 5, açıklama en az 10 karakter olmalı.");
    setSaving(true); const current = readTickets(); const timestamp = new Date().toISOString();
    if (editingId) {
      const next = current.map((ticket) => ticket.id === editingId ? { ...ticket, ...form, updated_at: timestamp, updated_by: name, history: [...(ticket.history || []), { action: "Ticket düzenlendi", actor: name, at: timestamp }] } : ticket);
      saveTickets(next); setTickets(next);
    } else {
      const seq = String((Number(localStorage.getItem("odak_ticket_sequence") || 0) + 1)).padStart(4, "0"); localStorage.setItem("odak_ticket_sequence", String(Number(seq)));
      const ticket = { ...form, id: `TKT-${Date.now()}`, code: `ODK-${new Date().getFullYear()}-${seq}`, status: "open", created_at: timestamp, created_by: name, role, browser: navigator.userAgent, screen: `${window.innerWidth}×${window.innerHeight}`, history: [{ action: "Ticket oluşturuldu", actor: name, at: timestamp }] };
      saveTickets([ticket, ...current]); setTickets([ticket, ...current]); setSelected(ticket);
    }
    setSaving(false); setView(editingId ? "list" : "detail"); setEditingId(null); setForm(blankForm(currentPath));
  };
  const updateStatus = (ticket, status) => { const at = new Date().toISOString(); const next = readTickets().map((item) => item.id === ticket.id ? { ...item, status, updated_at: at, updated_by: name, history: [...(item.history || []), { action: `Durum: ${statusText[status]}`, actor: name, at }] } : item); saveTickets(next); setTickets(next); setSelected(next.find((item) => item.id === ticket.id)); };
  const remove = (ticket) => { if (!window.confirm(`${ticket.code} silinsin mi?`)) return; const next = readTickets().filter((item) => item.id !== ticket.id); saveTickets(next); setTickets(next); setSelected(null); setView("list"); };

  if (!open) return null;
  return createPortal(<div className="tc-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className="tc-modal" role="dialog" aria-modal="true" aria-label="Destek ve ticket merkezi">
    <header className="tc-head"><div className="tc-brand"><span><Bug size={21}/></span><div><small>ODAK DESTEK MERKEZİ</small><h2>Ticket Yönetimi</h2></div>{openCount > 0 && <b>{openCount} açık</b>}</div><div><button onClick={startNew}><Plus size={16}/> Yeni ticket</button><button className="tc-close" onClick={onClose}><X size={19}/></button></div></header>
    {error && <div className="tc-error"><AlertTriangle size={15}/>{error}<button onClick={() => setError("")}><X size={13}/></button></div>}

    {view === "list" && <><div className="tc-toolbar"><label><Search size={15}/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Ticket ara..."/></label><div>{[["all","Tümü"],["open","Açık"],["progress","İşlemde"],["resolved","Çözüldü"]].map(([key,label]) => <button key={key} className={filter === key ? "active" : ""} onClick={() => setFilter(key)}>{label}</button>)}</div></div><div className="tc-list">{visible.length ? visible.map((ticket) => { const [label, Icon] = categoryMeta[ticket.category] || categoryMeta.bug; return <button className="tc-ticket" key={ticket.id} onClick={() => { setSelected(ticket); setView("detail"); }}><span className={`tc-type ${ticket.category}`}><Icon size={17}/></span><span className="tc-ticket-copy"><span><b>{ticket.code}</b><em className={`priority ${ticket.priority}`}>{priorityText[ticket.priority]}</em><em className={`status ${ticket.status}`}>{statusText[ticket.status]}</em></span><strong>{ticket.title}</strong><small>{label} · {ticket.created_by} · {new Date(ticket.created_at).toLocaleString("tr-TR")}</small></span>{ticket.attachments?.length > 0 && <span className="tc-image-count"><FileImage size={14}/>{ticket.attachments.length}</span>}</button>; }) : <div className="tc-empty"><CheckCircle2 size={27}/><b>Ticket bulunamadı</b><span>Yeni bir hata, güncelleme veya düzenleme talebi oluşturabilirsiniz.</span><button onClick={startNew}><Plus size={15}/> Ticket oluştur</button></div>}</div></>}

    {view === "form" && <div className="tc-form"><div className="tc-form-intro"><div><small>{editingId ? "TICKET DÜZENLE" : "YENİ DESTEK TALEBİ"}</small><h3>{editingId ? "Talebi güncelleyin" : "Ne üzerinde çalışalım?"}</h3><p>Detaylı açıklama ve ekran görüntüsü çözüm süresini kısaltır.</p></div><button onClick={() => setView("list")}><X size={16}/></button></div><div className="tc-categories">{Object.entries(categoryMeta).map(([key,[label,Icon]]) => <button key={key} className={form.category === key ? "active" : ""} onClick={() => setForm({ ...form, category: key })}><Icon size={17}/><span>{label}</span></button>)}</div><div className="tc-form-grid"><label className="wide">Kısa başlık<input value={form.title} maxLength={100} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="Örn. Tarife güncelle butonu çalışmıyor"/></label><label>Öncelik<select value={form.priority} onChange={(event) => setForm({ ...form, priority: event.target.value })}><option value="low">Düşük</option><option value="normal">Normal</option><option value="high">Yüksek</option><option value="critical">Kritik</option></select></label><label>İlgili ekran<input value={form.page} onChange={(event) => setForm({ ...form, page: event.target.value })}/></label><label className="wide">Açıklama<textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="Sorunu veya istediğiniz değişikliği detaylı anlatın..."/></label><label>Tekrarlama adımları<textarea value={form.steps} onChange={(event) => setForm({ ...form, steps: event.target.value })} placeholder="1. Sayfayı açtım..."/></label><label>Beklenen sonuç<textarea value={form.expected} onChange={(event) => setForm({ ...form, expected: event.target.value })} placeholder="Nasıl çalışmasını bekliyorsunuz?"/></label></div><div className={`tc-upload ${form.attachments.length ? "has-images" : ""}`} onClick={() => inputRef.current?.click()} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); addImages([...event.dataTransfer.files]); }}><input ref={inputRef} type="file" accept="image/*" multiple hidden onChange={(event) => addImages([...event.target.files])}/><ImagePlus size={23}/><div><b>Ekran görüntüsü ekleyin</b><span>Sürükleyin, seçin veya Ctrl+V ile yapıştırın. En fazla 3 görsel.</span></div></div>{form.attachments.length > 0 && <div className="tc-previews">{form.attachments.map((image,index) => <div key={`${image.name}-${index}`}><img src={image.data} alt={image.name}/><button onClick={() => setForm((old) => ({ ...old, attachments: old.attachments.filter((_,i) => i !== index) }))}><Trash2 size={13}/></button><small>{image.name}</small></div>)}</div>}<footer className="tc-form-actions"><span><Clock3 size={14}/> Sayfa ve cihaz bilgisi otomatik eklenecek.</span><div><button onClick={() => setView("list")}>Vazgeç</button><button className="primary" disabled={saving} onClick={submit}><Send size={15}/>{editingId ? "Değişiklikleri kaydet" : "Ticket oluştur"}</button></div></footer></div>}

    {view === "detail" && selected && <div className="tc-detail"><div className="tc-detail-head"><button onClick={() => setView("list")}>← Listeye dön</button><div>{(role === "admin" || selected.created_by === name) && <button onClick={() => editTicket(selected)}><Pencil size={14}/> Düzenle</button>}<button className="danger" onClick={() => remove(selected)}><Trash2 size={14}/></button></div></div><div className="tc-detail-title"><div><span>{selected.code}</span><h3>{selected.title}</h3><p>{categoryMeta[selected.category]?.[0]} · {priorityText[selected.priority]} öncelik</p></div><em className={`status ${selected.status}`}>{statusText[selected.status]}</em></div><div className="tc-detail-grid"><article><small>AÇIKLAMA</small><p>{selected.description}</p></article><article><small>TEKRARLAMA ADIMLARI</small><p>{selected.steps || "Belirtilmedi"}</p></article><article><small>BEKLENEN SONUÇ</small><p>{selected.expected || "Belirtilmedi"}</p></article><article><small>SİSTEM BİLGİSİ</small><p>{selected.page}<br/>{selected.screen}<br/>{selected.created_by}</p></article></div>{selected.attachments?.length > 0 && <div className="tc-detail-images">{selected.attachments.map((image,index) => <a href={image.data} target="_blank" rel="noreferrer" key={index}><img src={image.data} alt={image.name}/></a>)}</div>}<div className="tc-detail-bottom"><div className="tc-history"><h4>İşlem geçmişi</h4>{[...(selected.history || [])].reverse().map((item,index) => <div key={index}><i/><span><b>{item.action}</b><small>{item.actor} · {new Date(item.at).toLocaleString("tr-TR")}</small></span></div>)}</div><div className="tc-status-actions"><h4>Durumu güncelle</h4>{[["reviewing","İncelemeye al"],["progress","İşleme başla"],["resolved","Çözüldü"],["closed","Kapat"]].map(([status,label]) => <button key={status} disabled={selected.status === status} onClick={() => updateStatus(selected,status)}>{label}</button>)}</div></div></div>}
  </section></div>, document.body);
}

export const getOpenTicketCount = () => { const { name, role } = userInfo(); return readTickets().filter((ticket) => (role === "admin" || ticket.created_by === name) && !["resolved","closed"].includes(ticket.status)).length; };

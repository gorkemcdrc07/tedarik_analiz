const RULES_KEY = "odak_yakit_contract_rules_v2";
const QUEUE_KEY = "odak_yakit_escalation_queue_v2";
const AUDIT_KEY = "odak_yakit_audit_v2";
const SNAPSHOT_KEY = "odak_yakit_snapshots_v2";
const SUPPLIER_KEY = "odak_yakit_supplier_tariffs_v1";

export const CUSTOMER_RULES = {
  "FASDAT": { threshold: 7, factor: 50, provider: "Shell", location: "Afyon Merkez", storageKey: null },
  "KWS": { threshold: 12, factor: 30, provider: "Petrol Ofisi", location: "Eskişehir Merkez", storageKey: "kws_yakit_tarifeleri" },
  "ETİ": { threshold: 10, factor: 50, provider: "Petrol Ofisi", location: "Eskişehir Odunpazarı", storageKey: "eti_yakit_tarifeleri_v2" },
  "CMC AGRO": { threshold: 5, factor: 50, provider: "Petrol Ofisi", location: "Bursa Karacabey", storageKey: "cmc_agro_yakit_tarifeleri" },
  "CORTEVA": { threshold: 5, factor: 40, provider: "Petrol Ofisi", location: "Adana Merkez", storageKey: "corteva_yakit_tarifeleri" },
  "EFOR ÇAY": { threshold: 5, factor: 50, provider: "Petrol Ofisi", location: "Tokat Erbaa", storageKey: "efor_cay_yakit_tarifeleri" },
  "TEVERPAN": { threshold: 5, factor: 50, provider: "Petrol Ofisi", location: "Tekirdağ Çerkezköy", storageKey: "teverpan_yakit_tarifeleri" },
  "BİM": { threshold: 5, factor: 40, provider: "Petrol Ofisi", location: "İstanbul Sancaktepe", storageKey: "bim_yakit_tarifeleri", vatMode: "KDV hariç (+KDV)" }
};

const read = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key) || "null") ?? fallback; } catch { return fallback; } };
const write = (key, value) => localStorage.setItem(key, JSON.stringify(value));
const now = () => new Date().toISOString();
const currentUser = () => { const user = read("loginUser", {}); return user?.kullanici || user?.kullanici_adi || localStorage.getItem("userName") || "Sistem"; };
const deviceInfo = () => ({ userAgent: navigator.userAgent, platform: navigator.platform || "Bilinmiyor", language: navigator.language || "tr-TR" });

export const getContractRules = () => {
  const saved = read(RULES_KEY, {});
  return Object.fromEntries(Object.entries(CUSTOMER_RULES).map(([customer, base]) => [customer, {
    ...base, mode: "approval", anomalyLimit: 20, sourceTolerance: 3, fuelType: "Motorin", vatMode: base.vatMode || "KDV dahil", ...saved[customer]
  }]));
};
export const saveContractRule = (customer, changes) => { const rules = getContractRules(); rules[customer] = { ...rules[customer], ...changes }; write(RULES_KEY, rules); window.dispatchEvent(new Event("odak-escalation-changed")); return rules[customer]; };
export const getEscalationQueue = () => read(QUEUE_KEY, []);
export const getEscalationAudit = () => read(AUDIT_KEY, []);
export const getEscalationSnapshots = () => read(SNAPSHOT_KEY, []);

const audit = (event, data = {}) => {
  const rows = getEscalationAudit();
  const entry = { id: `AUD-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, event, actor: currentUser(), created_at: now(), device: deviceInfo(), ...data };
  write(AUDIT_KEY, [entry, ...rows].slice(0, 1000));
  return entry;
};

const priceKey = (key) => /(^|_)(fiyat|price|ton_tl|tir|kirkayak|kamyon|lowbed|acik|kapali|dorse|tl_ton)/i.test(String(key));
const collectPrices = (value, path = [], output = []) => {
  if (Array.isArray(value)) value.forEach((item, index) => collectPrices(item, [...path, index], output));
  else if (value && typeof value === "object") Object.entries(value).forEach(([key, item]) => {
    if (typeof item === "number" && Number.isFinite(item) && item > 0 && (priceKey(key) || path.includes("fiyatlar"))) output.push({ path: [...path, key], value: item, side: path.includes("alis") ? "buy" : "sale" });
    else collectPrices(item, [...path, key], output);
  });
  return output;
};
const setPath = (root, path, value) => { let cursor = root; path.slice(0, -1).forEach((key) => { cursor = cursor[key]; }); cursor[path[path.length - 1]] = value; };
const clone = (value) => JSON.parse(JSON.stringify(value));
const money = (value) => Math.round(Number(value) * 100) / 100;

export const buildEscalationPreview = ({ customer, oldFuel, newFuel, secondaryPrice = null }) => {
  const rule = getContractRules()[customer];
  if (!rule) return { ok: false, reason: "Müşteri kuralı bulunamadı." };
  const oldValue = Number(oldFuel), newValue = Number(newFuel);
  if (!(oldValue > 0) || !(newValue > 0)) return { ok: false, reason: "Geçerli eski ve yeni yakıt fiyatı gerekli." };
  const fuelChange = ((newValue / oldValue) - 1) * 100;
  const appliedRate = fuelChange * (Number(rule.factor) / 100);
  const thresholdPassed = Math.abs(fuelChange) >= Number(rule.threshold);
  const anomaly = Math.abs(fuelChange) >= Number(rule.anomalyLimit);
  const sourceDifference = Number(secondaryPrice) > 0 ? Math.abs(((newValue / Number(secondaryPrice)) - 1) * 100) : null;
  const sourceVerified = sourceDifference == null ? null : sourceDifference <= Number(rule.sourceTolerance);
  const tariffs = rule.storageKey ? read(rule.storageKey, null) : null;
  const entries = tariffs ? collectPrices(tariffs) : [];
  const comparison = entries.map((item) => ({
    path: item.path.join("."), side: item.side, before: money(item.value),
    after: money(item.value * (1 + appliedRate / 100)),
    difference: money(item.value * (appliedRate / 100))
  }));
  const buyImpact = comparison.filter((item) => item.side === "buy").reduce((sum, item) => sum + item.difference, 0);
  const salesImpact = comparison.filter((item) => item.side === "sale").reduce((sum, item) => sum + item.difference, 0);
  const blockers = [!thresholdPassed && "Müşteri eşiği sağlanmadı", anomaly && "Anormal fiyat değişimi", sourceVerified === false && "İkinci kaynak farkı toleransı aştı", !entries.length && "Tarife verisi bulunamadı"].filter(Boolean);
  return { ok: true, customer, rule, oldFuel: oldValue, newFuel: newValue, secondaryPrice: Number(secondaryPrice) || null, fuelChange, appliedRate, thresholdPassed, anomaly, sourceVerified, sourceDifference, entries, comparison, blockers, affectedRoutes: comparison.length, buyImpact, salesImpact, created_at: now() };
};

const saveQueue = (rows) => { write(QUEUE_KEY, rows.slice(0, 300)); window.dispatchEvent(new Event("odak-escalation-changed")); };
export const enqueueEscalation = (preview, status = "pending") => {
  const queue = getEscalationQueue();
  const fingerprint = `${preview.customer}:${preview.oldFuel}:${preview.newFuel}`;
  const existing = queue.find((row) => row.fingerprint === fingerprint);
  if (existing) return { ...existing, duplicate: true };
  const row = { ...preview, approval_status: status === "pending" ? "pending" : status, id: `ESC-${Date.now()}-${preview.customer.replace(/\s+/g, "-")}`, fingerprint, status, selected: false, created_at: now() };
  saveQueue([row, ...queue]); audit("ESCALATION_CREATED", { customer: preview.customer, escalationId: row.id, oldFuel: preview.oldFuel, newFuel: preview.newFuel, appliedRate: preview.appliedRate, status });
  return row;
};

export const applyEscalation = (id, { force = false } = {}) => {
  const queue = getEscalationQueue(), row = queue.find((item) => item.id === id);
  if (!row) return { ok: false, reason: "İşlem bulunamadı." };
  if (!force && row.blockers?.length) return { ok: false, reason: row.blockers.join("; ") };
  const rule = getContractRules()[row.customer], before = rule?.storageKey ? read(rule.storageKey, null) : null;
  if (!before) return { ok: false, reason: "Tarife verisi bulunamadı." };
  const after = clone(before), rate = Number(row.appliedRate) / 100;
  const entries = collectPrices(after);
  entries.forEach((item) => setPath(after, item.path, money(item.value * (1 + rate))));
  const supplierTariffs = read(SUPPLIER_KEY, {});
  const supplierBefore = clone(supplierTariffs[row.customer] || []);
  const supplierAfter = supplierBefore.map((item) => ({ ...item, value: money(Number(item.value) * (1 + rate)) }));
  if (supplierBefore.length) { supplierTariffs[row.customer] = supplierAfter; write(SUPPLIER_KEY, supplierTariffs); }
  const snapshot = { id: `SNP-${Date.now()}`, escalationId: id, customer: row.customer, storageKey: rule.storageKey, before, after, supplierBefore, supplierAfter, created_at: now(), actor: currentUser() };
  write(SNAPSHOT_KEY, [snapshot, ...getEscalationSnapshots()].slice(0, 100));
  write(rule.storageKey, after);
  saveQueue(queue.map((item) => item.id === id ? { ...item, status: "completed", approval_status: "approved", approved_at: item.approved_at || now(), approved_by: item.approved_by || currentUser(), completed_at: now(), completed_by: currentUser(), snapshotId: snapshot.id } : item));
  audit("TARIFF_APPLIED", { customer: row.customer, escalationId: id, snapshotId: snapshot.id, oldFuel: row.oldFuel, newFuel: row.newFuel, appliedRate: row.appliedRate, affected: entries.length });
  window.dispatchEvent(new Event("odak-fuel-updated"));
  return { ok: true, snapshot };
};

export const approveEscalation = (id, note = "") => {
  const queue = getEscalationQueue(), row = queue.find((item) => item.id === id);
  if (!row) return { ok: false, reason: "Onay kaydı bulunamadı." };
  if (!["pending", "postponed", "suspicious"].includes(row.status)) return { ok: false, reason: "Bu kayıt artık onay beklemiyor." };
  saveQueue(queue.map((item) => item.id === id ? { ...item, status: "processing", approval_status: "approved", approved_at: now(), approved_by: currentUser(), approval_note: note } : item));
  audit("ESCALATION_APPROVED", { customer: row.customer, escalationId: id, note });
  return applyEscalation(id, { force: false });
};

export const rejectEscalation = (id, reason, note = "") => {
  if (!reason) return { ok: false, reason: "Reddetme nedeni seçilmelidir." };
  const queue = getEscalationQueue(), row = queue.find((item) => item.id === id);
  if (!row) return { ok: false, reason: "Onay kaydı bulunamadı." };
  saveQueue(queue.map((item) => item.id === id ? { ...item, status: "rejected", approval_status: "rejected", rejected_at: now(), rejected_by: currentUser(), rejection_reason: reason, rejection_note: note } : item));
  audit("ESCALATION_REJECTED", { customer: row.customer, escalationId: id, reason, note });
  return { ok: true };
};

export const postponeEscalation = (id, hours = 24) => {
  const queue = getEscalationQueue(), row = queue.find((item) => item.id === id);
  if (!row) return { ok: false, reason: "Onay kaydı bulunamadı." };
  const until = new Date(Date.now() + Number(hours) * 3600000).toISOString();
  saveQueue(queue.map((item) => item.id === id ? { ...item, status: "postponed", approval_status: "postponed", postponed_until: until, postponed_by: currentUser() } : item));
  audit("ESCALATION_POSTPONED", { customer: row.customer, escalationId: id, hours });
  return { ok: true, until };
};

export const approveEscalationBatch = (ids) => ids.map((id) => ({ id, ...approveEscalation(id) }));

export const rollbackEscalation = (snapshotId) => {
  const snapshots = getEscalationSnapshots(), snapshot = snapshots.find((item) => item.id === snapshotId);
  if (!snapshot) return { ok: false, reason: "Geri alma kaydı bulunamadı." };
  write(snapshot.storageKey, snapshot.before);
  const supplierTariffs = read(SUPPLIER_KEY, {}); supplierTariffs[snapshot.customer] = snapshot.supplierBefore || []; write(SUPPLIER_KEY, supplierTariffs);
  saveQueue(getEscalationQueue().map((item) => item.id === snapshot.escalationId ? { ...item, status: "rolled_back", rolled_back_at: now(), rolled_back_by: currentUser() } : item));
  audit("TARIFF_ROLLED_BACK", { customer: snapshot.customer, escalationId: snapshot.escalationId, snapshotId });
  window.dispatchEvent(new Event("odak-fuel-updated"));
  return { ok: true };
};

export const ignoreEscalation = (id) => { saveQueue(getEscalationQueue().map((item) => item.id === id ? { ...item, status: "ignored", acted_at: now(), acted_by: currentUser() } : item)); audit("ESCALATION_IGNORED", { escalationId: id }); };
export const applyEscalationBatch = (ids) => ids.map((id) => ({ id, ...applyEscalation(id) }));

export const processFuelChange = (payload) => {
  const preview = buildEscalationPreview(payload);
  if (!preview.ok || !preview.thresholdPassed) return preview;
  if (preview.anomaly || preview.sourceVerified === false) return enqueueEscalation(preview, "suspicious");
  const mode = preview.rule.mode;
  if (mode === "notify") return enqueueEscalation(preview, "notified");
  const queued = enqueueEscalation(preview, mode === "auto" ? "processing" : "pending");
  if (queued.duplicate) return queued;
  if (mode === "auto") return { ...queued, application: applyEscalation(queued.id) };
  return queued;
};

// ===== Yakıt Yönetim Merkezi V3 =====
const RULE_HISTORY_KEY = "odak_yakit_rule_history_v3";
const COMMENTS_KEY = "odak_yakit_approval_comments_v3";
const ROLES_KEY = "odak_yakit_role_permissions_v3";
const HEALTH_KEY = "odak_yakit_source_health_v3";
const ROLLBACK_REQUEST_KEY = "odak_yakit_rollback_requests_v3";

export const getRuleHistory = () => read(RULE_HISTORY_KEY, []);
export const saveVersionedContractRule = (customer, changes, reason = "Kural güncellendi") => {
  const before = getContractRules()[customer];
  const after = saveContractRule(customer, changes);
  const versions = getRuleHistory();
  const version = versions.filter(x => x.customer === customer).length + 1;
  const item = { id:`RULE-${Date.now()}`, customer, version, before, after, reason, actor:currentUser(), created_at:now() };
  write(RULE_HISTORY_KEY, [item, ...versions].slice(0,500));
  audit("RULE_UPDATED", { customer, version, reason, before, after });
  return item;
};

export const getApprovalComments = (escalationId) => read(COMMENTS_KEY, []).filter(x => x.escalationId === escalationId);
export const addApprovalComment = (escalationId, text) => {
  if (!String(text||"").trim()) return null;
  const item = { id:`COM-${Date.now()}`, escalationId, text:String(text).trim(), actor:currentUser(), created_at:now() };
  write(COMMENTS_KEY, [item, ...read(COMMENTS_KEY, [])].slice(0,1000));
  audit("APPROVAL_COMMENT", { escalationId, commentId:item.id });
  window.dispatchEvent(new Event("odak-escalation-changed")); return item;
};

export const DEFAULT_ROLE_PERMISSIONS = {
  admin:["view","submit","approve","reject","rules","rollback"],
  yonetici:["view","submit","approve","reject","rollback"],
  operasyon:["view","submit"],
  kullanici:["view"]
};
export const getRolePermissions = () => ({...DEFAULT_ROLE_PERMISSIONS, ...read(ROLES_KEY,{})});
export const saveRolePermissions = (roles) => { write(ROLES_KEY,roles); audit("ROLE_PERMISSIONS_UPDATED",{}); return roles; };
export const currentFuelRole = () => { const u=read("loginUser",{}); return String(u?.rol || localStorage.getItem("userRole") || "kullanici").toLocaleLowerCase("tr-TR"); };
export const canFuel = (action) => (getRolePermissions()[currentFuelRole()] || getRolePermissions().kullanici || []).includes(action);

export const getApprovalSla = (row) => {
  const hours = Math.max(0,(Date.now()-new Date(row.created_at).getTime())/3600000);
  return { hours, level:hours>=6?"critical":hours>=2?"warning":"normal", label:hours>=6?"Gecikmiş":hours>=2?"Yaklaşıyor":"Normal" };
};

export const simulateFuelPrice = (newFuel, baselines={}) => Object.keys(getContractRules()).map(customer => {
  const oldFuel=Number(baselines[customer] || localStorage.getItem(`odak_last_fuel_${customer}`) || 0);
  if(!(oldFuel>0)) return {customer,ok:false,reason:"Referans fiyat yok"};
  return buildEscalationPreview({customer,oldFuel,newFuel:Number(newFuel)});
});

export const setFuelSourceHealth = (source, payload={}) => { const all=read(HEALTH_KEY,{}); all[source]={source,status:"ok",...payload,checked_at:now()}; write(HEALTH_KEY,all); if(all[source].status==="error") createAutomaticFuelTicket({title:`${source} yakıt kaynağı hatası`,description:all[source].message||`${source} kaynağından veri alınamadı.`,priority:"critical"}); return all[source]; };
export const getFuelSourceHealth = () => read(HEALTH_KEY,{
  "Petrol Ofisi":{source:"Petrol Ofisi",status:"unknown",message:"Henüz kontrol edilmedi"},
  "Shell":{source:"Shell",status:"unknown",message:"Henüz kontrol edilmedi"},
  "Supabase":{source:"Supabase",status:"unknown",message:"Bağlantı durumu bekleniyor"},
  "Yakıt Otomasyonu":{source:"Yakıt Otomasyonu",status:"unknown",message:"Çalışma bilgisi bekleniyor"}
});

export const requestRollbackApproval = (snapshotId, reason="") => {
  const snapshot=getEscalationSnapshots().find(x=>x.id===snapshotId); if(!snapshot)return {ok:false,reason:"Snapshot bulunamadı."};
  const rows=read(ROLLBACK_REQUEST_KEY,[]); const item={id:`RB-${Date.now()}`,snapshotId,escalationId:snapshot.escalationId,customer:snapshot.customer,reason,status:"pending",requested_by:currentUser(),created_at:now()};
  write(ROLLBACK_REQUEST_KEY,[item,...rows]); audit("ROLLBACK_REQUESTED",item); window.dispatchEvent(new Event("odak-escalation-changed")); return {ok:true,item};
};
export const getRollbackRequests = () => read(ROLLBACK_REQUEST_KEY,[]);
export const decideRollbackRequest = (id, approved) => { const rows=getRollbackRequests(), row=rows.find(x=>x.id===id); if(!row)return {ok:false,reason:"Talep bulunamadı."}; const result=approved?rollbackEscalation(row.snapshotId):{ok:true}; write(ROLLBACK_REQUEST_KEY,rows.map(x=>x.id===id?{...x,status:approved&&result.ok?"approved":"rejected",decided_by:currentUser(),decided_at:now()}:x)); audit(approved?"ROLLBACK_APPROVED":"ROLLBACK_REJECTED",{requestId:id}); return result; };

export const createAutomaticFuelTicket = ({title,description,priority="high",page="/finans/yakit-hesaplama"}) => {
  const key="odak_system_tickets_v1", tickets=read(key,[]); const duplicate=tickets.find(t=>t.auto_fuel && t.title===title && !["resolved","closed"].includes(t.status)); if(duplicate)return duplicate;
  const seq=String(Number(localStorage.getItem("odak_ticket_sequence")||0)+1).padStart(4,"0"); localStorage.setItem("odak_ticket_sequence",String(Number(seq)));
  const item={id:`TKT-${Date.now()}`,code:`ODK-${new Date().getFullYear()}-${seq}`,category:"bug",priority,title,description,steps:"Yakıt otomasyonu tarafından otomatik oluşturuldu.",expected:"Yakıt kaynağı/işlem tekrar sağlıklı çalışmalı.",page,attachments:[],status:"open",created_at:now(),created_by:"Yakıt Otomasyonu",role:"system",auto_fuel:true,history:[{action:"Otomatik ticket oluşturuldu",actor:"Yakıt Otomasyonu",at:now()}]};
  write(key,[item,...tickets].slice(0,40)); window.dispatchEvent(new Event("odak-tickets-changed")); audit("AUTO_TICKET_CREATED",{ticket:item.code,title}); return item;
};

export const getCustomerTimeline = (customer) => getEscalationAudit().filter(x=>x.customer===customer).sort((a,b)=>new Date(b.created_at)-new Date(a.created_at));
export const getDailyFuelSummary = () => { const day=new Date().toISOString().slice(0,10), q=getEscalationQueue().filter(x=>String(x.created_at).startsWith(day)); return {date:day,checked:Object.keys(getContractRules()).length,created:q.length,pending:q.filter(x=>["pending","postponed","suspicious"].includes(x.status)).length,approved:q.filter(x=>["processing","completed"].includes(x.status)).length,rejected:q.filter(x=>x.status==="rejected").length,affected:q.reduce((s,x)=>s+Number(x.affectedRoutes||0),0)}; };

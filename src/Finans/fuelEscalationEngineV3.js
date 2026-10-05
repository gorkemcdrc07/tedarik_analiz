import {
  buildEscalationPreview,
  getContractRules,
  getEscalationAudit,
  getEscalationQueue,
  getEscalationSnapshots,
  rollbackEscalation,
  saveContractRule
} from "./fuelEscalationEngine";

export * from "./fuelEscalationEngine";

const RULE_HISTORY_KEY = "odak_yakit_rule_history_v3";
const COMMENTS_KEY = "odak_yakit_approval_comments_v3";
const ROLES_KEY = "odak_yakit_role_permissions_v3";
const HEALTH_KEY = "odak_yakit_source_health_v3";
const ROLLBACK_REQUEST_KEY = "odak_yakit_rollback_requests_v3";
const AUDIT_KEY = "odak_yakit_audit_v2";

const read = (key, fallback) => {
  try { return JSON.parse(localStorage.getItem(key) || "null") ?? fallback; }
  catch { return fallback; }
};
const write = (key, value) => localStorage.setItem(key, JSON.stringify(value));
const now = () => new Date().toISOString();
const currentUser = () => {
  const user = read("loginUser", {});
  return user?.kullanici || user?.kullanici_adi || localStorage.getItem("userName") || "Sistem";
};
const audit = (event, data = {}) => {
  const rows = read(AUDIT_KEY, []);
  const entry = { id:`AUD-${Date.now()}-${Math.random().toString(36).slice(2,6)}`, event, actor:currentUser(), created_at:now(), ...data };
  write(AUDIT_KEY, [entry, ...rows].slice(0,1000));
  return entry;
};
const changed = () => window.dispatchEvent(new Event("odak-escalation-changed"));

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

export const getApprovalComments = escalationId => read(COMMENTS_KEY, []).filter(x => x.escalationId === escalationId);
export const addApprovalComment = (escalationId, text) => {
  if (!String(text || "").trim()) return null;
  const item = { id:`COM-${Date.now()}`, escalationId, text:String(text).trim(), actor:currentUser(), created_at:now() };
  write(COMMENTS_KEY, [item, ...read(COMMENTS_KEY, [])].slice(0,1000));
  audit("APPROVAL_COMMENT", { escalationId, commentId:item.id }); changed(); return item;
};

export const DEFAULT_ROLE_PERMISSIONS = {
  admin:["view","submit","approve","reject","rules","rollback"],
  yonetici:["view","submit","approve","reject","rollback"],
  operasyon:["view","submit"],
  kullanici:["view"]
};
export const getRolePermissions = () => ({...DEFAULT_ROLE_PERMISSIONS, ...read(ROLES_KEY,{})});
export const saveRolePermissions = roles => { write(ROLES_KEY, roles); audit("ROLE_PERMISSIONS_UPDATED",{}); return roles; };
export const currentFuelRole = () => {
  const u = read("loginUser", {});
  return String(u?.rol || localStorage.getItem("userRole") || "kullanici").toLocaleLowerCase("tr-TR");
};
export const canFuel = action => (getRolePermissions()[currentFuelRole()] || getRolePermissions().kullanici || []).includes(action);

export const getApprovalSla = row => {
  const created = new Date(row?.created_at).getTime();
  const hours = Number.isFinite(created) ? Math.max(0,(Date.now()-created)/3600000) : 0;
  return { hours, level:hours>=6?"critical":hours>=2?"warning":"normal", label:hours>=6?"Gecikmiş":hours>=2?"Yaklaşıyor":"Normal" };
};

export const simulateFuelPrice = (newFuel, baselines={}) => Object.keys(getContractRules()).map(customer => {
  const oldFuel = Number(baselines[customer] || localStorage.getItem(`odak_last_fuel_${customer}`) || 0);
  if (!(oldFuel > 0)) return {customer,ok:false,reason:"Referans fiyat yok"};
  return buildEscalationPreview({customer,oldFuel,newFuel:Number(newFuel)});
});

export const createAutomaticFuelTicket = ({title,description,priority="high",page="/finans/yakit-hesaplama"}) => {
  const key="odak_system_tickets_v1", tickets=read(key,[]);
  const duplicate=tickets.find(t=>t.auto_fuel && t.title===title && !["resolved","closed"].includes(t.status));
  if (duplicate) return duplicate;
  const next=Number(localStorage.getItem("odak_ticket_sequence")||0)+1;
  localStorage.setItem("odak_ticket_sequence",String(next));
  const seq=String(next).padStart(4,"0");
  const item={id:`TKT-${Date.now()}`,code:`ODK-${new Date().getFullYear()}-${seq}`,category:"bug",priority,title,description,steps:"Yakıt otomasyonu tarafından otomatik oluşturuldu.",expected:"Yakıt kaynağı/işlem tekrar sağlıklı çalışmalı.",page,attachments:[],status:"open",created_at:now(),created_by:"Yakıt Otomasyonu",role:"system",auto_fuel:true,history:[{action:"Otomatik ticket oluşturuldu",actor:"Yakıt Otomasyonu",at:now()}]};
  write(key,[item,...tickets].slice(0,40));
  window.dispatchEvent(new Event("odak-tickets-changed"));
  audit("AUTO_TICKET_CREATED",{ticket:item.code,title}); return item;
};

export const setFuelSourceHealth = (source, payload={}) => {
  const all=read(HEALTH_KEY,{});
  all[source]={source,status:"ok",...payload,checked_at:now()}; write(HEALTH_KEY,all);
  if(all[source].status==="error") createAutomaticFuelTicket({title:`${source} yakıt kaynağı hatası`,description:all[source].message||`${source} kaynağından veri alınamadı.`,priority:"critical"});
  return all[source];
};
export const getFuelSourceHealth = () => read(HEALTH_KEY,{
  "Petrol Ofisi":{source:"Petrol Ofisi",status:"unknown",message:"Henüz kontrol edilmedi"},
  "Shell":{source:"Shell",status:"unknown",message:"Henüz kontrol edilmedi"},
  "Supabase":{source:"Supabase",status:"unknown",message:"Bağlantı durumu bekleniyor"},
  "Yakıt Otomasyonu":{source:"Yakıt Otomasyonu",status:"unknown",message:"Çalışma bilgisi bekleniyor"}
});

export const requestRollbackApproval = (snapshotId, reason="") => {
  const snapshot=getEscalationSnapshots().find(x=>x.id===snapshotId);
  if(!snapshot) return {ok:false,reason:"Snapshot bulunamadı."};
  const rows=read(ROLLBACK_REQUEST_KEY,[]);
  const item={id:`RB-${Date.now()}`,snapshotId,escalationId:snapshot.escalationId,customer:snapshot.customer,reason,status:"pending",requested_by:currentUser(),created_at:now()};
  write(ROLLBACK_REQUEST_KEY,[item,...rows]); audit("ROLLBACK_REQUESTED",item); changed(); return {ok:true,item};
};
export const getRollbackRequests = () => read(ROLLBACK_REQUEST_KEY,[]);
export const decideRollbackRequest = (id, approved) => {
  const rows=getRollbackRequests(), row=rows.find(x=>x.id===id);
  if(!row) return {ok:false,reason:"Talep bulunamadı."};
  const result=approved?rollbackEscalation(row.snapshotId):{ok:true};
  const status=approved ? (result.ok?"approved":"failed") : "rejected";
  write(ROLLBACK_REQUEST_KEY,rows.map(x=>x.id===id?{...x,status,decided_by:currentUser(),decided_at:now()}:x));
  audit(approved?"ROLLBACK_APPROVED":"ROLLBACK_REJECTED",{requestId:id}); changed(); return result;
};

export const getCustomerTimeline = customer => getEscalationAudit().filter(x=>x.customer===customer).sort((a,b)=>new Date(b.created_at)-new Date(a.created_at));
export const getDailyFuelSummary = () => {
  const day=new Date().toISOString().slice(0,10), q=getEscalationQueue().filter(x=>String(x.created_at).startsWith(day));
  return {date:day,checked:Object.keys(getContractRules()).length,created:q.length,pending:q.filter(x=>["pending","postponed","suspicious"].includes(x.status)).length,approved:q.filter(x=>["processing","completed"].includes(x.status)).length,rejected:q.filter(x=>x.status==="rejected").length,affected:q.reduce((s,x)=>s+Number(x.affectedRoutes||0),0)};
};

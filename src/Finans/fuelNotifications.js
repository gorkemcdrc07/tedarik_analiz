export const FUEL_NOTIFICATION_KEY = "odak_sistem_bildirimleri_v1";

const readItems = () => {
  try {
    const value = JSON.parse(localStorage.getItem(FUEL_NOTIFICATION_KEY) || "[]");
    return Array.isArray(value) ? value : [];
  } catch { return []; }
};

const saveItems = (items) => {
  const limited = [...items].sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0)).slice(0, 150);
  localStorage.setItem(FUEL_NOTIFICATION_KEY, JSON.stringify(limited));
  window.dispatchEvent(new Event("odak-notifications-changed"));
  return limited;
};

const istanbulParts = (value = new Date()) => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Istanbul", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23", weekday: "short"
  }).formatToParts(value).reduce((all, part) => ({ ...all, [part.type]: part.value }), {});
  return { dateKey: `${parts.year}-${parts.month}-${parts.day}`, hour: Number(parts.hour), weekday: parts.weekday };
};

const uniqueInsert = (item) => {
  const existing = readItems();
  if (existing.some((saved) => saved.fingerprint === item.fingerprint || saved.id === item.id)) return null;
  saveItems([item, ...existing]);
  return item;
};

export const getFuelNotifications = () => readItems();

export const createFuelPriceNotification = ({ customer, oldPrice, newPrice, referencePrice, threshold, source, checkedAt, affected = 0, factor = 0 }) => {
  const previous = Number(oldPrice), current = Number(newPrice), reference = Number(referencePrice || oldPrice);
  if (!customer || !Number.isFinite(previous) || previous <= 0 || !Number.isFinite(current) || current <= 0 || Math.abs(current - previous) < 0.001) return null;
  const change = reference > 0 ? ((current - reference) / reference) * 100 : 0;
  const rawThreshold = Number(threshold || 0), thresholdPct = rawThreshold <= 1 ? rawThreshold * 100 : rawThreshold;
  if (Math.abs(change) < thresholdPct) return null;
  const direction = current > previous ? "arttı" : "azaldı";
  const severity = Math.abs(change) >= thresholdPct * 1.5 ? "critical" : "warning";
  return uniqueInsert({
    id: `fuel-${Date.now()}-${String(customer).replace(/\s+/g, "-").toLowerCase()}`,
    fingerprint: `threshold:${customer}:${previous.toFixed(3)}:${current.toFixed(3)}`,
    notification_kind: "threshold_change", customer, title: `${customer} için yakıt eşiği aşıldı`,
    message: `${previous.toLocaleString("tr-TR", { minimumFractionDigits: 2 })} ₺ → ${current.toLocaleString("tr-TR", { minimumFractionDigits: 2 })} ₺ · Fiyat %${Math.abs(change).toLocaleString("tr-TR", { maximumFractionDigits: 2 })} ${direction}. Tarife işlemi gerekli.`,
    type: severity, severity, read: false, status: "pending", rule_passed: true,
    old_price: previous, new_price: current, change_pct: change, threshold_pct: thresholdPct,
    factor_pct: Number(factor || 0) <= 1 ? Number(factor || 0) * 100 : Number(factor || 0), affected_count: Number(affected || 0),
    audience: ["admin", "finans", "kullanici"], source: source || "Yakıt fiyat otomasyonu",
    created_at: checkedAt || new Date().toISOString(), action_path: "/finans/yakit-onaylar"
  });
};

export const createDailyFuelPricesNotification = (results = []) => {
  const prices = results.filter((item) => item?.ok && Number.isFinite(Number(item.current))).map((item) => ({ customer: item.customer, price: Number(item.current), source: item.source }));
  const failed = results.filter((item) => !item?.ok).map((item) => item.customer);
  const { dateKey, hour } = istanbulParts();
  if (!prices.length || hour < 10) return null;
  return uniqueInsert({
    id: `daily-fuel-${dateKey}`, fingerprint: `daily-fuel-prices:${dateKey}`, notification_kind: "daily_prices",
    title: `Günlük yakıt fiyatları · ${prices.length} müşteri`,
    message: `${prices.map((item) => `${item.customer}: ${item.price.toLocaleString("tr-TR", { minimumFractionDigits: 2 })} ₺`).join(" • ")}${failed.length ? ` • Alınamayan: ${failed.join(", ")}` : ""}`,
    type: failed.length ? "warning" : "info", severity: failed.length ? "warning" : "info", read: false, status: "information",
    audience: ["admin", "finans", "operasyon", "kullanici"], source: "10.00 günlük yakıt özeti", prices, failed,
    created_at: new Date().toISOString(), action_path: "/finans/yakit-hesaplama"
  });
};

export const createFuelErrorNotification = ({ customer = "Yakıt otomasyonu", message, source = "Yakıt servisi" }) => {
  if (!message) return null;
  const { dateKey } = istanbulParts();
  return uniqueInsert({
    id: `fuel-error-${Date.now()}`, fingerprint: `fuel-error:${dateKey}:${customer}:${String(message).slice(0, 80)}`,
    notification_kind: "system_error", customer, title: `${customer} fiyatı alınamadı`, message,
    type: "error", severity: "critical", read: false, status: "attention", audience: ["admin"], source,
    created_at: new Date().toISOString(), action_path: "/finans/yakit-hesaplama"
  });
};

export const createWeeklyFuelSummary = () => {
  const { dateKey, hour, weekday } = istanbulParts();
  if (weekday !== "Mon" || hour < 10) return null;
  const existing = readItems(), start = Date.now() - 7 * 86400000;
  const recent = existing.filter((item) => new Date(item.created_at || 0).getTime() >= start);
  const thresholds = recent.filter((item) => item.notification_kind === "threshold_change");
  const completed = thresholds.filter((item) => item.status === "completed").length;
  const pending = thresholds.filter((item) => item.status === "pending" || item.status === "in_progress").length;
  return uniqueInsert({
    id: `weekly-fuel-${dateKey}`, fingerprint: `weekly-fuel-summary:${dateKey}`, notification_kind: "weekly_summary",
    title: "Haftalık yakıt yönetici özeti", message: `${thresholds.length} eşik aşımı • ${completed} tamamlanan tarife • ${pending} bekleyen işlem • ${recent.filter((item) => item.notification_kind === "system_error").length} servis uyarısı`,
    type: pending ? "warning" : "success", severity: pending ? "warning" : "success", read: false, status: "information",
    audience: ["admin"], source: "Haftalık yönetici özeti", created_at: new Date().toISOString(), action_path: "/finans/yakit-hesaplama"
  });
};

export const mergeFuelNotifications = (incoming = []) => {
  const current = readItems(), readState = new Map(current.map((item) => [item.id, item]));
  const allowed = incoming.filter((item) => {
    if (["daily_prices", "weekly_summary", "system_error"].includes(item?.notification_kind) || !item?.customer) return true;
    const previous = Number(item.old_price ?? item.previous ?? item.base), next = Number(item.new_price ?? item.current);
    const changed = Number.isFinite(previous) && Number.isFinite(next) ? Math.abs(next - previous) >= 0.001 : item.price_changed === true;
    return changed && (item.rule_passed === true || item.passed === true);
  });
  const merged = [...allowed, ...current].reduce((items, item) => {
    if (!item?.id || items.some((saved) => saved.id === item.id)) return items;
    const prior = readState.get(item.id);
    items.push({ ...item, read: prior?.read ?? Boolean(item.read), status: prior?.status || item.status || "information", action_path: item.action_path || "/finans/yakit-hesaplama" });
    return items;
  }, []);
  return saveItems(merged);
};

export const updateFuelNotification = (id, changes = {}) => saveItems(readItems().map((item) => item.id === id ? { ...item, ...changes, updated_at: new Date().toISOString() } : item));
export const markFuelNotificationRead = (id) => updateFuelNotification(id, { read: true });
export const markAllFuelNotificationsRead = () => saveItems(readItems().map((item) => ({ ...item, read: true })));
export const startFuelNotificationAction = (id, actor) => updateFuelNotification(id, { read: true, status: "in_progress", acted_by: actor });
export const completeFuelNotification = (id, actor) => updateFuelNotification(id, { read: true, status: "completed", completed_by: actor, completed_at: new Date().toISOString() });
export const ignoreFuelNotification = (id, actor) => updateFuelNotification(id, { read: true, status: "ignored", acted_by: actor });
export const snoozeFuelNotification = (id, hours = 24) => updateFuelNotification(id, { read: true, status: "snoozed", snoozed_until: new Date(Date.now() + hours * 3600000).toISOString() });

export const createApprovalStatusNotification = ({ escalation, status, message = "" }) => {
  if (!escalation?.id) return null;
  const map = { approved: ["Tarife güncellemesi onaylandı", "success", "completed"], rejected: ["Tarife güncellemesi reddedildi", "error", "rejected"], postponed: ["Tarife onayı ertelendi", "warning", "postponed"], error: ["Tarife onayı uygulanamadı", "error", "attention"] };
  const [title, type, state] = map[status] || ["Tarife onayı güncellendi", "info", status];
  return uniqueInsert({ id: `approval-${status}-${Date.now()}-${escalation.id}`, fingerprint: `approval:${status}:${escalation.id}:${Date.now()}`, notification_kind: "approval_status", customer: escalation.customer, title: `${escalation.customer} · ${title}`, message: message || `${escalation.id} numaralı yakıt tarife işleminin onay durumu güncellendi.`, type, severity: type, read: false, status: state, audience: ["admin", "finans", "kullanici"], source: "Yakıt Onay Merkezi", escalation_id: escalation.id, created_at: new Date().toISOString(), action_path: "/finans/yakit-onaylar" });
};

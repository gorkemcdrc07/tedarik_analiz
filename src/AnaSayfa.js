import React, { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight,
  BarChart3,
  Calculator,
  CalendarDays,
  ChartNoAxesCombined,
  ClipboardList,
  Clock3,
  Coins,
  FilePlus2,
  FolderKanban,
  Gauge,
  LayoutGrid,
  MapPinned,
  PackagePlus,
  ReceiptText,
  Route,
  ShieldCheck,
  Ship,
  Sparkles,
  Truck,
  UsersRound,
  WalletCards,
  Warehouse,
  Waypoints,
  Zap
} from "lucide-react";
import "./AnaSayfa.css";

const getUser = () => {
  try {
    return JSON.parse(localStorage.getItem("loginUser") || "null");
  } catch {
    return null;
  }
};

const parseArray = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return String(value).split(",").map((item) => item.trim()).filter(Boolean);
  }
};

const MODULES = [
  { title: "Sipariş Oluştur", description: "Yeni taşıma kaydı oluştur", path: "/SiparisIslemleri/SiparisOlustur", icon: PackagePlus, group: "Sipariş İşlemleri", color: "red" },
  { title: "Yeni Sipariş", description: "Excel ile toplu sipariş işle", path: "/SiparisIslemleri/YeniSiparis", icon: FilePlus2, group: "Sipariş İşlemleri", color: "blue" },
  { title: "Parsiyel Sipariş", description: "Parsiyel yük akışını yönet", path: "/SiparisIslemleri/ParsiyelSiparisOlustur", icon: Waypoints, group: "Sipariş İşlemleri", color: "green" },
  { title: "Teslim Noktaları", description: "Teslimat lokasyonlarını yönet", path: "/SiparisIslemleri/TeslimNoktalari", icon: MapPinned, group: "Operasyon", color: "purple" },
  { title: "Sipariş Açanlar", description: "Sipariş kullanıcılarını incele", path: "/SiparisIslemleri/SiparisAcanlar", icon: UsersRound, group: "Operasyon", color: "cyan" },
  { title: "Arkas", description: "Arkas operasyon kayıtlarını yönet", path: "/SiparisIslemleri/Arkas", icon: Ship, group: "Operasyon", color: "navy" },
  { title: "Fasdat", description: "Fasdat operasyon akışını yönet", path: "/SiparisIslemleri/Fasdat", icon: Warehouse, group: "Operasyon", color: "teal" },
  { title: "Proje Tanımları", description: "Müşteri ve proje tanımlamalarını yönet", path: "/Tanimlamalar/ProjeEkle", icon: FolderKanban, group: "Tanımlamalar", color: "blue" },
  { title: "Gelir Ekleme", description: "Gelir kayıtlarını sisteme aktar", path: "/GelirGider/GelirEkleme", icon: WalletCards, group: "Finans", color: "green" },
  { title: "Gider Ekleme", description: "Gider kayıtlarını sisteme aktar", path: "/GelirGider/GiderEkleme", icon: ReceiptText, group: "Finans", color: "orange" },
  { title: "Sefer Fiyatlandırma", description: "Sefer maliyetlerini hesapla", path: "/fiyatlandirma/seferFiyatlandirma", icon: Calculator, group: "Finans", color: "orange" },
  { title: "Özet Analiz", description: "Operasyon performansını incele", path: "/analiz/ozet", icon: ChartNoAxesCombined, group: "Rapor & Analiz", color: "blue" },
  { title: "Görsel Analiz", description: "Grafik ve görselleri incele", path: "/gorsel", icon: BarChart3, group: "Rapor & Analiz", color: "navy" }
];

const GROUP_META = {
  "Sipariş İşlemleri": { icon: PackagePlus, color: "red" },
  Operasyon: { icon: Truck, color: "blue" },
  Finans: { icon: Coins, color: "orange" },
  Tanımlamalar: { icon: FolderKanban, color: "blue" },
  "Rapor & Analiz": { icon: ChartNoAxesCombined, color: "navy" },
  Yönetim: { icon: ShieldCheck, color: "gray" }
};

function trDate(date) {
  return new Intl.DateTimeFormat("tr-TR", {
    day: "numeric",
    month: "long",
    year: "numeric"
  }).format(date);
}

function trTime(date) {
  return new Intl.DateTimeFormat("tr-TR", {
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

export default function AnaSayfa() {
  const navigate = useNavigate();
  const user = useMemo(() => getUser(), []);
  const isAdmin = String(user?.rol || "").toLowerCase() === "admin";
  const allowedScreens = useMemo(() => parseArray(user?.allowedScreens), [user?.allowedScreens]);
  const name = user?.kullanici || user?.kullanici_adi || "Odak Kullanıcısı";

  const availableModules = useMemo(
    () => MODULES.filter((item) => isAdmin || allowedScreens.includes(item.path)),
    [isAdmin, allowedScreens]
  );

  const quickModules = availableModules.slice(0, 6);

  const groupedModules = useMemo(() => {
    const map = new Map();
    availableModules.forEach((item) => {
      if (!map.has(item.group)) map.set(item.group, []);
      map.get(item.group).push(item);
    });
    if (isAdmin) map.set("Yönetim", [{ title: "Yönetici Paneli", path: "/admin" }]);
    return Array.from(map.entries());
  }, [availableModules, isAdmin]);

  const now = new Date();
  const sessionItems = useMemo(() => {
    const device = /Edg/i.test(navigator.userAgent) ? "Windows • Edge" : /Chrome/i.test(navigator.userAgent) ? "Windows • Chrome" : "Aktif cihaz";
    return [
      { title: "Aktif oturum", detail: device, time: `Bugün ${trTime(new Date())}`, status: "success" },
      { title: isAdmin ? "Yönetici hesabı" : "Kullanıcı hesabı", detail: `${availableModules.length} erişilebilir modül`, time: "Aktif", status: "info" }
    ];
  }, [availableModules.length, isAdmin]);

  return (
    <div className="od-home">
      <section className="od-home-hero">
        <div className="od-home-hero-shade" />

        <div className="od-home-hero-copy">
          <span className="od-home-eyebrow">GÜVENLİ TAŞIMACILIK, GÜÇLÜ YARINLAR</span>
          <h1>Her yükte<br /><em>daha ileriye.</em></h1>
          <p>Odak Lojistik olarak, operasyonlarınızı tek merkezden yönetmeniz için hızlı, güvenilir ve akıllı çözümler sunuyoruz.</p>
          <button className="od-home-cta" onClick={() => document.getElementById("od-quick-actions")?.scrollIntoView({ behavior: "smooth" })}>
            Hızlı İşlemlere Göz At <ArrowRight size={17} />
          </button>
        </div>

        <div className="od-home-hero-features">
          <div><span><ShieldCheck size={21} /></span><strong>GÜVENİLİR<small>OPERASYON</small></strong></div>
          <div><span><Clock3 size={21} /></span><strong>ZAMANINDA<small>TESLİMAT</small></strong></div>
          <div><span><Route size={21} /></span><strong>DAHA GÜÇLÜ<small>İŞ ORTAKLIĞI</small></strong></div>
        </div>
      </section>

      {quickModules.length > 0 && (
        <section className="od-quick-grid" id="od-quick-actions">
          {quickModules.map((item) => {
            const Icon = item.icon;
            return (
              <button className="od-quick-card" key={item.path} onClick={() => navigate(item.path)}>
                <span className={`od-card-icon od-card-icon-${item.color}`}><Icon size={21} strokeWidth={1.9} /></span>
                <span className="od-quick-copy"><strong>{item.title}</strong><small>{item.description}</small></span>
                <ArrowRight size={16} className="od-quick-arrow" />
              </button>
            );
          })}
        </section>
      )}

      <div className="od-home-grid">
        <section className="od-home-panel od-welcome-panel">
          <div className="od-panel-head">
            <div>
              <h2>Sisteme Hoş Geldin <span>👋</span></h2>
              <p>{name}, hızlı erişim için yetkin bulunan modülleri kullanabilirsin.</p>
            </div>
            <div className="od-date-card">
              <span><CalendarDays size={18} /></span>
              <div><strong>{trDate(now)}</strong><small>{trTime(now)}</small></div>
            </div>
          </div>

          <div className="od-panel-divider" />

          <div className="od-modules-head">
            <h3>Erişilebilir Modüller</h3>
            <span>{availableModules.length + (isAdmin ? 1 : 0)} modül</span>
          </div>

          <div className="od-module-group-grid">
            {groupedModules.map(([groupName, items]) => {
              const meta = GROUP_META[groupName] || { icon: LayoutGrid, color: "gray" };
              const Icon = meta.icon;
              const firstPath = items[0]?.path;
              return (
                <button key={groupName} className="od-module-group-card" onClick={() => firstPath && navigate(firstPath)}>
                  <span className={`od-card-icon od-card-icon-${meta.color}`}><Icon size={21} /></span>
                  <span className="od-module-group-copy"><strong>{groupName}</strong><small>{items.length} modül</small></span>
                  <ArrowRight size={16} />
                </button>
              );
            })}
          </div>
        </section>

        <aside className="od-home-panel od-session-panel">
          <div className="od-session-title">
            <span><Zap size={18} /></span>
            <h2>Oturum Bilgisi</h2>
          </div>

          <div className="od-session-list">
            {sessionItems.map((item, index) => (
              <div className="od-session-item" key={`${item.title}-${index}`}>
                <span className={`od-session-dot is-${item.status}`} />
                <span className="od-session-line" />
                <div className="od-session-copy"><strong>{item.title}</strong><small>{item.detail}</small></div>
                <time>{item.time}</time>
              </div>
            ))}
          </div>

          {isAdmin && (
            <button className="od-admin-shortcut" onClick={() => navigate("/admin")}>
              <ShieldCheck size={17} />
              <span>Yönetici Paneli</span>
              <ArrowRight size={16} />
            </button>
          )}
        </aside>
      </div>
    </div>
  );
}

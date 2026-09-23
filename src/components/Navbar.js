import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  BarChart3,
  Activity,
  Building2,
  Calculator,
  ChartNoAxesCombined,
  ChevronRight,
  ClipboardList,
  FilePlus2,
  FolderKanban,
  FileSpreadsheet,
  HelpCircle,
  LayoutDashboard,
  MapPinned,
  PackagePlus,
  ReceiptText,
  Settings,
  ShieldCheck,
  Ship,
  UserRound,
  UsersRound,
  Warehouse,
  X
} from "lucide-react";
import {
  RiAlertLine,
  RiCheckDoubleLine,
  RiCloseLine,
  RiGasStationLine,
  RiLogoutBoxRLine,
  RiMenu4Line,
  RiMessage3Line,
  RiMoonClearLine,
  RiNotification3Line,
  RiSearch2Line,
  RiSunFoggyLine,
  RiUser3Line
} from "react-icons/ri";
import { useLocation, useNavigate } from "react-router-dom";
import {
  completeFuelNotification,
  getFuelNotifications,
  ignoreFuelNotification,
  markAllFuelNotificationsRead,
  markFuelNotificationRead,
  snoozeFuelNotification,
  startFuelNotificationAction
} from "../Finans/fuelNotifications";
import TicketCenter, { getOpenTicketCount } from "./TicketCenter";
import "./Navbar.css";
const API_BASE =
  (process.env.REACT_APP_API_BASE_URL || "").replace(/\/$/, "");

const PAGE_CONFIG = {
  "/dashboard": { title: "Ana Sayfa", description: "Odak Lojistik operasyon merkezi.", icon: LayoutDashboard },
  "/admin": { title: "Yönetici Paneli", description: "Kullanıcı, rol ve ekran yetkilerini yönetin.", icon: ShieldCheck },
  "/SiparisIslemleri/SiparisOlustur": { title: "Sipariş Oluştur", description: "Yeni sipariş kayıtlarını oluşturun ve sisteme aktarın.", icon: ClipboardList },
  "/SiparisIslemleri/YeniSiparis": { title: "Yeni Sipariş", description: "Müşteri siparişlerini Excel üzerinden oluşturun ve yönetin.", icon: FilePlus2 },
  "/SiparisIslemleri/ParsiyelSiparisOlustur": { title: "Parsiyel Sipariş", description: "Parsiyel siparişleri oluşturun, düzenleyin ve yönetin.", icon: PackagePlus },
  "/SiparisIslemleri/TeslimNoktalari": { title: "Teslim Noktaları", description: "Teslimat noktalarını görüntüleyin ve yönetin.", icon: MapPinned },
  "/SiparisIslemleri/SiparisAcanlar": { title: "Sipariş Açanlar", description: "Sipariş oluşturan kullanıcı ve firma kayıtlarını yönetin.", icon: UsersRound },
  "/SiparisIslemleri/Arkas": { title: "Arkas", description: "Arkas operasyonlarına ait sipariş verilerini yönetin.", icon: Ship },
  "/SiparisIslemleri/Fasdat": { title: "Fasdat", description: "Fasdat operasyonlarına ait sipariş süreçlerini yönetin.", icon: Warehouse },
  "/Tanimlamalar/ProjeEkle": { title: "Proje Tanımlamaları", description: "Müşteri, proje ve VKN tanımlamalarını yönetin.", icon: FolderKanban },
  "/GelirGider/GelirEkleme": { title: "Gelir Ekleme", description: "Gelir kayıtlarını sisteme ekleyin ve yönetin.", icon: Building2 },
  "/GelirGider/GiderEkleme": { title: "Gider Ekleme", description: "Gider kayıtlarını sisteme ekleyin ve yönetin.", icon: ReceiptText },
  "/GelirGider/TestGelir": { title: "Test Gelir", description: "Gelir kayıtlarını kontrol edin.", icon: Building2 },
  "/GelirGider/TestGider": { title: "Test Gider", description: "Gider kayıtlarını kontrol edin.", icon: ReceiptText },
  "/fiyatlandirma/seferFiyatlandirma": { title: "Sefer Fiyatlandırma", description: "Sefer maliyetlerini hesaplayın ve fiyatlandırmaları yönetin.", icon: Calculator },
  "/analiz/ozet": { title: "Özet Analiz", description: "Operasyon verilerini özet metriklerle analiz edin.", icon: ChartNoAxesCombined },
  "/gorsel": { title: "Görsel Analiz", description: "Operasyon verilerini grafikler üzerinden inceleyin.", icon: BarChart3 },
  "/finans/yakit-kontrol-merkezi": { title: "Tarife Kontrol Merkezi", description: "Eskalasyon ve tarife güvenlik kontrollerini yönetin.", icon: ShieldCheck },
  "/finans/musteri-kurulum": { title: "Müşteri Kurulum Sihirbazı", description: "Excel yükleyin, tarife kurallarını tanımlayın ve yeni müşteriyi aktifleştirin.", icon: FileSpreadsheet },
  "/finans/yakit-onaylar": { title: "Yakıt Onay Merkezi", description: "Bekleyen tarife güncellemelerini inceleyin, onaylayın veya reddedin.", icon: RiCheckDoubleLine },
  "/finans/yakit-yonetim-v3": { title: "Yakıt Yönetim Merkezi V3", description: "Kurallar, yetkiler, SLA, simülasyon ve otomasyon sağlığı.", icon: ShieldCheck }
};

const getUser = () => {
  try {
    return JSON.parse(localStorage.getItem("loginUser") || "null");
  } catch {
    return null;
  }
};

const parseAllowed = (value) => {
  if (Array.isArray(value)) return value;
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const initials = (name) => String(name || "Kullanıcı")
  .trim()
  .split(/\s+/)
  .map((part) => part[0])
  .join("")
  .toUpperCase()
  .slice(0, 2);

export default function Navbar({ toggleSidebar, isMobile }) {
  const location = useLocation();
  const navigate = useNavigate();
  const rootRef = useRef(null);
  const commandInputRef = useRef(null);

  const [profileOpen, setProfileOpen] = useState(false);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [notifications, setNotifications] = useState(() => getFuelNotifications());
  const [notificationFilter, setNotificationFilter] = useState("all");
  const [notificationCustomer, setNotificationCustomer] = useState("all");
  const [ticketOpen, setTicketOpen] = useState(false);
  const [openTicketCount, setOpenTicketCount] = useState(() => getOpenTicketCount());
  const [searchOpen, setSearchOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [dark, setDark] = useState(() => localStorage.getItem("odak-theme") === "dark");

  const user = useMemo(() => getUser(), []);
  const name = user?.kullanici || user?.kullanici_adi || localStorage.getItem("userName") || "Kullanıcı";
  const email = user?.mail || user?.email || user?.kullanici_mail || "";
  const role = String(user?.rol || localStorage.getItem("userRole") || "kullanici").toLowerCase();
  const isAdmin = role === "admin";
  const page = PAGE_CONFIG[location.pathname] || { title: "Odak Lojistik", description: "Operasyon yönetim sistemi." };
  const PageIcon = page.icon || Activity;
  const roleNotifications = useMemo(() => notifications.filter((item) => {
    const allowed = !item.audience?.length || item.audience.includes(role) || isAdmin;
    const snoozed = item.status === "snoozed" && new Date(item.snoozed_until || 0) > new Date();
    return allowed && !snoozed;
  }), [notifications, role, isAdmin]);
  const notificationCustomers = useMemo(() => [...new Set(roleNotifications.map((item) => item.customer).filter(Boolean))].sort(), [roleNotifications]);
  const visibleNotifications = useMemo(() => roleNotifications.filter((item) => {
    if (notificationCustomer !== "all" && item.customer !== notificationCustomer) return false;
    if (notificationFilter === "unread") return !item.read;
    if (notificationFilter === "pending") return item.status === "pending" || item.status === "in_progress";
    if (notificationFilter === "completed") return item.status === "completed";
    return true;
  }), [roleNotifications, notificationCustomer, notificationFilter]);
  const unreadCount = roleNotifications.filter((item) => !item.read).length;
  const pendingCount = roleNotifications.filter((item) => item.status === "pending" || item.status === "in_progress").length;

  const searchablePages = useMemo(() => {
    const all = Object.entries(PAGE_CONFIG);
    if (isAdmin) return all;
    const allowed = parseAllowed(user?.allowedScreens);
    return all.filter(([path]) => path === "/dashboard" || allowed.includes(path));
  }, [isAdmin, user?.allowedScreens]);

  const searchResults = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("tr-TR");
    if (!normalized) return searchablePages.slice(0, 6);
    return searchablePages
      .filter(([, item]) => `${item.title} ${item.description}`.toLocaleLowerCase("tr-TR").includes(normalized))
      .slice(0, 7);
  }, [query, searchablePages]);

  useEffect(() => {
    const closeOnOutside = (event) => {
      if (rootRef.current && !rootRef.current.contains(event.target)) {
        setProfileOpen(false);
        setSearchOpen(false);
        setNotificationOpen(false);
      }
    };
    document.addEventListener("mousedown", closeOnOutside);
    return () => document.removeEventListener("mousedown", closeOnOutside);
  }, []);

  useEffect(() => {
    const refreshTickets = () => setOpenTicketCount(getOpenTicketCount());
    window.addEventListener("odak-tickets-changed", refreshTickets);
    window.addEventListener("storage", refreshTickets);
    return () => {
      window.removeEventListener("odak-tickets-changed", refreshTickets);
      window.removeEventListener("storage", refreshTickets);
    };
  }, []);

  useEffect(() => {
    const refresh = () => setNotifications(getFuelNotifications());
    window.addEventListener("odak-notifications-changed", refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener("odak-notifications-changed", refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  useEffect(() => {
    setSearchOpen(false);
    setQuery("");
  }, [location.pathname]);

  useEffect(() => {
    const onKeyDown = (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setProfileOpen(false);
        setSearchOpen(false);
        setCommandOpen(true);
        window.setTimeout(() => commandInputRef.current?.focus(), 30);
      }
      if (event.key === "Escape") setCommandOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.odakTheme = dark ? "dark" : "light";
    localStorage.setItem("odak-theme", dark ? "dark" : "light");
  }, [dark]);

  const go = (path) => {
    navigate(path);
    setSearchOpen(false);
    setCommandOpen(false);
    setProfileOpen(false);
    setNotificationOpen(false);
    setQuery("");
  };

  const logout = async () => {
    try {
      await fetch(`${API_BASE}/api/auth/logout`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json"
        }
      });
    } catch (error) {
      console.error("[LOGOUT]", error);
    } finally {
      [
        "loginUser",
        "kullanici",
        "userName",
        "userRole",
        "Reel_kullanici",
        "Reel_sifre",
        "odakAuthSession"
      ].forEach((key) => localStorage.removeItem(key));

      navigate("/", { replace: true });
      window.location.reload();
    }
  };

  return (
    <header className="od-topbar">
      <div className="od-topbar-inner" ref={rootRef}>
        <div className="od-topbar-left">
          <button className="od-icon-button od-menu-button" onClick={toggleSidebar} aria-label="Menüyü aç veya daralt" title="Menü">
            <RiMenu4Line size={22} />
          </button>

          {!isMobile && location.pathname !== "/dashboard" && (
            <div className="od-page-title-block">
              <span className="od-page-icon" aria-hidden="true"><PageIcon size={17} /></span>
              <span className="od-page-title-copy">
                <strong>{page.title}</strong>
                <span>{page.description}</span>
              </span>
            </div>
          )}
        </div>

        <div className={`od-search ${searchOpen ? "is-open" : ""}`}>
          <RiSearch2Line size={19} />
          <input
            value={query}
            onFocus={() => setSearchOpen(true)}
            onChange={(event) => {
              setQuery(event.target.value);
              setSearchOpen(true);
            }}
            placeholder="Sayfa, işlem veya modül ara..."
          />
          {!query && !isMobile && <button type="button" className="od-search-kbd" onClick={() => setCommandOpen(true)}>Ctrl + K</button>}
          {query && (
            <button className="od-search-clear" onClick={() => setQuery("")} aria-label="Aramayı temizle">
              <X size={15} />
            </button>
          )}

          {searchOpen && (
            <div className="od-search-dropdown">
              <div className="od-search-caption">HIZLI ERİŞİM</div>
              {searchResults.length ? (
                searchResults.map(([path, item]) => {
                  const Icon = item.icon || RiSearch2Line;
                  return (
                    <button key={path} onClick={() => go(path)}>
                      <span className="od-search-result-icon"><Icon size={16} /></span>
                      <span className="od-search-result-copy">
                        <strong>{item.title}</strong>
                        <small>{item.description}</small>
                      </span>
                      <ChevronRight size={15} />
                    </button>
                  );
                })
              ) : (
                <div className="od-search-empty">Eşleşen modül bulunamadı.</div>
              )}
            </div>
          )}
        </div>

        <div className="od-topbar-actions">
          {!isMobile && <span className="od-system-live" title="Sistem bağlantısı aktif"><i /> SİSTEM AKTİF</span>}

          <button className="od-icon-button od-theme-button" onClick={() => setDark((value) => !value)} title="Tema" aria-label="Temayı değiştir">
            {dark ? <RiMoonClearLine size={20} /> : <RiSunFoggyLine size={20} />}
          </button>

          <div className="od-notification-wrap">
            <button
              className={`od-icon-button od-notification-button ${notificationOpen ? "is-active" : ""}`}
              title="Bildirimler"
              aria-label={`${unreadCount} okunmamış bildirim`}
              onClick={() => {
                setNotificationOpen((value) => !value);
                setProfileOpen(false);
                setSearchOpen(false);
              }}
            >
              <RiNotification3Line size={20} />
              {unreadCount > 0 && <span className="od-notification-dot">{unreadCount > 99 ? "99+" : unreadCount}</span>}
            </button>

            {notificationOpen && (
              <div className="od-notification-menu">
                <div className="od-notification-head">
                  <div><small>YAKIT OTOMASYONU</small><strong>Bildirimler {pendingCount > 0 && <em>{pendingCount} işlem bekliyor</em>}</strong></div>
                  <div className="od-notification-head-actions">
                    {unreadCount > 0 && <button onClick={markAllFuelNotificationsRead} title="Tümünü okundu işaretle"><RiCheckDoubleLine size={18} /></button>}
                    <button onClick={() => setNotificationOpen(false)} title="Kapat"><RiCloseLine size={18} /></button>
                  </div>
                </div>
                <div className="od-notification-filters">
                  <div>
                    {[["all","Tümü"],["unread","Okunmamış"],["pending","Bekleyen"],["completed","Tamamlanan"]].map(([value,label]) => (
                      <button key={value} className={notificationFilter === value ? "is-active" : ""} onClick={() => setNotificationFilter(value)}>{label}</button>
                    ))}
                  </div>
                  <select value={notificationCustomer} onChange={(event) => setNotificationCustomer(event.target.value)} aria-label="Müşteri filtresi">
                    <option value="all">Tüm müşteriler</option>
                    {notificationCustomers.map((customer) => <option key={customer} value={customer}>{customer}</option>)}
                  </select>
                </div>
                <div className="od-notification-list">
                  {visibleNotifications.length ? visibleNotifications.slice(0, 30).map((item) => (
                    <div
                      key={item.id}
                      className={`od-notification-item ${item.type || "info"} ${item.read ? "is-read" : "is-unread"}`}
                      role="button"
                      tabIndex={0}
                      onClick={() => {
                        markFuelNotificationRead(item.id);
                      }}
                    >
                      <span className="od-notification-icon">{item.rule_passed || item.type === "warning" ? <RiAlertLine size={18} /> : <RiGasStationLine size={18} />}</span>
                      <span className="od-notification-copy">
                        <strong>{item.title}<b className={`od-status-pill ${item.status || "information"}`}>{({pending:"İşlem bekliyor",in_progress:"İşlemde",completed:"Tamamlandı",ignored:"Yok sayıldı",attention:"Kontrol gerekli",information:"Bilgi"})[item.status] || "Bilgi"}</b></strong>
                        <span>{item.message}</span>
                        {item.notification_kind === "threshold_change" && (
                          <span className="od-notification-metrics">
                            <i>Değişim %{Math.abs(Number(item.change_pct || 0)).toLocaleString("tr-TR", { maximumFractionDigits: 2 })}</i>
                            <i>Eşik %{Number(item.threshold_pct || 0).toLocaleString("tr-TR")}</i>
                            {item.factor_pct > 0 && <i>Yansıtma %{Number(item.factor_pct).toLocaleString("tr-TR")}</i>}
                            {item.affected_count > 0 && <i>{item.affected_count} tarife</i>}
                          </span>
                        )}
                        <small>{new Date(item.created_at || Date.now()).toLocaleString("tr-TR", { dateStyle: "short", timeStyle: "short" })}{item.source ? ` • ${item.source}` : ""}</small>
                        {item.notification_kind === "threshold_change" && !["completed","ignored"].includes(item.status) && (
                          <span className="od-notification-actions">
                            <button onClick={(event) => { event.stopPropagation(); startFuelNotificationAction(item.id, name); go(`${item.action_path || "/finans/yakit-onaylar"}?customer=${encodeURIComponent(item.customer || "")}&notification=${encodeURIComponent(item.id)}`); }}>Onayı incele</button>
                            {item.status === "in_progress" && <button onClick={(event) => { event.stopPropagation(); completeFuelNotification(item.id, name); }}>Tamamlandı</button>}
                            <button onClick={(event) => { event.stopPropagation(); snoozeFuelNotification(item.id, 24); }}>Yarın hatırlat</button>
                            <button onClick={(event) => { event.stopPropagation(); ignoreFuelNotification(item.id, name); }}>Yok say</button>
                          </span>
                        )}
                      </span>
                      {!item.read && <i className="od-unread-dot" />}
                    </div>
                  )) : (
                    <div className="od-notification-empty"><RiNotification3Line size={24} /><strong>Bu filtrede bildirim yok</strong><span>Eşik aşımı, günlük özet ve sistem kontrolleri burada görünür.</span></div>
                  )}
                </div>
                <button className="od-notification-footer" onClick={() => go("/finans/yakit-hesaplama")}><RiGasStationLine size={16} /> Yakıt hesaplamaya git <ChevronRight size={15} /></button>
              </div>
            )}
          </div>

          <button className={`od-icon-button od-message-button ${ticketOpen ? "is-active" : ""}`} title="Destek ve ticket oluştur" aria-label="Destek ve ticket oluştur" onClick={() => { setTicketOpen(true); setNotificationOpen(false); setProfileOpen(false); }}>
            <RiMessage3Line size={20} />
            {openTicketCount > 0 && <span className="od-ticket-dot">{openTicketCount > 99 ? "99+" : openTicketCount}</span>}
          </button>

          <div className="od-profile-wrap">
            <button
              className={`od-profile-trigger ${profileOpen ? "is-active" : ""}`}
              onClick={() => {
                setProfileOpen((value) => !value);
                setSearchOpen(false);
              }}
              aria-label="Kullanıcı menüsü"
              title={name}
            >
              <RiUser3Line size={21} />
              <span className="od-profile-live-dot" aria-hidden="true" />
            </button>

            {profileOpen && (
              <div className="od-profile-menu">
                <div className="od-profile-head">
                  <span className="od-profile-avatar od-profile-avatar-lg">{initials(name)}<i /></span>
                  <div>
                    <strong>{name}</strong>
                    {email && <span>{email}</span>}
                  </div>
                </div>

                <div className="od-profile-badges">
                  <span className="od-online-badge"><i /> Çevrimiçi</span>
                  {isAdmin && <span className="od-admin-badge"><ShieldCheck size={13} /> Yönetici</span>}
                </div>

                <div className="od-profile-divider" />

                <button><UserRound size={17} /><span>Profilim</span></button>
                <button><Settings size={17} /><span>Ayarlar</span></button>
                <button onClick={() => setDark((value) => !value)}>
                  {dark ? <RiMoonClearLine size={18} /> : <RiSunFoggyLine size={18} />}
                  <span>Tema</span>
                  <ChevronRight size={15} className="od-menu-arrow" />
                </button>
                <button><HelpCircle size={17} /><span>Yardım Merkezi</span></button>

                {isAdmin && (
                  <button onClick={() => go("/admin")} className="od-admin-menu-item">
                    <ShieldCheck size={17} />
                    <span>Yönetici Paneli</span>
                  </button>
                )}

                <div className="od-profile-divider" />

                <button className="od-logout-button" onClick={logout}>
                  <RiLogoutBoxRLine size={18} />
                  <span>Çıkış Yap</span>
                </button>
              </div>
            )}
          </div>

          <button className="od-logout-square" onClick={logout} title="Çıkış Yap">
            <RiLogoutBoxRLine size={21} />
          </button>
        </div>

        {commandOpen && (
          <div className="od-command-overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) setCommandOpen(false); }}>
            <div className="od-command-palette" role="dialog" aria-modal="true" aria-label="Hızlı komut paleti">
              <div className="od-command-search">
                <RiSearch2Line size={21} />
                <input ref={commandInputRef} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Sayfa, işlem veya modül ara..." />
                <kbd>ESC</kbd>
              </div>
              <div className="od-command-body">
                <div className="od-command-label">HIZLI ERİŞİM</div>
                {searchResults.length ? searchResults.map(([path, item]) => {
                  const Icon = item.icon || RiSearch2Line;
                  return (
                    <button key={`cmd-${path}`} className="od-command-item" onClick={() => go(path)}>
                      <span><Icon size={18} /></span>
                      <div><strong>{item.title}</strong><small>{item.description}</small></div>
                      <ChevronRight size={16} />
                    </button>
                  );
                }) : <div className="od-command-empty">Eşleşen modül bulunamadı.</div>}
              </div>
              <div className="od-command-footer"><span><kbd>↵</kbd> seç</span><span><kbd>ESC</kbd> kapat</span><span><kbd>Ctrl K</kbd> hızlı aç</span></div>
            </div>
          </div>
        )}
        <TicketCenter open={ticketOpen} onClose={() => setTicketOpen(false)} currentPath={location.pathname} />
      </div>
    </header>
  );
}

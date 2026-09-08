import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  BarChart3,
  Bell,
  Building2,
  Calculator,
  ChartNoAxesCombined,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  FilePlus2,
  FolderKanban,
  HelpCircle,
  LayoutDashboard,
  LogOut,
  MapPinned,
  Menu,
  MessageSquareText,
  Moon,
  PackagePlus,
  ReceiptText,
  Search,
  Settings,
  ShieldCheck,
  Ship,
  Sun,
  UserRound,
  UsersRound,
  Warehouse,
  X
} from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import "./Navbar.css";

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
  "/gorsel": { title: "Görsel Analiz", description: "Operasyon verilerini grafikler üzerinden inceleyin.", icon: BarChart3 }
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
      }
    };
    document.addEventListener("mousedown", closeOnOutside);
    return () => document.removeEventListener("mousedown", closeOnOutside);
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
    setQuery("");
  };

  const logout = () => {
    ["loginUser", "kullanici", "userName", "userRole", "Reel_kullanici", "Reel_sifre"].forEach((key) => localStorage.removeItem(key));
    navigate("/", { replace: true });
    window.location.reload();
  };

  return (
    <header className="od-topbar">
      <div className="od-topbar-inner" ref={rootRef}>
        <div className="od-topbar-left">
          <button className="od-icon-button od-menu-button" onClick={() => isMobile ? toggleSidebar() : setCommandOpen(true)} aria-label={isMobile ? "Menü" : "Komut paleti"}>
            <Menu size={20} />
          </button>

          {!isMobile && location.pathname !== "/dashboard" && (
            <div className="od-page-title-block">
              <strong>{page.title}</strong>
              <span>{page.description}</span>
            </div>
          )}
        </div>

        <div className={`od-search ${searchOpen ? "is-open" : ""}`}>
          <Search size={18} />
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
                  const Icon = item.icon || Search;
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
          <button className="od-icon-button" onClick={() => setDark((value) => !value)} title="Tema">
            {dark ? <Moon size={18} /> : <Sun size={18} />}
          </button>

          <button className="od-icon-button od-notification-button" title="Bildirimler">
            <Bell size={18} />
            <span className="od-notification-dot">3</span>
          </button>

          <button className="od-icon-button" title="Mesajlar">
            <MessageSquareText size={18} />
          </button>

          <div className="od-profile-wrap">
            <button
              className={`od-profile-trigger ${profileOpen ? "is-active" : ""}`}
              onClick={() => {
                setProfileOpen((value) => !value);
                setSearchOpen(false);
              }}
            >
              <span className="od-profile-avatar">{initials(name)}<i /></span>
              {!isMobile && (
                <span className="od-profile-trigger-copy">
                  <strong>{name}</strong>
                  <small>{isAdmin ? "Yönetici" : "Kullanıcı"}</small>
                </span>
              )}
              {!isMobile && <ChevronDown size={15} />}
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
                  {dark ? <Moon size={17} /> : <Sun size={17} />}
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
                  <LogOut size={17} />
                  <span>Çıkış Yap</span>
                </button>
              </div>
            )}
          </div>

          <button className="od-logout-square" onClick={logout} title="Çıkış Yap">
            <LogOut size={20} />
          </button>
        </div>

        {commandOpen && (
          <div className="od-command-overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) setCommandOpen(false); }}>
            <div className="od-command-palette" role="dialog" aria-modal="true" aria-label="Hızlı komut paleti">
              <div className="od-command-search">
                <Search size={20} />
                <input ref={commandInputRef} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Sayfa, işlem veya modül ara..." />
                <kbd>ESC</kbd>
              </div>
              <div className="od-command-body">
                <div className="od-command-label">HIZLI ERİŞİM</div>
                {searchResults.length ? searchResults.map(([path, item]) => {
                  const Icon = item.icon || Search;
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
      </div>
    </header>
  );
}

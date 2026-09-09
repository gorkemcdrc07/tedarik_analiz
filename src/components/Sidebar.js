import React, { useMemo } from "react";
import { NavLink, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  ClipboardList,
  FilePlus2,
  PackagePlus,
  MapPinned,
  UsersRound,
  Ship,
  Warehouse,
  FolderKanban,
  CircleDollarSign,
  ReceiptText,
  Calculator,
  ChartNoAxesCombined,
  BarChart3,
  ShieldCheck,
  ChevronRight,
  ChevronsLeft,
  Headphones,
  FileText
} from "lucide-react";
import "./Sidebar.css";

const parseArray = (value) => {
  if (!value) return [];

  if (Array.isArray(value)) return value;

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return String(value)
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean);
  }
};

const getUser = () => {
  try {
    return JSON.parse(localStorage.getItem("loginUser") || "null");
  } catch {
    return null;
  }
};

const GROUPS = [
  {
    title: "GENEL",
    items: [
      {
        label: "Ana Sayfa",
        route: "/dashboard",
        icon: LayoutDashboard
      }
    ]
  },

  {
    title: "SİPARİŞ İŞLEMLERİ",
    items: [
      {
        label: "Sipariş Oluştur",
        route: "/SiparisIslemleri/SiparisOlustur",
        icon: ClipboardList
      },
      {
        label: "Spot Tedarik Sipariş",
        route: "/SiparisIslemleri/YeniSiparis",
        icon: FilePlus2
      },
      {
        label: "İrsaliye",
        route: "/Irsaliye",
        icon: FileText
      },
      {
        label: "Parsiyel Sipariş",
        route: "/SiparisIslemleri/ParsiyelSiparisOlustur",
        icon: PackagePlus
      },
      {
        label: "Teslim Noktaları",
        route: "/SiparisIslemleri/TeslimNoktalari",
        icon: MapPinned
      },
      {
        label: "Sipariş Açanlar",
        route: "/SiparisIslemleri/SiparisAcanlar",
        icon: UsersRound
      },
      {
        label: "Arkas",
        route: "/SiparisIslemleri/Arkas",
        icon: Ship
      },
      {
        label: "Fasdat",
        route: "/SiparisIslemleri/Fasdat",
        icon: Warehouse
      }
    ]
  },

  {
    title: "TANIMLAMALAR",
    items: [
      {
        label: "Proje Tanımlamaları",
        route: "/Tanimlamalar/ProjeEkle",
        icon: FolderKanban
      }
    ]
  },

  {
    title: "FİNANS",
    items: [
      {
        label: "Gelir Ekleme",
        route: "/GelirGider/GelirEkleme",
        icon: CircleDollarSign
      },
      {
        label: "Gider Ekleme",
        route: "/GelirGider/GiderEkleme",
        icon: ReceiptText
      },
      {
        label: "Sefer Fiyatlandırma",
        route: "/fiyatlandirma/seferFiyatlandirma",
        icon: Calculator
      }
    ]
  },

  {
    title: "RAPOR & ANALİZ",
    items: [
      {
        label: "Özet Analiz",
        route: "/analiz/ozet",
        icon: ChartNoAxesCombined
      },
      {
        label: "Görsel Analiz",
        route: "/gorsel",
        icon: BarChart3
      }
    ]
  }
];

export default function Sidebar({
  isOpen,
  closeSidebar,
  isMobile
}) {
  const location = useLocation();

  const user = getUser();

  const role = String(user?.rol || "").toLowerCase();

  const isAdmin = role === "admin";

  const allowed = useMemo(
    () => parseArray(user?.allowedScreens),
    [user?.allowedScreens]
  );

  const groups = useMemo(() => {
    if (isAdmin || !user) {
      return GROUPS;
    }

    return GROUPS
      .map((group) => ({
        ...group,
        items: group.items.filter(
          (item) =>
            item.route === "/dashboard" ||
            allowed.includes(item.route)
        )
      }))
      .filter((group) => group.items.length);
  }, [isAdmin, user, allowed]);

  const onNav = () => {
    if (isMobile) {
      closeSidebar?.();
    }
  };

  const isItemActive = (route) => {
    if (route === "/dashboard") {
      return location.pathname === "/dashboard";
    }

    return (
      location.pathname === route ||
      location.pathname.startsWith(`${route}/`)
    );
  };

  return (
    <aside
      className={[
        "od-sidebar",
        isOpen ? "is-open" : "is-collapsed",
        isMobile ? "is-mobile" : ""
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="od-sidebar-brand">
        <NavLink
          to="/dashboard"
          onClick={onNav}
          className="od-brand-link"
          aria-label="Odak Lojistik Ana Sayfa"
        >
          <div className="od-brand-mark">
            <span className="od-brand-word">
              ODAK
            </span>

            <span className="od-brand-sub">
              LOJİSTİK
            </span>
          </div>
        </NavLink>
      </div>

      <div className="od-sidebar-scroll">
        <nav className="od-sidebar-nav">
          {groups.map((group) => (
            <section
              className="od-sidebar-group"
              key={group.title}
            >
              <div className="od-sidebar-group-title">
                {group.title}
              </div>

              <div className="od-sidebar-items">
                {group.items.map((item) => {
                  const Icon = item.icon;

                  const active = isItemActive(item.route);

                  return (
                    <NavLink
                      key={item.route}
                      to={item.route}
                      onClick={onNav}
                      title={item.label}
                      className={`od-sidebar-item ${
                        active ? "is-active" : ""
                      }`}
                    >
                      <span className="od-sidebar-active-line" />

                      <span className="od-sidebar-icon">
                        <Icon
                          size={19}
                          strokeWidth={1.9}
                        />
                      </span>

                      <span className="od-sidebar-label">
                        {item.label}
                      </span>

                      <ChevronRight
                        className="od-sidebar-arrow"
                        size={15}
                        strokeWidth={2}
                      />
                    </NavLink>
                  );
                })}
              </div>
            </section>
          ))}
        </nav>
      </div>

      <div className="od-sidebar-footer">
        <button
          type="button"
          className="od-support-card"
        >
          <span className="od-support-icon">
            <Headphones
              size={18}
              strokeWidth={1.9}
            />
          </span>

          <span className="od-support-copy">
            <strong>
              Destek Merkezi
            </strong>

            <small>
              Her zaman yanınızda
            </small>
          </span>

          <ChevronRight
            size={15}
            strokeWidth={2}
            className="od-support-arrow"
          />
        </button>

        <div className="od-sidebar-collapse-hint">
          <ChevronsLeft
            size={15}
            strokeWidth={1.8}
          />

          <span>
            Üzerine gelerek menüyü aç
          </span>
        </div>

        <div className="od-sidebar-status">
          <ShieldCheck
            size={14}
            strokeWidth={1.9}
          />

          <span>
            Sistem aktif
          </span>

          <i />
        </div>
      </div>
    </aside>
  );
}
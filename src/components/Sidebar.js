import React, { useEffect, useMemo, useState } from "react";
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
  Fuel,
  FileSpreadsheet,
  ChartNoAxesCombined,
  BarChart3,
  ShieldCheck,
  ChevronDown,
  Headphones,
  FileText,
  Layers3,
  WalletCards,
  ChartSpline
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

const NAVIGATION = [
  {
    id: "general",
    title: "GENEL",
    type: "single",
    items: [
      {
        label: "Ana Sayfa",
        route: "/dashboard",
        icon: LayoutDashboard
      }
    ]
  },
  {
    id: "operations",
    title: "OPERASYON",
    groups: [
      {
        id: "orders",
        label: "Sipari\u015f \u0130\u015flemleri",
        icon: Layers3,
        items: [
          {
            label: "Sipari\u015f Olu\u015ftur",
            route: "/SiparisIslemleri/SiparisOlustur",
            icon: ClipboardList
          },
          {
            label: "Spot Tedarik Sipari\u015f",
            route: "/SiparisIslemleri/YeniSiparis",
            icon: FilePlus2
          },
          {
            label: "\u0130rsaliye",
            route: "/Irsaliye",
            icon: FileText
          },
          {
            label: "Parsiyel Sipari\u015f",
            route: "/SiparisIslemleri/ParsiyelSiparisOlustur",
            icon: PackagePlus
          },
          {
            label: "Teslim Noktalar\u0131",
            route: "/SiparisIslemleri/TeslimNoktalari",
            icon: MapPinned
          },
          {
            label: "Sipari\u015f A\u00e7anlar",
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
        id: "definitions",
        label: "Tan\u0131mlamalar",
        icon: FolderKanban,
        items: [
          {
            label: "Proje Tan\u0131mlamalar\u0131",
            route: "/Tanimlamalar/ProjeEkle",
            icon: FolderKanban
          }
        ]
      }
    ]
  },
  {
    id: "finance",
    title: "F\u0130NANS",
    groups: [
      {
        id: "income-expense",
        label: "Gelir / Gider",
        icon: WalletCards,
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
            label: "Sefer Fiyatland\u0131rma",
            route: "/fiyatlandirma/seferFiyatlandirma",
            icon: Calculator
          }
        ]
      },
      {
        id: "fuel",
        label: "Yak\u0131t & Eskalasyon",
        icon: Fuel,
        items: [
          {
            label: "Yak\u0131t Hesaplama",
            route: "/finans/yakit-hesaplama",
            icon: Fuel
          },
          {
            label: "M\u00fc\u015fteri Kurulum",
            route: "/finans/musteri-kurulum",
            icon: FileSpreadsheet
          },
          {
            label: "Yak\u0131t Onaylar\u0131",
            route: "/finans/yakit-onaylar",
            icon: ShieldCheck
          },
          {
            label: "Yak\u0131t Y\u00f6netim V3",
            route: "/finans/yakit-yonetim-v3",
            icon: ShieldCheck
          },
          {
            label: "Tarife Kontrol Merkezi",
            route: "/finans/yakit-kontrol-merkezi",
            icon: ShieldCheck
          }
        ]
      }
    ]
  },
  {
    id: "analysis",
    title: "ANAL\u0130Z",
    groups: [
      {
        id: "reports",
        label: "Rapor & Analiz",
        icon: ChartSpline,
        items: [
          {
            label: "\u00d6zet Analiz",
            route: "/analiz/ozet",
            icon: ChartNoAxesCombined
          },
          {
            label: "G\u00f6rsel Analiz",
            route: "/gorsel",
            icon: BarChart3
          }
        ]
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

  const canSeeRoute = (route) => {
    return (
      isAdmin ||
      !user ||
      route === "/dashboard" ||
      allowed.includes(route)
    );
  };

  const navigation = useMemo(() => {
    return NAVIGATION
      .map((section) => {
        if (section.type === "single") {
          const items = section.items.filter((item) =>
            canSeeRoute(item.route)
          );

          return {
            ...section,
            items
          };
        }

        const groups = section.groups
          .map((group) => ({
            ...group,
            items: group.items.filter((item) =>
              canSeeRoute(item.route)
            )
          }))
          .filter((group) => group.items.length > 0);

        return {
          ...section,
          groups
        };
      })
      .filter((section) => {
        if (section.type === "single") {
          return section.items.length > 0;
        }

        return section.groups.length > 0;
      });
  }, [isAdmin, user, allowed]);

  const isItemActive = (route) => {
    if (route === "/dashboard") {
      return location.pathname === "/dashboard";
    }

    return (
      location.pathname === route ||
      location.pathname.startsWith(`${route}/`)
    );
  };

  const activeGroupId = useMemo(() => {
    for (const section of navigation) {
      if (section.type === "single") continue;

      for (const group of section.groups) {
        if (group.items.some((item) => isItemActive(item.route))) {
          return group.id;
        }
      }
    }

    return null;
  }, [navigation, location.pathname]);

  const [openGroups, setOpenGroups] = useState(() =>
    activeGroupId ? [activeGroupId] : []
  );

  useEffect(() => {
    if (!activeGroupId) return;

    setOpenGroups((current) =>
      current.includes(activeGroupId)
        ? current
        : [...current, activeGroupId]
    );
  }, [activeGroupId]);

  const toggleGroup = (groupId) => {
    setOpenGroups((current) =>
      current.includes(groupId)
        ? current.filter((id) => id !== groupId)
        : [...current, groupId]
    );
  };

  const onNav = () => {
    if (isMobile) {
      closeSidebar?.();
    }
  };

  return (
    <aside
      className={[
        "od-sidebar",
        "od-sidebar-v3",
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
          <div className="od-brand-symbol">
            <span>O</span>
          </div>

          <div className="od-brand-mark">
            <span className="od-brand-word">ODAK</span>
            <span className="od-brand-sub">LOJ\u0130ST\u0130K</span>
          </div>
        </NavLink>
      </div>

      <div className="od-sidebar-scroll">
        <nav className="od-sidebar-nav">
          {navigation.map((section) => (
            <section
              className="od-sidebar-group"
              key={section.id}
            >
              <div className="od-sidebar-group-title">
                {section.title}
              </div>

              {section.type === "single" ? (
                <div className="od-sidebar-items">
                  {section.items.map((item) => {
                    const Icon = item.icon;
                    const active = isItemActive(item.route);

                    return (
                      <NavLink
                        key={item.route}
                        to={item.route}
                        onClick={onNav}
                        title={item.label}
                        className={`od-sidebar-item od-sidebar-direct ${
                          active ? "is-active" : ""
                        }`}
                      >
                        <span className="od-sidebar-active-line" />

                        <span className="od-sidebar-icon">
                          <Icon size={18} strokeWidth={1.9} />
                        </span>

                        <span className="od-sidebar-label">
                          {item.label}
                        </span>
                      </NavLink>
                    );
                  })}
                </div>
              ) : (
                <div className="od-sidebar-accordion-list">
                  {section.groups.map((group) => {
                    const GroupIcon = group.icon;
                    const expanded = openGroups.includes(group.id);
                    const groupActive = group.items.some((item) =>
                      isItemActive(item.route)
                    );

                    return (
                      <div
                        key={group.id}
                        className={[
                          "od-nav-cluster",
                          expanded ? "is-expanded" : "",
                          groupActive ? "is-current" : ""
                        ]
                          .filter(Boolean)
                          .join(" ")}
                      >
                        <button
                          type="button"
                          className="od-nav-cluster-trigger"
                          onClick={() => toggleGroup(group.id)}
                          aria-expanded={expanded}
                          title={group.label}
                        >
                          <span className="od-sidebar-icon">
                            <GroupIcon size={18} strokeWidth={1.9} />
                          </span>

                          <span className="od-sidebar-label">
                            {group.label}
                          </span>

                          <span className="od-nav-count">
                            {group.items.length}
                          </span>

                          <ChevronDown
                            size={15}
                            strokeWidth={2}
                            className="od-nav-cluster-chevron"
                          />
                        </button>

                        <div className="od-nav-cluster-content">
                          <div className="od-nav-cluster-inner">
                            {group.items.map((item) => {
                              const ItemIcon = item.icon;
                              const active = isItemActive(item.route);

                              return (
                                <NavLink
                                  key={item.route}
                                  to={item.route}
                                  onClick={onNav}
                                  title={item.label}
                                  className={`od-nav-subitem ${
                                    active ? "is-active" : ""
                                  }`}
                                >
                                  <span className="od-nav-subitem-line" />

                                  <span className="od-nav-subitem-icon">
                                    <ItemIcon
                                      size={15}
                                      strokeWidth={1.85}
                                    />
                                  </span>

                                  <span className="od-nav-subitem-label">
                                    {item.label}
                                  </span>
                                </NavLink>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
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
            <Headphones size={17} strokeWidth={1.9} />
          </span>

          <span className="od-support-copy">
            <strong>Destek Merkezi</strong>
            <small>Yard\u0131m ve destek</small>
          </span>
        </button>

        <div className="od-sidebar-status">
          <ShieldCheck size={14} strokeWidth={1.9} />

          <span>Sistem aktif</span>

          <i />
        </div>
      </div>
    </aside>
  );
}

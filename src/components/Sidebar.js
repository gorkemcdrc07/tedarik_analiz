// Sidebar.js — koyu cam/blur, neon aksanlı, kütüphanesiz modern sidebar
import React, { useState } from "react";
import { NavLink } from "react-router-dom";
import "./Sidebar.css";

const Icon = {
    Chevron: (props) => (
        <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden {...props}>
            <path fill="currentColor" d="M6 9l6 6 6-6" />
        </svg>
    ),
    Order: (props) => (
        <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden {...props}>
            <path fill="currentColor" d="M7 4h10a2 2 0 0 1 2 2v3H5V6a2 2 0 0 1 2-2Zm-2 7h14v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7Zm4 2v5h2v-5H9Zm6 0v5h2v-5h-2Z" />
        </svg>
    ),
    Location: (props) => (
        <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden {...props}>
            <path fill="currentColor" d="M12 2a7 7 0 0 0-7 7c0 5.25 7 13 7 13s7-7.75 7-13a7 7 0 0 0-7-7Zm0 9.5A2.5 2.5 0 1 1 12 6a2.5 2.5 0 0 1 0 5.5Z" />
        </svg>
    ),
    MoneyIn: (props) => (
        <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden {...props}>
            <path fill="currentColor" d="M21 7H3V5h18v2Zm0 12H3v-2h18v2ZM7 9h10v6H7V9Zm5 5 3-3h-2V9h-2v2H9l3 3Z" />
        </svg>
    ),
    MoneyOut: (props) => (
        <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden {...props}>
            <path fill="currentColor" d="M21 7H3V5h18v2Zm0 12H3v-2h18v2ZM7 9h10v6H7V9Zm5-1-3 3h2v2h2v-2h2l-3-3Z" />
        </svg>
    ),
    Calc: (props) => (
        <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden {...props}>
            <path fill="currentColor" d="M7 2h10a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2Zm0 4v2h10V6H7Zm0 5h4v4H7v-4Zm6 0h4v4h-4v-4Zm-6 6h10v2H7v-2Z" />
        </svg>
    ),
    Report: (props) => (
        <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden {...props}>
            <path fill="currentColor" d="M5 3h10l4 4v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Zm9 1v4h4M7 12h2v6H7v-6Zm4-3h2v9h-2V9Zm4 5h2v4h-2v-4Z" />
        </svg>
    ),
    Dot: (props) => (
        <svg viewBox="0 0 24 24" width="8" height="8" aria-hidden {...props}>
            <circle cx="12" cy="12" r="3" fill="currentColor" />
        </svg>
    ),
};

const itemIconFor = (label) => {
    switch (label) {
        case "Sipariş Oluştur": return <Icon.Order />;
        case "Teslim Noktaları": return <Icon.Location />;
        case "Gelir Ekleme": return <Icon.MoneyIn />;
        case "Gider Ekleme": return <Icon.MoneyOut />;
        case "Eskalasyon Hesabı": return <Icon.Calc />;
        case "Tedarik Analiz": return <Icon.Report />;
        default: return <Icon.Dot />;
    }
};

const groupIconFor = (title) => {
    switch (title) {
        case "SİPARİŞ İŞLEMLERİ": return <Icon.Order />;
        case "GELİR & GİDER": return <Icon.MoneyIn />;
        case "RAPORLAR": return <Icon.Report />;
        default: return <Icon.Dot />;
    }
};

const Sidebar = ({ isOpen, toggleSidebar }) => {
    const [openSections, setOpenSections] = useState({ "GELİR & GİDER": true });

    const menuGroups = [
        { title: "SİPARİŞ İŞLEMLERİ", items: ["Sipariş Oluştur", "Teslim Noktaları"] },
        { title: "GELİR & GİDER", items: ["Gelir Ekleme", "Gider Ekleme", "Eskalasyon Hesabı"] },
        { title: "RAPORLAR", items: ["Tedarik Analiz"] },
    ];

    const routeMap = {
        "Tedarik Analiz": "/dashboard",
        "Gelir Ekleme": "/GelirGider/GelirEkleme",
        "Gider Ekleme": "/GelirGider/GiderEkleme",
        "Sipariş Oluştur": "/SiparisIslemleri/SiparisOlustur",
        // "Teslim Noktaları": "/Siparis/TeslimNoktalari",
    };

    const toggleSection = (title) =>
        setOpenSections((prev) => ({ ...prev, [title]: !prev[title] }));

    const onHeaderKey = (e, title) => {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggleSection(title); }
        if (e.key === "ArrowLeft") { e.preventDefault(); setOpenSections((p) => ({ ...p, [title]: false })); }
        if (e.key === "ArrowRight") { e.preventDefault(); setOpenSections((p) => ({ ...p, [title]: true })); }
    };

    return (
        <>
            <aside className={`sb sb--dark ${isOpen ? "open" : "closed"}`} aria-expanded={isOpen ? "true" : "false"}>
                <button
                    className="sb-toggle"
                    onClick={toggleSidebar}
                    aria-label={isOpen ? "Daralt" : "Genişlet"}
                    type="button"
                    title={isOpen ? "Daralt" : "Genişlet"}
                >
                    {isOpen ? "«" : "»"}
                </button>

                <div className="sb-inner">
                    <a className="sb-brand" href="#/" title="Panel">
                        <span className="sb-logo" aria-hidden />
                        {isOpen && <span className="sb-brand-text">Panel</span>}
                    </a>

                    <nav className="sb-nav" aria-label="Kenar menü">
                        {menuGroups.map((group) => {
                            const isGroupOpen = !!openSections[group.title];
                            return (
                                <div key={group.title} className={`sb-group ${isGroupOpen ? "is-open" : ""}`}>
                                    <div
                                        className="sb-group-header"
                                        role="button"
                                        tabIndex={0}
                                        onClick={() => toggleSection(group.title)}
                                        onKeyDown={(e) => onHeaderKey(e, group.title)}
                                        aria-expanded={isGroupOpen ? "true" : "false"}
                                        aria-controls={`sec-${group.title}`}
                                        title={group.title}
                                    >
                                        <span className="sb-group-icon">{groupIconFor(group.title)}</span>
                                        {isOpen && <span className="sb-group-title">{group.title}</span>}
                                        <Icon.Chevron className={`sb-chevron ${isGroupOpen ? "open" : ""}`} />
                                    </div>

                                    <ul id={`sec-${group.title}`} className="sb-list" data-open={isGroupOpen ? "true" : "false"}>
                                        {group.items.map((item) => {
                                            const to = routeMap[item];
                                            const content = (
                                                <>
                                                    <span className="sb-item-icon">{itemIconFor(item)}</span>
                                                    {isOpen && <span className="sb-item-label">{item}</span>}
                                                </>
                                            );
                                            return (
                                                <li key={item}>
                                                    {to ? (
                                                        <NavLink
                                                            to={to}
                                                            className="sb-item"
                                                            title={item}
                                                            end
                                                        >
                                                            {content}
                                                        </NavLink>
                                                    ) : (
                                                        <span className="sb-item sb-item--disabled" title={`${item} (yakında)`}>
                                                            {content}
                                                        </span>
                                                    )}
                                                </li>
                                            );
                                        })}
                                    </ul>
                                </div>
                            );
                        })}
                    </nav>
                </div>
            </aside>

            {/* Mobil overlay */}
            <div className="sb-overlay" data-open={isOpen ? "true" : "false"} onClick={toggleSidebar} />
        </>
    );
};

export default Sidebar;

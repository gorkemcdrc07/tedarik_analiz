import React, { useState } from "react";
import { NavLink } from "react-router-dom";
import "./Sidebar.css";

const Sidebar = ({ isOpen, toggleSidebar }) => {
    // İstersen "GELİR & GİDER" açık başlasın
    const [openSections, setOpenSections] = useState({ "GELİR & GİDER": true });

    const menuGroups = [
        {
            title: "SİPARİŞ İŞLEMLERİ",
            items: ["Sipariş Oluştur", "Teslim Noktaları"],
        },
        {
            title: "GELİR & GİDER",
            items: ["Gelir Ekleme", "Gider Ekleme", "Eskalasyon Hesabı"],
        },
        {
            title: "RAPORLAR",
            items: ["Tedarik Analiz"],
        },
    ];

    // Tüm item -> path eşleşmesi tek yerde
    const routeMap = {
        "Tedarik Analiz": "/dashboard",
        "Gelir Ekleme": "/GelirGider/GelirEkleme",
        "Gider Ekleme": "/GelirGider/GiderEkleme", // ✅ eklendi
        // "Eskalasyon Hesabı": "/GelirGider/Eskalasyon",
        // "Sipariş Oluştur": "/Siparis/Olustur",
        // "Teslim Noktaları": "/Siparis/TeslimNoktalari",
    };

    const toggleSection = (title) => {
        setOpenSections((prev) => ({ ...prev, [title]: !prev[title] }));
    };

    return (
        <aside className={`sidebar ${isOpen ? "open" : "closed"}`}>
            <button className="sidebar-toggle" onClick={toggleSidebar}>
                {isOpen ? "«" : "»"}
            </button>

            {isOpen &&
                menuGroups.map((group) => (
                    <div key={group.title} className="menu-group">
                        <div
                            className="menu-title expandable"
                            onClick={() => toggleSection(group.title)}
                        >
                            {group.title}
                            <span className="arrow">
                                {openSections[group.title] ? "▾" : "▸"}
                            </span>
                        </div>

                        {openSections[group.title] && (
                            <ul>
                                {group.items.map((item) => {
                                    const to = routeMap[item];
                                    // path tanımlı değilse pasif göster
                                    if (!to) {
                                        return (
                                            <li key={item}>
                                                <span className="menu-item disabled">{item}</span>
                                            </li>
                                        );
                                    }
                                    return (
                                        <li key={item}>
                                            <NavLink
                                                to={to}
                                                className={({ isActive }) =>
                                                    `menu-item ${isActive ? "active" : ""}`
                                                }
                                                end
                                            >
                                                {item}
                                            </NavLink>
                                        </li>
                                    );
                                })}
                            </ul>
                        )}
                    </div>
                ))}
        </aside>
    );
};

export default Sidebar;

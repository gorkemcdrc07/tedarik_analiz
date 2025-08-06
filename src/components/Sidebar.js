import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import "./Sidebar.css";

const Sidebar = ({ isOpen, toggleSidebar }) => {
    const navigate = useNavigate();
    const [openSections, setOpenSections] = useState({});
    const [activeItem, setActiveItem] = useState("");

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

    const toggleSection = (title) => {
        setOpenSections((prev) => ({
            ...prev,
            [title]: !prev[title],
        }));
    };

    const handleItemClick = (item) => {
        setActiveItem(item);
        if (item === "Tedarik Analiz") {
            navigate("/dashboard");
        }
        // Diğer item yönlendirmeleri burada yapılabilir
    };

    return (
        <aside className={`sidebar ${isOpen ? "open" : "closed"}`}>
            <button className="sidebar-toggle" onClick={toggleSidebar}>
                {isOpen ? "«" : "»"}
            </button>

            {isOpen && menuGroups.map((group) => (
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
                            {group.items.map((item) => (
                                <li
                                    key={item}
                                    className={activeItem === item ? "active" : ""}
                                    onClick={() => handleItemClick(item)}
                                >
                                    {item}
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            ))}
        </aside>
    );
};

export default Sidebar;

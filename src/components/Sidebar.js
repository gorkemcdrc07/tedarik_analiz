import React, { useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import {
    Box, List, ListItem, ListItemButton, ListItemIcon,
    ListItemText, Collapse, Typography, Tooltip
} from "@mui/material";
// İkonları tek tek ve garantili isimlerle import ediyoruz
import OrderIcon from "@mui/icons-material/ShoppingCartOutlined";
import LocationIcon from "@mui/icons-material/LocationOnOutlined";
import ReportIcon from "@mui/icons-material/BarChartOutlined";
import MoneyInIcon from "@mui/icons-material/PaidOutlined";
import MoneyOutIcon from "@mui/icons-material/MoneyOffCsredOutlined";
import CalcIcon from "@mui/icons-material/CalculateOutlined";
import PriceIcon from "@mui/icons-material/PriceChangeOutlined";
import DashboardIcon from "@mui/icons-material/AutoGraph";
import ChevronIcon from "@mui/icons-material/ArrowForwardIos"; // Listenizde mevcut
import MenuOpenIcon from "@mui/icons-material/MenuOpen";

const drawerWidthOpen = 280;
const drawerWidthClosed = 88;
const sidebarBg = "#0a0f1e";
const accentColor = "#3b82f6";

const Sidebar = ({ isOpen, toggleSidebar }) => {
    const [openSections, setOpenSections] = useState({});
    const location = useLocation();

    const handleSectionClick = (title) => {
        if (!isOpen) {
            toggleSidebar();
            setOpenSections((prev) => ({ ...prev, [title]: true }));
        } else {
            setOpenSections((prev) => ({ ...prev, [title]: !prev[title] }));
        }
    };

    const menuConfig = [
        {
            groupName: "OPERASYON",
            items: [
                {
                    title: "SİPARİŞ İŞLEMLERİ",
                    icon: OrderIcon,
                    subItems: [
                        { label: "Sipariş Oluştur", route: "/SiparisIslemleri/SiparisOlustur" },
                        { label: "Teslim Noktaları", route: "/teslim-noktalari" },
                        { label: "Sipariş Açanlar", route: "/SiparisIslemleri/SiparisAcanlar" },
                        { label: "Arkas", route: "/SiparisIslemleri/Arkas" },
                        { label: "Fasdat", route: "/SiparisIslemleri/Fasdat" },
                    ]
                }
            ]
        },
        {
            groupName: "FİNANS",
            items: [
                {
                    title: "GELİR & GİDER",
                    icon: MoneyInIcon,
                    subItems: [
                        { label: "Gelir Ekleme", route: "/GelirGider/GelirEkleme" },
                        { label: "Gider Ekleme", route: "/GelirGider/GiderEkleme" },
                        { label: "Eskalasyon", route: "/eskalasyon" },
                    ]
                },
                {
                    title: "FİYATLANDIRMA",
                    icon: PriceIcon,
                    subItems: [
                        { label: "Sefer Fiyatlandırma", route: "/fiyatlandirma/seferFiyatlandirma" },
                        { label: "Fiyat Listesi", route: "/Fiyatlandirma/FiyatListesi" },
                    ]
                }
            ]
        }
    ];

    return (
        <Box
            component="aside"
            sx={{
                width: isOpen ? drawerWidthOpen : drawerWidthClosed,
                height: '100vh',
                position: 'fixed',
                left: 0, top: 0,
                bgcolor: sidebarBg,
                borderRight: '1px solid rgba(255, 255, 255, 0.08)',
                transition: 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                zIndex: 1200,
                display: 'flex', flexDirection: 'column',
                overflow: 'hidden'
            }}
        >
            {/* Header / Logo */}
            <Box sx={{ p: 3, display: 'flex', alignItems: 'center', minHeight: 80 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mx: isOpen ? 0 : 'auto' }}>
                    <Box sx={{
                        width: 36, height: 36, borderRadius: '10px',
                        bgcolor: accentColor, display: 'flex', alignItems: 'center', justifyContent: 'center',
                        boxShadow: `0 0 15px ${accentColor}55`, flexShrink: 0
                    }}>
                        <DashboardIcon sx={{ color: '#fff', fontSize: 20 }} />
                    </Box>
                    {isOpen && (
                        <Typography sx={{ color: '#fff', fontWeight: 800, fontSize: 18, letterSpacing: -0.5 }}>
                            Fleet<span style={{ color: accentColor }}>OS</span>
                        </Typography>
                    )}
                </Box>
            </Box>

            {/* Navigation Content */}
            <Box sx={{ flexGrow: 1, overflowY: 'auto', px: 1.5 }}>
                {menuConfig.map((section) => (
                    <Box key={section.groupName} sx={{ mb: 2 }}>
                        {isOpen && (
                            <Typography sx={{
                                color: 'rgba(255,255,255,0.25)', fontSize: '10px',
                                fontWeight: 700, ml: 2, mb: 1, letterSpacing: '0.1em'
                            }}>
                                {section.groupName}
                            </Typography>
                        )}

                        {section.items.map((group) => {
                            const isExpanded = !!openSections[group.title] && isOpen;
                            const GroupIcon = group.icon;

                            return (
                                <Box key={group.title} sx={{ mb: 0.5 }}>
                                    <Tooltip title={!isOpen ? group.title : ""} placement="right" arrow>
                                        <ListItemButton
                                            onClick={() => handleSectionClick(group.title)}
                                            sx={{
                                                borderRadius: '12px',
                                                minHeight: 48,
                                                color: isExpanded ? '#fff' : 'rgba(255,255,255,0.5)',
                                                '&:hover': { bgcolor: 'rgba(255,255,255,0.04)', color: '#fff' }
                                            }}
                                        >
                                            <ListItemIcon sx={{ minWidth: 0, mr: isOpen ? 2 : 0, color: 'inherit', justifyContent: 'center' }}>
                                                <GroupIcon sx={{ fontSize: 22 }} />
                                            </ListItemIcon>

                                            {isOpen && (
                                                <>
                                                    <ListItemText
                                                        primary={group.title}
                                                        primaryTypographyProps={{ fontSize: '12px', fontWeight: 600 }}
                                                    />
                                                    <ChevronIcon sx={{
                                                        fontSize: 10,
                                                        transform: isExpanded ? 'rotate(90deg)' : 'none',
                                                        transition: '0.2s', opacity: 0.5
                                                    }} />
                                                </>
                                            )}
                                        </ListItemButton>
                                    </Tooltip>

                                    <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                                        <List disablePadding sx={{ mt: 0.5, ml: isOpen ? 2.5 : 0 }}>
                                            {group.subItems.map((item) => {
                                                const isActive = location.pathname === item.route;
                                                return (
                                                    <ListItemButton
                                                        key={item.label}
                                                        component={NavLink}
                                                        to={item.route}
                                                        sx={{
                                                            minHeight: 34,
                                                            borderRadius: '8px',
                                                            mb: 0.3,
                                                            color: isActive ? accentColor : 'rgba(255,255,255,0.4)',
                                                            bgcolor: isActive ? 'rgba(59, 130, 246, 0.08)' : 'transparent',
                                                            '&:hover': { color: '#fff', bgcolor: 'rgba(255,255,255,0.02)' }
                                                        }}
                                                    >
                                                        <ListItemText
                                                            primary={item.label}
                                                            primaryTypographyProps={{ fontSize: '12px', fontWeight: isActive ? 600 : 400 }}
                                                        />
                                                    </ListItemButton>
                                                );
                                            })}
                                        </List>
                                    </Collapse>
                                </Box>
                            );
                        })}
                    </Box>
                ))}
            </Box>

            {/* Footer Control */}
            <Box sx={{ p: 2, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                <ListItemButton
                    onClick={toggleSidebar}
                    sx={{
                        borderRadius: '12px',
                        justifyContent: isOpen ? 'initial' : 'center',
                        color: 'rgba(255,255,255,0.4)',
                        '&:hover': { color: '#fff', bgcolor: 'rgba(255,255,255,0.04)' }
                    }}
                >
                    <ListItemIcon sx={{ minWidth: 0, mr: isOpen ? 2 : 0, color: 'inherit' }}>
                        <MenuOpenIcon sx={{ fontSize: 20, transform: !isOpen ? 'scaleX(-1)' : 'none' }} />
                    </ListItemIcon>
                    {isOpen && <ListItemText primary="Menüyü Daralt" primaryTypographyProps={{ fontSize: '12px', fontWeight: 600 }} />}
                </ListItemButton>
            </Box>
        </Box>
    );
};

export default Sidebar;
// src/Sidebar.jsx - EN BÜYÜK, EN MODERN VE ŞIK MUI VERSİYONU (Optimize Edilmiş ve Tam)

import React, { useState, useCallback } from "react";
import { NavLink } from "react-router-dom";
import {
    Box,
    List,
    ListItem,
    ListItemButton,
    ListItemIcon,
    ListItemText,
    Collapse,
    Typography,
    Divider,
    IconButton,
} from "@mui/material";
import {
    ChevronLeft as ChevronIcon,
    ShoppingCart as OrderIcon,
    LocationOn as LocationIcon,
    BarChart as ReportIcon,
    AttachMoney as MoneyInIcon,
    MoneyOff as MoneyOutIcon,
    Calculate as CalcIcon,
    PriceChange as PriceIcon,
    FiberManualRecord as DotIcon,
    Menu as MenuIcon,
} from "@mui/icons-material";
import { styled } from "@mui/material/styles";

// ----------------------------------------------------
// 1. İKON EŞLEŞTİRME
// ----------------------------------------------------
const IconMap = {
    Order: OrderIcon,
    Location: LocationIcon,
    Report: ReportIcon,
    MoneyIn: MoneyInIcon,
    MoneyOut: MoneyOutIcon,
    Calc: CalcIcon,
    Price: PriceIcon,
    Dot: DotIcon,
};

// ----------------------------------------------------
// 2. MENÜ VERİ YAPISI (ARŞİM VE FASDAT ROTALARI EKLENDİ)
// ----------------------------------------------------
const menuConfig = [
    {
        title: "SİPARİŞ İŞLEMLERİ",
        icon: IconMap.Order,
        items: [
            { label: "Sipariş Oluştur", route: "/SiparisIslemleri/SiparisOlustur", icon: IconMap.Order },
            { label: "Teslim Noktaları", route: "/teslim-noktalari", icon: IconMap.Location },
            { label: "Sipariş Açanlar", route: "/SiparisIslemleri/SiparisAcanlar", icon: IconMap.Report },
            // PASİFLİK KALDIRILDI: Geçici veya doğru rotaları buraya ekleyin
            { label: "Arkas", route: "/SiparisIslemleri/Arkas", icon: IconMap.Dot },
            { label: "Fasdat", route: "/SiparisIslemleri/Fasdat", icon: IconMap.Dot },
        ],
    },
    {
        title: "GELİR & GİDER",
        icon: IconMap.MoneyIn,
        items: [
            { label: "Gelir Ekleme", route: "/GelirGider/GelirEkleme", icon: IconMap.MoneyIn },
            { label: "Test Gelir", route: "/GelirGider/TestGelir", icon: IconMap.MoneyIn },
            { label: "Gider Ekleme", route: "/GelirGider/GiderEkleme", icon: IconMap.MoneyOut },
            { label: "Test Gider", route: "/GelirGider/TestGider", icon: IconMap.MoneyOut },
            { label: "Eskalasyon Hesabı", route: "/eskalasyon", icon: IconMap.Calc },
        ],
    },
    {
        title: "FİYATLANDIRMA",
        icon: IconMap.Price,
        items: [
            { label: "SEFER FİYATLANDIRMA", route: "/fiyatlandirma/seferFiyatlandirma", icon: IconMap.Price },
            { label: "FİYAT LİSTESİ", route: "/Fiyatlandirma/FiyatListesi", icon: IconMap.Price },
        ],
    },
    {
        title: "RAPORLAR",
        icon: IconMap.Report,
        items: [
            { label: "Tedarik Analiz", route: "/dashboard", icon: IconMap.Report },
            { label: "Özet Tablo", route: "/analiz/ozet", icon: IconMap.Report },
        ],
    },
];

// ----------------------------------------------------
// 3. STİL SABİTLERİ
// ----------------------------------------------------
const drawerWidthOpen = 300;
const drawerWidthClosed = 80;
const accentColor = 'info.main';

const sidebarStyles = {
    bgcolor: 'grey.900',
    color: 'grey.200',
    height: '100vh',
    position: 'fixed',
    zIndex: 1200,
    boxShadow: 8,
    pt: 2,
    overflowX: 'hidden',
    overflowY: 'auto',

    transition: (theme) => theme.transitions.create('width', {
        easing: theme.transitions.easing.sharp,
        duration: theme.transitions.duration.standard,
    }),
};

const listItemButtonBaseStyle = {
    borderRadius: 1.5,
    my: 0.5,
    mx: 2,
    py: 1,
    px: 1.5,
    minHeight: 44,
    color: 'grey.300',
    justifyContent: 'center',

    '&:hover': {
        bgcolor: 'grey.800',
        color: 'white',
    },
};

const ActiveLinkStyle = (theme) => ({
    '&.Mui-selected, &.Mui-selected:hover': {
        bgcolor: accentColor,
        color: 'white',
        fontWeight: 600,
        boxShadow: theme.shadows[3],
    },
});

// ----------------------------------------------------
// 4. YARDIMCI BİLEŞENLER
// ----------------------------------------------------

// Alt Menü Öğesi Bileşeni
const MenuItem = React.memo(({ item, isSidebarOpen }) => {
    const { label, route, icon: ItemIcon } = item;
    // route null değilse disabled false olur. (Eğer route: null kalsaydı true olurdu)
    const isDisabled = !route;
    const Component = route ? NavLink : 'span';

    return (
        <ListItem disablePadding sx={{ display: 'block' }}>
            <ListItemButton
                component={Component}
                to={route || '#'}
                end
                disabled={isDisabled}
                sx={(theme) => ({
                    ...listItemButtonBaseStyle,
                    ...ActiveLinkStyle(theme),
                    // Kilitli öğe stili, route null değilse artık uygulanmaz
                    opacity: isDisabled ? 0.6 : 1,
                    cursor: isDisabled ? 'not-allowed' : 'pointer',

                    ...(isSidebarOpen && {
                        justifyContent: 'initial',
                        mx: 1.5,
                    }),
                })}
                className={({ isActive }) => (isActive ? 'Mui-selected' : '')}
            >
                <ListItemIcon sx={{
                    minWidth: 40,
                    color: 'inherit',
                    justifyContent: 'center',
                }}>
                    <ItemIcon sx={{ fontSize: 22 }} />
                </ListItemIcon>

                {isSidebarOpen && (
                    <ListItemText
                        primary={label}
                        sx={{
                            opacity: isSidebarOpen ? 1 : 0,
                            overflow: 'hidden',
                            whiteSpace: 'nowrap',
                            ml: 1,

                            '& .MuiTypography-root': { fontSize: 15, fontWeight: 500 },
                        }}
                    />
                )}
            </ListItemButton>
        </ListItem>
    );
});

// Grup Başlığı Bileşeni
const GroupHeader = React.memo(({ title, IconComponent, isGroupOpen, toggleSection, onHeaderKey, isSidebarOpen }) => (
    <ListItemButton
        onClick={() => toggleSection(title)}
        onKeyDown={(e) => onHeaderKey(e, title)}
        aria-expanded={isGroupOpen}
        aria-controls={`collapse-${title}`}
        sx={{
            ...listItemButtonBaseStyle,
            mx: 0,
            py: 1.5,
            px: 2,
            borderRadius: 0,
            justifyContent: 'center',

            borderLeft: (theme) => isGroupOpen && isSidebarOpen ? `4px solid ${theme.palette[accentColor.split('.')[0]][accentColor.split('.')[1]]}` : '4px solid transparent',
            bgcolor: isGroupOpen ? 'grey.800' : 'transparent',
            color: isGroupOpen ? 'white' : 'grey.300',

            ...(isSidebarOpen && {
                justifyContent: 'initial',
            }),
        }}
    >
        <ListItemIcon sx={{ minWidth: isSidebarOpen ? 40 : 0, color: 'inherit', justifyContent: 'center' }}>
            <IconComponent sx={{ fontSize: 24 }} />
        </ListItemIcon>

        {isSidebarOpen && (
            <>
                <ListItemText
                    primary={
                        <Typography variant="subtitle2" component="span" sx={{
                            color: 'inherit',
                            fontWeight: 700,
                            letterSpacing: 1.2,
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            transition: 'color 0.3s',
                        }}>
                            {title}
                        </Typography>
                    }
                    sx={{ ml: 1 }}
                />
                <ChevronIcon
                    sx={{
                        transform: isGroupOpen ? 'rotate(-90deg)' : 'rotate(0deg)',
                        transition: 'transform 0.3s',
                        color: 'grey.500',
                        ml: 1,
                        flexShrink: 0,
                    }}
                />
            </>
        )}
    </ListItemButton>
));

// ----------------------------------------------------
// 5. ANA BİLEŞEN
// ----------------------------------------------------

const Sidebar = ({ isOpen, toggleSidebar }) => {
    // BURASI DÜZELTİLDİ: Hiçbir sekme açık gelmesin
    const [openSections, setOpenSections] = useState({});

    const toggleSection = useCallback((title) => {
        setOpenSections((prev) => ({ ...prev, [title]: !prev[title] }));
    }, []);

    const onHeaderKey = useCallback((e, title) => {
        if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            toggleSection(title);
        }
    }, [toggleSection]);

    return (
        <Box
            component="aside"
            sx={{
                ...sidebarStyles,
                width: isOpen ? drawerWidthOpen : drawerWidthClosed,
            }}
        >
            {/* Toggle Button - Masaüstü */}
            <IconButton
                onClick={toggleSidebar}
                aria-label={isOpen ? "Menüyü Daralt" : "Menüyü Genişlet"}
                sx={{
                    position: 'absolute',
                    top: 100,
                    right: -18,
                    bgcolor: accentColor,
                    color: 'white',
                    zIndex: 1300,
                    boxShadow: 6,
                    p: 1,
                    transition: 'all 0.3s',
                    '&:hover': {
                        bgcolor: 'info.dark',
                    },
                    display: { xs: 'none', md: 'flex' },
                }}
            >
                <ChevronIcon sx={{ transform: isOpen ? 'rotate(0deg)' : 'rotate(180deg)', transition: 'transform 0.3s', fontSize: 24 }} />
            </IconButton>

            {/* Brand/Logo */}
            <Box sx={{ p: 2, display: 'flex', alignItems: 'center', justifyContent: isOpen ? 'flex-start' : 'center', mb: 2 }}>
                <Box sx={{ width: 36, height: 36, bgcolor: accentColor, borderRadius: 1.5, mr: isOpen ? 1 : 0, flexShrink: 0 }} />
                {isOpen && (
                    <Typography variant="h6" noWrap component="a" href="#" sx={{ color: 'white', textDecoration: 'none', fontWeight: 600, fontSize: 18 }}>
                        Modern Panel
                    </Typography>
                )}
            </Box>

            <Divider sx={{ borderColor: 'grey.800', mb: 1 }} />

            {/* Navigasyon */}
            <List sx={{ flexGrow: 1 }}>
                {menuConfig.map((group) => {
                    const isGroupOpen = !!openSections[group.title];

                    return (
                        <React.Fragment key={group.title}>
                            <GroupHeader
                                title={group.title}
                                IconComponent={group.icon}
                                isGroupOpen={isGroupOpen}
                                toggleSection={toggleSection}
                                onHeaderKey={onHeaderKey}
                                isSidebarOpen={isOpen}
                            />

                            {/* Sub-menu (Collapse) */}
                            <Collapse in={isGroupOpen} timeout="auto" unmountOnExit>
                                <List component="div" disablePadding sx={{ pl: isOpen ? 0 : 0 }}>
                                    {group.items.map((item) => (
                                        <MenuItem key={item.label} item={item} isSidebarOpen={isOpen} />
                                    ))}
                                </List>
                            </Collapse>
                        </React.Fragment>
                    );
                })}
            </List>

            <Divider sx={{ borderColor: 'grey.800', mt: 1 }} />

            {/* Mobil Toggle */}
            <Box sx={{ display: { xs: 'flex', md: 'none' }, justifyContent: 'center', py: 2 }}>
                <IconButton
                    onClick={toggleSidebar}
                    aria-label={isOpen ? "Menüyü Kapat" : "Menüyü Aç"}
                    sx={{ color: 'grey.400' }}
                >
                    <MenuIcon sx={{ fontSize: 28 }} />
                </IconButton>
            </Box>


            {/* Mobil overlay */}
            {isOpen && (
                <Box
                    onClick={toggleSidebar}
                    sx={{
                        position: 'fixed',
                        inset: 0,
                        bgcolor: 'rgba(0, 0, 0, 0.6)',
                        zIndex: 1100,
                        display: { xs: 'block', md: 'none' },
                    }}
                />
            )}
        </Box>
    );
};

export default Sidebar;
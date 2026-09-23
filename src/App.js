import React, { useEffect, useState } from "react";
import {
    BrowserRouter as Router,
    Routes,
    Route,
    Navigate,
    useLocation
} from "react-router-dom";
import Login from "./Login";
import Dashboard from "./Dashboard";
import AnaSayfa from "./AnaSayfa";
import Layout from "./Layout";
import Gorsel from "./gorsel";
import Yetkisiz from "./Yetkisiz";
import SiparisOlustur from "./SiparisIslemleri/SiparisOlustur";
import YeniSiparis from "./SiparisIslemleri/YeniSiparis";
import ParsiyelSiparisOlustur from "./SiparisIslemleri/ParsiyelSiparisOlustur";
import SiparisAcanlar from "./SiparisIslemleri/siparisAcanlar";
import Arkas from "./SiparisIslemleri/Arkas";
import Fasdat from "./SiparisIslemleri/Fasdat";
import TeslimNoktalari from "./SiparisIslemleri/TeslimNoktalari";
import Irsaliye from "./Irsaliye/Irsaliye";
import ProjeEkle from "./Tanimlamalar/ProjeEkle";
import GelirEkleme from "./GelirGider/GelirEkleme";
import GiderEkleme from "./GelirGider/GiderEkleme";
import TestGelir from "./GelirGider/TestGelir";
import TestGider from "./GelirGider/TestGider";
import SeferFiyatlandirma from "./fiyatlandirma/seferFiyatlandirma";
import YakitDegisimMerkezi from "./Finans/YakitDegisimMerkezi";
import YakitHesaplama from "./Finans/YakitHesaplama";
import YakitKontrolMerkezi from "./Finans/YakitKontrolMerkezi";
import YakitOnayMerkezi from "./Finans/YakitOnayMerkezi";
import YakitYonetimMerkeziV3 from "./Finans/YakitYonetimMerkeziV3";
import MusteriKurulumSihirbazi from "./Finans/MusteriKurulumSihirbazi";
import OzetTablo from "./analiz/ozetTablo";
import OdakMuiTheme from "./theme/OdakMuiTheme";
import { startFuelScheduler } from "./Finans/autoFuelService";
import "./odak-modern.css";
import "./odak-modern-v3.css";
import "./odak-modern-v4.css";
import "./odak-modern-v6.css";
import "./odak-dark-compat.css";

const API_BASE =
    (process.env.REACT_APP_API_BASE_URL || "")
        .replace(/\/+$/, "");

async function fetchCurrentSession() {
    const response = await fetch(
        `${API_BASE}/api/auth/session`,
        {
            method: "GET",
            credentials: "include",
            headers: {
                Accept: "application/json"
            },
            cache: "no-store"
        }
    );

    let data = null;

    try {
        data = await response.json();
    } catch {
        data = null;
    }

    if (
        !response.ok ||
        !data?.authenticated
    ) {
        return null;
    }

    return data.user || null;
}

// Sipariş

// İrsaliye

// Tanımlamalar

// Gelir / Gider

// Fiyatlandırma

// Analiz



function getLoginUser() {
    try {
        return JSON.parse(
            localStorage.getItem("loginUser") ||
            "null"
        );
    } catch {
        return null;
    }
}

function getFirstAllowedPath() {
    const user = getLoginUser();

    if (!user) {
        return "/";
    }

    return "/dashboard";
}

function ProtectedPage({ children, user }) {
    const location = useLocation();

    if (!user) {
        return (
            <Navigate
                to="/"
                replace
            />
        );
    }

    const currentPath = location.pathname;

    const allowedScreens = Array.isArray(
        user.allowedScreens
    )
        ? user.allowedScreens
        : [];

    /*
     * Ana sayfa tüm giriş yapmış
     * kullanıcılara açık.
     */
    if (currentPath === "/dashboard") {
        return (
            <Layout>
                {children}
            </Layout>
        );
    }

    /*
     * Admin paneli sadece
     * admin kullanıcıya açık.
     */
    if (currentPath === "/admin") {
        if (
            String(user.rol || "").toLowerCase() !==
            "admin"
        ) {
            return (
                <Layout>
                    <Yetkisiz />
                </Layout>
            );
        }

        return (
            <Layout>
                {children}
            </Layout>
        );
    }

    /*
     * Admin kullanıcılar tüm
     * ekranlara erişebilir.
     */
    if (
        String(user.rol || "").toLowerCase() ===
        "admin"
    ) {
        return (
            <Layout>
                {children}
            </Layout>
        );
    }

    /*
     * Normal kullanıcı ekran yetkisi.
     */
    if (!allowedScreens.includes(currentPath)) {
        return (
            <Layout>
                <Yetkisiz />
            </Layout>
        );
    }

    return (
        <Layout>
            {children}
        </Layout>
    );
}

export default function App() {
    const [
        isAuthenticated,
        setIsAuthenticated
    ] = useState(false);

    const [
        sessionUser,
        setSessionUser
    ] = useState(null);

    const [
        sessionLoading,
        setSessionLoading
    ] = useState(true);

    useEffect(() => {
        let active = true;

        const restoreSession = async () => {
            try {
                const user =
                    await fetchCurrentSession();

                if (!active) return;

                if (user) {
                    setSessionUser(user);
                    setIsAuthenticated(true);

                    /*
                     * Yalnızca UI cache.
                     * Yetkilendirme otoritesi backend session + DB'dir.
                     */
                    localStorage.setItem(
                        "loginUser",
                        JSON.stringify(user)
                    );
                } else {
                    setSessionUser(null);
                    setIsAuthenticated(false);

                    localStorage.removeItem(
                        "loginUser"
                    );

                    localStorage.removeItem(
                        "userRole"
                    );
                }
            } catch {
                if (!active) return;

                setSessionUser(null);
                setIsAuthenticated(false);

                localStorage.removeItem(
                    "loginUser"
                );

                localStorage.removeItem(
                    "userRole"
                );
            } finally {
                if (active) {
                    setSessionLoading(false);
                }
            }
        };

        restoreSession();

        return () => {
            active = false;
        };
    }, []);

    useEffect(() => startFuelScheduler(), []);

    const handleLoginSuccess = async () => {
        setSessionLoading(true);

        try {
            const user =
                await fetchCurrentSession();

            if (!user) {
                throw new Error(
                    "Oturum doğrulanamadı."
                );
            }

            setSessionUser(user);
            setIsAuthenticated(true);

            localStorage.setItem(
                "loginUser",
                JSON.stringify(user)
            );

            localStorage.setItem(
                "userRole",
                user.rol || "kullanici"
            );
        } catch {
            setSessionUser(null);
            setIsAuthenticated(false);

            localStorage.removeItem(
                "loginUser"
            );

            localStorage.removeItem(
                "userRole"
            );
        } finally {
            setSessionLoading(false);
        }
    };

    if (sessionLoading) {
        return (
            <OdakMuiTheme>
                <div
                    style={{
                        minHeight: "100vh",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center"
                    }}
                >
                    Oturum kontrol ediliyor...
                </div>
            </OdakMuiTheme>
        );
    }

    return (
        <OdakMuiTheme>
            <Router>
                <Routes>

                    {/* LOGIN */}
                    <Route
                        path="/"
                        element={
                            isAuthenticated ? (
                                <Navigate
                                    to={getFirstAllowedPath()}
                                    replace
                                />
                            ) : (
                                <Login
                                    onLoginSuccess={
                                        handleLoginSuccess
                                    }
                                />
                            )
                        }
                    />

                    {/* YETKİSİZ */}
                    <Route
                        path="/yetkisiz"
                        element={
                            <Layout>
                                <Yetkisiz />
                            </Layout>
                        }
                    />

                    {/* ANA SAYFA */}
                    <Route
                        path="/dashboard"
                        element={
                            <ProtectedPage user={sessionUser}>
                                <AnaSayfa />
                            </ProtectedPage>
                        }
                    />

                    {/* ADMIN */}
                    <Route
                        path="/admin"
                        element={
                            <ProtectedPage user={sessionUser}>
                                <Dashboard />
                            </ProtectedPage>
                        }
                    />

                    {/* ========================= */}
                    {/* SİPARİŞ İŞLEMLERİ */}
                    {/* ========================= */}

                    <Route
                        path="/SiparisIslemleri/SiparisOlustur"
                        element={
                            <ProtectedPage user={sessionUser}>
                                <SiparisOlustur />
                            </ProtectedPage>
                        }
                    />

                    <Route
                        path="/SiparisIslemleri/YeniSiparis"
                        element={
                            <ProtectedPage user={sessionUser}>
                                <YeniSiparis />
                            </ProtectedPage>
                        }
                    />

                    <Route
                        path="/SiparisIslemleri/ParsiyelSiparisOlustur"
                        element={
                            <ProtectedPage user={sessionUser}>
                                <ParsiyelSiparisOlustur />
                            </ProtectedPage>
                        }
                    />

                    <Route
                        path="/SiparisIslemleri/SiparisAcanlar"
                        element={
                            <ProtectedPage user={sessionUser}>
                                <SiparisAcanlar />
                            </ProtectedPage>
                        }
                    />

                    <Route
                        path="/SiparisIslemleri/Arkas"
                        element={
                            <ProtectedPage user={sessionUser}>
                                <Arkas />
                            </ProtectedPage>
                        }
                    />

                    <Route
                        path="/SiparisIslemleri/Fasdat"
                        element={
                            <ProtectedPage user={sessionUser}>
                                <Fasdat />
                            </ProtectedPage>
                        }
                    />

                    <Route
                        path="/SiparisIslemleri/TeslimNoktalari"
                        element={
                            <ProtectedPage user={sessionUser}>
                                <TeslimNoktalari />
                            </ProtectedPage>
                        }
                    />

                    {/* ========================= */}
                    {/* İRSALİYE */}
                    {/* ========================= */}

                    <Route
                        path="/Irsaliye"
                        element={
                            <ProtectedPage user={sessionUser}>
                                <Irsaliye />
                            </ProtectedPage>
                        }
                    />

                    {/* ========================= */}
                    {/* TANIMLAMALAR */}
                    {/* ========================= */}

                    <Route
                        path="/Tanimlamalar/ProjeEkle"
                        element={
                            <ProtectedPage user={sessionUser}>
                                <ProjeEkle />
                            </ProtectedPage>
                        }
                    />

                    {/* ========================= */}
                    {/* GELİR / GİDER */}
                    {/* ========================= */}

                    <Route
                        path="/GelirGider/GelirEkleme"
                        element={
                            <ProtectedPage user={sessionUser}>
                                <GelirEkleme />
                            </ProtectedPage>
                        }
                    />

                    <Route
                        path="/GelirGider/GiderEkleme"
                        element={
                            <ProtectedPage user={sessionUser}>
                                <GiderEkleme />
                            </ProtectedPage>
                        }
                    />

                    <Route
                        path="/GelirGider/TestGelir"
                        element={
                            <ProtectedPage user={sessionUser}>
                                <TestGelir />
                            </ProtectedPage>
                        }
                    />

                    <Route
                        path="/GelirGider/TestGider"
                        element={
                            <ProtectedPage user={sessionUser}>
                                <TestGider />
                            </ProtectedPage>
                        }
                    />

                    {/* ========================= */}
                    {/* FİYATLANDIRMA */}
                    {/* ========================= */}

                    <Route
                        path="/fiyatlandirma/seferFiyatlandirma"
                        element={
                            <ProtectedPage user={sessionUser}>
                                <SeferFiyatlandirma />
                            </ProtectedPage>
                        }
                    />

                    <Route
                        path="/finans/yakit-hesaplama"
                        element={
                            <ProtectedPage user={sessionUser}>
                                <YakitHesaplama />
                            </ProtectedPage>
                        }
                    />

                    <Route
                        path="/finans/musteri-kurulum"
                        element={
                            <ProtectedPage user={sessionUser}>
                                <MusteriKurulumSihirbazi />
                            </ProtectedPage>
                        }
                    />

                    <Route
                        path="/finans/yakit-yonetim-v3"
                        element={
                            <ProtectedPage user={sessionUser}>
                                <YakitYonetimMerkeziV3 />
                            </ProtectedPage>
                        }
                    />

                    <Route
                        path="/finans/yakit-onaylar"
                        element={
                            <ProtectedPage user={sessionUser}>
                                <YakitOnayMerkezi />
                            </ProtectedPage>
                        }
                    />

                    <Route
                        path="/finans/yakit-kontrol-merkezi"
                        element={
                            <ProtectedPage user={sessionUser}>
                                <YakitKontrolMerkezi />
                            </ProtectedPage>
                        }
                    />

                    <Route
                        path="/finans/akaryakit-fiyat-takip"
                        element={
                            <ProtectedPage user={sessionUser}>
                                <YakitDegisimMerkezi />
                            </ProtectedPage>
                        }
                    />

                    <Route
                        path="/finans/yakit-otomasyon-merkezi"
                        element={
                            <ProtectedPage user={sessionUser}>
                                <YakitDegisimMerkezi />
                            </ProtectedPage>
                        }
                    />

                    {/* ========================= */}
                    {/* ANALİZ */}
                    {/* ========================= */}

                    <Route
                        path="/analiz/ozet"
                        element={
                            <ProtectedPage user={sessionUser}>
                                <OzetTablo />
                            </ProtectedPage>
                        }
                    />

                    {/* ========================= */}
                    {/* GÖRSEL */}
                    {/* ========================= */}

                    <Route
                        path="/gorsel"
                        element={
                            <ProtectedPage user={sessionUser}>
                                <Gorsel />
                            </ProtectedPage>
                        }
                    />

                    {/* BULUNAMAYAN ROUTE */}
                    <Route
                        path="*"
                        element={
                            <Navigate
                                to="/"
                                replace
                            />
                        }
                    />

                </Routes>
            </Router>
        </OdakMuiTheme>
    );
}

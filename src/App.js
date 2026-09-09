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

// Sipariş
import SiparisOlustur from "./SiparisIslemleri/SiparisOlustur";
import YeniSiparis from "./SiparisIslemleri/YeniSiparis";
import ParsiyelSiparisOlustur from "./SiparisIslemleri/ParsiyelSiparisOlustur";
import SiparisAcanlar from "./SiparisIslemleri/siparisAcanlar";
import Arkas from "./SiparisIslemleri/Arkas";
import Fasdat from "./SiparisIslemleri/Fasdat";
import TeslimNoktalari from "./SiparisIslemleri/TeslimNoktalari";

// İrsaliye
import Irsaliye from "./Irsaliye/Irsaliye";

// Tanımlamalar
import ProjeEkle from "./Tanimlamalar/ProjeEkle";

// Gelir / Gider
import GelirEkleme from "./GelirGider/GelirEkleme";
import GiderEkleme from "./GelirGider/GiderEkleme";
import TestGelir from "./GelirGider/TestGelir";
import TestGider from "./GelirGider/TestGider";

// Fiyatlandırma
import SeferFiyatlandirma from "./fiyatlandirma/seferFiyatlandirma";

// Analiz
import OzetTablo from "./analiz/ozetTablo";

import OdakMuiTheme from "./theme/OdakMuiTheme";

import "./odak-modern.css";
import "./odak-modern-v3.css";
import "./odak-modern-v4.css";
import "./odak-modern-v6.css";
import "./odak-dark-compat.css";

function getLoginUser() {
    try {
        return JSON.parse(
            localStorage.getItem("loginUser") || "null"
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

function ProtectedPage({ children }) {
    const location = useLocation();

    const user = getLoginUser();

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

    useEffect(() => {
        const user = getLoginUser();

        setIsAuthenticated(
            Boolean(user)
        );
    }, []);

    const handleLoginSuccess = () => {
        setIsAuthenticated(true);
    };

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
                            <ProtectedPage>
                                <AnaSayfa />
                            </ProtectedPage>
                        }
                    />

                    {/* ADMIN */}
                    <Route
                        path="/admin"
                        element={
                            <ProtectedPage>
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
                            <ProtectedPage>
                                <SiparisOlustur />
                            </ProtectedPage>
                        }
                    />

                    <Route
                        path="/SiparisIslemleri/YeniSiparis"
                        element={
                            <ProtectedPage>
                                <YeniSiparis />
                            </ProtectedPage>
                        }
                    />

                    <Route
                        path="/SiparisIslemleri/ParsiyelSiparisOlustur"
                        element={
                            <ProtectedPage>
                                <ParsiyelSiparisOlustur />
                            </ProtectedPage>
                        }
                    />

                    <Route
                        path="/SiparisIslemleri/SiparisAcanlar"
                        element={
                            <ProtectedPage>
                                <SiparisAcanlar />
                            </ProtectedPage>
                        }
                    />

                    <Route
                        path="/SiparisIslemleri/Arkas"
                        element={
                            <ProtectedPage>
                                <Arkas />
                            </ProtectedPage>
                        }
                    />

                    <Route
                        path="/SiparisIslemleri/Fasdat"
                        element={
                            <ProtectedPage>
                                <Fasdat />
                            </ProtectedPage>
                        }
                    />

                    <Route
                        path="/SiparisIslemleri/TeslimNoktalari"
                        element={
                            <ProtectedPage>
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
                            <ProtectedPage>
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
                            <ProtectedPage>
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
                            <ProtectedPage>
                                <GelirEkleme />
                            </ProtectedPage>
                        }
                    />

                    <Route
                        path="/GelirGider/GiderEkleme"
                        element={
                            <ProtectedPage>
                                <GiderEkleme />
                            </ProtectedPage>
                        }
                    />

                    <Route
                        path="/GelirGider/TestGelir"
                        element={
                            <ProtectedPage>
                                <TestGelir />
                            </ProtectedPage>
                        }
                    />

                    <Route
                        path="/GelirGider/TestGider"
                        element={
                            <ProtectedPage>
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
                            <ProtectedPage>
                                <SeferFiyatlandirma />
                            </ProtectedPage>
                        }
                    />

                    {/* ========================= */}
                    {/* ANALİZ */}
                    {/* ========================= */}

                    <Route
                        path="/analiz/ozet"
                        element={
                            <ProtectedPage>
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
                            <ProtectedPage>
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
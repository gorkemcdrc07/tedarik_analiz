import React, { useState, useEffect } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from "react-router-dom";

import Login from "./Login";
import Dashboard from "./Dashboard";
import Layout from "./Layout";
import Gorsel from "./gorsel";
import Yetkisiz from "./Yetkisiz";

// Sipariş
import SiparisOlustur from "./SiparisIslemleri/SiparisOlustur";
import ParsiyelSiparisOlustur from "./SiparisIslemleri/ParsiyelSiparisOlustur";
import SiparisAcanlar from "./SiparisIslemleri/siparisAcanlar";
import Arkas from "./SiparisIslemleri/Arkas";
import Fasdat from "./SiparisIslemleri/Fasdat";
import TeslimNoktalari from "./SiparisIslemleri/TeslimNoktalari";

// Gelir / Gider
import GelirEkleme from "./GelirGider/GelirEkleme";
import GiderEkleme from "./GelirGider/GiderEkleme";
import TestGelir from "./GelirGider/TestGelir";
import TestGider from "./GelirGider/TestGider";

// Fiyatlandırma
import SeferFiyatlandirma from "./fiyatlandirma/seferFiyatlandirma";

// Analiz
import OzetTablo from "./analiz/ozetTablo";

function getLoginUser() {
    try {
        return JSON.parse(localStorage.getItem("loginUser") || "null");
    } catch {
        return null;
    }
}

function getFirstAllowedPath() {
    const user = getLoginUser();

    if (!user) return "/";

    if (user.rol === "admin") {
        return "/dashboard";
    }

    const allowedScreens = Array.isArray(user.allowedScreens)
        ? user.allowedScreens
        : [];

    return allowedScreens.length > 0 ? allowedScreens[0] : "/yetkisiz";
}

function ProtectedPage({ children }) {
    const location = useLocation();
    const user = getLoginUser();

    if (!user) {
        return <Navigate to="/" replace />;
    }

    const currentPath = location.pathname;

    const allowedScreens = Array.isArray(user.allowedScreens)
        ? user.allowedScreens
        : [];

    if (user.rol === "admin") {
        return <Layout>{children}</Layout>;
    }

    if (!allowedScreens.includes(currentPath)) {
        return (
            <Layout>
                <Yetkisiz />
            </Layout>
        );
    }

    return <Layout>{children}</Layout>;
}

export default function App() {
    const [isAuthenticated, setIsAuthenticated] = useState(false);

    useEffect(() => {
        const user = getLoginUser();
        setIsAuthenticated(!!user);
    }, []);

    const handleLoginSuccess = () => {
        setIsAuthenticated(true);
    };

    return (
        <Router>
            <Routes>
                <Route
                    path="/"
                    element={
                        isAuthenticated ? (
                            <Navigate to={getFirstAllowedPath()} replace />
                        ) : (
                            <Login onLoginSuccess={handleLoginSuccess} />
                        )
                    }
                />

                <Route
                    path="/yetkisiz"
                    element={
                        <Layout>
                            <Yetkisiz />
                        </Layout>
                    }
                />

                <Route path="/dashboard" element={<ProtectedPage><Dashboard /></ProtectedPage>} />
                <Route path="/SiparisIslemleri/SiparisOlustur" element={<ProtectedPage><SiparisOlustur /></ProtectedPage>} />
                <Route path="/SiparisIslemleri/ParsiyelSiparisOlustur" element={<ProtectedPage><ParsiyelSiparisOlustur /></ProtectedPage>} />
                <Route path="/SiparisIslemleri/SiparisAcanlar" element={<ProtectedPage><SiparisAcanlar /></ProtectedPage>} />
                <Route path="/SiparisIslemleri/Arkas" element={<ProtectedPage><Arkas /></ProtectedPage>} />
                <Route path="/SiparisIslemleri/Fasdat" element={<ProtectedPage><Fasdat /></ProtectedPage>} />
                <Route path="/SiparisIslemleri/TeslimNoktalari" element={<ProtectedPage><TeslimNoktalari /></ProtectedPage>} />

                <Route path="/GelirGider/GelirEkleme" element={<ProtectedPage><GelirEkleme /></ProtectedPage>} />
                <Route path="/GelirGider/GiderEkleme" element={<ProtectedPage><GiderEkleme /></ProtectedPage>} />
                <Route path="/GelirGider/TestGelir" element={<ProtectedPage><TestGelir /></ProtectedPage>} />
                <Route path="/GelirGider/TestGider" element={<ProtectedPage><TestGider /></ProtectedPage>} />

                <Route path="/fiyatlandirma/seferFiyatlandirma" element={<ProtectedPage><SeferFiyatlandirma /></ProtectedPage>} />
                <Route path="/analiz/ozet" element={<ProtectedPage><OzetTablo /></ProtectedPage>} />
                <Route path="/gorsel" element={<ProtectedPage><Gorsel /></ProtectedPage>} />

                <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
        </Router>
    );
}
// src/App.js
import React, { useState, useEffect } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";

import Login from "./Login";
import Dashboard from "./Dashboard";
import Layout from "./Layout";

// Sipariş
import SiparisOlustur from "./SiparisIslemleri/SiparisOlustur";
import SiparisAcanlar from "./SiparisIslemleri/siparisAcanlar";
import Arkas from "./SiparisIslemleri/Arkas";
import Fasdat from "./SiparisIslemleri/Fasdat";

// Gelir / Gider
import GelirEkleme from "./GelirGider/GelirEkleme";
import GiderEkleme from "./GelirGider/GiderEkleme";
import TestGelir from "./GelirGider/TestGelir";
import TestGider from "./GelirGider/TestGider";

// Fiyatlandırma
import SeferFiyatlandirma from "./fiyatlandirma/seferFiyatlandirma";

// Analiz
import OzetTablo from "./analiz/ozetTablo";

export default function App() {
    const [isAuthenticated, setIsAuthenticated] = useState(false);

    useEffect(() => {
        const user = localStorage.getItem("kullanici");
        if (user) setIsAuthenticated(true);
    }, []);

    return (
        <Router>
            <Routes>

                {/* LOGIN */}
                <Route
                    path="/"
                    element={
                        isAuthenticated ? (
                            <Navigate to="/dashboard" />
                        ) : (
                            <Login onLoginSuccess={() => setIsAuthenticated(true)} />
                        )
                    }
                />

                {/* DASHBOARD */}
                <Route
                    path="/dashboard"
                    element={
                        isAuthenticated ? (
                            <Layout>
                                <Dashboard />
                            </Layout>
                        ) : (
                            <Navigate to="/" />
                        )
                    }
                />

                {/* SİPARİŞ */}
                <Route
                    path="/SiparisIslemleri/SiparisOlustur"
                    element={isAuthenticated ? <Layout><SiparisOlustur /></Layout> : <Navigate to="/" />}
                />

                <Route
                    path="/SiparisIslemleri/SiparisAcanlar"
                    element={isAuthenticated ? <Layout><SiparisAcanlar /></Layout> : <Navigate to="/" />}
                />

                <Route
                    path="/SiparisIslemleri/Arkas"
                    element={isAuthenticated ? <Layout><Arkas /></Layout> : <Navigate to="/" />}
                />

                <Route
                    path="/SiparisIslemleri/Fasdat"
                    element={isAuthenticated ? <Layout><Fasdat /></Layout> : <Navigate to="/" />}
                />

                {/* GELİR / GİDER */}
                <Route
                    path="/GelirGider/GelirEkleme"
                    element={isAuthenticated ? <Layout><GelirEkleme /></Layout> : <Navigate to="/" />}
                />

                <Route
                    path="/GelirGider/GiderEkleme"
                    element={isAuthenticated ? <Layout><GiderEkleme /></Layout> : <Navigate to="/" />}
                />

                <Route
                    path="/GelirGider/TestGelir"
                    element={isAuthenticated ? <Layout><TestGelir /></Layout> : <Navigate to="/" />}
                />

                <Route
                    path="/GelirGider/TestGider"
                    element={isAuthenticated ? <Layout><TestGider /></Layout> : <Navigate to="/" />}
                />

                {/* FİYATLANDIRMA */}
                <Route
                    path="/fiyatlandirma/seferFiyatlandirma"
                    element={isAuthenticated ? <Layout><SeferFiyatlandirma /></Layout> : <Navigate to="/" />}
                />

                {/* ANALİZ */}
                <Route
                    path="/analiz/ozet"
                    element={isAuthenticated ? <Layout><OzetTablo /></Layout> : <Navigate to="/" />}
                />

                {/* FALLBACK */}
                <Route path="*" element={<Navigate to="/" />} />

            </Routes>
        </Router>
    );
}

// src/App.js
import React, { useState, useEffect } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";

import Login from "./Login";
import AnaSayfa from "./AnaSayfa";
import Dashboard from "./Dashboard";
import Layout from "./Layout";

import SiparisAcanlar from "./SiparisIslemleri/siparisAcanlar"; // <-- Sipariş Açanlar
import GelirEkleme from "./GelirGider/GelirEkleme";
import GiderEkleme from "./GelirGider/GiderEkleme";
import TestGelir from "./GelirGider/TestGelir";
import TestGider from "./GelirGider/TestGider";
import SiparisOlustur from "./SiparisIslemleri/SiparisOlustur";
import Arkas from "./SiparisIslemleri/Arkas";
import SeferFiyatlandirma from "./fiyatlandirma/seferFiyatlandirma";
import Fasdat from "./SiparisIslemleri/Fasdat";

import OzetTablo from "./analiz/ozetTablo"; // <-- YENİ: Özet Tablo

export default function App() {
    const [isAuthenticated, setIsAuthenticated] = useState(false);

    useEffect(() => {
        const user = localStorage.getItem("kullanici");
        if (user) setIsAuthenticated(true);
    }, []);

    return (
        <Router>
            <Routes>
                <Route
                    path="/"
                    element={
                        isAuthenticated ? (
                            <Layout><AnaSayfa /></Layout>
                        ) : (
                            <Login onLoginSuccess={() => setIsAuthenticated(true)} />
                        )
                    }
                />

                <Route
                    path="/dashboard"
                    element={
                        isAuthenticated ? (
                            <Layout><Dashboard /></Layout>
                        ) : (
                            <Navigate to="/" />
                        )
                    }
                />

                <Route
                    path="/GelirGider/GelirEkleme"
                    element={
                        isAuthenticated ? (
                            <Layout><GelirEkleme /></Layout>
                        ) : (
                            <Navigate to="/" />
                        )
                    }
                />

                <Route
                    path="/GelirGider/GiderEkleme"
                    element={
                        isAuthenticated ? (
                            <Layout><GiderEkleme /></Layout>
                        ) : (
                            <Navigate to="/" />
                        )
                    }
                />

                {/* Test Gelir */}
                <Route
                    path="/GelirGider/TestGelir"
                    element={
                        isAuthenticated ? (
                            <Layout><TestGelir /></Layout>
                        ) : (
                            <Navigate to="/" />
                        )
                    }
                />

                {/* Test Gider */}
                <Route
                    path="/GelirGider/TestGider"
                    element={
                        isAuthenticated ? (
                            <Layout><TestGider /></Layout>
                        ) : (
                            <Navigate to="/" />
                        )
                    }
                />

                <Route
                    path="/SiparisIslemleri/SiparisOlustur"
                    element={
                        isAuthenticated ? (
                            <Layout><SiparisOlustur /></Layout>
                        ) : (
                            <Navigate to="/" />
                        )
                    }
                />

                <Route
                    path="/SiparisIslemleri/Arkas"
                    element={
                        isAuthenticated ? (
                            <Layout><Arkas /></Layout>
                        ) : (
                            <Navigate to="/" />
                        )
                    }
                />

                <Route
                    path="/SiparisIslemleri/Fasdat"
                    element={
                        isAuthenticated ? (
                            <Layout><Fasdat /></Layout>
                        ) : (
                            <Navigate to="/" />
                        )
                    }
                />

                <Route
                    path="/SiparisIslemleri/SiparisAcanlar"
                    element={
                        isAuthenticated ? (
                            <Layout><SiparisAcanlar /></Layout>
                        ) : (
                            <Navigate to="/" />
                        )
                    }
                />

                {/* YENİ: Özet Tablo */}
                <Route
                    path="/analiz/ozet"
                    element={
                        isAuthenticated ? (
                            <Layout><OzetTablo /></Layout>
                        ) : (
                            <Navigate to="/" />
                        )
                    }
                />

                <Route path="*" element={<Navigate to={isAuthenticated ? "/" : "/"} />} />
            </Routes>
        </Router>
    );
}

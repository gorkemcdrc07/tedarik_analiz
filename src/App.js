// src/App.js
import React, { useState, useEffect } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";

import Login from "./Login";
import AnaSayfa from "./AnaSayfa";
import Dashboard from "./Dashboard";
import Layout from "./Layout";
import GelirEkleme from "./GelirGider/GelirEkleme";
import GiderEkleme from "./GelirGider/GiderEkleme";
import SiparisOlustur from "./SiparisIslemleri/SiparisOlustur";

// ✅ Yeni: Sefer Fiyatlandırma ekranı
import SeferFiyatlandirma from "./fiyatlandirma/seferFiyatlandirma";
// import FiyatListesi from "./fiyatlandirma/FiyatListesi"; // hazır olduğunda açın

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

                {/* ✅ Yeni rota: Sefer Fiyatlandırma */}
                <Route
                    path="/fiyatlandirma/seferFiyatlandirma"
                    element={
                        isAuthenticated ? (
                            <Layout><SeferFiyatlandirma /></Layout>
                        ) : (
                            <Navigate to="/" />
                        )
                    }
                />

                {/* İsterseniz hazır olduğunda açın
        <Route
          path="/fiyatlandirma/fiyatListesi"
          element={
            isAuthenticated ? (
              <Layout><FiyatListesi /></Layout>
            ) : (
              <Navigate to="/" />
            )
          }
        />
        */}

                {/* Opsiyonel: bilinmeyen rotaları ana sayfaya yönlendir */}
                <Route path="*" element={<Navigate to={isAuthenticated ? "/" : "/"} />} />
            </Routes>
        </Router>
    );
}

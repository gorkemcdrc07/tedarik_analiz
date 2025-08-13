// src/App.js
import React, { useState, useEffect } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";

import Login from "./Login";
import AnaSayfa from "./AnaSayfa";
import Dashboard from "./Dashboard";
import Layout from "./Layout";
import GelirEkleme from "./GelirGider/GelirEkleme";
import GiderEkleme from "./GelirGider/GiderEkleme"; // ✅ yeni import

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
                    path="/GelirGider/GiderEkleme"   // ✅ yeni rota
                    element={
                        isAuthenticated ? (
                            <Layout><GiderEkleme /></Layout>
                        ) : (
                            <Navigate to="/" />
                        )
                    }
                />
            </Routes>
        </Router>
    );
}

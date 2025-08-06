import React, { useEffect, useState } from "react";
import "./Navbar.css";

const Navbar = () => {
    const [kullaniciIsmi, setKullaniciIsmi] = useState("");
    const [tema, setTema] = useState("dark");

    useEffect(() => {
        const user = JSON.parse(localStorage.getItem("kullanici"));
        if (user) {
            setKullaniciIsmi(user.kullanici);
        }
    }, []);

    const handleLogout = () => {
        localStorage.removeItem("kullanici");
        window.location.reload(); // Giriş ekranına döner
    };

    const toggleTheme = () => {
        setTema((prev) => (prev === "dark" ? "light" : "dark"));
        alert(`Tema değiştirildi: ${tema === "dark" ? "Açık" : "Koyu"}`);
    };

    return (
        <nav className="navbar">
            <div />
            <div className="right-section">
                <div className="user-box">
                    <span className="user-name">{kullaniciIsmi}</span>
                </div>
                <div className="theme-toggle" onClick={toggleTheme}>
                    {tema === "dark" ? "🌙" : "☀️"}
                </div>
                <button className="logout-btn" onClick={handleLogout}>
                    Çıkış
                </button>
            </div>
        </nav>
    );
};

export default Navbar;

// src/Login.js
import React, { useState } from "react";
import { createClient } from "@supabase/supabase-js";
import "./Login.css";

const supabase = createClient(
    process.env.REACT_APP_SUPABASE_URL,
    process.env.REACT_APP_SUPABASE_KEY
);

function Login({ onLoginSuccess }) {
    const [email, setEmail] = useState("");      // kullanici_adi
    const [password, setPassword] = useState(""); // sifre
    const [loading, setLoading] = useState(false);

    const handleLogin = async (e) => {
        e.preventDefault();
        setLoading(true);

        try {
            const { data, error } = await supabase
                .from("Login")
                .select("*")
                .eq("kullanici_adi", email)
                .eq("sifre", password)
                .single();

            if (error || !data) {
                alert("❌ Hatalı kullanıcı adı veya şifre!");
                return;
            }

            // ✅ Tüm kullanıcı kaydını sakla
            localStorage.setItem("kullanici", JSON.stringify(data));

            // ✅ REEL bilgilerini esnek alan adlarıyla yakala
            const reelUser =
                data.Reel_kullanici ??
                data.reel_kullanici ??
                data.reelUserName ??
                data.reel_username ??
                "";
            const reelPass =
                data.Reel_sifre ??
                data.reel_sifre ??
                data.reelPassword ??
                data.reel_password ??
                "";

            // Tekil anahtarlar (opsiyonel ama bazen pratik)
            if (reelUser) localStorage.setItem("Reel_kullanici", reelUser);
            if (reelPass) localStorage.setItem("Reel_sifre", reelPass);

            // 🔥 tokenManager için bundle halinde de sakla
            if (reelUser && reelPass) {
                localStorage.setItem(
                    "reelCreds",
                    JSON.stringify({ userName: reelUser, password: reelPass })
                );
            } else {
                console.warn(
                    "[REEL] Giriş kaydında Reel_kullanici / Reel_sifre alanları bulunamadı."
                );
            }

            onLoginSuccess();
        } catch (err) {
            console.error(err);
            alert("Beklenmeyen bir hata oluştu. Lütfen tekrar deneyin.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="login-container">
            <form className="login-form" onSubmit={handleLogin}>
                <h2>Giriş Yap</h2>
                <input
                    type="text"
                    placeholder="Kullanıcı Adı"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="username"
                    required
                />
                <input
                    type="password"
                    placeholder="Şifre"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                    required
                />
                <button type="submit" disabled={loading}>
                    {loading ? "Giriş yapılıyor…" : "Giriş"}
                </button>
            </form>
        </div>
    );
}

export default Login;

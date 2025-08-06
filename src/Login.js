// Login.js
import React, { useState } from "react";
import { createClient } from "@supabase/supabase-js";
import "./Login.css";

const supabase = createClient(
    process.env.REACT_APP_SUPABASE_URL,
    process.env.REACT_APP_SUPABASE_KEY
);

function Login({ onLoginSuccess }) {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");

    const handleLogin = async (e) => {
        e.preventDefault();

        const { data, error } = await supabase
            .from("Login")
            .select("*")
            .eq("kullanici_adi", email)
            .eq("sifre", password)
            .single();

        if (error || !data) {
            alert("❌ Hatalı e-posta veya şifre!");
            return;
        }

        // ✅ Giriş başarılı: kullanıcıyı localStorage'a kaydet
        localStorage.setItem("kullanici", JSON.stringify(data));

        // App.js'e bildir
        onLoginSuccess();
    };

    return (
        <div className="login-container">
            <form className="login-form" onSubmit={handleLogin}>
                <h2>Giriş Yap</h2>
                <input
                    type="email"
                    placeholder="E-posta"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                />
                <input
                    type="password"
                    placeholder="Şifre"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                />
                <button type="submit">Giriş</button>
            </form>
        </div>
    );
}

export default Login;

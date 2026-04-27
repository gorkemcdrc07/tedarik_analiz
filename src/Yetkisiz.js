import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";

const RECIPIENT = "gorkem.cadirci@odaklojistik.com.tr";

const inp = (err) => ({
    width: "100%",
    padding: "12px 16px",
    borderRadius: 12,
    border: `1px solid ${err ? "rgba(239,68,68,0.7)" : "rgba(220,38,38,0.2)"}`,
    background: "rgba(255,255,255,0.04)",
    color: "#fff",
    fontSize: 14,
    fontFamily: "'DM Sans',sans-serif",
    outline: "none",
    boxSizing: "border-box"
});

function Label({ children }) {
    return (
        <p
            style={{
                margin: "0 0 7px",
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                color: "rgba(252,165,165,0.55)",
                fontFamily: "'DM Sans',sans-serif"
            }}
        >
            {children}
        </p>
    );
}

export default function Yetkisiz({ currentUser }) {
    const navigate = useNavigate();
    const location = useLocation();

    const [userName, setUserName] = useState(currentUser || "");
    const [screenName, setScreenName] = useState("");
    const [reason, setReason] = useState("");
    const [errors, setErrors] = useState({});
    const [done, setDone] = useState(false);

    useEffect(() => {
        const loginUser = JSON.parse(localStorage.getItem("loginUser") || "null");

        if (!currentUser && loginUser?.kullanici) {
            setUserName(loginUser.kullanici);
        }

        const parts = location.pathname.split("/").filter(Boolean);
        const raw = parts[parts.length - 1] || "Bilinmeyen ekran";
        setScreenName(decodeURIComponent(raw.replace(/-/g, " ")));
    }, [currentUser, location.pathname]);

    const validate = () => {
        const e = {};

        if (!userName.trim()) e.userName = "Adınızı giriniz";
        if (!screenName.trim()) e.screenName = "Ekran adı boş bırakılamaz";
        if (!reason.trim()) e.reason = "Açıklama yazınız";

        setErrors(e);
        return Object.keys(e).length === 0;
    };

    const handleSend = () => {
        if (!validate()) return;

        const subject = encodeURIComponent(`Erişim Yetki Talebi – ${screenName}`);

        const body = encodeURIComponent(
            `Merhaba Görkem Bey,\n\n` +
            `Aşağıdaki kullanıcı kısıtlı bir sayfaya erişim yetkisi talep etmektedir.\n\n` +
            `Kullanıcı Adı  : ${userName}\n` +
            `Ekran / Sayfa  : ${screenName}\n` +
            `Talep Sebebi   : ${reason}\n\n` +
            `Gerekli yetkilendirmenin yapılmasını rica ederim.\n\n` +
            `Saygılarımla,\n${userName}`
        );

        window.location.href = `mailto:${RECIPIENT}?subject=${subject}&body=${body}`;
        setDone(true);
    };

    const foc = (e) => {
        e.target.style.borderColor = "rgba(220,38,38,0.55)";
        e.target.style.background = "rgba(255,255,255,0.07)";
    };

    const blr = (e) => {
        e.target.style.borderColor = "rgba(220,38,38,0.2)";
        e.target.style.background = "rgba(255,255,255,0.04)";
    };

    return (
        <>
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700;900&display=swap');
                * { box-sizing: border-box; }
                textarea { resize: vertical; min-height: 86px; }
                ::placeholder { color: rgba(255,255,255,0.22) !important; }
            `}</style>

            <div
                style={{
                    minHeight: "calc(100vh - 90px)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: 24,
                    background: "#060000",
                    position: "relative",
                    overflow: "hidden",
                    fontFamily: "'DM Sans',sans-serif",
                    borderRadius: 18
                }}
            >
                <div
                    style={{
                        position: "absolute",
                        width: 700,
                        height: 700,
                        top: "-20%",
                        right: "-15%",
                        background: "radial-gradient(circle,rgba(185,28,28,0.11) 0%,transparent 70%)",
                        pointerEvents: "none"
                    }}
                />

                <AnimatePresence mode="wait">
                    {done ? (
                        <motion.div
                            key="done"
                            initial={{ opacity: 0, scale: 0.92 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ duration: 0.35 }}
                            style={{
                                width: "100%",
                                maxWidth: 420,
                                zIndex: 1,
                                borderRadius: 26,
                                background: "rgba(16,4,4,0.9)",
                                border: "1px solid rgba(74,222,128,0.2)",
                                backdropFilter: "blur(22px)",
                                padding: "50px 34px",
                                textAlign: "center",
                                boxShadow: "0 32px 80px -20px rgba(0,0,0,0.95)"
                            }}
                        >
                            <svg width="72" height="72" viewBox="0 0 72 72" style={{ margin: "0 auto 20px", display: "block" }}>
                                <circle cx="36" cy="36" r="34" fill="rgba(74,222,128,0.1)" stroke="#4ade80" strokeWidth="1.5" />
                                <polyline points="22 38 33 49 52 27" fill="none" stroke="#4ade80" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>

                            <h2 style={{ color: "#fff", fontSize: 24, fontWeight: 900, margin: "0 0 12px" }}>
                                Talep Hazırlandı
                            </h2>

                            <p style={{ color: "rgba(252,165,165,0.6)", fontSize: 14, lineHeight: 1.7, margin: "0 0 28px" }}>
                                Mail taslağı Outlook üzerinden açıldı. Gönder butonuna basmanız yeterli.
                            </p>

                            <button
                                onClick={() => navigate(-1)}
                                style={{
                                    width: "100%",
                                    padding: "15px",
                                    borderRadius: 14,
                                    border: "none",
                                    cursor: "pointer",
                                    fontWeight: 800,
                                    fontSize: 14,
                                    color: "#fff",
                                    background: "linear-gradient(135deg,#dc2626,#991b1b)"
                                }}
                            >
                                Geri Dön
                            </button>
                        </motion.div>
                    ) : (
                        <motion.div
                            key="form"
                            initial={{ opacity: 0, y: 28, scale: 0.96 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: -16, scale: 0.96 }}
                            transition={{ duration: 0.45 }}
                            style={{
                                width: "100%",
                                maxWidth: 480,
                                zIndex: 1,
                                borderRadius: 28,
                                background: "rgba(14,3,3,0.88)",
                                border: "1px solid rgba(220,38,38,0.15)",
                                backdropFilter: "blur(26px)",
                                boxShadow: "0 32px 80px -20px rgba(0,0,0,0.97)",
                                overflow: "hidden"
                            }}
                        >
                            <div style={{ height: 3, background: "linear-gradient(90deg,transparent,#dc2626,#f87171,#dc2626,transparent)" }} />

                            <div style={{ padding: "42px 38px 36px" }}>
                                <div style={{ textAlign: "center", marginBottom: 32 }}>
                                    <motion.div
                                        animate={{
                                            boxShadow: [
                                                "0 0 0 0 rgba(220,38,38,0)",
                                                "0 0 0 16px rgba(220,38,38,0.1)",
                                                "0 0 0 0 rgba(220,38,38,0)"
                                            ]
                                        }}
                                        transition={{ repeat: Infinity, duration: 3.2 }}
                                        style={{
                                            width: 76,
                                            height: 76,
                                            borderRadius: 20,
                                            margin: "0 auto 18px",
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "center",
                                            background: "linear-gradient(135deg,#ef4444,#7f1d1d)"
                                        }}
                                    >
                                        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                                            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                                        </svg>
                                    </motion.div>

                                    <h1 style={{ margin: "0 0 10px", fontSize: 28, fontWeight: 900, color: "#fff" }}>
                                        Erişim Kısıtlı
                                    </h1>

                                    <p style={{ margin: 0, color: "rgba(252,165,165,0.55)", fontSize: 13.5, lineHeight: 1.65 }}>
                                        Bu ekrana erişim yetkiniz bulunmuyor. Yetki talebi oluşturabilirsiniz.
                                    </p>
                                </div>

                                <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
                                    <div>
                                        <Label>Adınız Soyadınız</Label>
                                        <input
                                            type="text"
                                            placeholder="Örn: Ayşe Kaya"
                                            value={userName}
                                            onChange={(e) => {
                                                setUserName(e.target.value);
                                                setErrors((p) => ({ ...p, userName: "" }));
                                            }}
                                            onFocus={foc}
                                            onBlur={blr}
                                            style={inp(errors.userName)}
                                        />
                                        {errors.userName && (
                                            <p style={{ color: "#f87171", fontSize: 11, margin: "5px 0 0 2px" }}>
                                                {errors.userName}
                                            </p>
                                        )}
                                    </div>

                                    <div>
                                        <Label>Ekran / Sayfa Adı</Label>
                                        <input
                                            type="text"
                                            value={screenName}
                                            onChange={(e) => {
                                                setScreenName(e.target.value);
                                                setErrors((p) => ({ ...p, screenName: "" }));
                                            }}
                                            onFocus={foc}
                                            onBlur={blr}
                                            style={inp(errors.screenName)}
                                        />
                                        {errors.screenName && (
                                            <p style={{ color: "#f87171", fontSize: 11, margin: "5px 0 0 2px" }}>
                                                {errors.screenName}
                                            </p>
                                        )}
                                    </div>

                                    <div>
                                        <Label>Neden bu ekrana ihtiyaç duyuyorsunuz?</Label>
                                        <textarea
                                            placeholder="Kısa bir açıklama yazınız..."
                                            value={reason}
                                            onChange={(e) => {
                                                setReason(e.target.value);
                                                setErrors((p) => ({ ...p, reason: "" }));
                                            }}
                                            onFocus={foc}
                                            onBlur={blr}
                                            style={inp(errors.reason)}
                                        />
                                        {errors.reason && (
                                            <p style={{ color: "#f87171", fontSize: 11, margin: "5px 0 0 2px" }}>
                                                {errors.reason}
                                            </p>
                                        )}
                                    </div>
                                </div>

                                <div
                                    style={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 10,
                                        margin: "22px 0 20px",
                                        padding: "10px 14px",
                                        background: "rgba(220,38,38,0.07)",
                                        border: "1px solid rgba(220,38,38,0.12)",
                                        borderRadius: 10
                                    }}
                                >
                                    <span
                                        style={{
                                            width: 7,
                                            height: 7,
                                            borderRadius: "50%",
                                            background: "#ef4444",
                                            flexShrink: 0
                                        }}
                                    />
                                    <span style={{ fontSize: 12, color: "rgba(252,165,165,0.5)", fontFamily: "monospace" }}>
                                        {RECIPIENT}
                                    </span>
                                </div>

                                <motion.button
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.97 }}
                                    onClick={handleSend}
                                    style={{
                                        width: "100%",
                                        padding: "16px",
                                        borderRadius: 16,
                                        border: "none",
                                        cursor: "pointer",
                                        fontWeight: 900,
                                        fontSize: 15,
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        gap: 10,
                                        color: "#fff",
                                        background: "linear-gradient(135deg,#dc2626,#991b1b)",
                                        boxShadow: "0 4px 22px rgba(220,38,38,0.3)"
                                    }}
                                >
                                    Yetki Talebi Gönder
                                </motion.button>

                                <button
                                    onClick={() => navigate(-1)}
                                    style={{
                                        marginTop: 11,
                                        width: "100%",
                                        padding: "12px",
                                        borderRadius: 14,
                                        border: "1px solid rgba(255,255,255,0.06)",
                                        cursor: "pointer",
                                        fontWeight: 600,
                                        fontSize: 13,
                                        color: "rgba(148,163,184,0.7)",
                                        background: "transparent"
                                    }}
                                >
                                    ← Geri Dön
                                </button>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </>
    );
}
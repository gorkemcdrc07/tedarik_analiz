import React, { useState } from "react";
import { createClient } from "@supabase/supabase-js";
import styled, { keyframes } from "styled-components";
import { motion, AnimatePresence } from "framer-motion";
import {
    Truck,
    ShieldCheck,
    Eye,
    EyeOff,
    Headset,
    Lock,
    User,
    PlusCircle,
    TrendingUp,
    ArrowDownCircle,
    Layers
} from "lucide-react";

// Supabase Yapılandırması (Mevcut mantık korundu)
const supabase = createClient(
    process.env.REACT_APP_SUPABASE_URL,
    process.env.REACT_APP_SUPABASE_KEY
);

export default function Login({ onLoginSuccess }) {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [remember, setRemember] = useState(true);

    const handleLogin = async (e) => {
        e.preventDefault();
        setError("");
        setLoading(true);

        try {
            const { data, error } = await supabase
                .from("Login")
                .select("*")
                .eq("kullanici_adi", email)
                .eq("sifre", password)
                .single();

            if (error || !data) {
                setError("Kimlik bilgileri doğrulanamadı.");
                return;
            }

            if (remember) {
                localStorage.setItem("kullanici", JSON.stringify(data));
            }

            const reelUser = data.Reel_kullanici ?? data.reel_kullanici ?? data.reelUserName ?? data.reel_username ?? email;
            const reelPass = data.Reel_sifre ?? data.reel_sifre ?? data.reelPassword ?? data.reel_password ?? password;

            localStorage.setItem("Reel_kullanici", reelUser);
            localStorage.setItem("Reel_sifre", reelPass);
            localStorage.setItem("reelCreds", JSON.stringify({ userName: reelUser, password: reelPass }));

            onLoginSuccess?.();
        } catch (err) {
            setError("Sunucu bağlantısı kurulamadı.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <Screen>
            <AmbientLight />

            <LoginCard
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
            >
                <SideDecor>
                    <BrandWrapper>
                        <LogoIcon>
                            <Truck size={32} />
                        </LogoIcon>
                        <BrandText>
                            <h3>FleetPortal</h3>
                            <span>v4.2 Enterprise</span>
                        </BrandText>
                    </BrandWrapper>

                    <FeatureList>
                        <FeatureItem>
                            <PlusCircle size={18} color="#10b981" />
                            <div>
                                <strong>Sipariş Yönetimi</strong>
                                <p>Hızlı sipariş oluşturma ve takip</p>
                            </div>
                        </FeatureItem>
                        <FeatureItem>
                            <TrendingUp size={18} color="#3b82f6" />
                            <div>
                                <strong>Gelir Takibi</strong>
                                <p>Anlık nakit akış analizi</p>
                            </div>
                        </FeatureItem>
                        <FeatureItem>
                            <ArrowDownCircle size={18} color="#ef4444" />
                            <div>
                                <strong>Gider Kontrolü</strong>
                                <p>Operasyonel maliyet yönetimi</p>
                            </div>
                        </FeatureItem>
                    </FeatureList>

                    <SecurityBadge>
                        <ShieldCheck size={14} />
                        Uçtan Uca Şifreli Erişim
                    </SecurityBadge>
                </SideDecor>

                <MainFormSection>
                    <Header>
                        <h1>Yönetici Girişi</h1>
                        <p>Lütfen devam etmek için oturum açın.</p>
                    </Header>

                    <Form onSubmit={handleLogin}>
                        <InputWrapper>
                            <Label>Kullanıcı Adı</Label>
                            <div className="input-field">
                                <User size={18} />
                                <input
                                    type="text"
                                    placeholder="admin_kullanici"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                />
                            </div>
                        </InputWrapper>

                        <InputWrapper>
                            <Label>Şifre</Label>
                            <div className="input-field">
                                <Lock size={18} />
                                <input
                                    type={showPassword ? "text" : "password"}
                                    placeholder="••••••••"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                />
                                <button type="button" onClick={() => setShowPassword(!showPassword)}>
                                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                </button>
                            </div>
                        </InputWrapper>

                        <FlexBetween>
                            <CheckboxContainer>
                                <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} id="rem" />
                                <label htmlFor="rem">Beni hatırla</label>
                            </CheckboxContainer>
                            <GhostLink>Şifremi Unuttum</GhostLink>
                        </FlexBetween>

                        <AnimatePresence>
                            {error && (
                                <ErrorBox
                                    initial={{ opacity: 0, scale: 0.9 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                >
                                    {error}
                                </ErrorBox>
                            )}
                        </AnimatePresence>

                        <SubmitBtn
                            type="submit"
                            disabled={loading || !email || !password}
                            whileTap={{ scale: 0.97 }}
                        >
                            {loading ? <Loader /> : "Sisteme Giriş Yap"}
                        </SubmitBtn>
                    </Form>

                    <SupportFooter>
                        <button onClick={() => alert("Destek hattına bağlanılıyor...")}>
                            <Headset size={16} /> Teknik Destek Talebi
                        </button>
                    </SupportFooter>
                </MainFormSection>
            </LoginCard>

            <Copyright>© {new Date().getFullYear()} FleetCorp Logistics Management System</Copyright>
        </Screen>
    );
}

// STYLED COMPONENTS (Koyu Tema)
const Screen = styled.main`
    min-height: 100vh;
    background-color: #020617; // Slate 950
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 20px;
    font-family: 'Inter', sans-serif;
    position: relative;
    overflow: hidden;
`;

const AmbientLight = styled.div`
    position: absolute;
    width: 600px;
    height: 600px;
    background: radial-gradient(circle, rgba(59, 130, 246, 0.08) 0%, rgba(0, 0, 0, 0) 70%);
    top: -200px;
    right: -100px;
    pointer-events: none;
`;

const LoginCard = styled(motion.div)`
    display: flex;
    width: 100%;
    max-width: 900px;
    min-height: 580px;
    background: #0f172a; // Slate 900
    border-radius: 24px;
    border: 1px solid rgba(255, 255, 255, 0.05);
    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
    overflow: hidden;

    @media (max-width: 768px) {
        flex-direction: column;
    }
`;

const SideDecor = styled.div`
    flex: 1;
    background: rgba(30, 41, 59, 0.5); // Slate 800
    padding: 40px;
    display: flex;
    flex-direction: column;
    border-right: 1px solid rgba(255, 255, 255, 0.05);

    @media (max-width: 768px) {
        display: none;
    }
`;

const BrandWrapper = styled.div`
    display: flex;
    align-items: center;
    gap: 15px;
    margin-bottom: 60px;
`;

const LogoIcon = styled.div`
    background: linear-gradient(135deg, #3b82f6, #1d4ed8);
    padding: 10px;
    border-radius: 14px;
    color: white;
    box-shadow: 0 8px 20px rgba(59, 130, 246, 0.3);
`;

const BrandText = styled.div`
    h3 { color: white; margin: 0; font-size: 20px; letter-spacing: -0.5px; }
    span { color: #64748b; font-size: 12px; }
`;

const FeatureList = styled.div`
    display: flex;
    flex-direction: column;
    gap: 30px;
`;

const FeatureItem = styled.div`
    display: flex;
    gap: 15px;
    align-items: flex-start;
    strong { display: block; color: #f1f5f9; font-size: 14px; margin-bottom: 2px; }
    p { color: #64748b; font-size: 12px; margin: 0; }
`;

const SecurityBadge = styled.div`
    margin-top: auto;
    background: rgba(16, 185, 129, 0.1);
    color: #10b981;
    padding: 8px 16px;
    border-radius: 100px;
    font-size: 11px;
    display: flex;
    align-items: center;
    gap: 6px;
    width: fit-content;
`;

const MainFormSection = styled.div`
    flex: 1.2;
    padding: 60px;
    display: flex;
    flex-direction: column;
    justify-content: center;

    @media (max-width: 500px) {
        padding: 30px;
    }
`;

const Header = styled.header`
    margin-bottom: 35px;
    h1 { color: white; font-size: 28px; margin-bottom: 10px; }
    p { color: #94a3b8; font-size: 15px; }
`;

const Form = styled.form`
    display: flex;
    flex-direction: column;
    gap: 20px;
`;

const InputWrapper = styled.div`
    display: flex;
    flex-direction: column;
    gap: 8px;

    .input-field {
        position: relative;
        display: flex;
        align-items: center;
        background: #1e293b;
        border: 1px solid #334155;
        border-radius: 12px;
        transition: all 0.3s;

        svg { margin-left: 15px; color: #64748b; }

        input {
            width: 100%;
            background: transparent;
            border: none;
            padding: 14px 15px;
            color: white;
            font-size: 15px;
            &:focus { outline: none; }
        }

        button {
            background: transparent;
            border: none;
            color: #64748b;
            padding-right: 15px;
            cursor: pointer;
            &:hover { color: #3b82f6; }
        }

        &:focus-within {
            border-color: #3b82f6;
            box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.1);
        }
    }
`;

const Label = styled.label`
    color: #94a3b8;
    font-size: 13px;
    font-weight: 500;
`;

const FlexBetween = styled.div`
    display: flex;
    justify-content: space-between;
    align-items: center;
`;

const CheckboxContainer = styled.div`
    display: flex;
    align-items: center;
    gap: 8px;
    color: #94a3b8;
    font-size: 14px;
    input { accent-color: #3b82f6; }
`;

const GhostLink = styled.button`
    background: none;
    border: none;
    color: #3b82f6;
    font-size: 13px;
    cursor: pointer;
    font-weight: 500;
`;

const SubmitBtn = styled(motion.button)`
    background: #3b82f6;
    color: white;
    padding: 15px;
    border-radius: 12px;
    border: none;
    font-size: 16px;
    font-weight: 600;
    cursor: pointer;
    margin-top: 10px;
    box-shadow: 0 10px 20px rgba(59, 130, 246, 0.2);
    &:disabled { opacity: 0.5; cursor: not-allowed; }
`;

const ErrorBox = styled(motion.div)`
    background: rgba(239, 68, 68, 0.1);
    border: 1px solid rgba(239, 68, 68, 0.2);
    color: #f87171;
    padding: 12px;
    border-radius: 10px;
    font-size: 13px;
    text-align: center;
`;

const SupportFooter = styled.div`
    margin-top: 40px;
    button {
        background: transparent;
        border: none;
        color: #64748b;
        font-size: 13px;
        display: flex;
        align-items: center;
        gap: 8px;
        cursor: pointer;
        &:hover { color: #f1f5f9; }
    }
`;

const Copyright = styled.div`
    margin-top: 30px;
    color: #475569;
    font-size: 12px;
`;

const spin = keyframes` to { transform: rotate(360deg); } `;
const Loader = styled.div`
    width: 20px;
    height: 20px;
    border: 2px solid rgba(255,255,255,0.3);
    border-top-color: white;
    border-radius: 50%;
    animation: ${spin} 0.8s linear infinite;
    margin: 0 auto;
`;
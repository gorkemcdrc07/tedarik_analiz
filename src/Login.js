import React, { useState } from "react";
import { createClient } from "@supabase/supabase-js";
import styled, { keyframes } from "styled-components";
import { motion } from "framer-motion";
import { Truck, Package, MapPin, ShieldCheck, Eye, EyeOff, Headset } from "lucide-react";



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
                setError("Hatalı kullanıcı adı veya şifre.");
                return;
            }

            // login bilgilerini kaydet
            if (remember) {
                localStorage.setItem("kullanici", JSON.stringify(data));
            }

            // Reel bilgilerini belirle
            const reelUser =
                data.Reel_kullanici ??
                data.reel_kullanici ??
                data.reelUserName ??
                data.reel_username ??
                email;            // 🔥 fallback eklendi

            const reelPass =
                data.Reel_sifre ??
                data.reel_sifre ??
                data.reelPassword ??
                data.reel_password ??
                password;        // 🔥 fallback eklendi

            // 🔥 REEL auth için GEREKLİ zorunlu kayıtlar
            localStorage.setItem("Reel_kullanici", reelUser);
            localStorage.setItem("Reel_sifre", reelPass);

            localStorage.setItem(
                "reelCreds",
                JSON.stringify({ userName: reelUser, password: reelPass })
            );

            onLoginSuccess?.();
        } catch (err) {
            console.error(err);
            setError("Beklenmeyen bir hata oluştu. Lütfen tekrar deneyin.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <Screen>
            <MovingRoutes aria-hidden />
            <Decor>
                <Badge as={motion.div} initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
                    <ShieldCheck size={16} />
                    <span>Kurumsal Güvenli Erişim</span>
                </Badge>
                <Hero>
                    <Circle1 />
                    <Circle2 />
                    <TruckIcon>
                        <Truck />
                    </TruckIcon>
                    <Pin1>
                        <MapPin size={18} />
                    </Pin1>
                    <Pin2>
                        <MapPin size={18} />
                    </Pin2>
                    <Boxes>
                        <Package size={16} />
                        <Package size={16} />
                        <Package size={16} />
                    </Boxes>
                </Hero>
            </Decor>

            <Card
                as={motion.section}
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, ease: "easeOut" }}
            >
                <TopStripe />

                <Header>
                    <Logo>
                        <Truck size={18} />
                    </Logo>
                    <Title>
                        FleetPortal
                        <Sub>Operasyon Yönetim Paneli</Sub>
                    </Title>
                </Header>

                <Tagline>Sevkiyatlarınızı tek ekrandan yönetin</Tagline>

                <Form onSubmit={handleLogin} noValidate>
                    <Field>
                        <Label>Kullanıcı Adı</Label>
                        <Input
                            type="text"
                            placeholder="kullanici_adi"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            autoComplete="username"
                            required
                        />
                    </Field>

                    <Field>
                        <Label>Şifre</Label>
                        <PasswordWrap>
                            <Input
                                type={showPassword ? "text" : "password"}
                                placeholder="••••••••"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                autoComplete="current-password"
                                required
                            />
                            <IconBtn
                                type="button"
                                onClick={() => setShowPassword((s) => !s)}
                                aria-label={showPassword ? "Şifreyi gizle" : "Şifreyi göster"}
                            >
                                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                            </IconBtn>
                        </PasswordWrap>
                    </Field>

                    <Options>
                        <label>
                            <Checkbox type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
                            Beni hatırla
                        </label>
                        <GhostBtn type="button" onClick={() => alert("Şifre sıfırlama için IT ile iletişime geçin.")}>Şifremi unuttum</GhostBtn>
                    </Options>

                    {error && <Error role="alert">{error}</Error>}

                    <Submit
                        type="submit"
                        disabled={loading || !email || !password}
                        as={motion.button}
                        whileTap={{ scale: 0.98 }}
                    >
                        {loading ? <Loader aria-label="Giriş yapılıyor" /> : "Giriş Yap"}
                    </Submit>

                    <Divider>
                        <Line />
                        <span>veya</span>
                        <Line />
                    </Divider>

                    <SSORow>
                        <SSOButton type="button" onClick={() => alert("SSO yapılandırılmadı")}>Google ile devam et</SSOButton>
                        <SSOButton type="button" onClick={() => alert("SSO yapılandırılmadı")}>Microsoft ile devam et</SSOButton>
                    </SSORow>
                </Form>

                <Footer>
                    <MiniRow>
                        <Dot /> 99.95% Uptime
                        <Sep />
                        <Dot /> ISO 27001
                        <Sep />
                        <Dot /> TLS 1.3
                    </MiniRow>
                    <Support onClick={() => alert("Destek: support@logistics.co")}> <Headset size={14} /> Destek</Support>
                    <Copy>© {new Date().getFullYear()} FleetCorp Logistics</Copy>
                </Footer>
            </Card>
        </Screen>
    );
}


const fly = keyframes`
  0% { transform: translateX(-10%); }
  100% { transform: translateX(110%); }
`;

const pulse = keyframes`
  0% { transform: scale(1); opacity: .9 }
  70% { transform: scale(1.03); opacity: 1 }
  100% { transform: scale(1); opacity: .9 }
`;

const shimmer = keyframes`
  0% { background-position: -200% 50%; }
  100% { background-position: 200% 50%; }
`;

const dash = keyframes`
  to { stroke-dashoffset: -200; }
`;

const spin = keyframes`
  to { transform: rotate(360deg); }
`;

const Screen = styled.main`
  min-height: 100dvh;
  display: grid;
  place-items: center;
  padding: 24px;
  background: radial-gradient(1200px 800px at 5% 10%, #0a0f1f 0%, #070c19 40%, #050913 100%);
  color: #e7eaff;
  overflow: hidden;
`;

const MovingRoutes = styled.div`
  position: absolute;
  inset: -10% -10% -10% -10%;
  pointer-events: none;
  background-image:
    radial-gradient(circle at 20% 30%, rgba(0,255,194,.08) 0 30%, transparent 31%),
    radial-gradient(circle at 80% 70%, rgba(59,130,246,.10) 0 30%, transparent 31%),
    radial-gradient(800px 600px at 10% 10%, rgba(99,102,241,.12), transparent 70%);
  filter: saturate(1.2);
  &::after {
    content: '';
    position: absolute;
    left: -20%; right: -20%; top: 50%; height: 2px;
    background:
      repeating-linear-gradient(90deg, rgba(255,255,255,.2) 0 16px, transparent 16px 32px);
    transform: translateY(-50%);
    animation: ${fly} 18s linear infinite;
  }
`;

const Decor = styled.aside`
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  pointer-events: none;
`;

const Badge = styled.div`
  position: absolute;
  top: 26px; left: 26px;
  display: inline-flex; align-items: center; gap: 8px;
  padding: 8px 10px;
  font-size: 12px; color: #b9f3ff;
  border: 1px solid rgba(186, 230, 253, .3);
  background: linear-gradient(180deg, rgba(12, 28, 36, .7), rgba(9, 22, 30, .7));
  border-radius: 10px;
  box-shadow: 0 10px 30px rgba(0,0,0,.3), inset 0 1px 0 rgba(255,255,255,.08);
`;

const Hero = styled.div`
  position: absolute; right: 6vw; bottom: 10vh;
  width: min(420px, 40vw); height: min(420px, 40vw);
  border-radius: 50%;
  background: radial-gradient(closest-side, rgba(16, 185, 129, .15), transparent 70%);
  filter: blur(0.2px);
  animation: ${pulse} 10s ease-in-out infinite;
`;

const Circle1 = styled.div`
  position: absolute; inset: 8%; border-radius: 50%;
  border: 1px dashed rgba(255,255,255,.2);
  animation: ${dash} 20s linear infinite;
  box-shadow: inset 0 0 40px rgba(34,197,94,.08);
`;

const Circle2 = styled.div`
  position: absolute; inset: 20%; border-radius: 50%;
  border: 1px dashed rgba(255,255,255,.18);
  animation: ${dash} 28s linear infinite reverse;
`;

const TruckIcon = styled.div`
  position: absolute; left: 10%; top: 50%; transform: translateY(-50%);
  width: 44px; height: 44px; border-radius: 12px;
  display: grid; place-items: center; color: #0b132b;
  background: linear-gradient(135deg, #22d3ee, #60a5fa);
  box-shadow: 0 12px 30px rgba(34,211,238,.35);
`;

const Pin1 = styled.div`
  position: absolute; right: 18%; top: 28%; color: #93c5fd;
`;
const Pin2 = styled.div`
  position: absolute; right: 6%; bottom: 18%; color: #5eead4;
`;

const Boxes = styled.div`
  position: absolute; left: 24%; bottom: 18%; display: flex; gap: 6px; color: #a5b4fc;
`;

const Card = styled.div`
  position: relative;
  width: min(460px, 92vw);
  border-radius: 18px;
  padding: 28px 26px 18px;
  background: linear-gradient(180deg, rgba(255,255,255,.08), rgba(255,255,255,.04));
  box-shadow: 0 10px 40px rgba(0,0,0,.45), inset 0 1px 0 rgba(255,255,255,.12);
  border: 1px solid rgba(255,255,255,.14);
  backdrop-filter: blur(14px) saturate(1.2);
`;

const TopStripe = styled.div`
  position: absolute; inset: 0 0 auto 0; height: 6px; border-radius: 18px 18px 0 0;
  background: linear-gradient(90deg, #06b6d4, #60a5fa, #8b5cf6);
  background-size: 220% 100%;
  animation: ${shimmer} 7s linear infinite;
`;

const Header = styled.header`
  display: flex; align-items: center; gap: 12px;
`;

const Logo = styled.div`
  width: 40px; height: 40px; display: grid; place-items: center;
  border-radius: 12px; color: #0b132b;
  background: linear-gradient(135deg, #22d3ee, #60a5fa);
  border: 1px solid rgba(255,255,255,.25);
  box-shadow: inset 0 1px 0 rgba(255,255,255,.35), 0 8px 24px rgba(34,211,238,.35);
`;

const Title = styled.h1`
  margin: 0; font-size: clamp(18px, 2.2vw, 22px); font-weight: 800; letter-spacing: .2px;
`;

const Sub = styled.span`
  display: block; font-weight: 500; font-size: 12px; color: #a9b3e6;
`;

const Tagline = styled.p`
  margin: 10px 0 18px; color: #b9c0ff; font-size: 14px;
`;

const Form = styled.form`
  display: grid; gap: 16px;
`;

const Field = styled.div`
  display: grid; gap: 8px;
`;

const Label = styled.label`
  font-size: 13px; color: #c7cdff;
`;

const Input = styled.input`
  width: 100%; height: 46px; padding: 0 14px; color: #e9ecff; font-size: 15px;
  border-radius: 12px; outline: none; border: 1px solid rgba(255,255,255,.14);
  background: linear-gradient(180deg, rgba(12,17,36,.8), rgba(10,14,28,.8));
  box-shadow: inset 0 1px 0 rgba(255,255,255,.08), inset 0 0 0 999px rgba(255,255,255,0), 0 6px 20px rgba(0,0,0,.25);
  transition: box-shadow .2s ease, border-color .2s ease, transform .05s ease;
  ::placeholder { color: #7c86b2; }
  &:focus { border-color: rgba(99,102,241,.6); box-shadow: 0 10px 30px rgba(80,91,230,.25), 0 0 0 3px rgba(99,102,241,.25) inset; }
`;

const PasswordWrap = styled.div`
  position: relative;
`;

const IconBtn = styled.button`
  position: absolute; right: 8px; top: 50%; transform: translateY(-50%);
  height: 30px; padding: 0 8px; border-radius: 8px;
  border: 1px solid rgba(255,255,255,.14);
  background: rgba(255,255,255,.06);
  color: #cfd5ff; display: grid; place-items: center;
  cursor: pointer; transition: transform .08s ease, background .2s ease;
  &:active { transform: translateY(-50%) scale(.98); }
`;

const Options = styled.div`
  display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-top: 2px;
  font-size: 13px; color: #cfd5ff;
`;

const Checkbox = styled.input`
  margin-right: 6px; vertical-align: middle;
`;

const GhostBtn = styled.button`
  background: transparent; border: none; color: #99a3ff; font-size: 13px; cursor: pointer; text-decoration: underline;
`;

const Error = styled.div`
  font-size: 13px; color: #ffb4c1; background: linear-gradient(180deg, rgba(255, 99, 132,.12), rgba(255, 99, 132,.08));
  border: 1px solid rgba(255,255,255,.14); padding: 10px 12px; border-radius: 12px; backdrop-filter: blur(6px);
`;

const Submit = styled.button`
  height: 46px; border-radius: 12px; border: 1px solid rgba(255,255,255,.18);
  background: linear-gradient(90deg, #22d3ee, #60a5fa, #8b5cf6);
  background-size: 200% 100%; animation: ${shimmer} 6s linear infinite;
  color: white; font-weight: 700; letter-spacing: .3px; cursor: pointer; display: grid; place-items: center;
  transition: filter .2s ease, transform .06s ease, opacity .2s ease; box-shadow: 0 10px 30px rgba(34,211,238,.35);
  &:disabled { opacity: .55; cursor: not-allowed; filter: grayscale(.2); }
  &:active { transform: translateY(1px); }
`;

const Divider = styled.div`
  margin: 6px 0; display: flex; align-items: center; gap: 10px; color: #8fa0d9; font-size: 12px;
`;
const Line = styled.span`
  height: 1px; flex: 1; background: linear-gradient(90deg, rgba(255,255,255,.0), rgba(255,255,255,.22), rgba(255,255,255,0));
`;

const SSORow = styled.div`
  display: grid; grid-template-columns: 1fr 1fr; gap: 10px;
`;
const SSOButton = styled.button`
  height: 40px; border-radius: 10px; border: 1px solid rgba(255,255,255,.14);
  background: rgba(255,255,255,.06); color: #e8ecff; font-weight: 600; cursor: pointer;
`;

const Footer = styled.footer`
  margin-top: 14px; display: grid; place-items: center; gap: 8px;
`;

const MiniRow = styled.div`
  display: inline-flex; align-items: center; gap: 8px; color: #8ea1d9; font-size: 12px;
`;
const Dot = styled.span`
  width: 6px; height: 6px; background: #60a5fa; border-radius: 50%; display: inline-block;
`;
const Sep = styled.span`
  width: 6px; height: 1px; background: rgba(255,255,255,.25); display: inline-block; transform: translateY(-1px);
`;

const Support = styled.button`
  display: inline-flex; align-items: center; gap: 6px; background: transparent; border: none; color: #99a3ff; cursor: pointer; font-size: 12px; text-decoration: underline;
`;

const Copy = styled.small`
  color: #8891bf;
`;

const Loader = styled.div`
  width: 18px; height: 18px; border-radius: 50%; border: 2px solid rgba(255,255,255,.7); border-top-color: transparent; animation: ${spin} .8s linear infinite;
`;
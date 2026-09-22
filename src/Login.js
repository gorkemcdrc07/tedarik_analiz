import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  Headphones,
  KeyRound,
  LockKeyhole,
  QrCode,
  ShieldCheck,
  Smartphone,
  UserRound,
} from "lucide-react";
import "./Login.css";

const safeParse = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) return value;

  try {
    return JSON.parse(value);
  } catch {
    return String(value)
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }
};

const API_BASE = (
  process.env.REACT_APP_API_BASE_URL || ""
).replace(/\/+$/, "");

const authUrl = (path) =>
  `${API_BASE}/api/auth/2fa/${path}`;

const apiJson = async (url, options = {}) => {
  const response = await fetch(url, options);

  const contentType = (
    response.headers.get("content-type") || ""
  ).toLowerCase();

  const raw = await response.text();

  let data = null;

  if (contentType.includes("application/json")) {
    try {
      data = raw ? JSON.parse(raw) : {};
    } catch {
      data = null;
    }
  }

  if (!data) {
    const hint =
      response.status === 404
        ? "2FA servisi bulunamadı. Backend güncel mi ve API adresi doğru mu?"
        : "Sunucu JSON yerine beklenmeyen bir yanıt döndürdü.";

    throw new Error(
      `${hint} (HTTP ${response.status})`
    );
  }

  if (!response.ok) {
    throw new Error(
      data.error ||
        data.message ||
        `İstek başarısız (HTTP ${response.status}).`
    );
  }

  return data;
};

export default function Login({
  onLoginSuccess,
}) {
  const [username, setUsername] =
    useState("");

  const [password, setPassword] =
    useState("");

  const [showPassword, setShowPassword] =
    useState(false);

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState("");

  const [step, setStep] =
    useState("credentials");

  const [challenge, setChallenge] =
    useState(null);

  const [code, setCode] =
    useState("");

  const [seconds, setSeconds] =
    useState(0);

  useEffect(() => {
    if (seconds <= 0) return undefined;

    const timer = setInterval(() => {
      setSeconds((current) =>
        Math.max(0, current - 1)
      );
    }, 1000);

    return () => clearInterval(timer);
  }, [seconds]);

  const beginAuthentication = async () => {
    setError("");
    setLoading(true);

    try {
      const data = await apiJson(
        authUrl("start"),
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({
            username: username.trim(),
            password,
          }),
        }
      );

      if (
        data.mode !== "setup" &&
        data.mode !== "verify"
      ) {
        throw new Error(
          "Sunucudan geçersiz doğrulama modu alındı."
        );
      }

      if (!data.challengeId) {
        throw new Error(
          "Doğrulama oturumu oluşturulamadı."
        );
      }

      if (
        data.mode === "setup" &&
        !data.qrCodeDataUrl
      ) {
        throw new Error(
          "Authenticator QR kodu oluşturulamadı."
        );
      }

      setChallenge(data);
      setCode("");

      setSeconds(
        Number(data.expiresIn) || 300
      );

      setStep(
        data.mode === "setup"
          ? "setup"
          : "verify"
      );
    } catch (err) {
      setError(
        err?.message ||
          "Giriş işlemi başlatılamadı."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (event) => {
    event.preventDefault();

    if (
      !username.trim() ||
      !password
    ) {
      return;
    }

    await beginAuthentication();
  };

  const verifyAuthenticator =
    async (event) => {
      event.preventDefault();

      if (
        !challenge?.challengeId ||
        code.length !== 6
      ) {
        return;
      }

      setError("");
      setLoading(true);

      try {
        const data = await apiJson(
          authUrl("verify"),
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
              Accept:
                "application/json",
            },
            body: JSON.stringify({
              challengeId:
                challenge.challengeId,
              code,
            }),
          }
        );

        if (
          !data?.user ||
          !data?.sessionToken
        ) {
          throw new Error(
            "Oturum bilgisi oluşturulamadı."
          );
        }

        const user = {
          ...data.user,

          allowedScreens: safeParse(
            data.user.allowedScreens
          ),

          allowedButtons: safeParse(
            data.user.allowedButtons
          ),
        };

        /*
         * Kullanıcı bilgileri.
         *
         * ŞİFRE localStorage'a veya
         * sessionStorage'a yazılmaz.
         */
        localStorage.setItem(
          "loginUser",
          JSON.stringify(user)
        );

        localStorage.setItem(
          "Reel_kullanici",
          user.kullanici_adi ||
            user.kullanici ||
            username.trim()
        );

        localStorage.setItem(
          "userName",
          user.kullanici ||
            user.kullanici_adi ||
            username.trim()
        );

        localStorage.setItem(
          "userRole",
          user.rol || "kullanici"
        );

        /*
         * Önceki sürümden kalmış olabilecek
         * düz metin şifreyi temizle.
         */
        localStorage.removeItem(
          "Reel_sifre"
        );

        sessionStorage.setItem(
          "odakAuthSession",
          data.sessionToken
        );

        /*
         * React state'inde de şifreyi
         * gereksiz yere tutma.
         */
        setPassword("");
        setCode("");

        onLoginSuccess?.();
      } catch (err) {
        setError(
          err?.message ||
            "Authenticator doğrulaması başarısız."
        );

        setCode("");
      } finally {
        setLoading(false);
      }
    };

  const backToCredentials = () => {
    setStep("credentials");
    setChallenge(null);
    setCode("");
    setSeconds(0);
    setError("");
  };

  const getHeader = () => {
    if (step === "setup") {
      return {
        eyebrow:
          "2 / 2 · Authenticator Kurulumu",
        title:
          "Güvenli Erişimi Etkinleştirin",
        description:
          "Bu işlem yalnızca ilk kurulumda yapılır. QR kodunu Authenticator uygulamanız ile okutun.",
      };
    }

    if (step === "verify") {
      return {
        eyebrow:
          "2 / 2 · Güvenlik Kontrolü",
        title:
          "Authenticator Kodunu Girin",
        description:
          "Telefonunuzdaki Authenticator uygulamasında görünen 6 haneli kodu girin.",
      };
    }

    return {
      eyebrow:
        "1 / 2 · Hesap Doğrulama",
      title: "Sisteme Giriş",
      description:
        "Kullanıcı bilgileriniz doğrulandıktan sonra Authenticator güvenlik kontrolü yapılacaktır.",
    };
  };

  const header = getHeader();

  return (
    <main className="ots-login">
      <div className="ots-login-bg-grid" />

      <div className="ots-login-orb ots-login-orb-blue" />
      <div className="ots-login-orb ots-login-orb-orange" />

      <motion.section
        className="ots-login-container"
        initial={{
          opacity: 0,
          y: 14,
        }}
        animate={{
          opacity: 1,
          y: 0,
        }}
      >
        <div className="ots-login-showcase">
          <div>
            <div className="ots-login-brand">
              <div className="ots-login-logo-box">
                <img
                  src="/odak-logo.png"
                  alt="Odak Lojistik"
                />
              </div>

              <div className="ots-login-brand-text">
                <strong>ODAK</strong>
                <span>
                  LOJİSTİK · OPERASYON SİSTEMİ
                </span>
              </div>
            </div>

            <div className="ots-login-hero">
              <div className="ots-login-hero-badge">
                <ShieldCheck size={14} />
                <span>
                  İki adımlı güvenli erişim
                </span>
              </div>

              <h1>
                Her yükte{" "}
                <span>daha ileriye.</span>
              </h1>

              <p>
                Kritik tarife ve operasyon
                verileri, kullanıcı şifresine
                ek olarak Authenticator
                doğrulamasıyla korunur.
              </p>
            </div>

            <div className="ots-login-features">
              <Feature
                icon={
                  <LockKeyhole size={18} />
                }
                title="Şifre Doğrulaması"
                text="Kullanıcı hesabı sunucu tarafında doğrulanır."
              />

              <Feature
                icon={
                  <Smartphone size={18} />
                }
                title="Authenticator"
                text="Microsoft veya Google Authenticator ile 6 haneli güvenlik kodu."
              />

              <Feature
                icon={
                  <ShieldCheck size={18} />
                }
                title="Tek Kullanımlık Kod"
                text="Kodlar yaklaşık 30 saniyede bir yenilenir ve tekrar kullanılamaz."
              />
            </div>
          </div>

          <div className="ots-login-showcase-footer">
            <div className="ots-login-secure">
              <CheckCircle2 size={15} />

              <span>
                2 aşamalı güvenli sistem erişimi
              </span>
            </div>
          </div>
        </div>

        <div className="ots-login-form-section">
          <header className="ots-login-form-header">
            <span className="ots-login-eyebrow">
              {header.eyebrow}
            </span>

            <h2>{header.title}</h2>

            <p>{header.description}</p>
          </header>

          {step === "credentials" && (
            <form
              className="ots-login-form"
              onSubmit={handleLogin}
            >
              <Field label="Kullanıcı Adı">
                <div className="ots-login-input-wrapper">
                  <UserRound
                    className="ots-login-input-icon"
                    size={18}
                  />

                  <input
                    autoComplete="username"
                    placeholder="Kullanıcı adınızı girin"
                    value={username}
                    onChange={(event) =>
                      setUsername(
                        event.target.value
                      )
                    }
                    required
                  />
                </div>
              </Field>

              <Field label="Şifre">
                <div className="ots-login-input-wrapper">
                  <LockKeyhole
                    className="ots-login-input-icon"
                    size={18}
                  />

                  <input
                    type={
                      showPassword
                        ? "text"
                        : "password"
                    }
                    autoComplete="current-password"
                    placeholder="Şifrenizi girin"
                    value={password}
                    onChange={(event) =>
                      setPassword(
                        event.target.value
                      )
                    }
                    required
                  />

                  <button
                    type="button"
                    className="ots-login-password-toggle"
                    aria-label={
                      showPassword
                        ? "Şifreyi gizle"
                        : "Şifreyi göster"
                    }
                    onClick={() =>
                      setShowPassword(
                        (current) =>
                          !current
                      )
                    }
                  >
                    {showPassword ? (
                      <EyeOff size={18} />
                    ) : (
                      <Eye size={18} />
                    )}
                  </button>
                </div>
              </Field>

              <ErrorBox error={error} />

              <motion.button
                type="submit"
                className="ots-login-submit"
                disabled={
                  loading ||
                  !username.trim() ||
                  !password
                }
              >
                {loading ? (
                  <>
                    <span className="ots-login-spinner" />
                    Hesap doğrulanıyor...
                  </>
                ) : (
                  <>
                    Devam Et
                    <ArrowRight size={18} />
                  </>
                )}
              </motion.button>
            </form>
          )}

          {step === "setup" && (
            <form
              className="ots-login-form"
              onSubmit={
                verifyAuthenticator
              }
            >
              <div className="ots-totp-setup">
                <div className="ots-totp-setup-title">
                  <div className="ots-login-support-icon">
                    <QrCode size={19} />
                  </div>

                  <div>
                    <strong>
                      QR kodunu okutun
                    </strong>

                    <span>
                      Microsoft Authenticator
                      veya Google Authenticator
                    </span>
                  </div>
                </div>

                <div className="ots-totp-qr">
                  <img
                    src={
                      challenge?.qrCodeDataUrl
                    }
                    alt="Odak Lojistik Authenticator QR kodu"
                  />
                </div>

                <div className="ots-totp-steps">
                  <span>
                    <strong>1.</strong>{" "}
                    Authenticator uygulamasını
                    açın.
                  </span>

                  <span>
                    <strong>2.</strong>{" "}
                    Yeni hesap ekleyip QR kodunu
                    okutun.
                  </span>

                  <span>
                    <strong>3.</strong>{" "}
                    Uygulamada oluşan 6 haneli
                    kodu aşağıya girin.
                  </span>
                </div>
              </div>

              <AuthenticatorCodeField
                code={code}
                setCode={setCode}
              />

              <ChallengeTimer
                seconds={seconds}
              />

              <ErrorBox error={error} />

              <motion.button
                type="submit"
                className="ots-login-submit"
                disabled={
                  loading ||
                  code.length !== 6 ||
                  seconds <= 0
                }
              >
                {loading ? (
                  <>
                    <span className="ots-login-spinner" />
                    Doğrulanıyor...
                  </>
                ) : (
                  <>
                    Authenticator'ı Etkinleştir
                    <ShieldCheck size={18} />
                  </>
                )}
              </motion.button>

              <BackButton
                onClick={
                  backToCredentials
                }
              />
            </form>
          )}

          {step === "verify" && (
            <form
              className="ots-login-form"
              onSubmit={
                verifyAuthenticator
              }
            >
              <div className="ots-otp-shield">
                <div>
                  <Smartphone size={24} />
                </div>

                <strong>
                  Authenticator Doğrulaması
                </strong>

                <span>
                  Telefonunuzdaki güncel kodu
                  girin. Kodlar yaklaşık 30
                  saniyede bir yenilenir.
                </span>
              </div>

              <AuthenticatorCodeField
                code={code}
                setCode={setCode}
              />

              <ChallengeTimer
                seconds={seconds}
              />

              <ErrorBox error={error} />

              <motion.button
                type="submit"
                className="ots-login-submit"
                disabled={
                  loading ||
                  code.length !== 6 ||
                  seconds <= 0
                }
              >
                {loading ? (
                  <>
                    <span className="ots-login-spinner" />
                    Doğrulanıyor...
                  </>
                ) : (
                  <>
                    Doğrula ve Giriş Yap
                    <ShieldCheck size={18} />
                  </>
                )}
              </motion.button>

              <BackButton
                onClick={
                  backToCredentials
                }
              />
            </form>
          )}

          <div className="ots-login-support">
            <div className="ots-login-support-icon">
              <Headphones size={17} />
            </div>

            <div>
              <span>
                Authenticator erişiminizi
                kaybettiyseniz
              </span>

              <strong>
                Sistem yöneticiniz ile
                iletişime geçin.
              </strong>
            </div>
          </div>
        </div>
      </motion.section>

      <footer className="ots-login-footer">
        <span>
          © {new Date().getFullYear()} Odak
          Lojistik
        </span>

        <span className="ots-login-footer-dot" />

        <span>
          Güvenli Operasyon Takip Sistemi
        </span>
      </footer>
    </main>
  );
}

function AuthenticatorCodeField({
  code,
  setCode,
}) {
  return (
    <Field label="6 Haneli Authenticator Kodu">
      <div className="ots-login-input-wrapper ots-otp-input">
        <KeyRound
          className="ots-login-input-icon"
          size={18}
        />

        <input
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete="one-time-code"
          maxLength={6}
          placeholder="000000"
          value={code}
          onChange={(event) =>
            setCode(
              event.target.value
                .replace(/\D/g, "")
                .slice(0, 6)
            )
          }
          autoFocus
        />
      </div>
    </Field>
  );
}

function ChallengeTimer({ seconds }) {
  if (seconds <= 0) {
    return (
      <div className="ots-totp-expired">
        Doğrulama oturumunun süresi doldu.
        Giriş bilgilerinizi yeniden girin.
      </div>
    );
  }

  const minutes = Math.floor(
    seconds / 60
  );

  const remainingSeconds =
    seconds % 60;

  return (
    <div className="ots-totp-timer">
      Güvenlik oturumu:{" "}
      <strong>
        {String(minutes).padStart(
          2,
          "0"
        )}
        :
        {String(
          remainingSeconds
        ).padStart(2, "0")}
      </strong>
    </div>
  );
}

function BackButton({ onClick }) {
  return (
    <div className="ots-otp-actions ots-otp-actions-single">
      <button
        type="button"
        onClick={onClick}
      >
        <ArrowLeft size={15} />
        Giriş bilgilerini değiştir
      </button>
    </div>
  );
}

function ErrorBox({ error }) {
  return (
    <AnimatePresence>
      {error && (
        <motion.div
          className="ots-login-error"
          initial={{
            opacity: 0,
            y: -4,
          }}
          animate={{
            opacity: 1,
            y: 0,
          }}
          exit={{
            opacity: 0,
            y: -4,
          }}
        >
          <span className="ots-login-error-dot" />
          <span>{error}</span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Feature({
  icon,
  title,
  text,
}) {
  return (
    <div className="ots-login-feature">
      <div className="ots-login-feature-icon">
        {icon}
      </div>

      <div>
        <strong>{title}</strong>
        <span>{text}</span>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}) {
  return (
    <div className="ots-login-field">
      <label>{label}</label>
      {children}
    </div>
  );
}
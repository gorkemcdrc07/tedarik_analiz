const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const fetch = require("node-fetch");
const QRCode = require("qrcode");
const {
  generateSecret,
  generateURI,
  verifySync,
} = require("otplib");

const attempts = new Map();

const CHALLENGE_TTL_MS = 5 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const LOCK_MS = 15 * 60 * 1000;

function cfg() {
  return {
    url: process.env.SUPABASE_URL,
    key: process.env.SUPABASE_SERVICE_ROLE_KEY,
    secret: process.env.AUTH_SESSION_SECRET || "",
  };
}

function b64url(value) {
  return Buffer.from(value).toString("base64url");
}

function supabaseHeaders(extra = {}) {
  const c = cfg();

  return {
    apikey: c.key,
    Authorization: `Bearer ${c.key}`,
    "Content-Type": "application/json",
    ...extra,
  };
}

async function loginRows(username) {
  const c = cfg();

  if (!c.url || !c.key) {
    throw new Error("Supabase sunucu ayarlari eksik.");
  }

  const q = new URL(
    `${c.url.replace(/\/$/, "")}/rest/v1/Login`
  );

  q.searchParams.set("select", "*");
  q.searchParams.set(
    "kullanici_adi",
    `eq.${username}`
  );
  q.searchParams.set("limit", "1");

  const response = await fetch(q.toString(), {
    headers: supabaseHeaders(),
  });

  if (!response.ok) {
    const detail = await response.text();

    throw new Error(
      `Login tablosu okunamadi (${response.status}): ${detail}`
    );
  }

  return response.json();
}

async function loginRowsById(loginId) {
  const c = cfg();
  const q = new URL(`${c.url.replace(/\/$/, "")}/rest/v1/Login`);
  q.searchParams.set("select", "*"); q.searchParams.set("id", `eq.${loginId}`); q.searchParams.set("limit", "1");
  const response = await fetch(q.toString(), { headers: supabaseHeaders() });
  if (!response.ok) throw new Error("Login kullanicisi okunamadi.");
  return response.json();
}

async function countAdminUsers() {
  const c = cfg();

  const q = new URL(
    `${c.url.replace(/\/$/, "")}/rest/v1/Login`
  );

  q.searchParams.set("select", "id");
  q.searchParams.set("rol", "eq.admin");

  const response = await fetch(
    q.toString(),
    {
      method: "GET",
      headers: supabaseHeaders({
        Prefer: "count=exact",
      }),
    }
  );

  if (!response.ok) {
    const detail =
      await response.text();

    throw new Error(
      `Admin sayisi okunamadi: ${detail}`
    );
  }

  const contentRange =
    response.headers.get("content-range");

  if (contentRange) {
    const match =
      contentRange.match(/\/(\d+)$/);

    if (match) {
      return Number(match[1]);
    }
  }

  const rows = await response.json();

  return Array.isArray(rows)
    ? rows.length
    : 0;
}

async function ensureAdminCanBeRemoved(
  user
) {
  const isAdmin =
    String(user?.rol || "")
      .trim()
      .toLowerCase() === "admin";

  if (!isAdmin) {
    return true;
  }

  const adminCount =
    await countAdminUsers();

  return adminCount > 1;
}
async function getTotp(loginId) {
  const c = cfg();

  const q = new URL(
    `${c.url.replace(/\/$/, "")}/rest/v1/user_totp`
  );

  q.searchParams.set("select", "*");
  q.searchParams.set(
    "login_id",
    `eq.${loginId}`
  );
  q.searchParams.set("limit", "1");

  const response = await fetch(q.toString(), {
    headers: supabaseHeaders(),
  });

  if (!response.ok) {
    const detail = await response.text();

    throw new Error(
      `user_totp tablosu okunamadi (${response.status}): ${detail}`
    );
  }

  const rows = await response.json();

  return rows?.[0] || null;
}

async function createTotp(loginId, secret) {
  const c = cfg();

  const response = await fetch(
    `${c.url.replace(/\/$/, "")}/rest/v1/user_totp`,
    {
      method: "POST",
      headers: supabaseHeaders({
        Prefer: "return=representation",
      }),
      body: JSON.stringify({
        login_id: loginId,
        secret,
        enabled: false,
      }),
    }
  );

  if (!response.ok) {
    const detail = await response.text();

    throw new Error(
      `Authenticator kaydi olusturulamadi (${response.status}): ${detail}`
    );
  }

  const rows = await response.json();

  return rows?.[0] || null;
}

async function updateTotpSecret(loginId, secret) {
  const c = cfg();

  const q = new URL(
    `${c.url.replace(/\/$/, "")}/rest/v1/user_totp`
  );

  q.searchParams.set(
    "login_id",
    `eq.${loginId}`
  );

  const response = await fetch(q.toString(), {
    method: "PATCH",
    headers: supabaseHeaders({
      Prefer: "return=representation",
    }),
    body: JSON.stringify({
      secret,
      enabled: false,
      updated_at: new Date().toISOString(),
    }),
  });

  if (!response.ok) {
    const detail = await response.text();

    throw new Error(
      `Authenticator kaydi guncellenemedi (${response.status}): ${detail}`
    );
  }

  const rows = await response.json();

  return rows?.[0] || null;
}

async function enableTotp(loginId) {
  const c = cfg();

  const q = new URL(
    `${c.url.replace(/\/$/, "")}/rest/v1/user_totp`
  );

  q.searchParams.set(
    "login_id",
    `eq.${loginId}`
  );

  const response = await fetch(q.toString(), {
    method: "PATCH",
    headers: supabaseHeaders({
      Prefer: "return=representation",
    }),
    body: JSON.stringify({
      enabled: true,
      updated_at: new Date().toISOString(),
    }),
  });

  if (!response.ok) {
    const detail = await response.text();

    throw new Error(
      `Authenticator etkinlestirilemedi (${response.status}): ${detail}`
    );
  }

  return response.json();
}

function parsePermissionArray(value) {
  if (Array.isArray(value)) {
    return value;
  }

  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(
      String(value)
    );

    return Array.isArray(parsed)
      ? parsed
      : [];
  } catch {
    return String(value)
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }
}

const PERMISSION_SCREEN_ACTIONS = Object.freeze({
  "/SiparisIslemleri/SiparisOlustur": ["Görüntüle", "Kaydet", "Sil", "Güncelle"],
  "/SiparisIslemleri/YeniSiparis": ["Görüntüle", "Kaydet", "Sil", "Güncelle", "Şablon İndir", "Excel Yükle"],
  "/SiparisIslemleri/ParsiyelSiparisOlustur": ["Görüntüle", "Kaydet", "Sil", "Güncelle"],
  "/SiparisIslemleri/SiparisAcanlar": ["Görüntüle", "Filtrele", "Dışa Aktar"],
  "/SiparisIslemleri/Arkas": ["Görüntüle", "Kaydet", "Dışa Aktar"],
  "/SiparisIslemleri/Fasdat": ["Görüntüle", "Kaydet", "Dışa Aktar"],
  "/SiparisIslemleri/TeslimNoktalari": ["Görüntüle", "Ekle", "Sil", "Güncelle"],
  "/Tanimlamalar/ProjeEkle": ["Görüntüle", "Ekle", "Güncelle", "Sil"],
  "/GelirGider/GelirEkleme": ["Görüntüle", "Ekle", "Sil", "Güncelle"],
  "/GelirGider/GiderEkleme": ["Görüntüle", "Ekle", "Sil", "Güncelle"],
  "/GelirGider/TestGelir": ["Görüntüle", "Dışa Aktar"],
  "/GelirGider/TestGider": ["Görüntüle", "Dışa Aktar"],
  "/fiyatlandirma/seferFiyatlandirma": ["Görüntüle", "Hesapla", "Kaydet"],
  "/finans/yakit-hesaplama": ["Görüntüle", "Kaydet", "Güncelle", "Geri Al", "Excel Yükle"],
  "/finans/yakit-onaylar": ["Görüntüle"],
  "/finans/yakit-kontrol-merkezi": ["Görüntüle"],
  "/analiz/ozet": ["Görüntüle", "Filtrele", "Dışa Aktar"],
  "/gorsel": ["Görüntüle"]
});

function validatePermissionPayload(screens, buttons) {
  const cleanScreens = [
    ...new Set(
      (Array.isArray(screens) ? screens : [])
        .map((item) => String(item).trim())
        .filter(Boolean)
    )
  ];

  const cleanButtons = [
    ...new Set(
      (Array.isArray(buttons) ? buttons : [])
        .map((item) => String(item).trim())
        .filter(Boolean)
    )
  ];

  const invalidScreens = cleanScreens.filter(
    (path) =>
      !Object.prototype.hasOwnProperty.call(
        PERMISSION_SCREEN_ACTIONS,
        path
      )
  );

  if (invalidScreens.length > 0) {
    return {
      valid: false,
      error: "Gecersiz ekran yetkisi.",
    };
  }

  const availableButtons = new Set(
    cleanScreens.flatMap(
      (path) =>
        PERMISSION_SCREEN_ACTIONS[path] || []
    )
  );

  const invalidButtons = cleanButtons.filter(
    (button) => !availableButtons.has(button)
  );

  if (invalidButtons.length > 0) {
    return {
      valid: false,
      error: "Gecersiz buton yetkisi.",
    };
  }

  return {
    valid: true,
    screens: cleanScreens,
    buttons: cleanButtons,
  };
}

function safeUser(user) {
  return {
    id: user.id,
    kullanici: user.kullanici,
    kullanici_adi: user.kullanici_adi,
    rol: user.rol,
    allowedScreens:
      parsePermissionArray(
        user.allowedScreens
      ),
    allowedButtons:
      parsePermissionArray(
        user.allowedButtons
      ),
    Reel_kullanici: user.Reel_kullanici,
  };
}

function signSession(user) {
  const c = cfg();

  if (!c.secret) {
    throw new Error(
      "AUTH_SESSION_SECRET tanimli degil."
    );
  }

  const payload = b64url(
    JSON.stringify({
      sub: user.id,
      name:
        user.kullanici ||
        user.kullanici_adi,
      role: user.rol,
      iat: Date.now(),
      exp:
        Date.now() +
        8 * 60 * 60 * 1000,
    })
  );

  const signature = crypto
    .createHmac("sha256", c.secret)
    .update(payload)
    .digest("base64url");

  return `${payload}.${signature}`;
}

function verifySession(token) {
  const c = cfg();

  if (!c.secret || !token) {
    return null;
  }

  try {
    const parts = String(token).split(".");

    if (parts.length !== 2) {
      return null;
    }

    const [payload, suppliedSignature] = parts;

    if (!payload || !suppliedSignature) {
      return null;
    }

    const expectedSignature = crypto
      .createHmac("sha256", c.secret)
      .update(payload)
      .digest("base64url");

    const suppliedBuffer = Buffer.from(
      suppliedSignature,
      "utf8"
    );

    const expectedBuffer = Buffer.from(
      expectedSignature,
      "utf8"
    );

    if (
      suppliedBuffer.length !==
      expectedBuffer.length
    ) {
      return null;
    }

    if (
      !crypto.timingSafeEqual(
        suppliedBuffer,
        expectedBuffer
      )
    ) {
      return null;
    }

    const session = JSON.parse(
      Buffer.from(
        payload,
        "base64url"
      ).toString("utf8")
    );

    if (
      !session?.sub ||
      !session?.exp ||
      Date.now() >= Number(session.exp)
    ) {
      return null;
    }

    return session;
  } catch {
    return null;
  }
}

function readCookie(req, name) {
  const cookieHeader = String(
    req.headers?.cookie || ""
  );

  if (!cookieHeader) {
    return null;
  }

  const cookies = cookieHeader.split(";");

  for (const cookie of cookies) {
    const separatorIndex =
      cookie.indexOf("=");

    if (separatorIndex === -1) {
      continue;
    }

    const key = cookie
      .slice(0, separatorIndex)
      .trim();

    if (key !== name) {
      continue;
    }

    const value = cookie
      .slice(separatorIndex + 1)
      .trim();

    try {
      return decodeURIComponent(value);
    } catch {
      return value;
    }
  }

  return null;
}
async function createChallenge(loginId, mode) {
  const c = cfg();
  const id = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + CHALLENGE_TTL_MS).toISOString();
  const response = await fetch(`${c.url.replace(/\/$/, "")}/rest/v1/auth_challenges`, {
    method: "POST",
    headers: supabaseHeaders({ Prefer: "return=representation" }),
    body: JSON.stringify({ id, login_id: loginId, mode, tries: 0, expires_at: expiresAt }),
  });
  if (!response.ok) throw new Error(`Dogrulama oturumu olusturulamadi (${response.status}).`);
  return { id, expiresAt };
}

async function getChallenge(id) {
  const c = cfg();
  const q = new URL(`${c.url.replace(/\/$/, "")}/rest/v1/auth_challenges`);
  q.searchParams.set("select", "*"); q.searchParams.set("id", `eq.${id}`); q.searchParams.set("limit", "1");
  const response = await fetch(q.toString(), { headers: supabaseHeaders() });
  if (!response.ok) throw new Error("Dogrulama oturumu okunamadi.");
  const rows = await response.json(); return rows?.[0] || null;
}

async function patchChallenge(id, patch) {
  const c = cfg();
  const q = new URL(`${c.url.replace(/\/$/, "")}/rest/v1/auth_challenges`);
  q.searchParams.set("id", `eq.${id}`);
  const response = await fetch(q.toString(), { method: "PATCH", headers: supabaseHeaders(), body: JSON.stringify(patch) });
  if (!response.ok) throw new Error("Dogrulama oturumu guncellenemedi.");
}

function verifyTotp(secret, code) {
  const result = verifySync({
    secret,
    token: code,
    strategy: "totp",
    algorithm: "sha1",
    digits: 6,
    period: 30,

    // Bir onceki / sonraki 30 saniyelik
    // zaman dilimine de tolerans ver.
    epochTolerance: 30,
  });

  if (typeof result === "boolean") {
    return result;
  }

  if (
    result &&
    typeof result === "object"
  ) {
    if ("valid" in result) {
      return Boolean(result.valid);
    }

    if ("delta" in result) {
      return result.delta !== null &&
        result.delta !== undefined;
    }
  }

  return Boolean(result);
}

function setSessionCookie(res, token) {
  const secure =
    process.env.NODE_ENV === "production";

  res.cookie("odakAuthSession", token, {
    httpOnly: true,
    secure,
    sameSite: secure ? "none" : "lax",
    maxAge: 8 * 60 * 60 * 1000,
    path: "/",
  });
}

async function requireAdmin(req, res) {
  try {
    const token = readCookie(
      req,
      "odakAuthSession"
    );

    const session = verifySession(token);

    if (!session) {
      res.status(401).json({
        error: "Oturum gerekli.",
      });
      return null;
    }

    const rows = await loginRowsById(
      session.sub
    );

    const user = rows?.[0];

    if (!user) {
      res.status(401).json({
        error: "Oturum kullanicisi bulunamadi.",
      });
      return null;
    }

    if (
      String(user.rol || "")
        .trim()
        .toLowerCase() !== "admin"
    ) {
      res.status(403).json({
        error: "Bu islem icin admin yetkisi gerekli.",
      });
      return null;
    }

    return user;
  } catch (error) {
    console.error(
      "Admin authorization:",
      error
    );

    res.status(500).json({
      error: "Yetki kontrolu yapilamadi.",
    });

    return null;
  }
}

function install(app) {
  app.post(
    "/api/auth/logout",
    (req, res) => {
      const secure =
        process.env.NODE_ENV === "production";

      res.clearCookie(
        "odakAuthSession",
        {
          httpOnly: true,
          secure,
          sameSite: secure
            ? "none"
            : "lax",
          path: "/",
        }
      );

      return res.json({
        ok: true,
      });
    }
  );
  app.get(
    "/api/auth/session",
    async (req, res) => {
      try {
        const token = readCookie(
          req,
          "odakAuthSession"
        );

        const session =
          verifySession(token);

        if (!session) {
          return res.status(401).json({
            authenticated: false,
          });
        }

        const rows = await loginRowsById(
          session.sub
        );

        const dbUser = rows?.[0];

        if (!dbUser) {
          return res.status(401).json({
            authenticated: false,
          });
        }

        return res.json({
          authenticated: true,
          user: safeUser(dbUser),
        });
      } catch (error) {
        console.error(
          "Auth session:",
          error
        );

        return res.status(500).json({
          authenticated: false,
          error:
            "Oturum dogrulanamadi.",
        });
      }
    }
  );

  app.patch(
    "/api/admin/users/:id",
    async (req, res) => {
      try {
        const admin = await requireAdmin(
          req,
          res
        );

        if (!admin) {
          return;
        }

        const id = String(
          req.params?.id || ""
        ).trim();

        if (!/^\d+$/.test(id)) {
          return res.status(400).json({
            error: "Gecersiz kullanici ID.",
          });
        }

        const username = String(
          req.body?.kullanici_adi || ""
        ).trim();

        const displayName = String(
          req.body?.kullanici || ""
        ).trim();

        const role = String(
          req.body?.rol || ""
        )
          .trim()
          .toLowerCase();

        const reelUser = String(
          req.body?.Reel_kullanici || ""
        ).trim() || null;

        const allowedScreens =
          Array.isArray(
            req.body?.allowedScreens
          )
            ? req.body.allowedScreens
            : [];

        const allowedButtons =
          Array.isArray(
            req.body?.allowedButtons
          )
            ? req.body.allowedButtons
            : [];

        if (!username || !displayName) {
          return res.status(400).json({
            error:
              "Kullanici adi ve kullanici zorunludur.",
          });
        }

        if (
          role !== "admin" &&
          role !== "kullanici"
        ) {
          return res.status(400).json({
            error: "Gecersiz rol.",
          });
        }

        const permissionCheck =
          validatePermissionPayload(
            allowedScreens,
            allowedButtons
          );

        if (!permissionCheck.valid) {
          return res.status(400).json({
            error: permissionCheck.error,
          });
        }

        const validatedScreens =
          permissionCheck.screens;

        const validatedButtons =
          permissionCheck.buttons;

        const c = cfg();

        /*
         * Ayni kullanici adinin baska
         * bir hesapta kullanilmasini engelle.
         */
        const duplicateUrl = new URL(
          `${c.url.replace(/\/$/, "")}/rest/v1/Login`
        );

        duplicateUrl.searchParams.set(
          "select",
          "id"
        );

        duplicateUrl.searchParams.set(
          "kullanici_adi",
          `eq.${username}`
        );

        duplicateUrl.searchParams.set(
          "id",
          `neq.${id}`
        );

        duplicateUrl.searchParams.set(
          "limit",
          "1"
        );

        const duplicateResponse =
          await fetch(
            duplicateUrl.toString(),
            {
              headers:
                supabaseHeaders(),
            }
          );

        if (!duplicateResponse.ok) {
          const detail =
            await duplicateResponse.text();

          throw new Error(
            `Kullanici kontrolu yapilamadi: ${detail}`
          );
        }

        const duplicates =
          await duplicateResponse.json();

        if (duplicates?.length) {
          return res.status(409).json({
            error:
              "Bu kullanici adi zaten kullaniliyor.",
          });
        }

        /*
         * Bir admin kullanici rolune dusuruluyorsa
         * sistemde en az bir baska admin kalmalidir.
         */
        const targetRows =
          await loginRowsById(id);

        const targetUser =
          targetRows?.[0];

        if (!targetUser) {
          return res.status(404).json({
            error:
              "Kullanici bulunamadi.",
          });
        }

        const targetIsAdmin =
          String(targetUser.rol || "")
            .trim()
            .toLowerCase() === "admin";

        if (
          targetIsAdmin &&
          role !== "admin"
        ) {
          const canRemoveAdmin =
            await ensureAdminCanBeRemoved(
              targetUser
            );

          if (!canRemoveAdmin) {
            return res.status(409).json({
              error:
                "Sistemde en az bir admin hesabi kalmalidir.",
            });
          }
        }
        const updateBody = {
          kullanici_adi:
            username,
          kullanici:
            displayName,
          Reel_kullanici:
            reelUser,
          rol:
            role,
          allowedScreens:
            JSON.stringify(
              validatedScreens
            ),
          allowedButtons:
            JSON.stringify(
              validatedButtons
            ),
        };

        /*
         * Reel_sifre payload'da yoksa
         * mevcut credential korunur.
         * Varsa yeni degerle guncellenir.
         */
        if (
          Object.prototype.hasOwnProperty.call(
            req.body || {},
            "Reel_sifre"
          )
        ) {
          const reelPassword = String(
            req.body.Reel_sifre || ""
          );

          if (reelPassword) {
            updateBody.Reel_sifre =
              reelPassword;
          }
        }

        const updateUrl = new URL(
          `${c.url.replace(/\/$/, "")}/rest/v1/Login`
        );

        updateUrl.searchParams.set(
          "id",
          `eq.${id}`
        );

        const updateResponse =
          await fetch(
            updateUrl.toString(),
            {
              method: "PATCH",
              headers: {
                ...supabaseHeaders(),
                "Content-Type":
                  "application/json",
                Prefer:
                  "return=representation",
              },
              body:
                JSON.stringify(
                  updateBody
                ),
            }
          );

        if (!updateResponse.ok) {
          const detail =
            await updateResponse.text();

          throw new Error(
            `Kullanici guncellenemedi: ${detail}`
          );
        }

        const updatedRows =
          await updateResponse.json();

        const updated =
          updatedRows?.[0];

        if (!updated) {
          return res.status(404).json({
            error:
              "Kullanici bulunamadi.",
          });
        }

        return res.json({
          user: {
            id: updated.id,
            kullanici_adi:
              updated.kullanici_adi,
            kullanici:
              updated.kullanici,
            Reel_kullanici:
              updated.Reel_kullanici,
            hasReelCredential:
              Boolean(
                updated.Reel_sifre
              ),
            rol:
              updated.rol,
            allowedScreens:
              updated.allowedScreens,
            allowedButtons:
              updated.allowedButtons,
          },
        });
      } catch (error) {
        console.error(
          "Admin update user:",
          error
        );

        return res.status(500).json({
          error:
            "Kullanici guncellenemedi.",
        });
      }
    }
  );

  app.delete(
    "/api/admin/users/:id",
    async (req, res) => {
      try {
        const admin = await requireAdmin(
          req,
          res
        );

        if (!admin) {
          return;
        }

        const id = String(
          req.params?.id || ""
        ).trim();

        if (!/^\d+$/.test(id)) {
          return res.status(400).json({
            error:
              "Gecersiz kullanici ID.",
          });
        }

        /*
         * Admin kendi hesabini bu endpoint
         * uzerinden silemez.
         */
        if (
          String(admin.id) === id
        ) {
          return res.status(409).json({
            error:
              "Aktif admin hesabi silinemez.",
          });
        }

        const existingRows =
          await loginRowsById(id);

        const existingUser =
          existingRows?.[0];

        if (!existingUser) {
          return res.status(404).json({
            error:
              "Kullanici bulunamadi.",
          });
        }

        /*
         * Silinecek hesap admin ise sistemde
         * en az bir baska admin kalmalidir.
         */
        const canDeleteAdmin =
          await ensureAdminCanBeRemoved(
            existingUser
          );

        if (!canDeleteAdmin) {
          return res.status(409).json({
            error:
              "Sistemde en az bir admin hesabi kalmalidir.",
          });
        }

        const c = cfg();
        const base =
          c.url.replace(/\/$/, "");

        async function deleteAuthRows(
          table,
          column,
          value
        ) {
          const url = new URL(
            `${base}/rest/v1/${table}`
          );

          url.searchParams.set(
            column,
            `eq.${value}`
          );

          const response =
            await fetch(
              url.toString(),
              {
                method: "DELETE",
                headers:
                  supabaseHeaders(),
              }
            );

          if (!response.ok) {
            const detail =
              await response.text();

            throw new Error(
              `${table} temizlenemedi: ${detail}`
            );
          }
        }

        /*
         * Yeni auth sistemi.
         */
        await deleteAuthRows(
          "auth_challenges",
          "login_id",
          id
        );

        await deleteAuthRows(
          "user_totp",
          "login_id",
          id
        );

        /*
         * Eski auth tablolarinda kayit
         * varsa onlar da yetim kalmasin.
         * user_key Login.id degeridir.
         */
        await deleteAuthRows(
          "recovery_codes",
          "user_key",
          id
        );

        await deleteAuthRows(
          "login_sessions",
          "user_key",
          id
        );

        await deleteAuthRows(
          "login_totp",
          "user_key",
          id
        );

        /*
         * security_events denetim kaydi
         * oldugu icin silmiyoruz.
         */

        const loginUrl = new URL(
          `${base}/rest/v1/Login`
        );

        loginUrl.searchParams.set(
          "id",
          `eq.${id}`
        );

        const deleteResponse =
          await fetch(
            loginUrl.toString(),
            {
              method: "DELETE",
              headers: {
                ...supabaseHeaders(),
                Prefer:
                  "return=representation",
              },
            }
          );

        if (!deleteResponse.ok) {
          const detail =
            await deleteResponse.text();

          throw new Error(
            `Kullanici silinemedi: ${detail}`
          );
        }

        const deletedRows =
          await deleteResponse.json();

        if (!deletedRows?.length) {
          return res.status(404).json({
            error:
              "Kullanici bulunamadi.",
          });
        }

        return res.json({
          ok: true,
          deletedUserId:
            deletedRows[0].id,
        });
      } catch (error) {
        console.error(
          "Admin delete user:",
          error
        );

        return res.status(500).json({
          error:
            "Kullanici silinemedi.",
        });
      }
    }
  );
  app.post(
    "/api/admin/users",
    async (req, res) => {
      try {
        const admin = await requireAdmin(
          req,
          res
        );

        if (!admin) {
          return;
        }

        const username = String(
          req.body?.kullanici_adi || ""
        ).trim();

        const displayName = String(
          req.body?.kullanici || ""
        ).trim();

        const password = String(
          req.body?.password || ""
        );

        const role = String(
          req.body?.rol || "kullanici"
        )
          .trim()
          .toLowerCase();

        const reelUser = String(
          req.body?.Reel_kullanici || ""
        ).trim() || null;

        const reelPassword =
          req.body?.Reel_sifre
            ? String(req.body.Reel_sifre)
            : null;

        const allowedScreens =
          Array.isArray(
            req.body?.allowedScreens
          )
            ? req.body.allowedScreens
            : [];

        const allowedButtons =
          Array.isArray(
            req.body?.allowedButtons
          )
            ? req.body.allowedButtons
            : [];

        if (!username || !displayName) {
          return res.status(400).json({
            error:
              "Kullanici adi ve kullanici zorunludur.",
          });
        }

        if (password.length < 10) {
          return res.status(400).json({
            error:
              "Sifre en az 10 karakter olmalidir.",
          });
        }

        if (
          role !== "admin" &&
          role !== "kullanici"
        ) {
          return res.status(400).json({
            error: "Gecersiz rol.",
          });
        }

        const permissionCheck =
          validatePermissionPayload(
            allowedScreens,
            allowedButtons
          );

        if (!permissionCheck.valid) {
          return res.status(400).json({
            error: permissionCheck.error,
          });
        }

        const validatedScreens =
          permissionCheck.screens;

        const validatedButtons =
          permissionCheck.buttons;

        const c = cfg();

        const duplicateUrl = new URL(
          `${c.url.replace(/\/$/, "")}/rest/v1/Login`
        );

        duplicateUrl.searchParams.set(
          "select",
          "id"
        );

        duplicateUrl.searchParams.set(
          "kullanici_adi",
          `eq.${username}`
        );

        duplicateUrl.searchParams.set(
          "limit",
          "1"
        );

        const duplicateResponse =
          await fetch(
            duplicateUrl.toString(),
            {
              headers:
                supabaseHeaders(),
            }
          );

        if (!duplicateResponse.ok) {
          const detail =
            await duplicateResponse.text();

          throw new Error(
            `Kullanici kontrolu yapilamadi: ${detail}`
          );
        }

        const duplicates =
          await duplicateResponse.json();

        if (duplicates?.length) {
          return res.status(409).json({
            error:
              "Bu kullanici adi zaten kullaniliyor.",
          });
        }

        const passwordHash =
          await bcrypt.hash(
            password,
            12
          );

        const insertResponse =
          await fetch(
            `${c.url.replace(/\/$/, "")}/rest/v1/Login`,
            {
              method: "POST",
              headers: {
                ...supabaseHeaders(),
                "Content-Type":
                  "application/json",
                Prefer:
                  "return=representation",
              },
              body: JSON.stringify({
                kullanici_adi:
                  username,
                kullanici:
                  displayName,

                // Uygulama parolasi artik
                // plaintext olarak tutulmaz.
                password_hash:
                  passwordHash,

                Reel_kullanici:
                  reelUser,
                Reel_sifre:
                  reelPassword,
                rol:
                  role,

                allowedScreens:
                  JSON.stringify(
                    validatedScreens
                  ),

                allowedButtons:
                  JSON.stringify(
                    validatedButtons
                  ),
              }),
            }
          );

        if (!insertResponse.ok) {
          const detail =
            await insertResponse.text();

          throw new Error(
            `Kullanici olusturulamadi: ${detail}`
          );
        }

        const createdRows =
          await insertResponse.json();

        const created =
          createdRows?.[0];

        if (!created) {
          throw new Error(
            "Olusturulan kullanici alinamadi."
          );
        }

        return res.status(201).json({
          user: {
            id: created.id,
            kullanici_adi:
              created.kullanici_adi,
            kullanici:
              created.kullanici,
            Reel_kullanici:
              created.Reel_kullanici,
            hasReelCredential:
              Boolean(
                created.Reel_sifre
              ),
            rol:
              created.rol,
            allowedScreens:
              created.allowedScreens,
            allowedButtons:
              created.allowedButtons,
          },
        });
      } catch (error) {
        console.error(
          "Admin create user:",
          error
        );

        return res.status(500).json({
          error:
            "Kullanici olusturulamadi.",
        });
      }
    }
  );

  app.put(
    "/api/admin/users/:id/password",
    async (req, res) => {
      try {
        const admin = await requireAdmin(
          req,
          res
        );

        if (!admin) {
          return;
        }

        const id = String(
          req.params?.id || ""
        ).trim();

        const password = String(
          req.body?.password || ""
        );

        if (!/^\d+$/.test(id)) {
          return res.status(400).json({
            error:
              "Gecersiz kullanici ID.",
          });
        }

        if (password.length < 10) {
          return res.status(400).json({
            error:
              "Sifre en az 10 karakter olmalidir.",
          });
        }

        const existingRows =
          await loginRowsById(id);

        const existingUser =
          existingRows?.[0];

        if (!existingUser) {
          return res.status(404).json({
            error:
              "Kullanici bulunamadi.",
          });
        }

        const passwordHash =
          await bcrypt.hash(
            password,
            12
          );

        const c = cfg();

        const updateUrl = new URL(
          `${c.url.replace(/\/$/, "")}/rest/v1/Login`
        );

        updateUrl.searchParams.set(
          "id",
          `eq.${id}`
        );

        const updateResponse =
          await fetch(
            updateUrl.toString(),
            {
              method: "PATCH",
              headers: {
                ...supabaseHeaders(),
                "Content-Type":
                  "application/json",
                Prefer:
                  "return=representation",
              },
              body: JSON.stringify({
                // Uygulama sifresi sadece
                // bcrypt hash olarak tutulur.
                password_hash:
                  passwordHash,
              }),
            }
          );

        if (!updateResponse.ok) {
          const detail =
            await updateResponse.text();

          throw new Error(
            `Sifre guncellenemedi: ${detail}`
          );
        }

        const updatedRows =
          await updateResponse.json();

        if (!updatedRows?.length) {
          return res.status(404).json({
            error:
              "Kullanici bulunamadi.",
          });
        }

        return res.json({
          ok: true,
        });
      } catch (error) {
        console.error(
          "Admin change password:",
          error
        );

        return res.status(500).json({
          error:
            "Sifre guncellenemedi.",
        });
      }
    }
  );
  app.get(
    "/api/admin/users",
    async (req, res) => {
      try {
        const admin = await requireAdmin(
          req,
          res
        );

        if (!admin) {
          return;
        }

        const c = cfg();

        const q = new URL(
          `${c.url.replace(/\/$/, "")}/rest/v1/Login`
        );

        q.searchParams.set(
          "select",
          "id,kullanici_adi,kullanici,Reel_kullanici,rol,allowedScreens,allowedButtons,Reel_sifre"
        );

        q.searchParams.set(
          "order",
          "kullanici.asc"
        );

        const response = await fetch(
          q.toString(),
          {
            headers: supabaseHeaders(),
          }
        );

        if (!response.ok) {
          const detail =
            await response.text();

          throw new Error(
            `Kullanici listesi alinamadi: ${detail}`
          );
        }

        const rows = await response.json();

        const users = (rows || []).map(
          (user) => ({
            id: user.id,
            kullanici_adi:
              user.kullanici_adi,
            kullanici:
              user.kullanici,
            Reel_kullanici:
              user.Reel_kullanici,
            hasReelCredential:
              Boolean(user.Reel_sifre),
            rol:
              user.rol,
            allowedScreens:
              user.allowedScreens,
            allowedButtons:
              user.allowedButtons,
          })
        );

        return res.json({
          users,
        });
      } catch (error) {
        console.error(
          "Admin users list:",
          error
        );

        return res.status(500).json({
          error:
            "Kullanici listesi alinamadi.",
        });
      }
    }
  );

  app.get(
    "/api/auth/2fa/health",
    (req, res) => {
      res.json({
        ok: true,
        service: "authenticator-totp",
        supabaseConfigured: Boolean(
          cfg().url && cfg().key
        ),
      });
    }
  );

  app.post(
    "/api/auth/2fa/start",
    async (req, res) => {
      try {
        const username = String(
          req.body?.username || ""
        ).trim();

        const password = String(
          req.body?.password || ""
        );

        if (!username || !password) {
          return res.status(400).json({
            error:
              "Kullanici adi ve sifre zorunludur.",
          });
        }

        const attemptKey =
          username.toLocaleLowerCase(
            "tr-TR"
          );

        const lock =
          attempts.get(attemptKey);

        if (
          lock?.lockedUntil &&
          lock.lockedUntil > Date.now()
        ) {
          return res.status(429).json({
            error:
              "Cok fazla basarisiz deneme. 15 dakika sonra tekrar deneyin.",
          });
        }

        const rows =
          await loginRows(username);

        const user = rows?.[0];

        const passwordValid =
          Boolean(user?.password_hash) &&
          await bcrypt.compare(
            password,
            String(user.password_hash)
          );

        if (
          !user ||
          !passwordValid
        ) {
          const count =
            (lock?.count || 0) + 1;

          attempts.set(attemptKey, {
            count,
            lockedUntil:
              count >= MAX_ATTEMPTS
                ? Date.now() + LOCK_MS
                : 0,
          });

          return res.status(401).json({
            error:
              "Kullanici adi veya sifre hatali.",
          });
        }

        attempts.delete(attemptKey);

        let totp = await getTotp(user.id);

        let mode;
        let qrCodeDataUrl = null;

        if (!totp || !totp.enabled) {
          const secret = generateSecret({
            length: 20,
          });

          if (!totp) {
            totp = await createTotp(
              user.id,
              secret
            );
          } else {
            totp =
              await updateTotpSecret(
                user.id,
                secret
              );
          }

          if (!totp?.secret) {
            throw new Error(
              "Authenticator secret olusturulamadi."
            );
          }

          const accountLabel =
            user.kullanici_adi ||
            user.kullanici ||
            String(user.id);

          const otpAuthUri = generateURI({
            strategy: "totp",
            issuer: "Odak Lojistik",
            label: accountLabel,
            secret: totp.secret,
            algorithm: "sha1",
            digits: 6,
            period: 30,
          });

          qrCodeDataUrl =
            await QRCode.toDataURL(
              otpAuthUri,
              {
                errorCorrectionLevel: "M",
                margin: 2,
                width: 300,
              }
            );

          mode = "setup";
        } else {
          mode = "verify";
        }

        const dbChallenge = await createChallenge(user.id, mode);

        return res.json({
          ok: true,
          mode,
          challengeId: dbChallenge.id,
          expiresIn: Math.max(1, Math.floor((new Date(dbChallenge.expiresAt).getTime() - Date.now()) / 1000)),
          ...(qrCodeDataUrl
            ? { qrCodeDataUrl }
            : {}),
        });
      } catch (error) {
        console.error(
          "2FA start:",
          error
        );

        return res.status(500).json({
          error:
            "Authenticator islemi baslatilamadi.",
          detail:
            process.env.NODE_ENV ===
            "development"
              ? error.message
              : undefined,
        });
      }
    }
  );

  app.post(
    "/api/auth/2fa/verify",
    async (req, res) => {
      try {
        const challengeId = String(
          req.body?.challengeId || ""
        );

        const code = String(
          req.body?.code || ""
        ).replace(/\D/g, "");

        if (
          !challengeId ||
          code.length !== 6
        ) {
          return res.status(400).json({
            error:
              "6 haneli Authenticator kodunu girin.",
          });
        }

        const challenge = await getChallenge(challengeId);

        if (!challenge || challenge.consumed_at) {
          return res.status(400).json({ error: "Dogrulama oturumu bulunamadi veya daha once kullanildi. Yeniden giris yapin." });
        }

        if (Date.now() > new Date(challenge.expires_at).getTime()) {
          await patchChallenge(challengeId, { consumed_at: new Date().toISOString() });
          return res.status(410).json({ error: "Dogrulama oturumunun suresi doldu. Yeniden giris yapin." });
        }

        const nextTries = Number(challenge.tries || 0) + 1;
        await patchChallenge(challengeId, { tries: nextTries });
        if (nextTries > MAX_ATTEMPTS) {
          await patchChallenge(challengeId, { consumed_at: new Date().toISOString() });
          return res.status(429).json({ error: "Cok fazla hatali kod denemesi. Yeniden giris yapin." });
        }

        const rows = await loginRowsById(challenge.login_id);
        const challengeUser = rows?.[0];
        const totp = await getTotp(challenge.login_id);
        if (!challengeUser || !totp?.secret) {
          return res.status(400).json({ error: "Authenticator kaydi bulunamadi. Yeniden giris yapin." });
        }

        const valid = verifyTotp(totp.secret, code);

        if (!valid) {
          return res.status(401).json({
            error:
              `Authenticator kodu hatali. ${
                MAX_ATTEMPTS -
                nextTries
              } deneme hakkiniz kaldi.`,
          });
        }

        if (
          challenge.mode === "setup"
        ) {
          await enableTotp(
            challenge.login_id
          );
        }

        await patchChallenge(challengeId, { consumed_at: new Date().toISOString() });

        const user = safeUser(challengeUser);

        const sessionToken =
          signSession(user);

        setSessionCookie(
          res,
          sessionToken
        );

        return res.json({
          ok: true,
          user,
          expiresIn: 28800,
        });
      } catch (error) {
        console.error(
          "2FA verify:",
          error
        );

        return res.status(500).json({
          error:
            "Authenticator dogrulamasi tamamlanamadi.",
          detail:
            process.env.NODE_ENV ===
            "development"
              ? error.message
              : undefined,
        });
      }
    }
  );
}

module.exports = {
  install,
};

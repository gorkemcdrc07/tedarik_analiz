
import React,{useState} from "react";
import {AnimatePresence,motion} from "framer-motion";
import {ArrowRight,BarChart3,CheckCircle2,Eye,EyeOff,Headphones,LockKeyhole,PackageCheck,ShieldCheck,Truck,UserRound} from "lucide-react";
import "./Login.css";

const API_BASE = (
  process.env.REACT_APP_API_BASE_URL ||
  "https://tedarik-analiz-backend.onrender.com"
)
  .trim()
  .replace(/\/+$/, "");
export default function Login({onLoginSuccess}){
 const [email,setEmail]=useState(""),[password,setPassword]=useState(""),[loading,setLoading]=useState(false),[error,setError]=useState(""),[showPassword,setShowPassword]=useState(false),[remember,setRemember]=useState(true);
 const [resetMode,setResetMode]=useState(false);
 const [newPassword,setNewPassword]=useState("");
 const [confirmPassword,setConfirmPassword]=useState("");
 const [showNewPassword,setShowNewPassword]=useState(false);
 const [resetSuccess,setResetSuccess]=useState("");
 const safeParse=v=>{if(!v)return[];if(Array.isArray(v))return v;try{const p=JSON.parse(v);return Array.isArray(p)?p:[]}catch{return[]}};
 const handleResetPassword=async e=>{
  e.preventDefault();
  setError("");
  setResetSuccess("");

  if(!email.trim()){
    setError("Kullan?c? ad?n?z? girin.");
    return;
  }

  if(newPassword.length<8){
    setError("Yeni ?ifre en az 8 karakter olmal?d?r.");
    return;
  }

  if(newPassword!==confirmPassword){
    setError("Girdi?iniz yeni ?ifreler e?le?miyor.");
    return;
  }

  setLoading(true);

  try{
    const response=await fetch(`${API_BASE}/api/auth/reset-password`,{
      method:"POST",
      credentials:"include",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({
        username:email.trim(),
        newPassword
      })
    });

    let result=null;

    try{
      result=await response.json();
    }catch{
      result=null;
    }

    if(!response.ok||!result?.ok){
      setError(
        result?.error||
        "?ifre de?i?tirilemedi."
      );
      return;
    }

    setResetSuccess("?ifreniz ba?ar?yla de?i?tirildi.");
    setPassword("");
    setNewPassword("");
    setConfirmPassword("");

    setTimeout(()=>{
      setResetMode(false);
      setResetSuccess("");
      setError("");
    },1500);

  }catch(err){
    console.error(err);

    setError(
      "Sunucu ba?lant?s? kurulamad?. L?tfen tekrar deneyin."
    );
  }finally{
    setLoading(false);
  }
 };

 const handleLogin=async e=>{
  e.preventDefault();
  setError("");
  setLoading(true);

  try{
    const response=await fetch(`${API_BASE}/api/auth/login`,{
      method:"POST",
      credentials:"include",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({
        username:email.trim(),
        password
      })
    });

    let result=null;

    try{
      result=await response.json();
    }catch{
      result=null;
    }

    if(!response.ok||!result?.ok||!result?.user){
      setError(
        result?.error||
        "Kullan?c? ad? veya ?ifre hatal?."
      );
      return;
    }

    const data=result.user;

    const userData={
      id:data.id,
      kullanici:data.kullanici,
      kullanici_adi:data.kullanici_adi,
      rol:data.rol,
      allowedScreens:safeParse(data.allowedScreens),
      allowedButtons:safeParse(data.allowedButtons)
    };

    localStorage.setItem(
      "loginUser",
      JSON.stringify(userData)
    );

    if(remember){
      localStorage.setItem(
        "kullanici",
        JSON.stringify(data)
      );
    }else{
      localStorage.removeItem("kullanici");
    }

    // TMS parolasi artik tarayiciya alinmaz.
    // Eski surumlerden kalmis credential varsa temizle.
    localStorage.removeItem("Reel_sifre");
    localStorage.removeItem("Reel_kullanici");

    localStorage.setItem(
      "userName",
      data.kullanici??email.trim()
    );

    localStorage.setItem(
      "userRole",
      data.rol??"kullanici"
    );

    onLoginSuccess?.();

  }catch(err){
    console.error(err);
    setError(
      "Sunucu ba?lant?s? kurulamad?. L?tfen tekrar deneyin."
    );
  }finally{
    setLoading(false);
  }
};
 return <main className="ots-login"><div className="ots-login-bg-grid"/><div className="ots-login-orb ots-login-orb-blue"/><div className="ots-login-orb ots-login-orb-orange"/><motion.section className="ots-login-container" initial={{opacity:0,y:14}} animate={{opacity:1,y:0}} transition={{duration:.45}}><div className="ots-login-showcase"><div><div className="ots-login-brand"><div className="ots-login-logo-box"><img src="/odak-logo.png" alt="Odak Lojistik"/></div><div className="ots-login-brand-text"><strong>ODAK</strong><span>LOJİSTİK · OPERASYON SİSTEMİ</span></div></div><div className="ots-login-hero"><div className="ots-login-hero-badge"><ShieldCheck size={14}/><span>Operasyon Yönetim Sistemi</span></div><h1>Her yükte <span>daha ileriye.</span></h1><p>Sipariş, operasyon, gelir-gider, fiyatlandırma ve analiz süreçlerinizi Odak Lojistik yönetim sistemi üzerinden tek merkezden yönetin.</p></div><div className="ots-login-features"><Feature icon={<PackageCheck size={18}/>} title="Sipariş Yönetimi" text="Siparişleri oluşturun, aktarın ve takip edin."/><Feature icon={<Truck size={18}/>} title="Operasyon Yönetimi" text="Sefer ve müşteri süreçlerini tek ekrandan yönetin."/><Feature icon={<BarChart3 size={18}/>} title="Analiz ve Raporlama" text="Operasyon verilerinizi anlık olarak analiz edin."/></div></div><div className="ots-login-showcase-footer"><div className="ots-login-secure"><CheckCircle2 size={15}/><span>Güvenli sistem erişimi</span></div><span className="ots-login-version">ODAK LOJİSTİK</span></div></div><div className="ots-login-form-section"><div className="ots-login-mobile-brand"><div className="ots-login-logo-box"><img src="/odak-logo.png" alt="Odak Lojistik"/></div><div className="ots-login-brand-text"><strong>ODAK</strong><span>LOJİSTİK · OPERASYON SİSTEMİ</span></div></div><header className="ots-login-form-header"><span className="ots-login-eyebrow">Hoş Geldiniz</span><h2>Sisteme Giriş</h2><p>Odak Lojistik yönetim sistemine erişmek için kullanıcı bilgilerinizi girin.</p></header><form className="ots-login-form" onSubmit={resetMode?handleResetPassword:handleLogin}>

<Field label="Kullan?c? Ad?">
<div className="ots-login-input-wrapper">
<UserRound className="ots-login-input-icon" size={18}/>
<input
 type="text"
 autoComplete="username"
 placeholder="Kullan?c? ad?n?z? girin"
 value={email}
 onChange={e=>{
  setEmail(e.target.value);
  if(error)setError("");
 }}
 required
/>
</div>
</Field>

{resetMode?(
<>
<Field label="Yeni ?ifre">
<div className="ots-login-input-wrapper">
<LockKeyhole className="ots-login-input-icon" size={18}/>
<input
 type={showNewPassword?"text":"password"}
 autoComplete="new-password"
 placeholder="En az 8 karakter"
 value={newPassword}
 onChange={e=>{
  setNewPassword(e.target.value);
  if(error)setError("");
 }}
 required
/>
<button
 type="button"
 className="ots-login-password-toggle"
 onClick={()=>setShowNewPassword(v=>!v)}
>
{showNewPassword?<EyeOff size={18}/>:<Eye size={18}/>}
</button>
</div>
</Field>

<Field label="Yeni ?ifre Tekrar">
<div className="ots-login-input-wrapper">
<LockKeyhole className="ots-login-input-icon" size={18}/>
<input
 type={showNewPassword?"text":"password"}
 autoComplete="new-password"
 placeholder="Yeni ?ifrenizi tekrar girin"
 value={confirmPassword}
 onChange={e=>{
  setConfirmPassword(e.target.value);
  if(error)setError("");
 }}
 required
/>
</div>
</Field>

<div className="ots-login-options">
<button
 type="button"
 className="ots-login-forgot"
 onClick={()=>{
  setResetMode(false);
  setNewPassword("");
  setConfirmPassword("");
  setResetSuccess("");
  setError("");
 }}
>
? Giri? ekran?na d?n
</button>
</div>
</>
):(
<>
<Field label="?ifre">
<div className="ots-login-input-wrapper">
<LockKeyhole className="ots-login-input-icon" size={18}/>
<input
 type={showPassword?"text":"password"}
 autoComplete="current-password"
 placeholder="?ifrenizi girin"
 value={password}
 onChange={e=>{
  setPassword(e.target.value);
  if(error)setError("");
 }}
 required
/>
<button
 type="button"
 className="ots-login-password-toggle"
 onClick={()=>setShowPassword(v=>!v)}
>
{showPassword?<EyeOff size={18}/>:<Eye size={18}/>}
</button>
</div>
</Field>

<div className="ots-login-options">

<label className="ots-login-checkbox">
<input
 type="checkbox"
 checked={remember}
 onChange={e=>setRemember(e.target.checked)}
/>
<span className="ots-login-checkbox-ui"/>
<span>Beni hat?rla</span>
</label>

<button
 type="button"
 className="ots-login-forgot"
 onClick={()=>{
  setResetMode(true);
  setPassword("");
  setError("");
  setResetSuccess("");
 }}
>
?ifremi unuttum
</button>

</div>
</>
)}

<AnimatePresence>

{resetSuccess&&
<motion.div
 className="ots-login-success"
 initial={{opacity:0,y:-4}}
 animate={{opacity:1,y:0}}
 exit={{opacity:0,y:-4}}
>
<CheckCircle2 size={16}/>
<span>{resetSuccess}</span>
</motion.div>
}

{error&&
<motion.div
 className="ots-login-error"
 initial={{opacity:0,y:-4}}
 animate={{opacity:1,y:0}}
 exit={{opacity:0,y:-4}}
>
<span className="ots-login-error-dot"/>
<span>{error}</span>
</motion.div>
}

</AnimatePresence>

<motion.button
 type="submit"
 className="ots-login-submit"
 disabled={
  loading||
  !email||
  (resetMode
   ?(!newPassword||!confirmPassword)
   :!password)
 }
 whileTap={loading?undefined:{scale:.985}}
>

{loading?(
<>
<span className="ots-login-spinner"/>
<span>
{resetMode?"?ifre g?ncelleniyor...":"Giri? yap?l?yor..."}
</span>
</>
):(
<>
<span>
{resetMode?"?ifreyi G?ncelle":"Sisteme Giri? Yap"}
</span>
<ArrowRight size={18}/>
</>
)}

</motion.button>

</form><div className="ots-login-support"><div className="ots-login-support-icon"><Headphones size={17}/></div><div><span>Erişim sorunu mu yaşıyorsunuz?</span><strong>Sistem yöneticiniz ile iletişime geçin.</strong></div></div></div></motion.section><footer className="ots-login-footer"><span>© {new Date().getFullYear()} Odak Lojistik</span><span className="ots-login-footer-dot"/><span>Operasyon Takip Sistemi</span></footer></main>
}
function Feature({icon,title,text}){return <div className="ots-login-feature"><div className="ots-login-feature-icon">{icon}</div><div><strong>{title}</strong><span>{text}</span></div></div>}
function Field({label,children}){return <div className="ots-login-field"><label>{label}</label>{children}</div>}

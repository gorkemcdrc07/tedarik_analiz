import React,{useEffect,useState} from "react";
import {useLocation,useNavigate} from "react-router-dom";
import {CheckCircle2,LockKeyhole,Mail} from "lucide-react";
import "./Yetkisiz.css";

const RECIPIENT="gorkem.cadirci@odaklojistik.com.tr";

export default function Yetkisiz({currentUser}){
 const navigate=useNavigate();
 const location=useLocation();
 const [userName,setUserName]=useState(currentUser||"");
 const [screenName,setScreenName]=useState("");
 const [reason,setReason]=useState("");
 const [errors,setErrors]=useState({});
 const [done,setDone]=useState(false);
 useEffect(()=>{try{const u=JSON.parse(localStorage.getItem("loginUser")||"null");if(!currentUser&&u?.kullanici)setUserName(u.kullanici)}catch{} const parts=location.pathname.split("/").filter(Boolean);const raw=parts.at(-1)||"Bilinmeyen ekran";setScreenName(decodeURIComponent(raw.replace(/-/g," ")))},[currentUser,location.pathname]);
 const validate=()=>{const e={};if(!userName.trim())e.userName="Adınızı giriniz";if(!screenName.trim())e.screenName="Ekran adı boş bırakılamaz";if(!reason.trim())e.reason="Açıklama yazınız";setErrors(e);return !Object.keys(e).length};
 const send=()=>{if(!validate())return;const subject=encodeURIComponent(`Erişim Yetki Talebi – ${screenName}`);const body=encodeURIComponent(`Merhaba Görkem Bey,\n\nAşağıdaki kullanıcı kısıtlı bir sayfaya erişim yetkisi talep etmektedir.\n\nKullanıcı Adı  : ${userName}\nEkran / Sayfa  : ${screenName}\nTalep Sebebi   : ${reason}\n\nGerekli yetkilendirmenin yapılmasını rica ederim.\n\nSaygılarımla,\n${userName}`);window.location.href=`mailto:${RECIPIENT}?subject=${subject}&body=${body}`;setDone(true)};
 const field=(key,label,value,setter,area=false)=><div className={`ots-denied-field ${errors[key]?"is-error":""}`}><label>{label}</label>{area?<textarea value={value} placeholder="Kısa bir açıklama yazınız..." onChange={e=>{setter(e.target.value);setErrors(p=>({...p,[key]:""}))}}/>:<input value={value} onChange={e=>{setter(e.target.value);setErrors(p=>({...p,[key]:""}))}}/>}{errors[key]&&<span className="ots-denied-error">{errors[key]}</span>}</div>;
 return <div className="ots-denied"><div className="ots-denied-card"><div className="ots-denied-accent"/>{done?<div className="ots-denied-success"><div className="ots-denied-success-icon"><CheckCircle2 size={30}/></div><h2>Talep Hazırlandı</h2><p>Mail taslağı açıldı. Göndermeniz halinde yetki talebiniz sistem yöneticisine iletilecek.</p><button className="ots-denied-btn primary" onClick={()=>navigate(-1)}>Geri Dön</button></div>:<div className="ots-denied-body"><div className="ots-denied-icon"><LockKeyhole size={28}/></div><div className="ots-denied-header"><h1>Erişim Kısıtlı</h1><p>Bu ekran için yetkiniz bulunmuyor. Gerekliyse aşağıdaki formdan erişim talebi oluşturabilirsiniz.</p></div><div className="ots-denied-fields">{field("userName","Adınız Soyadınız",userName,setUserName)}{field("screenName","Ekran / Sayfa Adı",screenName,setScreenName)}{field("reason","Talep Açıklaması",reason,setReason,true)}</div><div className="ots-denied-recipient"><Mail size={14}/><span className="ots-denied-recipient-dot"/><span>{RECIPIENT}</span></div><div className="ots-denied-actions"><button className="ots-denied-btn secondary" onClick={()=>navigate(-1)}>Geri Dön</button><button className="ots-denied-btn primary" onClick={send}>Yetki Talebi Gönder</button></div></div>}</div></div>;
}

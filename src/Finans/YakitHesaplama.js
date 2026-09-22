import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";

import {
  ArrowLeft,
  ArrowRight,
  BadgeDollarSign,
  Building2,
  Calculator,
  CheckCircle2,
  Fuel,
  History,
  Plus,
  RefreshCw,
  Save,
  Search,
  ShoppingCart,
  Upload,
  Users,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Minus,
  Truck,
  Undo2,
  Download,
  ChevronDown,
  ChevronUp,
  SlidersHorizontal,
  Table2,
} from "lucide-react";

import * as XLSX from "xlsx";
import ExcelJS from "exceljs";
import supabase from "../supabaseClient";
import { createFuelPriceNotification } from "./fuelNotifications";
import { getContractRules, saveContractRule } from "./fuelEscalationEngine";
import "./YakitHesaplama.css";
import FuelStationDashboard from "./FuelStationDashboard";
import BimCustomerScreen from "./customerScreens/BimCustomerScreen";
import {
  CUSTOMER_FUEL_REFERENCES,
  CUSTOMER_LIST,
  CUSTOMER_KEYS,
  getCustomerKey,
} from "./customerScreens";

/* =========================================================
   YARDIMCI FONKSİYONLAR
========================================================= */

const num = (v) => {
  if (typeof v === "number") {
    return Number.isFinite(v) ? v : NaN;
  }

  let s = String(v ?? "")
    .trim()
    .replace(/\s/g, "")
    .replace(/₺|TL/gi, "");

  if (!s) return NaN;

  // TR format: 1.480,34 -> 1480.34
  if (s.includes(",")) {
    s = s.replace(/\./g, "").replace(",", ".");
  } else if (/^[-+]?\d{1,3}(\.\d{3}){1,}$/.test(s)) {
    // 1.480.000 -> 1480000
    s = s.replace(/\./g, "");
  }

  const n = Number(s);

  return Number.isFinite(n) ? n : NaN;
};

const money = (v) => {
  if (v == null) return "—";

  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    minimumFractionDigits: 2,
  }).format(Number(v));
};

// V38 — Tarife tutarları standart TL yuvarlama kuralına göre tam sayıya çevrilir.
// Küsurat 0,50 ve üzerindeyse yukarı, 0,50 altındaysa aşağı yuvarlanır.
// Yakıt litre fiyatları (örn. 73,96 / 80,09) bu kurala dahil değildir.
const parseTariffNumber = (v) => {
  if (typeof v === "number") return Number.isFinite(v) ? v : NaN;
  const raw = String(v ?? "").trim().replace(/\s/g, "");
  if (!raw) return NaN;
  // TR biçimi: 20.802,311 -> 20802.311. Nokta yalnızca ondalıksa da desteklenir.
  const normalized = raw.includes(",") ? raw.replace(/\./g, "").replace(",", ".") : raw;
  const n = Number(normalized);
  return Number.isFinite(n) ? n : NaN;
};
const tariffRound = (v) => {
  const n = parseTariffNumber(v);
  if (!Number.isFinite(n)) return 0;
  // Pozitif tarife tutarlarında: 0,500... yukarı; 0,499... ve altı aşağı.
  // Kesin standart yuvarlama: 0,500... ve üzeri yukarı; 0,499... ve altı aşağı.
  // Örn. 20802.311 => 20802, 8295.916 => 8296.
  return Math.floor(n + 0.5);
};
const tariffMoney = (v) => {
  if (v == null || !Number.isFinite(Number(v))) return "—";
  return new Intl.NumberFormat("tr-TR", {
    style: "currency", currency: "TRY", minimumFractionDigits: 0, maximumFractionDigits: 0
  }).format(tariffRound(v));
};

// V44 — BİM ilk değerleri test12345(2).xlsx kaynağından küsuratlarıyla korunur ve gösterilir.
// BİM tarafında tam sayıya yuvarlama yapılmaz.
const tariffRaw = (v) => {
  const n = parseTariffNumber(v);
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString("tr-TR", { minimumFractionDigits: 3, maximumFractionDigits: 3 });
};
// BİM: kaynak/ilk değerlerde gerçek 3 hane gösterilir; hesaplama sonrası tam TL sonuçlar ,00 gösterilir.
const bimTariffDisplay = (v) => {
  const n = parseTariffNumber(v);
  if (!Number.isFinite(n)) return "—";
  const isWhole = Math.abs(n - Math.trunc(n)) < 1e-9;
  return n.toLocaleString("tr-TR", {
    minimumFractionDigits: isWhole ? 2 : 3,
    maximumFractionDigits: isWhole ? 2 : 3
  });
};

const HEADERS = [
  "İL",
  "İLÇE",
  "KÖY/MAHALLE",
  "TON/TL",
];

const norm = (s) =>
  String(s ?? "")
    .trim()
    .toLocaleUpperCase("tr-TR")
    .replace(/\s+/g, " ");

/*
  Yakıt Hesaplama ekranında gösterilecek müşteriler.

  Buraya daha sonra yeni müşteri eklemek çok kolay:
  { name: "A101", order: 3 }

  Şu an istenen:
  1. FASDAT
  2. KWS
*/
const ALLOWED_CUSTOMERS = CUSTOMER_LIST;

const getCustomerOrder = (customer) => {
  const name = norm(customer?.musteri_adi);
  const code = norm(customer?.kod);

  const config = ALLOWED_CUSTOMERS.find(
    (item) =>
      norm(item.name) === name ||
      norm(item.name) === code
  );

  return config?.order ?? 999;
};

const isAllowedCustomer = (customer) => {
  const name = norm(customer?.musteri_adi);
  const code = norm(customer?.kod);

  return ALLOWED_CUSTOMERS.some(
    (item) =>
      norm(item.name) === name ||
      norm(item.name) === code
  );
};

const customerFuelKey = (item) => {
  return getCustomerKey(item);
};



/* =========================================================
   ETİ TARİFELERİ
   Kaynak: eti şeker.xlsx
========================================================= */

const ETI_SEKER = [{"rota": "Eskişehir - Eskişehir", "fiyat": 352.911}, {"rota": "Eskişehir - Bozüyük", "fiyat": 449.656}, {"rota": "Balıkesir Susurluk - Eskişehir", "fiyat": 1239.96}, {"rota": "Balıkesir Susurluk - Bozüyük", "fiyat": 1130.953}, {"rota": "Konya Merkez - Eskişehir", "fiyat": 940.189}, {"rota": "Konya Merkez - Bozüyük", "fiyat": 1062.823}];
const ETI_CIFTCI_SATIS = [{"il": "AFYONKARAHİSAR", "ilce": "SANDIKLI", "mahalle": "BALLIK", "fiyat": 1203.64532914928}, {"il": "AFYONKARAHİSAR", "ilce": "SİNANPAŞA", "mahalle": "AYVALI", "fiyat": 1203.6453291492764}, {"il": "AFYONKARAHİSAR", "ilce": "SİNANPAŞA", "mahalle": "DÜZAĞAÇ", "fiyat": 1203.6453291492764}, {"il": "AFYONKARAHİSAR", "ilce": "SİNANPAŞA", "mahalle": "EYİCE", "fiyat": 1203.6453291492764}, {"il": "AFYONKARAHİSAR", "ilce": "SİNANPAŞA", "mahalle": "YILDIRIMKEMAL", "fiyat": 1203.6453291492764}, {"il": "ANKARA", "ilce": "BALA", "mahalle": "ABAZLI", "fiyat": 1418.9314855824805}, {"il": "ANKARA", "ilce": "BALA", "mahalle": "AHMETÇAYIRI", "fiyat": 1418.9314855824805}, {"il": "ANKARA", "ilce": "BALA", "mahalle": "HANBURUN", "fiyat": 1418.9314855824805}, {"il": "ANKARA", "ilce": "GÖLBAŞI", "mahalle": "EMİRLER", "fiyat": 1418.9314855824805}, {"il": "ANKARA", "ilce": "GÖLBAŞI", "mahalle": "GÖKÇEHÜYÜK", "fiyat": 1418.9314855824805}, {"il": "ANKARA", "ilce": "GÖLBAŞI", "mahalle": "HALAÇLI", "fiyat": 1418.9314855824805}, {"il": "ANKARA", "ilce": "GÖLBAŞI", "mahalle": "KARAOĞLAN", "fiyat": 1418.9314855824805}, {"il": "ANKARA", "ilce": "GÖLBAŞI", "mahalle": "OĞULBEY", "fiyat": 1418.9314855824805}, {"il": "ANKARA", "ilce": "HAYMANA", "mahalle": "AHIRLIKUYU", "fiyat": 1418.9314855824805}, {"il": "ANKARA", "ilce": "POLATLI", "mahalle": "KARAKUYU", "fiyat": 1418.9314855824805}, {"il": "ANKARA", "ilce": "POLATLI", "mahalle": "YEŞİLÖZ", "fiyat": 1418.9314855824805}, {"il": "BİLECİK", "ilce": "BOZÜYÜK", "mahalle": "ALİBEYDÜZÜ", "fiyat": 1017.7163758660548}, {"il": "BİLECİK", "ilce": "BOZÜYÜK", "mahalle": "YENİ DODURGA", "fiyat": 1017.7163758660548}, {"il": "ESKİŞEHİR", "ilce": "ÇİFTELER", "mahalle": "BELPINAR", "fiyat": 929.6447664161079}, {"il": "ESKİŞEHİR", "ilce": "ÇİFTELER", "mahalle": "DİKMEN", "fiyat": 929.6447664161079}, {"il": "ESKİŞEHİR", "ilce": "MAHMUDİYE", "mahalle": "AKYURT", "fiyat": 802.4302194328509}, {"il": "ESKİŞEHİR", "ilce": "MAHMUDİYE", "mahalle": "BALÇIKHİSAR", "fiyat": 802.4302194328509}, {"il": "ESKİŞEHİR", "ilce": "MAHMUDİYE", "mahalle": "ÇAL", "fiyat": 802.4302194328509}, {"il": "ESKİŞEHİR", "ilce": "MAHMUDİYE", "mahalle": "HAMİDİYE", "fiyat": 802.4302194328509}, {"il": "ESKİŞEHİR", "ilce": "MAHMUDİYE", "mahalle": "MERKEZ", "fiyat": 802.4302194328509}, {"il": "ESKİŞEHİR", "ilce": "MAHMUDİYE", "mahalle": "ŞEREFİYE", "fiyat": 802.4302194328509}, {"il": "ESKİŞEHİR", "ilce": "MAHMUDİYE", "mahalle": "TOKATHAN", "fiyat": 802.4302194328509}, {"il": "ESKİŞEHİR", "ilce": "MAHMUDİYE", "mahalle": "TOPKAYA", "fiyat": 802.4302194328509}, {"il": "ESKİŞEHİR", "ilce": "MAHMUDİYE", "mahalle": "YEŞİLYURT", "fiyat": 802.4302194328509}, {"il": "ESKİŞEHİR", "ilce": "ODUNPAZARI", "mahalle": "DEMİRLİ", "fiyat": 802.4302194328509}, {"il": "ESKİŞEHİR", "ilce": "ODUNPAZARI", "mahalle": "KARAPAZAR", "fiyat": 802.4302194328509}, {"il": "ESKİŞEHİR", "ilce": "ODUNPAZARI", "mahalle": "KARATEPE", "fiyat": 802.4302194328509}, {"il": "ESKİŞEHİR", "ilce": "ODUNPAZARI", "mahalle": "KIRAVDAN", "fiyat": 802.4302194328509}, {"il": "ESKİŞEHİR", "ilce": "ODUNPAZARI", "mahalle": "YASSIHÖYÜK", "fiyat": 802.4302194328509}, {"il": "ESKİŞEHİR", "ilce": "SEYİTGAZİ", "mahalle": "AYVALI", "fiyat": 802.4302194328509}, {"il": "ESKİŞEHİR", "ilce": "SEYİTGAZİ", "mahalle": "DEĞİŞÖREN", "fiyat": 802.4302194328509}, {"il": "ESKİŞEHİR", "ilce": "SEYİTGAZİ", "mahalle": "DOĞANÇAYIR", "fiyat": 802.4302194328509}, {"il": "ESKİŞEHİR", "ilce": "SEYİTGAZİ", "mahalle": "GÜMÜŞBEL", "fiyat": 802.4302194328509}, {"il": "ESKİŞEHİR", "ilce": "SİVRİHİSAR", "mahalle": "AKTAŞ", "fiyat": 900.2875632661253}, {"il": "ESKİŞEHİR", "ilce": "TEPEBAŞI", "mahalle": "BOYACIOĞLU", "fiyat": 900.2875632661253}, {"il": "ESKİŞEHİR", "ilce": "TEPEBAŞI", "mahalle": "GÜNDÜZLER", "fiyat": 900.2875632661253}, {"il": "ISPARTA", "ilce": "ŞARKİKARAAĞAÇ", "mahalle": "GÖKSÖĞÜT", "fiyat": 1487.4316262657724}, {"il": "ISPARTA", "ilce": "YALVAÇ", "mahalle": "SALUR", "fiyat": 1487.4316262657724}, {"il": "KAYSERİ", "ilce": "PINARBAŞI", "mahalle": "METHİYE", "fiyat": 2329.0047832319333}, {"il": "KAYSERİ", "ilce": "PINARBAŞI", "mahalle": "ÜÇPINAR", "fiyat": 2329.0047832319333}, {"il": "KAYSERİ", "ilce": "PINARBAŞI", "mahalle": "YAHYABEY", "fiyat": 2329.0047832319333}, {"il": "KONYA", "ilce": "KULU", "mahalle": "KÖMÜŞİNİ", "fiyat": 1604.8604388657018}, {"il": "KONYA", "ilce": "KULU", "mahalle": "KÖŞKER", "fiyat": 1604.8604388657018}, {"il": "KONYA", "ilce": "YUNAK", "mahalle": "KARATAŞ", "fiyat": 1438.5029543491348}, {"il": "KÜTAHYA", "ilce": "ALTINTAŞ", "mahalle": "AYKIRIKÇI", "fiyat": 1193.8595947659487}, {"il": "KÜTAHYA", "ilce": "ALTINTAŞ", "mahalle": "OSMANİYE", "fiyat": 1203.6453291492764}, {"il": "KÜTAHYA", "ilce": "ALTINTAŞ", "mahalle": "ÜÇHÜYÜK", "fiyat": 1066.6450477826922}, {"il": "KÜTAHYA", "ilce": "ALTINTAŞ ", "mahalle": "ZAFERTEPEÇALKÖY", "fiyat": 1281.931204215896}, {"il": "KÜTAHYA", "ilce": "DUMLUPINAR", "mahalle": "ALLIÖREN", "fiyat": 1281.931204215896}, {"il": "KÜTAHYA", "ilce": "DUMLUPINAR", "mahalle": "HAMUR", "fiyat": 1281.931204215896}, {"il": "KÜTAHYA", "ilce": "DUMLUPINAR", "mahalle": "KIZILCA", "fiyat": 1281.931204215896}, {"il": "KÜTAHYA", "ilce": "DUMLUPINAR", "mahalle": "MERKEZ", "fiyat": 1281.931204215896}, {"il": "KÜTAHYA", "ilce": "MERKEZ", "mahalle": "ULUKÖY", "fiyat": 1281.931204215896}, {"il": "SİVAS", "ilce": "ALTINYAYLA", "mahalle": "ALTINYURT", "fiyat": 2553.3939483938143}, {"il": "SİVAS", "ilce": "ALTINYAYLA", "mahalle": "BAŞÖREN", "fiyat": 2553.3939483938143}, {"il": "SİVAS", "ilce": "ALTINYAYLA", "mahalle": "BAYINDIR", "fiyat": 2553.3939483938143}, {"il": "SİVAS", "ilce": "ALTINYAYLA", "mahalle": "DELİİLYAS", "fiyat": 2553.3939483938143}, {"il": "SİVAS", "ilce": "ALTINYAYLA", "mahalle": "MERKEZ", "fiyat": 2553.3939483938143}, {"il": "SİVAS", "ilce": "ALTINYAYLA", "mahalle": "MUTUBEY", "fiyat": 2553.3939483938143}, {"il": "SİVAS", "ilce": "ALTINYAYLA", "mahalle": "TAHTYURT", "fiyat": 2553.3939483938143}, {"il": "SİVAS", "ilce": "KANGAL", "mahalle": "BOZARMUT", "fiyat": 2623.4871156046247}, {"il": "SİVAS", "ilce": "KANGAL", "mahalle": "ÇALTEPE", "fiyat": 2623.4871156046247}, {"il": "SİVAS", "ilce": "KANGAL", "mahalle": "ÇAMURLU", "fiyat": 2623.4871156046247}, {"il": "SİVAS", "ilce": "KANGAL", "mahalle": "ÇATKÖY", "fiyat": 2623.4871156046247}, {"il": "SİVAS", "ilce": "KANGAL", "mahalle": "DELİKTAŞ", "fiyat": 2623.4871156046247}, {"il": "SİVAS", "ilce": "KANGAL", "mahalle": "HAMAL", "fiyat": 2623.4871156046247}, {"il": "SİVAS", "ilce": "KANGAL", "mahalle": "HATUNÇAYIRI", "fiyat": 2623.4871156046247}, {"il": "SİVAS", "ilce": "KANGAL", "mahalle": "KIZILDİKME", "fiyat": 2623.4871156046247}, {"il": "SİVAS", "ilce": "KANGAL", "mahalle": "MERKEZ", "fiyat": 2623.4871156046247}, {"il": "SİVAS", "ilce": "KANGAL", "mahalle": "TAHTALI", "fiyat": 2623.4871156046247}, {"il": "SİVAS", "ilce": "KANGAL", "mahalle": "TİLKİHÜYÜK", "fiyat": 2623.4871156046247}, {"il": "SİVAS", "ilce": "KANGAL", "mahalle": "YAYLACIK", "fiyat": 2623.4871156046247}, {"il": "SİVAS", "ilce": "ŞARKIŞLA", "mahalle": "CANABDAL GÜDÜL MEZRASI", "fiyat": 2553.3939483938143}, {"il": "SİVAS", "ilce": "ŞARKIŞLA", "mahalle": "İĞECİK", "fiyat": 2553.3939483938143}, {"il": "SİVAS", "ilce": "ŞARKIŞLA", "mahalle": "KAZANCIK", "fiyat": 2553.3939483938143}, {"il": "SİVAS", "ilce": "ULAŞ", "mahalle": "BOĞAZDERE", "fiyat": 2623.4871156046247}, {"il": "SİVAS", "ilce": "ULAŞ", "mahalle": "KARACALAR", "fiyat": 2623.4871156046247}, {"il": "SİVAS", "ilce": "ULAŞ", "mahalle": "KURTLUKAYA", "fiyat": 2623.4871156046247}, {"il": "SİVAS", "ilce": "ULAŞ", "mahalle": "MERKEZ", "fiyat": 2623.4871156046247}, {"il": "UŞAK", "ilce": "BANAZ", "mahalle": "ÇİFTLİK", "fiyat": 1471.9565114270222}];
const ETI_CIFTCI_ALIS = [{"il": "AFYONKARAHİSAR", "ilce": "SANDIKLI", "mahalle": "BALLIK", "fiyat": 986.9891699024096}, {"il": "AFYONKARAHİSAR", "ilce": "SİNANPAŞA", "mahalle": "AYVALI", "fiyat": 986.9891699024066}, {"il": "AFYONKARAHİSAR", "ilce": "SİNANPAŞA", "mahalle": "DÜZAĞAÇ", "fiyat": 986.9891699024066}, {"il": "AFYONKARAHİSAR", "ilce": "SİNANPAŞA", "mahalle": "EYİCE", "fiyat": 986.9891699024066}, {"il": "AFYONKARAHİSAR", "ilce": "SİNANPAŞA", "mahalle": "YILDIRIMKEMAL", "fiyat": 986.9891699024066}, {"il": "ANKARA", "ilce": "BALA", "mahalle": "ABAZLI", "fiyat": 1163.523818177634}, {"il": "ANKARA", "ilce": "BALA", "mahalle": "AHMETÇAYIRI", "fiyat": 1163.523818177634}, {"il": "ANKARA", "ilce": "BALA", "mahalle": "HANBURUN", "fiyat": 1163.523818177634}, {"il": "ANKARA", "ilce": "GÖLBAŞI", "mahalle": "EMİRLER", "fiyat": 1163.523818177634}, {"il": "ANKARA", "ilce": "GÖLBAŞI", "mahalle": "GÖKÇEHÜYÜK", "fiyat": 1163.523818177634}, {"il": "ANKARA", "ilce": "GÖLBAŞI", "mahalle": "HALAÇLI", "fiyat": 1163.523818177634}, {"il": "ANKARA", "ilce": "GÖLBAŞI", "mahalle": "KARAOĞLAN", "fiyat": 1163.523818177634}, {"il": "ANKARA", "ilce": "GÖLBAŞI", "mahalle": "OĞULBEY", "fiyat": 1163.523818177634}, {"il": "ANKARA", "ilce": "HAYMANA", "mahalle": "AHIRLIKUYU", "fiyat": 1163.523818177634}, {"il": "ANKARA", "ilce": "POLATLI", "mahalle": "KARAKUYU", "fiyat": 1163.523818177634}, {"il": "ANKARA", "ilce": "POLATLI", "mahalle": "YEŞİLÖZ", "fiyat": 1163.523818177634}, {"il": "BİLECİK", "ilce": "BOZÜYÜK", "mahalle": "ALİBEYDÜZÜ", "fiyat": 834.5274282101649}, {"il": "BİLECİK", "ilce": "BOZÜYÜK", "mahalle": "YENİ DODURGA", "fiyat": 834.5274282101649}, {"il": "ESKİŞEHİR", "ilce": "ÇİFTELER", "mahalle": "BELPINAR", "fiyat": 762.3087084612084}, {"il": "ESKİŞEHİR", "ilce": "ÇİFTELER", "mahalle": "DİKMEN", "fiyat": 762.3087084612084}, {"il": "ESKİŞEHİR", "ilce": "MAHMUDİYE", "mahalle": "AKYURT", "fiyat": 657.9927799349377}, {"il": "ESKİŞEHİR", "ilce": "MAHMUDİYE", "mahalle": "BALÇIKHİSAR", "fiyat": 657.9927799349377}, {"il": "ESKİŞEHİR", "ilce": "MAHMUDİYE", "mahalle": "ÇAL", "fiyat": 657.9927799349377}, {"il": "ESKİŞEHİR", "ilce": "MAHMUDİYE", "mahalle": "HAMİDİYE", "fiyat": 657.9927799349377}, {"il": "ESKİŞEHİR", "ilce": "MAHMUDİYE", "mahalle": "MERKEZ", "fiyat": 657.9927799349377}, {"il": "ESKİŞEHİR", "ilce": "MAHMUDİYE", "mahalle": "ŞEREFİYE", "fiyat": 657.9927799349377}, {"il": "ESKİŞEHİR", "ilce": "MAHMUDİYE", "mahalle": "TOKATHAN", "fiyat": 657.9927799349377}, {"il": "ESKİŞEHİR", "ilce": "MAHMUDİYE", "mahalle": "TOPKAYA", "fiyat": 657.9927799349377}, {"il": "ESKİŞEHİR", "ilce": "MAHMUDİYE", "mahalle": "YEŞİLYURT", "fiyat": 657.9927799349377}, {"il": "ESKİŞEHİR", "ilce": "ODUNPAZARI", "mahalle": "DEMİRLİ", "fiyat": 657.9927799349377}, {"il": "ESKİŞEHİR", "ilce": "ODUNPAZARI", "mahalle": "KARAPAZAR", "fiyat": 657.9927799349377}, {"il": "ESKİŞEHİR", "ilce": "ODUNPAZARI", "mahalle": "KARATEPE", "fiyat": 657.9927799349377}, {"il": "ESKİŞEHİR", "ilce": "ODUNPAZARI", "mahalle": "KIRAVDAN", "fiyat": 657.9927799349377}, {"il": "ESKİŞEHİR", "ilce": "ODUNPAZARI", "mahalle": "YASSIHÖYÜK", "fiyat": 657.9927799349377}, {"il": "ESKİŞEHİR", "ilce": "SEYİTGAZİ", "mahalle": "AYVALI", "fiyat": 657.9927799349377}, {"il": "ESKİŞEHİR", "ilce": "SEYİTGAZİ", "mahalle": "DEĞİŞÖREN", "fiyat": 657.9927799349377}, {"il": "ESKİŞEHİR", "ilce": "SEYİTGAZİ", "mahalle": "DOĞANÇAYIR", "fiyat": 657.9927799349377}, {"il": "ESKİŞEHİR", "ilce": "SEYİTGAZİ", "mahalle": "GÜMÜŞBEL", "fiyat": 657.9927799349377}, {"il": "ESKİŞEHİR", "ilce": "SİVRİHİSAR", "mahalle": "AKTAŞ", "fiyat": 738.2358018782227}, {"il": "ESKİŞEHİR", "ilce": "TEPEBAŞI", "mahalle": "BOYACIOĞLU", "fiyat": 738.2358018782227}, {"il": "ESKİŞEHİR", "ilce": "TEPEBAŞI", "mahalle": "GÜNDÜZLER", "fiyat": 738.2358018782227}, {"il": "ISPARTA", "ilce": "ŞARKİKARAAĞAÇ", "mahalle": "GÖKSÖĞÜT", "fiyat": 1219.6939335379332}, {"il": "ISPARTA", "ilce": "YALVAÇ", "mahalle": "SALUR", "fiyat": 1219.6939335379332}, {"il": "KAYSERİ", "ilce": "PINARBAŞI", "mahalle": "METHİYE", "fiyat": 1909.7839222501852}, {"il": "KAYSERİ", "ilce": "PINARBAŞI", "mahalle": "ÜÇPINAR", "fiyat": 1909.7839222501852}, {"il": "KAYSERİ", "ilce": "PINARBAŞI", "mahalle": "YAHYABEY", "fiyat": 1909.7839222501852}, {"il": "KONYA", "ilce": "KULU", "mahalle": "KÖMÜŞİNİ", "fiyat": 1315.9855598698755}, {"il": "KONYA", "ilce": "KULU", "mahalle": "KÖŞKER", "fiyat": 1315.9855598698755}, {"il": "KONYA", "ilce": "YUNAK", "mahalle": "KARATAŞ", "fiyat": 1179.5724225662905}, {"il": "KÜTAHYA", "ilce": "ALTINTAŞ", "mahalle": "AYKIRIKÇI", "fiyat": 978.9648677080779}, {"il": "KÜTAHYA", "ilce": "ALTINTAŞ", "mahalle": "OSMANİYE", "fiyat": 986.9891699024066}, {"il": "KÜTAHYA", "ilce": "ALTINTAŞ", "mahalle": "ÜÇHÜYÜK", "fiyat": 874.6489391818076}, {"il": "KÜTAHYA", "ilce": "ALTINTAŞ ", "mahalle": "ZAFERTEPEÇALKÖY", "fiyat": 1051.1835874570347}, {"il": "KÜTAHYA", "ilce": "DUMLUPINAR", "mahalle": "ALLIÖREN", "fiyat": 1051.1835874570347}, {"il": "KÜTAHYA", "ilce": "DUMLUPINAR", "mahalle": "HAMUR", "fiyat": 1051.1835874570347}, {"il": "KÜTAHYA", "ilce": "DUMLUPINAR", "mahalle": "KIZILCA", "fiyat": 1051.1835874570347}, {"il": "KÜTAHYA", "ilce": "DUMLUPINAR", "mahalle": "MERKEZ", "fiyat": 1051.1835874570347}, {"il": "KÜTAHYA", "ilce": "MERKEZ", "mahalle": "ULUKÖY", "fiyat": 1051.1835874570347}, {"il": "SİVAS", "ilce": "ALTINYAYLA", "mahalle": "ALTINYURT", "fiyat": 2093.7830376829274}, {"il": "SİVAS", "ilce": "ALTINYAYLA", "mahalle": "BAŞÖREN", "fiyat": 2093.7830376829274}, {"il": "SİVAS", "ilce": "ALTINYAYLA", "mahalle": "BAYINDIR", "fiyat": 2093.7830376829274}, {"il": "SİVAS", "ilce": "ALTINYAYLA", "mahalle": "DELİİLYAS", "fiyat": 2093.7830376829274}, {"il": "SİVAS", "ilce": "ALTINYAYLA", "mahalle": "MERKEZ", "fiyat": 2093.7830376829274}, {"il": "SİVAS", "ilce": "ALTINYAYLA", "mahalle": "MUTUBEY", "fiyat": 2093.7830376829274}, {"il": "SİVAS", "ilce": "ALTINYAYLA", "mahalle": "TAHTYURT", "fiyat": 2093.7830376829274}, {"il": "SİVAS", "ilce": "KANGAL", "mahalle": "BOZARMUT", "fiyat": 2151.259434795792}, {"il": "SİVAS", "ilce": "KANGAL", "mahalle": "ÇALTEPE", "fiyat": 2151.259434795792}, {"il": "SİVAS", "ilce": "KANGAL", "mahalle": "ÇAMURLU", "fiyat": 2151.259434795792}, {"il": "SİVAS", "ilce": "KANGAL", "mahalle": "ÇATKÖY", "fiyat": 2151.259434795792}, {"il": "SİVAS", "ilce": "KANGAL", "mahalle": "DELİKTAŞ", "fiyat": 2151.259434795792}, {"il": "SİVAS", "ilce": "KANGAL", "mahalle": "HAMAL", "fiyat": 2151.259434795792}, {"il": "SİVAS", "ilce": "KANGAL", "mahalle": "HATUNÇAYIRI", "fiyat": 2151.259434795792}, {"il": "SİVAS", "ilce": "KANGAL", "mahalle": "KIZILDİKME", "fiyat": 2151.259434795792}, {"il": "SİVAS", "ilce": "KANGAL", "mahalle": "MERKEZ", "fiyat": 2151.259434795792}, {"il": "SİVAS", "ilce": "KANGAL", "mahalle": "TAHTALI", "fiyat": 2151.259434795792}, {"il": "SİVAS", "ilce": "KANGAL", "mahalle": "TİLKİHÜYÜK", "fiyat": 2151.259434795792}, {"il": "SİVAS", "ilce": "KANGAL", "mahalle": "YAYLACIK", "fiyat": 2151.259434795792}, {"il": "SİVAS", "ilce": "ŞARKIŞLA", "mahalle": "CANABDAL GÜDÜL MEZRASI", "fiyat": 2093.7830376829274}, {"il": "SİVAS", "ilce": "ŞARKIŞLA", "mahalle": "İĞECİK", "fiyat": 2093.7830376829274}, {"il": "SİVAS", "ilce": "ŞARKIŞLA", "mahalle": "KAZANCIK", "fiyat": 2093.7830376829274}, {"il": "SİVAS", "ilce": "ULAŞ", "mahalle": "BOĞAZDERE", "fiyat": 2151.259434795792}, {"il": "SİVAS", "ilce": "ULAŞ", "mahalle": "KARACALAR", "fiyat": 2151.259434795792}, {"il": "SİVAS", "ilce": "ULAŞ", "mahalle": "KURTLUKAYA", "fiyat": 2151.259434795792}, {"il": "SİVAS", "ilce": "ULAŞ", "mahalle": "MERKEZ", "fiyat": 2151.259434795792}, {"il": "UŞAK", "ilce": "BANAZ", "mahalle": "ÇİFTLİK", "fiyat": 1207.004339370158}];
const ETI_YULAF_SATIS = [{"il": "AKSARAY", "ilce": "ORTAKÖY", "mahalle": "", "fiyat": 1595.1827452425377}, {"il": "AMASYA", "ilce": "MERKEZ", "mahalle": "", "fiyat": 1605.4397212393449}, {"il": "ANKARA", "ilce": "HAYMANA", "mahalle": "", "fiyat": 1092.5909213989985}, {"il": "ANKARA", "ilce": "AHİBOZ", "mahalle": "", "fiyat": 1376.6645609627383}, {"il": "ANKARA", "ilce": "ŞİMŞİR", "mahalle": "", "fiyat": 1376.6645609627383}, {"il": "ANKARA", "ilce": "BALA", "mahalle": "MERKEZ", "fiyat": 1442.2200162466781}, {"il": "ANKARA", "ilce": "POLATLI", "mahalle": "", "fiyat": 1081.6650121850087}, {"il": "DENİZLİ", "ilce": "SARAYKÖY", "mahalle": "", "fiyat": 1584.256836028548}, {"il": "DENİZLİ", "ilce": "BAKLAN", "mahalle": "", "fiyat": 1442.2200162466781}, {"il": "DENİZLİ", "ilce": "ÇARDAK", "mahalle": "", "fiyat": 1474.997743888648}, {"il": "EDİRNE", "ilce": "HAVSA", "mahalle": "", "fiyat": 2698.6995758555263}, {"il": "EDİRNE", "ilce": "LALAPAŞA", "mahalle": "", "fiyat": 2786.1068495674463}, {"il": "ESKİŞEHİR", "ilce": "ÇİFTELER", "mahalle": "", "fiyat": 871.2842361533781}, {"il": "KASTAMONU", "ilce": "TAŞKÖPRÜ", "mahalle": "ALATARLA", "fiyat": 2512.959119217697}, {"il": "KASTAMONU", "ilce": "TAŞKÖPRÜ", "mahalle": "ESKİATÇA", "fiyat": 2687.7736666415367}, {"il": "KIRKLARELİ", "ilce": "MERKEZ", "mahalle": "", "fiyat": 2458.3295731477474}, {"il": "KIRKLARELİ", "ilce": "KOFÇAZ", "mahalle": "", "fiyat": 2698.6995758555263}, {"il": "KIRKLARELİ", "ilce": "LÜLEBURGAZ", "mahalle": "", "fiyat": 2294.440934937897}, {"il": "KIRŞEHİR", "ilce": "KAMAN", "mahalle": "", "fiyat": 1617.0345636705179}, {"il": "KIRŞEHİR", "ilce": "MERKEZ", "mahalle": "", "fiyat": 1595.1827452425377}, {"il": "KIRŞEHİR", "ilce": "MUCUR", "mahalle": "", "fiyat": 1595.1827452425377}, {"il": "KIRŞEHİR", "ilce": "AKPINAR", "mahalle": "", "fiyat": 1442.2200162466781}, {"il": "KONYA", "ilce": "KULU", "mahalle": "", "fiyat": 1376.6645609627383}, {"il": "KONYA", "ilce": "CİHANBEYLİ", "mahalle": "BEYLİOVA", "fiyat": 1376.6645609627383}, {"il": "KONYA", "ilce": "CİHANBEYLİ", "mahalle": "PINARBAŞI", "fiyat": 1376.6645609627383}, {"il": "KONYA", "ilce": "CİHANBEYLİ", "mahalle": "BÖĞRÜDELİK", "fiyat": 1376.6645609627383}, {"il": "KONYA", "ilce": "SARAYÖNÜ", "mahalle": "BAŞHÜYÜK", "fiyat": 1442.2200162466781}, {"il": "KONYA", "ilce": "KADINHANI", "mahalle": "SARIKAYA", "fiyat": 1147.2204674689485}, {"il": "KONYA", "ilce": "SEYDİŞEHİR", "mahalle": "", "fiyat": 1584.256836028548}, {"il": "KONYA", "ilce": "BEYŞEHİR", "mahalle": "", "fiyat": 1540.5531991725882}, {"il": "KONYA", "ilce": "ILGIN", "mahalle": "", "fiyat": 1376.6645609627383}, {"il": "KONYA", "ilce": "ÇELTİK", "mahalle": "", "fiyat": 1081.6650121850087}, {"il": "KONYA", "ilce": "YUNAK", "mahalle": "", "fiyat": 1092.5909213989985}, {"il": "KONYA", "ilce": "MERAM", "mahalle": "", "fiyat": 1584.256836028548}, {"il": "KONYA", "ilce": "SELÇUKLU", "mahalle": "", "fiyat": 1540.5531991725882}, {"il": "KONYA", "ilce": "KARATAY", "mahalle": "", "fiyat": 1584.256836028548}, {"il": "KÜTAHYA", "ilce": "TAVŞANLI", "mahalle": "", "fiyat": 972.4059200451088}, {"il": "KÜTAHYA", "ilce": "ÇAVDARHİSAR", "mahalle": "", "fiyat": 1005.183647687079}, {"il": "KÜTAHYA", "ilce": "GEDİZ", "mahalle": "", "fiyat": 1092.5909213989985}, {"il": "TEKİRDAĞ", "ilce": "HAYRABOLU", "mahalle": "", "fiyat": 2458.3295731477474}, {"il": "TEKİRDAĞ", "ilce": "MALKARA", "mahalle": "", "fiyat": 2458.3295731477474}, {"il": "TOKAT", "ilce": "MERKEZ", "mahalle": "", "fiyat": 1605.4397212393449}, {"il": "YOZGAT", "ilce": "SARIKAYA", "mahalle": "BEBEK KÖYÜ", "fiyat": 2152.4041151560273}, {"il": "YOZGAT", "ilce": "SORGUN", "mahalle": "", "fiyat": 2152.4041151560273}, {"il": "YOZGAT", "ilce": "AKDAĞMADEN", "mahalle": "", "fiyat": 2152.4041151560273}, {"il": "YOZGAT", "ilce": "MERKEZ", "mahalle": "", "fiyat": 1672.3330429576513}];
const ETI_YULAF_ALIS = [{"il": "AKSARAY", "ilce": "ORTAKÖY", "mahalle": "", "fiyat": 1308.049851098881}, {"il": "AMASYA", "ilce": "MERKEZ", "mahalle": "", "fiyat": 1316.4605714162626}, {"il": "ANKARA", "ilce": "HAYMANA", "mahalle": "", "fiyat": 895.9245555471787}, {"il": "ANKARA", "ilce": "AHİBOZ", "mahalle": "", "fiyat": 1128.8649399894452}, {"il": "ANKARA", "ilce": "ŞİMŞİR", "mahalle": "", "fiyat": 1128.8649399894452}, {"il": "ANKARA", "ilce": "BALA", "mahalle": "MERKEZ", "fiyat": 1182.620413322276}, {"il": "ANKARA", "ilce": "POLATLI", "mahalle": "", "fiyat": 886.965309991707}, {"il": "DENİZLİ", "ilce": "SARAYKÖY", "mahalle": "", "fiyat": 1299.0906055434093}, {"il": "DENİZLİ", "ilce": "BAKLAN", "mahalle": "", "fiyat": 1182.620413322276}, {"il": "DENİZLİ", "ilce": "ÇARDAK", "mahalle": "", "fiyat": 1209.4981499886912}, {"il": "EDİRNE", "ilce": "HAVSA", "mahalle": "", "fiyat": 2212.9336522015315}, {"il": "EDİRNE", "ilce": "LALAPAŞA", "mahalle": "", "fiyat": 2284.607616645306}, {"il": "ESKİŞEHİR", "ilce": "ÇİFTELER", "mahalle": "", "fiyat": 714.45307364577}, {"il": "KASTAMONU", "ilce": "TAŞKÖPRÜ", "mahalle": "ALATARLA", "fiyat": 2060.6264777585116}, {"il": "KASTAMONU", "ilce": "TAŞKÖPRÜ", "mahalle": "ESKİATÇA", "fiyat": 2203.97440664606}, {"il": "KIRKLARELİ", "ilce": "MERKEZ", "mahalle": "", "fiyat": 2015.8302499811527}, {"il": "KIRKLARELİ", "ilce": "KOFÇAZ", "mahalle": "", "fiyat": 2212.9336522015315}, {"il": "KIRKLARELİ", "ilce": "LÜLEBURGAZ", "mahalle": "", "fiyat": 1881.4415666490754}, {"il": "KIRŞEHİR", "ilce": "KAMAN", "mahalle": "", "fiyat": 1325.9683422098246}, {"il": "KIRŞEHİR", "ilce": "MERKEZ", "mahalle": "", "fiyat": 1308.049851098881}, {"il": "KIRŞEHİR", "ilce": "MUCUR", "mahalle": "", "fiyat": 1308.049851098881}, {"il": "KIRŞEHİR", "ilce": "AKPINAR", "mahalle": "", "fiyat": 1182.620413322276}, {"il": "KONYA", "ilce": "KULU", "mahalle": "", "fiyat": 1128.8649399894452}, {"il": "KONYA", "ilce": "CİHANBEYLİ", "mahalle": "BEYLİOVA", "fiyat": 1128.8649399894452}, {"il": "KONYA", "ilce": "CİHANBEYLİ", "mahalle": "PINARBAŞI", "fiyat": 1128.8649399894452}, {"il": "KONYA", "ilce": "CİHANBEYLİ", "mahalle": "BÖĞRÜDELİK", "fiyat": 1128.8649399894452}, {"il": "KONYA", "ilce": "SARAYÖNÜ", "mahalle": "BAŞHÜYÜK", "fiyat": 1182.620413322276}, {"il": "KONYA", "ilce": "KADINHANI", "mahalle": "SARIKAYA", "fiyat": 940.7207833245377}, {"il": "KONYA", "ilce": "SEYDİŞEHİR", "mahalle": "", "fiyat": 1299.0906055434093}, {"il": "KONYA", "ilce": "BEYŞEHİR", "mahalle": "", "fiyat": 1263.2536233215221}, {"il": "KONYA", "ilce": "ILGIN", "mahalle": "", "fiyat": 1128.8649399894452}, {"il": "KONYA", "ilce": "ÇELTİK", "mahalle": "", "fiyat": 886.965309991707}, {"il": "KONYA", "ilce": "YUNAK", "mahalle": "", "fiyat": 895.9245555471787}, {"il": "KONYA", "ilce": "MERAM", "mahalle": "", "fiyat": 1299.0906055434093}, {"il": "KONYA", "ilce": "SELÇUKLU", "mahalle": "", "fiyat": 1263.2536233215221}, {"il": "KONYA", "ilce": "KARATAY", "mahalle": "", "fiyat": 1299.0906055434093}, {"il": "KÜTAHYA", "ilce": "TAVŞANLI", "mahalle": "", "fiyat": 797.3728544369892}, {"il": "KÜTAHYA", "ilce": "ÇAVDARHİSAR", "mahalle": "", "fiyat": 824.2505911034048}, {"il": "KÜTAHYA", "ilce": "GEDİZ", "mahalle": "", "fiyat": 895.9245555471787}, {"il": "TEKİRDAĞ", "ilce": "HAYRABOLU", "mahalle": "", "fiyat": 2015.8302499811527}, {"il": "TEKİRDAĞ", "ilce": "MALKARA", "mahalle": "", "fiyat": 2015.8302499811527}, {"il": "TOKAT", "ilce": "MERKEZ", "mahalle": "", "fiyat": 1316.4605714162626}, {"il": "YOZGAT", "ilce": "SARIKAYA", "mahalle": "BEBEK KÖYÜ", "fiyat": 1764.9713744279422}, {"il": "YOZGAT", "ilce": "SORGUN", "mahalle": "", "fiyat": 1764.9713744279422}, {"il": "YOZGAT", "ilce": "AKDAĞMADEN", "mahalle": "", "fiyat": 1764.9713744279422}, {"il": "YOZGAT", "ilce": "MERKEZ", "mahalle": "", "fiyat": 1371.313095225274}];
const ETI_BUGDAY_SATIS = [{"il": "KIRŞEHİR", "ilce": "MERKEZ", "mahalle": "", "fiyat": 1194.448104280258}, {"il": "KIRŞEHİR", "ilce": "KAMAN", "mahalle": "", "fiyat": 1194.448104280258}, {"il": "KIRŞEHİR", "ilce": "MUCUR", "mahalle": "", "fiyat": 1267.6667895380597}, {"il": "KIRŞEHİR", "ilce": "AKPINAR", "mahalle": "", "fiyat": 1267.6667895380597}, {"il": "KONYA", "ilce": "KULU", "mahalle": "", "fiyat": 1086.2593006903717}, {"il": "KONYA", "ilce": "CİHANBEYLİ", "mahalle": "BEYLİOVA", "fiyat": 1055.6604471497978}, {"il": "KONYA", "ilce": "CİHANBEYLİ", "mahalle": "PINARBAŞI", "fiyat": 1055.6604471497978}, {"il": "KONYA", "ilce": "CİHANBEYLİ", "mahalle": "BÖĞRÜDELİK", "fiyat": 1055.6604471497978}, {"il": "KONYA", "ilce": "SARAYÖNÜ", "mahalle": "BAŞHÜYÜK", "fiyat": 1158.385169750296}, {"il": "KONYA", "ilce": "KADINHANI", "mahalle": "SARIKAYA", "fiyat": 1055.6604471497978}, {"il": "KONYA", "ilce": "SEYDİŞEHİR", "mahalle": "", "fiyat": 1194.448104280258}, {"il": "KONYA", "ilce": "BEYŞEHİR", "mahalle": "", "fiyat": 1232.6966712059752}, {"il": "KONYA", "ilce": "ILGIN", "mahalle": "", "fiyat": 1068.7742415243297}, {"il": "AMASYA", "ilce": "MERKEZ", "mahalle": "", "fiyat": 1756.1556299893634}, {"il": "TOKAT", "ilce": "MERKEZ", "mahalle": "", "fiyat": 1900.4073681092118}, {"il": "YOZGAT", "ilce": "MERKEZ", "mahalle": "", "fiyat": 1900.4073681092118}, {"il": "DENİZLİ", "ilce": "SARAYKÖY", "mahalle": "", "fiyat": 1213.0259796441778}, {"il": "DENİZLİ", "ilce": "ÇARDAK", "mahalle": "", "fiyat": 1158.385169750296}, {"il": "DENİZLİ", "ilce": "BAKLAN", "mahalle": "", "fiyat": 1068.7742415243297}, {"il": "AYDIN", "ilce": "BUHARKENT", "mahalle": "", "fiyat": 1158.385169750296}, {"il": "KÜTAHYA", "ilce": "TAVŞANLI", "mahalle": "", "fiyat": 760.6000737228358}, {"il": "KÜTAHYA", "ilce": "ÇAVDARHİSAR", "mahalle": "", "fiyat": 760.6000737228358}, {"il": "KÜTAHYA", "ilce": "GEDİZ", "mahalle": "", "fiyat": 779.1779490867557}, {"il": "ANKARA", "ilce": "HAYMANA", "mahalle": "", "fiyat": 868.788877312722}, {"il": "ANKARA", "ilce": "AHİBOZ", "mahalle": "", "fiyat": 1158.385169750296}, {"il": "KONYA", "ilce": "ÇELTİK", "mahalle": "", "fiyat": 760.6000737228358}, {"il": "KONYA", "ilce": "YUNAK", "mahalle": "", "fiyat": 842.5612885636589}, {"il": "KONYA", "ilce": "MERAM", "mahalle": "", "fiyat": 1194.448104280258}, {"il": "KONYA", "ilce": "SELÇUKLU", "mahalle": "", "fiyat": 1176.963045114216}, {"il": "KONYA", "ilce": "KARATAY", "mahalle": "", "fiyat": 1267.6667895380597}];
const ETI_BUGDAY_ALIS = [{"il": "KIRŞEHİR", "ilce": "MERKEZ", "mahalle": "", "fiyat": 979.4474455098114}, {"il": "KIRŞEHİR", "ilce": "KAMAN", "mahalle": "", "fiyat": 979.4474455098114}, {"il": "KIRŞEHİR", "ilce": "MUCUR", "mahalle": "", "fiyat": 1039.486767421209}, {"il": "KIRŞEHİR", "ilce": "AKPINAR", "mahalle": "", "fiyat": 1039.486767421209}, {"il": "KONYA", "ilce": "KULU", "mahalle": "", "fiyat": 890.7326265661047}, {"il": "KONYA", "ilce": "CİHANBEYLİ", "mahalle": "BEYLİOVA", "fiyat": 865.6415666628342}, {"il": "KONYA", "ilce": "CİHANBEYLİ", "mahalle": "PINARBAŞI", "fiyat": 865.6415666628342}, {"il": "KONYA", "ilce": "CİHANBEYLİ", "mahalle": "BÖĞRÜDELİK", "fiyat": 865.6415666628342}, {"il": "KONYA", "ilce": "SARAYÖNÜ", "mahalle": "BAŞHÜYÜK", "fiyat": 949.8758391952426}, {"il": "KONYA", "ilce": "KADINHANI", "mahalle": "SARIKAYA", "fiyat": 865.6415666628342}, {"il": "KONYA", "ilce": "SEYDİŞEHİR", "mahalle": "", "fiyat": 979.4474455098114}, {"il": "KONYA", "ilce": "BEYŞEHİR", "mahalle": "", "fiyat": 1010.8112703888996}, {"il": "KONYA", "ilce": "ILGIN", "mahalle": "", "fiyat": 876.3948780499503}, {"il": "AMASYA", "ilce": "MERKEZ", "mahalle": "", "fiyat": 1440.047616591278}, {"il": "TOKAT", "ilce": "MERKEZ", "mahalle": "", "fiyat": 1558.3340418495536}, {"il": "YOZGAT", "ilce": "MERKEZ", "mahalle": "", "fiyat": 1558.3340418495536}, {"il": "DENİZLİ", "ilce": "SARAYKÖY", "mahalle": "", "fiyat": 994.6813033082258}, {"il": "DENİZLİ", "ilce": "ÇARDAK", "mahalle": "", "fiyat": 949.8758391952426}, {"il": "DENİZLİ", "ilce": "BAKLAN", "mahalle": "", "fiyat": 876.3948780499503}, {"il": "AYDIN", "ilce": "BUHARKENT", "mahalle": "", "fiyat": 949.8758391952426}, {"il": "KÜTAHYA", "ilce": "TAVŞANLI", "mahalle": "", "fiyat": 623.6920604527253}, {"il": "KÜTAHYA", "ilce": "ÇAVDARHİSAR", "mahalle": "", "fiyat": 623.6920604527253}, {"il": "KÜTAHYA", "ilce": "GEDİZ", "mahalle": "", "fiyat": 638.9259182511396}, {"il": "ANKARA", "ilce": "HAYMANA", "mahalle": "", "fiyat": 712.406879396432}, {"il": "ANKARA", "ilce": "AHİBOZ", "mahalle": "", "fiyat": 949.8758391952426}, {"il": "KONYA", "ilce": "ÇELTİK", "mahalle": "", "fiyat": 623.6920604527253}, {"il": "KONYA", "ilce": "YUNAK", "mahalle": "", "fiyat": 690.9002566222002}, {"il": "KONYA", "ilce": "MERAM", "mahalle": "", "fiyat": 979.4474455098114}, {"il": "KONYA", "ilce": "SELÇUKLU", "mahalle": "", "fiyat": 965.1096969936569}, {"il": "KONYA", "ilce": "KARATAY", "mahalle": "", "fiyat": 1039.486767421209}];
const ETI_EK_SATIS = [{"il": "KAYSERİ", "ilce": "BÜNYAN", "fiyat": 2329.0003262513524}, {"il": "KAYSERİ", "ilce": "PINARBAŞI", "fiyat": 2329.0003262513524}, {"il": "AKSARAY", "ilce": "MERKEZ", "fiyat": 1594.278705340041}, {"il": "SİVAS", "ilce": "ŞARKIŞLA", "fiyat": 2553.3921866202195}, {"il": "SİVAS", "ilce": "KANGAL", "fiyat": 2623.4831015003133}, {"il": "KAHRAMANMARAŞ", "ilce": "MERKEZ", "fiyat": 2638.0151239439524}, {"il": "SİVAS", "ilce": "ULAŞ", "fiyat": 2445.041387705417}];
const ETI_EK_ALIS = [{"il": "KAYSERİ", "ilce": "BÜNYAN", "fiyat": 1909.780267526109}, {"il": "KAYSERİ", "ilce": "PINARBAŞI", "fiyat": 1909.780267526109}, {"il": "AKSARAY", "ilce": "MERKEZ", "fiyat": 1307.3085383788334}, {"il": "SİVAS", "ilce": "ŞARKIŞLA", "fiyat": 2093.7815930285797}, {"il": "SİVAS", "ilce": "KANGAL", "fiyat": 2151.256143230257}, {"il": "KAHRAMANMARAŞ", "ilce": "MERKEZ", "fiyat": 2163.172401634041}, {"il": "SİVAS", "ilce": "ULAŞ", "fiyat": 2004.9339379184419}];

const ETI_TABS = [
  { key: "seker", label: "Şeker" },
  { key: "ciftci", label: "Çiftçi Listesi" },
  { key: "yulaf", label: "Yulaf Tedarikçi" },
  { key: "bugday", label: "Buğday Tedarikçi" },
  { key: "ek", label: "Ek Rotalar" },
];

/* =========================================================
   EFOR ÇAY TARİFELERİ
   Kaynak: efor çay.xlsx
   Format: Yükleme | Varış | Araç Tipi | TIR Fiyatı
========================================================= */
const EFOR_CAY_TARIFELERI = [{"yukleme": "ARTVİN -ARHAVİ", "varis": "TOKAT -ERBAA", "aracTipi": "TIR", "tir": 23493.31973102432}, {"yukleme": "RİZE-PAZAR", "varis": "TOKAT -ERBAA", "aracTipi": "TIR", "tir": 22856.806577008105}, {"yukleme": "RİZE -KALKANDERE", "varis": "TOKAT -ERBAA", "aracTipi": "TIR", "tir": 22856.806577008105}, {"yukleme": "TRABZON-ESKİPAZAR", "varis": "TOKAT -ERBAA", "aracTipi": "TIR", "tir": 21120.838559322034}, {"yukleme": "TRABZON-OF", "varis": "TOKAT -ERBAA", "aracTipi": "TIR", "tir": 21120.838559322034}];

/* TEVERPAN - 15.09.2026 fiyat listesi */


/* BİM - bim.xlsx / TIR fiyat matrisi */
const BIM_DESTINATIONS = ["ADANA","AYDIN","ÇORLU","DENİZLİ","KAYSERİ","MARAŞ","ÇORUM"];
const BIM_TARIFELERI = [{"sira":1,"cikis":"ADANA-2","fiyatlar":{"ADANA":8295.915893586762,"AYDIN":38718.70042905173,"ÇORLU":53989.29391064402,"DENİZLİ":34629.94369611815,"KAYSERİ":20802.310642061835,"MARAŞ":19358.24364978082,"ÇORUM":39779.896019547894}},{"sira":2,"cikis":"AFYON","fiyatlar":{"ADANA":34629.94369611815,"AYDIN":26332.92123778634,"ÇORLU":38718.70042905173,"DENİZLİ":19358.24364978082,"KAYSERİ":30420.571405974883,"MARAŞ":45692.271452312205,"ÇORUM":44851.28224607959}},{"sira":3,"cikis":"AKHİSAR","fiyatlar":{"ADANA":41482.89916216894,"AYDIN":15270.59348159228,"ÇORLU":30420.571405974883,"DENİZLİ":16595.15148140865,"KAYSERİ":35952.28856644443,"MARAŞ":55311.6387809703,"ÇORUM":51275.997155798774}},{"sira":4,"cikis":"AKSARAY","fiyatlar":{"ADANA":16595.15148140865,"AYDIN":48458.6833149195,"ÇORLU":49781.02818524579,"DENİZLİ":33185.87670383714,"KAYSERİ":12506.39474847507,"MARAŞ":30420.571405974883,"ÇORUM":31553.69370489883}},{"sira":5,"cikis":"BAFRA","fiyatlar":{"ADANA":37395.2489939804,"AYDIN":48458.6833149195,"ÇORLU":45692.271452312205,"DENİZLİ":45692.271452312205,"KAYSERİ":24889.960810250377,"MARAŞ":41482.89916216894,"ÇORUM":25694.433379896574}},{"sira":6,"cikis":"BALIKESİR","fiyatlar":{"ADANA":41482.89916216894,"AYDIN":22124.65551238812,"ÇORLU":29098.226535648595,"DENİZLİ":22124.65551238812,"KAYSERİ":38718.70042905173,"MARAŞ":52545.226918363005,"ÇORUM":54093.31099667805}},{"sira":7,"cikis":"BATMAN","fiyatlar":{"ADANA":27656.372672857673,"AYDIN":71905.68369763391,"ÇORLU":66373.96653716436,"DENİZLİ":59522.11763585861,"KAYSERİ":38718.70042905173,"MARAŞ":22932.44777626945,"ÇORUM":59727.938678436585}},{"sira":8,"cikis":"ÇANAKKALE","fiyatlar":{"ADANA":58076.94407883255,"AYDIN":33185.87670383714,"ÇORLU":22124.65551238812,"DENİZLİ":40161.660856587696,"KAYSERİ":55311.6387809703,"MARAŞ":65051.621666838066,"ÇORUM":66600.81230989816}},{"sira":9,"cikis":"ÇORLU","fiyatlar":{"ADANA":48458.6833149195,"AYDIN":33185.87670383714,"ÇORLU":9019.609236844832,"DENİZLİ":33185.87670383714,"KAYSERİ":41482.89916216894,"MARAŞ":58076.94407883255,"ÇORUM":56346.276817585436}},{"sira":10,"cikis":"ÇUMRA","fiyatlar":{"ADANA":22932.44777626945,"AYDIN":34708.509793016194,"ÇORLU":44625.54303809083,"DENİZLİ":32229.804764120054,"KAYSERİ":19214.39023292524,"MARAŞ":33185.87670383714,"ÇORUM":41696.466157962226}},{"sira":11,"cikis":"DİYARBAKIR","fiyatlar":{"ADANA":24889.960810250377,"AYDIN":65051.621666838066,"ÇORLU":62285.209804230784,"DENİZLİ":55311.6387809703,"KAYSERİ":30420.571405974883,"MARAŞ":27656.372672857673,"ÇORUM":56346.276817585436}},{"sira":12,"cikis":"DÖŞEMEALTI","fiyatlar":{"ADANA":30990.452249671984,"AYDIN":22124.65551238812,"ÇORLU":45692.271452312205,"DENİZLİ":16595.15148140865,"KAYSERİ":27656.372672857673,"MARAŞ":37395.2489939804,"ÇORUM":50711.64913582688}},{"sira":13,"cikis":"ELAZIĞ","fiyatlar":{"ADANA":29130.316913254843,"AYDIN":62285.209804230784,"ÇORLU":60842.24937669481,"DENİZLİ":60842.24937669481,"KAYSERİ":33185.87670383714,"MARAŞ":27656.372672857673,"ÇORUM":53866.465223944244}},{"sira":14,"cikis":"ERZURUM","fiyatlar":{"ADANA":45692.271452312205,"AYDIN":60842.24937669481,"ÇORLU":59522.11763585861,"DENİZLİ":58076.94407883255,"KAYSERİ":24889.960810250377,"MARAŞ":33185.87670383714,"ÇORUM":45077.021454068345}},{"sira":15,"cikis":"ESKİŞEHİR","fiyatlar":{"ADANA":33185.87670383714,"AYDIN":31865.744963000936,"ÇORLU":29098.226535648595,"DENİZLİ":24889.960810250377,"KAYSERİ":30420.571405974883,"MARAŞ":44250.41758952128,"ÇORUM":38315.910861856115}},{"sira":16,"cikis":"GAZİANTEP 1 ","fiyatlar":{"ADANA":13636.19735316389,"AYDIN":59522.11763585861,"ÇORLU":55311.6387809703,"DENİZLİ":45692.271452312205,"KAYSERİ":20802.310642061835,"MARAŞ":11061.221191449018,"ÇORUM":41021.461663486036}},{"sira":17,"cikis":"GAZİANTEP 2 ","fiyatlar":{"ADANA":13636.19735316389,"AYDIN":59522.11763585861,"ÇORLU":55311.6387809703,"DENİZLİ":45692.271452312205,"KAYSERİ":20802.310642061835,"MARAŞ":11061.221191449018,"ÇORUM":41021.461663486036}},{"sira":18,"cikis":"GEBZE ","fiyatlar":{"ADANA":38718.70042905173,"AYDIN":37395.2489939804,"ÇORLU":20802.310642061835,"DENİZLİ":30420.571405974883,"KAYSERİ":38718.70042905173,"MARAŞ":44250.41758952128,"ÇORUM":38428.78046585048}},{"sira":19,"cikis":"IĞDIR","fiyatlar":{"ADANA":49781.02818524579,"AYDIN":69139.27183502661,"ÇORLU":69139.27183502661,"DENİZLİ":65051.621666838066,"KAYSERİ":41527.161751970656,"MARAŞ":44250.41758952128,"ÇORUM":53866.465223944244}},{"sira":20,"cikis":"İZMİT","fiyatlar":{"ADANA":38718.70042905173,"AYDIN":37395.2489939804,"ÇORLU":22124.65551238812,"DENİZLİ":30420.571405974883,"KAYSERİ":34088.83353579216,"MARAŞ":44250.41758952128,"ÇORUM":37187.214821912334}},{"sira":21,"cikis":"KEMALPAŞA -1 ","fiyatlar":{"ADANA":40161.660856587696,"AYDIN":12506.39474847507,"ÇORLU":30420.571405974883,"DENİZLİ":15270.59348159228,"KAYSERİ":34629.94369611815,"MARAŞ":58076.94407883255,"ÇORUM":51275.997155798774}},{"sira":22,"cikis":"KEMALPAŞA -2 ","fiyatlar":{"ADANA":40161.660856587696,"AYDIN":12506.39474847507,"ÇORLU":30420.571405974883,"DENİZLİ":15270.59348159228,"KAYSERİ":34629.94369611815,"MARAŞ":58076.94407883255,"ÇORUM":51275.997155798774}},{"sira":23,"cikis":"KESTEL","fiyatlar":{"ADANA":37187.214821912334,"AYDIN":29098.226535648595,"ÇORLU":31865.744963000936,"DENİZLİ":28511.74722077585,"KAYSERİ":38718.70042905173,"MARAŞ":49781.02818524579,"ÇORUM":45077.021454068345}},{"sira":24,"cikis":"KONYA","fiyatlar":{"ADANA":23552.124033493485,"AYDIN":34088.83353579216,"ÇORLU":43387.29708838781,"DENİZLİ":28511.74722077585,"KAYSERİ":19214.39023292524,"MARAŞ":30990.452249671984,"ÇORUM":39442.3937723098}},{"sira":25,"cikis":"MERSİN","fiyatlar":{"ADANA":9296.250423105561,"AYDIN":35329.29261498527,"ÇORLU":50204.84248259723,"DENİZLİ":34088.83353579216,"KAYSERİ":19214.39023292524,"MARAŞ":21570.26657512162,"ÇORUM":39779.896019547894}},{"sira":26,"cikis":"MUĞLA","fiyatlar":{"ADANA":41482.89916216894,"AYDIN":13636.19735316389,"ÇORLU":34629.94369611815,"DENİZLİ":15270.59348159228,"KAYSERİ":43387.29708838781,"MARAŞ":52545.226918363005,"ÇORUM":58937.851450475944}},{"sira":27,"cikis":"PİRAZİZ","fiyatlar":{"ADANA":41482.89916216894,"AYDIN":51222.882048036714,"ÇORLU":45692.271452312205,"DENİZLİ":47014.616322638496,"KAYSERİ":29098.226535648595,"MARAŞ":41482.89916216894,"ÇORUM":27046.655498339023}},{"sira":28,"cikis":"SAKARYA","fiyatlar":{"ADANA":38718.70042905173,"AYDIN":40161.660856587696,"ÇORLU":24889.960810250377,"DENİZLİ":26033.042191879707,"KAYSERİ":35952.28856644443,"MARAŞ":44250.41758952128,"ÇORUM":35950.07543695434}},{"sira":29,"cikis":"SAMSUN","fiyatlar":{"ADANA":34629.94369611815,"AYDIN":45692.271452312205,"ÇORLU":44250.41758952128,"DENİZLİ":42926.96615444995,"KAYSERİ":22124.65551238812,"MARAŞ":38718.70042905173,"ÇORUM":24342.211261454133}},{"sira":30,"cikis":"SANCAKTEPE","fiyatlar":{"ADANA":41482.89916216894,"AYDIN":37395.2489939804,"ÇORLU":20802.310642061835,"DENİZLİ":33185.87670383714,"KAYSERİ":41482.89916216894,"MARAŞ":47014.616322638496,"ÇORUM":39779.896019547894}},{"sira":31,"cikis":"SİVAS","fiyatlar":{"ADANA":25412.25936991063,"AYDIN":57022.38787680665,"ÇORLU":50824.51873982126,"DENİZLİ":40907.48549474663,"KAYSERİ":15496.332689581039,"MARAŞ":24792.5831126866,"ÇORUM":28172.031844047673}},{"sira":32,"cikis":"ŞANLIURFA","fiyatlar":{"ADANA":20802.310642061835,"AYDIN":59522.11763585861,"ÇORLU":58076.94407883255,"DENİZLİ":51222.882048036714,"KAYSERİ":24889.960810250377,"MARAŞ":16595.15148140865,"ÇORUM":44851.28224607959}},{"sira":33,"cikis":"TARSUS","fiyatlar":{"ADANA":8058.004473402535,"AYDIN":36568.64512943333,"ÇORLU":50204.84248259723,"DENİZLİ":34708.509793016194,"KAYSERİ":19832.959925404233,"MARAŞ":21693.09526182138,"ÇORUM":39779.896019547894}},{"sira":34,"cikis":"ULUKENT ","fiyatlar":{"ADANA":40161.660856587696,"AYDIN":13827.633054056316,"ÇORLU":30420.571405974883,"DENİZLİ":16595.15148140865,"KAYSERİ":34629.94369611815,"MARAŞ":58076.94407883255,"ÇORUM":53866.465223944244}},{"sira":35,"cikis":"ÇORUM","fiyatlar":{"ADANA":29098.226535648595,"AYDIN":41482.89916216894,"ÇORLU":40161.660856587696,"DENİZLİ":35952.28856644443,"KAYSERİ":19358.24364978082,"MARAŞ":30420.571405974883,"ÇORUM":10254.535492312729}},{"sira":36,"cikis":"MALATYA","fiyatlar":{"ADANA":27608.790388820824,"AYDIN":65361.45979545009,"ÇORLU":70997.19404195368,"DENİZLİ":59727.938678436585,"KAYSERİ":28172.031844047673,"MARAŞ":25355.82456791344,"ÇORUM":40568.8766827635}},{"sira":37,"cikis":"AYDIN","fiyatlar":{"ADANA":52964.614956734265,"AYDIN":12394.631709225736,"ÇORLU":45077.021454068345,"DENİZLİ":18595.82054044625,"KAYSERİ":49585.1662253732,"MARAŞ":65361.45979545009,"ÇORUM":53866.465223944244}},{"sira":38,"cikis":"VAN","fiyatlar":{"ADANA":45288.37532037155,"AYDIN":69139.27183502661,"ÇORLU":69139.27183502661,"DENİZLİ":65051.621666838066,"KAYSERİ":41803.80293823139,"MARAŞ":42965.69592052645,"ÇORUM":48771.84113776664}},{"sira":39,"cikis":"TURGUTLU","fiyatlar":{"ADANA":41482.89916216894,"AYDIN":15270.59348159228,"ÇORLU":30420.571405974883,"DENİZLİ":16595.15148140865,"KAYSERİ":35952.28856644443,"MARAŞ":55311.6387809703,"ÇORUM":51275.997155798774}}];
const TEVERPAN_TARIFELERI = [{"no": 1, "il": "ADANA", "ilce": "ADANA", "guncelSatis": 2.44}, {"no": 2, "il": "ADIYAMAN", "ilce": "ADIYAMAN", "guncelSatis": 3.01}, {"no": 3, "il": "AFYON", "ilce": "SANDIKLI", "guncelSatis": 1.51}, {"no": null, "il": "AFYON", "ilce": "MERKEZ", "guncelSatis": 1.33}, {"no": null, "il": "AFYON", "ilce": "DİNAR", "guncelSatis": 1.33}, {"no": 4, "il": "AĞRI", "ilce": "AĞRI", "guncelSatis": 4.43}, {"no": 5, "il": "AMASYA", "ilce": "MERKEZ", "guncelSatis": 2}, {"no": null, "il": "AMASYA", "ilce": "MERZİFON", "guncelSatis": 1.86}, {"no": 6, "il": "ANKARA", "ilce": "ÇUBUK", "guncelSatis": 1.51}, {"no": null, "il": "ANKARA", "ilce": "GÖLBAŞI", "guncelSatis": 1.51}, {"no": null, "il": "ANKARA", "ilce": "MERKEZ", "guncelSatis": 1.46}, {"no": null, "il": "ANKARA", "ilce": "POLATLI", "guncelSatis": 1.55}, {"no": null, "il": "ANKARA", "ilce": "AKYURT", "guncelSatis": 1.51}, {"no": null, "il": "ANKARA", "ilce": "BALA", "guncelSatis": 1.55}, {"no": 7, "il": "ANTALYA", "ilce": "ALANYA", "guncelSatis": 2.53}, {"no": null, "il": "ANTALYA", "ilce": "MERKEZ", "guncelSatis": 2.22}, {"no": null, "il": "ANTALYA", "ilce": "MANAVGAT", "guncelSatis": 2.44}, {"no": null, "il": "ANTALYA", "ilce": "KEPEZ", "guncelSatis": 2.44}, {"no": 8, "il": "ARTVİN", "ilce": "ARTVİN", "guncelSatis": 3.99}, {"no": 9, "il": "AYDIN", "ilce": "KUŞADASI", "guncelSatis": 1.69}, {"no": null, "il": "AYDIN", "ilce": "SÖKE", "guncelSatis": 2}, {"no": null, "il": "AYDIN", "ilce": "MERKEZ", "guncelSatis": 1.69}, {"no": null, "il": "AYDIN", "ilce": "DİDİM", "guncelSatis": 1.69}, {"no": null, "il": "AYDIN", "ilce": "NAZİLLİ", "guncelSatis": 1.69}, {"no": 10, "il": "BALIKESİR", "ilce": "BANDIRMA", "guncelSatis": 1.07}, {"no": null, "il": "BALIKESİR", "ilce": "MERKEZ", "guncelSatis": 1.07}, {"no": null, "il": "BALIKESİR", "ilce": "BİGADİÇ", "guncelSatis": 1.11}, {"no": null, "il": "BALIKESİR", "ilce": "GÖNEN", "guncelSatis": 1.29}, {"no": null, "il": "BALIKESİR", "ilce": "AYVALIK", "guncelSatis": 1.29}, {"no": null, "il": "BALIKESİR", "ilce": "BURHANİYE", "guncelSatis": 1.29}, {"no": null, "il": "BALIKESİR", "ilce": "EDREMİT", "guncelSatis": 1.29}, {"no": null, "il": "BALIKESİR", "ilce": "DURSUNBEY", "guncelSatis": 1.29}, {"no": 11, "il": "BİLECİK", "ilce": "BİLECİK", "guncelSatis": 1.11}, {"no": 12, "il": "BİNGÖL", "ilce": "BİNGÖL", "guncelSatis": 4.21}, {"no": 13, "il": "BİTLİS", "ilce": "BİTLİS", "guncelSatis": 4.21}, {"no": 14, "il": "BOLU", "ilce": "BOLU", "guncelSatis": 1.33}, {"no": 15, "il": "BURDUR", "ilce": "BURDUR", "guncelSatis": 1.77}, {"no": 16, "il": "BURSA", "ilce": "İNEGÖL", "guncelSatis": 1.07}, {"no": null, "il": "BURSA", "ilce": "MERKEZ", "guncelSatis": 0.98}, {"no": null, "il": "BURSA", "ilce": "KARACABEY", "guncelSatis": 0.98}, {"no": null, "il": "BURSA", "ilce": "MUSTAFAKEMALPAŞA", "guncelSatis": 1.02}, {"no": 17, "il": "ÇANAKKALE", "ilce": "MERKEZ", "guncelSatis": 0.89}, {"no": null, "il": "ÇANAKKALE", "ilce": "BİGA", "guncelSatis": 0.89}, {"no": 18, "il": "ÇANKIRI", "ilce": "ÇANKIRI", "guncelSatis": 1.64}, {"no": 19, "il": "ÇORUM", "ilce": "MERKEZ", "guncelSatis": 1.91}, {"no": null, "il": "ÇORUM", "ilce": "İSKİLİP", "guncelSatis": 1.95}, {"no": 20, "il": "DENİZLİ", "ilce": "ACIPAYAM", "guncelSatis": 2}, {"no": null, "il": "DENİZLİ", "ilce": "MERKEZ", "guncelSatis": 1.69}, {"no": null, "il": "DENİZLİ", "ilce": "ÇİVRİL", "guncelSatis": 1.77}, {"no": null, "il": "DENİZLİ", "ilce": "TAVAS", "guncelSatis": 2}, {"no": 21, "il": "DİYARBAKIR", "ilce": "MERKEZ", "guncelSatis": 3.9}, {"no": null, "il": "DİYARBAKIR", "ilce": "BİSMİL", "guncelSatis": 3.9}, {"no": 22, "il": "EDİRNE", "ilce": "MERKEZ", "guncelSatis": 0.8}, {"no": null, "il": "EDİRNE", "ilce": "KEŞAN", "guncelSatis": 0.89}, {"no": 23, "il": "ELAZIĞ", "ilce": "ELAZIĞ", "guncelSatis": 3.32}, {"no": 24, "il": "ERZİNCAN", "ilce": "ERZİNCAN", "guncelSatis": 3.54}, {"no": 25, "il": "ERZURUM", "ilce": "ERZURUM", "guncelSatis": 3.9}, {"no": 26, "il": "ESKİŞEHİR", "ilce": "ESKİŞEHİR", "guncelSatis": 1.11}, {"no": 27, "il": "GAZİANTEP", "ilce": "GAZİANTEP", "guncelSatis": 3.1}, {"no": 28, "il": "GİRESUN", "ilce": "GİRESUN", "guncelSatis": 2.88}, {"no": 29, "il": "GÜMÜŞHANE", "ilce": "GÜMÜŞHANE", "guncelSatis": 3.32}, {"no": 30, "il": "HAKKARİ", "ilce": "HAKKARİ", "guncelSatis": 4.87}, {"no": 31, "il": "HATAY", "ilce": "HATAY", "guncelSatis": 3.1}, {"no": 32, "il": "ISPARTA", "ilce": "MERKEZ", "guncelSatis": 1.69}, {"no": null, "il": "ISPARTA", "ilce": "YALVAÇ", "guncelSatis": 1.86}, {"no": 33, "il": "İÇEL / MERSİN", "ilce": "MERKEZ", "guncelSatis": 2.44}, {"no": null, "il": "İÇEL / MERSİN", "ilce": "TARSUS", "guncelSatis": 2.44}, {"no": 34, "il": "İST/ AVRUPA", "ilce": "SİLİVRİ", "guncelSatis": 0.54}, {"no": null, "il": "İST/ AVRUPA", "ilce": "SELİMPAŞA", "guncelSatis": 0.58}, {"no": null, "il": "İST/ AVRUPA", "ilce": "İKİTELLİ İLERİSİ", "guncelSatis": 0.62}, {"no": 34, "il": "İST /ANADOLU", "ilce": "İST /ANADOLU", "guncelSatis": 0.85}, {"no": 35, "il": "İZMİR", "ilce": "DİKİLİ", "guncelSatis": 1.69}, {"no": null, "il": "İZMİR", "ilce": "MERKEZ", "guncelSatis": 1.55}, {"no": null, "il": "İZMİR", "ilce": "MENDERES", "guncelSatis": 1.55}, {"no": null, "il": "İZMİR", "ilce": "MENEMEN", "guncelSatis": 1.55}, {"no": null, "il": "İZMİR", "ilce": "BALÇOVA", "guncelSatis": 1.6}, {"no": null, "il": "İZMİR", "ilce": "KISIKKÖY", "guncelSatis": 1.77}, {"no": null, "il": "İZMİR", "ilce": "SARNIÇ", "guncelSatis": 1.6}, {"no": null, "il": "İZMİR", "ilce": "PANCAR", "guncelSatis": 1.77}, {"no": null, "il": "İZMİR", "ilce": "TORBALI", "guncelSatis": 1.69}, {"no": null, "il": "İZMİR", "ilce": "ÇAMDİBİ", "guncelSatis": 1.69}, {"no": null, "il": "İZMİR", "ilce": "ÖDEMİŞ", "guncelSatis": 1.77}, {"no": null, "il": "İZMİR", "ilce": "TİRE", "guncelSatis": 1.77}, {"no": null, "il": "İZMİR", "ilce": "YAZIBAŞI", "guncelSatis": 1.77}, {"no": 36, "il": "KARS", "ilce": "KARS", "guncelSatis": 4.34}, {"no": 37, "il": "KASTAMONU", "ilce": "MERKEZ", "guncelSatis": 1.69}, {"no": null, "il": "KASTAMONU", "ilce": "TOSYA", "guncelSatis": 1.69}, {"no": 38, "il": "KAYSERİ", "ilce": "KAYSERİ", "guncelSatis": 1.77}, {"no": 39, "il": "KIRKLARELİ", "ilce": "LÜLEBURGAZ", "guncelSatis": 0.5172368055538282}, {"no": null, "il": "KIRKLARELİ", "ilce": "MERKEZ", "guncelSatis": 0.5172368055538282}, {"no": null, "il": "KIRKLARELİ", "ilce": "BABAESKİ", "guncelSatis": 0.5}, {"no": 40, "il": "KIRŞEHİR", "ilce": "KIRŞEHİR", "guncelSatis": 1.65}, {"no": 41, "il": "KOCAELİ / GEBZE", "ilce": "KOCAELİ / GEBZE", "guncelSatis": 0.9}, {"no": 41, "il": "KOCAELİ / İZMİT", "ilce": "DERİNCE", "guncelSatis": 0.95}, {"no": 42, "il": "KONYA", "ilce": "KONYA", "guncelSatis": 1.9913617013822382}, {"no": 43, "il": "KÜTAHYA", "ilce": "MERKEZ", "guncelSatis": 1.7327432986053244}, {"no": null, "il": "KÜTAHYA", "ilce": "SİMAV", "guncelSatis": 1.706881458327633}, {"no": 44, "il": "MALATYA", "ilce": "APAPKİR", "guncelSatis": 3.5}, {"no": 45, "il": "MANİSA", "ilce": "ALAŞEHİR", "guncelSatis": 1.6}, {"no": null, "il": "MANİSA", "ilce": "MERKEZ", "guncelSatis": 1.42}, {"no": null, "il": "MANİSA", "ilce": "GÖRDES", "guncelSatis": 1.51}, {"no": null, "il": "MANİSA", "ilce": "TURGUTLU", "guncelSatis": 1.51}, {"no": null, "il": "MANİSA", "ilce": "KULA ", "guncelSatis": 1.51}, {"no": null, "il": "MANİSA", "ilce": "AKHİSAR", "guncelSatis": 1.33}, {"no": null, "il": "MANİSA", "ilce": "SALİHLİ", "guncelSatis": 1.33}, {"no": null, "il": "MANİSA", "ilce": "SELİMŞAHLAR", "guncelSatis": 1.42}, {"no": null, "il": "MANİSA", "ilce": "MURADİYE", "guncelSatis": 1.42}, {"no": 46, "il": "KAHRAMANMARAŞ", "ilce": "MERKEZ", "guncelSatis": 2.92}, {"no": null, "il": "KAHRAMANMARAŞ", "ilce": "ELBİSTAN", "guncelSatis": 3.01}, {"no": 47, "il": "MARDİN", "ilce": "MERKEZ", "guncelSatis": 4.137894444430626}, {"no": null, "il": "MARDİN", "ilce": "NUSAYBİN", "guncelSatis": 4.189618124986008}, {"no": 48, "il": "MUĞLA", "ilce": "FETHİYE", "guncelSatis": 2.66}, {"no": null, "il": "MUĞLA", "ilce": "MERKEZ", "guncelSatis": 2.22}, {"no": null, "il": "MUĞLA", "ilce": "MİLAS", "guncelSatis": 2.22}, {"no": null, "il": "MUĞLA", "ilce": "ORTACA", "guncelSatis": 2.22}, {"no": null, "il": "MUĞLA", "ilce": "BODRUM", "guncelSatis": 2.3}, {"no": 49, "il": "MUŞ", "ilce": "MUŞ", "guncelSatis": 4.21}, {"no": 50, "il": "NEVŞEHİR", "ilce": "NEVŞEHİR", "guncelSatis": 1.6939505381887872}, {"no": 51, "il": "NİĞDE", "ilce": "NİĞDE", "guncelSatis": 1.7973978992995525}, {"no": 52, "il": "ORDU", "ilce": "ORDU", "guncelSatis": 2.3}, {"no": null, "il": "ORDU", "ilce": "ÜNYE", "guncelSatis": 2.3}, {"no": null, "il": "ORDU", "ilce": "FATSA", "guncelSatis": 2.35}, {"no": 53, "il": "RİZE", "ilce": "RİZE", "guncelSatis": 3.32}, {"no": 54, "il": "SAKARYA", "ilce": "AKYAZI", "guncelSatis": 0.89}, {"no": null, "il": "SAKARYA", "ilce": "MERKEZ", "guncelSatis": 0.89}, {"no": null, "il": "SAKARYA", "ilce": "HENDEK", "guncelSatis": 0.89}, {"no": 55, "il": "SAMSUN", "ilce": "SAMSUN", "guncelSatis": 2.22}, {"no": null, "il": "SAMSUN", "ilce": "BAFRA", "guncelSatis": 2.39}, {"no": null, "il": "SAMSUN", "ilce": "ÇARŞAMBA", "guncelSatis": 2.26}, {"no": null, "il": "SAMSUN", "ilce": "TERME", "guncelSatis": 2.3}, {"no": 56, "il": "SİİRT", "ilce": "SİİRT", "guncelSatis": 4.34}, {"no": 57, "il": "SİNOP", "ilce": "SİNOP", "guncelSatis": 2.13}, {"no": null, "il": "SİNOP", "ilce": "BOYABAT", "guncelSatis": 2.17}, {"no": 58, "il": "SİVAS", "ilce": "SİVAS", "guncelSatis": 2.39}, {"no": 59, "il": "TEKİRDAĞ", "ilce": "MALKARA", "guncelSatis": 0.67}, {"no": null, "il": "TEKİRDAĞ", "ilce": "MERKEZ", "guncelSatis": 0.62}, {"no": null, "il": "TEKİRDAĞ", "ilce": "HAYRABOLU", "guncelSatis": 0.62}, {"no": null, "il": "TEKİRDAĞ", "ilce": "ÇORLU", "guncelSatis": 0.36}, {"no": 60, "il": "TOKAT", "ilce": "ERBAA", "guncelSatis": 2.17}, {"no": null, "il": "TOKAT", "ilce": "MERKEZ", "guncelSatis": 2}, {"no": null, "il": "TOKAT", "ilce": "NİKSAR", "guncelSatis": 1.9913617013822382}, {"no": 61, "il": "TRABZON", "ilce": "MERKEZ", "guncelSatis": 3.19}, {"no": null, "il": "TRABZON", "ilce": "ARSİN", "guncelSatis": 3.23}, {"no": 62, "il": "TUNCELİ", "ilce": "TUNCELİ", "guncelSatis": 3.76}, {"no": 63, "il": "ŞANLIURFA", "ilce": "MERKEZ", "guncelSatis": 3.1}, {"no": null, "il": "ŞANLIURFA", "ilce": "SİVEREK", "guncelSatis": 3.32}, {"no": 64, "il": "UŞAK", "ilce": "UŞAK", "guncelSatis": 1.42}, {"no": 65, "il": "VAN", "ilce": "MERKEZ", "guncelSatis": 4.65}, {"no": null, "il": "VAN", "ilce": "ERCİŞ", "guncelSatis": 4.65}, {"no": 66, "il": "YOZGAT", "ilce": "SORGUN", "guncelSatis": 1.7327432986053244}, {"no": null, "il": "YOZGAT", "ilce": "MERKEZ", "guncelSatis": 1.706881458327633}, {"no": null, "il": "YOZGAT", "ilce": "AKDAĞMADENİ", "guncelSatis": 1.8879143402714726}, {"no": 67, "il": "ZONGULDAK", "ilce": "MERKEZ", "guncelSatis": 1.42}, {"no": null, "il": "ZONGULDAK", "ilce": "ÇAYCUMA", "guncelSatis": 1.33}, {"no": null, "il": "ZONGULDAK", "ilce": "EREĞLİ", "guncelSatis": 1.42}, {"no": null, "il": "ZONGULDAK", "ilce": "DEVREK", "guncelSatis": 1.42}, {"no": 68, "il": "AKSARAY", "ilce": "AKSARAY", "guncelSatis": 1.73}, {"no": 69, "il": "BAYBURT", "ilce": "BAYBURT", "guncelSatis": 3.45}, {"no": 70, "il": "KARAMAN", "ilce": "KARAMAN", "guncelSatis": 1.86}, {"no": 71, "il": "KIRIKKALE", "ilce": "KIRIKKALE", "guncelSatis": 1.69}, {"no": 72, "il": "BATMAN", "ilce": "BATMAN", "guncelSatis": 3.9}, {"no": 73, "il": "ŞIRNAK", "ilce": "CİZRE", "guncelSatis": 4.65}, {"no": null, "il": "ŞIRNAK", "ilce": "MERKEZ", "guncelSatis": 4.65}, {"no": null, "il": "ŞIRNAK", "ilce": "İDİL", "guncelSatis": 4.65}, {"no": 74, "il": "BARTIN", "ilce": "BARTIN", "guncelSatis": 1.69}, {"no": 75, "il": "ARDAHAN", "ilce": "ARDAHAN", "guncelSatis": 4.34}, {"no": 76, "il": "IĞDIR", "ilce": "IĞDIR", "guncelSatis": 4.34}, {"no": 77, "il": "YALOVA", "ilce": "YALOVA", "guncelSatis": 1.02}, {"no": 78, "il": "KARABÜK", "ilce": "KARABÜK", "guncelSatis": 1.64}, {"no": 79, "il": "KİLİS", "ilce": "KİLİS", "guncelSatis": 3.32}, {"no": 80, "il": "OSMANİYE", "ilce": "OSMANİYE", "guncelSatis": 2.9}, {"no": 81, "il": "DÜZCE", "ilce": "DÜZCE", "guncelSatis": 1.11}];


/* =========================================================
   CORTEVA TARİFELERİ
   Format: Bölge | Yükleme Yeri | İndirme Yeri | TIR | KIRKAYAK
   Kaynak: corteva.xlsx
========================================================= */
const CORTEVA_SATIS = [{"bolge": "YENİŞEHİR", "yuklemeYeri": "TARLA", "indirmeYeri": "HARMAN YERİ", "tir": 25357.712079826077, "kirkayak": 24073.80605553163}, {"bolge": "YENİŞEHİR", "yuklemeYeri": "HARMAN YERİ", "indirmeYeri": "FABRİKA", "tir": 2439.4214461594497, "kirkayak": null}, {"bolge": "YENİŞEHİR", "yuklemeYeri": "TARLA", "indirmeYeri": "AGROMAR", "tir": 898.7342170061131, "kirkayak": null}, {"bolge": "YENİŞEHİR", "yuklemeYeri": "HARMAN YERİ", "indirmeYeri": "AGROMAR", "tir": 898.7342170061131, "kirkayak": null}, {"bolge": "ESKİŞEHİR", "yuklemeYeri": "TARLA", "indirmeYeri": "HARMAN YERİ", "tir": 25357.712079826077, "kirkayak": 24073.80605553163}, {"bolge": "ESKİŞEHİR", "yuklemeYeri": "HARMAN YERİ", "indirmeYeri": "FABRİKA", "tir": 2272.400042999022, "kirkayak": null}, {"bolge": "BORU NAKLİ", "yuklemeYeri": "ADANA", "indirmeYeri": "KARACABEY", "tir": 48788.428923189, "kirkayak": 46220.616874600106}, {"bolge": "BORU NAKLİ", "yuklemeYeri": "KARACABEY", "indirmeYeri": "BERGAMA", "tir": 25678.120485888947, "kirkayak": 23752.261449447276}, {"bolge": "BORU NAKLİ", "yuklemeYeri": "KARACABEY", "indirmeYeri": "YENİŞEHİR", "tir": 20542.49638871116, "kirkayak": 19258.59036441671}, {"bolge": "BORU NAKLİ", "yuklemeYeri": "KARACABEY", "indirmeYeri": "ÇANAKKALE-BİGA", "tir": 17974.68434012226, "kirkayak": 16690.778315827814}, {"bolge": "BORU NAKLİ", "yuklemeYeri": "ADANA", "indirmeYeri": "ESKİŞEHİR-YENİŞEHİR-BİGA", "tir": 51356.240971777894, "kirkayak": 48788.428923189}];
const CORTEVA_ALIS = [{"bolge": "YENİŞEHİR", "yuklemeYeri": "TARLA", "indirmeYeri": "HARMAN YERİ", "tir": 22439.945294583882, "kirkayak": 21303.75100660502}, {"bolge": "YENİŞEHİR", "yuklemeYeri": "HARMAN YERİ", "indirmeYeri": "FABRİKA", "tir": 2158.783561426684, "kirkayak": null}, {"bolge": "YENİŞEHİR", "yuklemeYeri": "TARLA", "indirmeYeri": "AGROMAR", "tir": 795.3380607661823, "kirkayak": null}, {"bolge": "YENİŞEHİR", "yuklemeYeri": "HARMAN YERİ", "indirmeYeri": "AGROMAR", "tir": 795.3380607661823, "kirkayak": null}, {"bolge": "ESKİŞEHİR", "yuklemeYeri": "TARLA", "indirmeYeri": "HARMAN YERİ", "tir": 22439.945294583882, "kirkayak": 21303.75100660502}, {"bolge": "ESKİŞEHİR", "yuklemeYeri": "HARMAN YERİ", "indirmeYeri": "FABRİKA", "tir": 2045.1579550858653, "kirkayak": null}, {"bolge": "BORU NAKLİ", "yuklemeYeri": "ADANA", "indirmeYeri": "KARACABEY", "tir": 43175.599157199475, "kirkayak": 40903.200285336854}, {"bolge": "BORU NAKLİ", "yuklemeYeri": "KARACABEY", "indirmeYeri": "BERGAMA", "tir": 22723.999014531044, "kirkayak": 21019.697286657858}, {"bolge": "BORU NAKLİ", "yuklemeYeri": "KARACABEY", "indirmeYeri": "YENİŞEHİR", "tir": 18179.20127080581, "kirkayak": 17042.99668692206}, {"bolge": "BORU NAKLİ", "yuklemeYeri": "KARACABEY", "indirmeYeri": "ÇANAKKALE-BİGA", "tir": 15906.802398943195, "kirkayak": 14770.597815059446}, {"bolge": "BORU NAKLİ", "yuklemeYeri": "ADANA", "indirmeYeri": "ESKİŞEHİR-YENİŞEHİR-BİGA", "tir": 45447.99802906209, "kirkayak": 43175.599157199475}];

/* =========================================================
   CMC AGRO TARİFELERİ
   Kaynak: cmc agro.xlsx

   Kural:
   Yakıt fiyatındaki değişimin %50'si tarifenin tamamına uygulanır.
   TL/TON, TIR, KIRKAYAK ve 13.60 AÇIK DORSE kolonlarının hepsi değişir.
========================================================= */
const CMC_AGRO_SATIS = [{"il": "BURSA", "ilce": "YENİŞEHİR", "tlTon": 902.6214985392388, "tir": 18878.926764627933, "kirkayak": 17660.931489490646, "acikDorse": 18878.926764627933}, {"il": "BURSA", "ilce": "İNEGÖL", "tlTon": 902.6214985392388, "tir": 18878.926764627933, "kirkayak": 17660.931489490646, "acikDorse": 18878.926764627933}, {"il": "BURSA", "ilce": "M.KEMALPAŞA", "tlTon": 511.1230172451111, "tir": 10657.458657451252, "kirkayak": 10048.461019882609, "acikDorse": 10961.957476235573}, {"il": "İZMİR", "ilce": "KINIK-BERGAMA", "tlTon": 1163.6204860686573, "tir": 23924.907190196693, "kirkayak": 23141.910227608434, "acikDorse": 24359.905502745718}, {"il": "KONYA", "ilce": "ÇUMRA", "tlTon": 1892.2426595882837, "tir": 39737.09585135396, "kirkayak": 32168.12521300082, "acikDorse": 39737.09585135396}, {"il": "KONYA", "ilce": "CİHANBEYLİ", "tlTon": 1892.2426595882837, "tir": 39737.09585135396, "kirkayak": 32168.12521300082, "acikDorse": 39737.09585135396}];
const CMC_AGRO_ALIS = [{"il": "BURSA", "ilce": "YENİŞEHİR", "tlTon": 802.5738987764182, "tir": 16856.188751946607, "kirkayak": 15768.684003337039, "acikDorse": 16856.188751946607}, {"il": "BURSA", "ilce": "İNEGÖL", "tlTon": 802.5738987764182, "tir": 16856.188751946607, "kirkayak": 15768.684003337039, "acikDorse": 16856.188751946607}, {"il": "BURSA", "ilce": "M.KEMALPAŞA", "tlTon": 453.48485372636264, "tir": 9515.588751390433, "kirkayak": 8971.83637708565, "acikDorse": 9787.459751946608}, {"il": "İZMİR", "ilce": "KINIK-BERGAMA", "tlTon": 1036.385656284761, "tir": 21206.166253615127, "kirkayak": 20662.42425250278, "acikDorse": 21749.91862791991}, {"il": "KONYA", "ilce": "ÇUMRA", "tlTon": 1700.840497775306, "tir": 35717.712692436035, "kirkayak": 28914.340328142378, "acikDorse": 35717.712692436035}, {"il": "KONYA", "ilce": "CİHANBEYLİ", "tlTon": 1700.840497775306, "tir": 35717.712692436035, "kirkayak": 28914.340328142378, "acikDorse": 35717.712692436035}];

/* =========================================================
   KWS TARİFELERİ
   Kaynak: kws yakıt.xlsx

   Kural:
   Yakıt değişimi +%12 veya -%12 eşiğine ulaştığında
   değişimin %30'u tarifelere yansıtılır.
========================================================= */

const KWS_TIR_SATIS = [
  { yukleme: "KINIK - BERGAMA", bosaltma: "KWS SALİHLİ TESİS", ikiHaric: 18000, ikiDahil: 21600, ucHaric: 18500, ucDahil: 22200 },
  { yukleme: "KINIK - BERGAMA", bosaltma: "KWS ESKİŞEHİR TESİS OSB", ikiHaric: 37000, ikiDahil: 44400, ucHaric: 38000, ucDahil: 45600 },
  { yukleme: "YENİŞEHİR - BURSA", bosaltma: "KWS SALİHLİ TESİS", ikiHaric: 31500, ikiDahil: 37800, ucHaric: 32500, ucDahil: 39000 },
  { yukleme: "YENİŞEHİR - BURSA", bosaltma: "KWS ESKİŞEHİR TESİS OSB", ikiHaric: 18000, ikiDahil: 21600, ucHaric: 19000, ucDahil: 22800 },
  { yukleme: "(TOPKAYA - ALPU) ESKİŞEHİR", bosaltma: "KWS SALİHLİ TESİS", ikiHaric: 34000, ikiDahil: 40800, ucHaric: 35000, ucDahil: 42000 },
  { yukleme: "(TOPKAYA - ALPU) ESKİŞEHİR", bosaltma: "KWS ESKİŞEHİR TESİS OSB", ikiHaric: 12300, ikiDahil: 14760, ucHaric: 12700, ucDahil: 15240 },
];

const KWS_TIR_ALIS = [
  { yukleme: "KINIK - BERGAMA", bosaltma: "KWS SALİHLİ TESİS", ikiHaric: 15680, ikiDahil: 18816, ucHaric: 16170, ucDahil: 19404 },
  { yukleme: "KINIK - BERGAMA", bosaltma: "KWS ESKİŞEHİR TESİS OSB", ikiHaric: 32340, ikiDahil: 38808, ucHaric: 33320, ucDahil: 39984 },
  { yukleme: "YENİŞEHİR - BURSA", bosaltma: "KWS SALİHLİ TESİS", ikiHaric: 27440, ikiDahil: 32928, ucHaric: 27930, ucDahil: 33516 },
  { yukleme: "YENİŞEHİR - BURSA", bosaltma: "KWS ESKİŞEHİR TESİS OSB", ikiHaric: 15680, ikiDahil: 18816, ucHaric: 16170, ucDahil: 19404 },
  { yukleme: "(TOPKAYA - ALPU) ESKİŞEHİR", bosaltma: "KWS SALİHLİ TESİS", ikiHaric: 29400, ikiDahil: 35280, ucHaric: 30380, ucDahil: 36456 },
  { yukleme: "(TOPKAYA - ALPU) ESKİŞEHİR", bosaltma: "KWS ESKİŞEHİR TESİS OSB", ikiHaric: 10780, ikiDahil: 12936, ucHaric: 11025, ucDahil: 13230 },
];

const KWS_LOWBED = [
  { yukleme: "ESKİŞEHİR", bosaltma: "KINIK", haric: 210000, dahil: 252000 },
  { yukleme: "ESKİŞEHİR", bosaltma: "YENİŞEHİR", haric: 153000, dahil: 183600 },
  { yukleme: "KINIK", bosaltma: "YENİŞEHİR", haric: 210000, dahil: 252000 },
  { yukleme: "ESKİŞEHİR", bosaltma: "ESKİŞEHİR ŞEHİR İÇİ", haric: 65000, dahil: 78000 },
];

const isKwsCustomer = (item) =>
  norm(item?.musteri_adi) === "KWS" ||
  norm(item?.kod) === "KWS" ||
  item?.id === "__KWS_PLACEHOLDER__";

const isEtiCustomer = (item) => {
  const name = norm(item?.musteri_adi);
  const code = norm(item?.kod);

  return (
    name === "ETİ" ||
    name === "ETI" ||
    code === "ETİ" ||
    code === "ETI" ||
    item?.id === "__ETI_PLACEHOLDER__"
  );
};

const isCmcAgroCustomer = (item) => {
  const name = norm(item?.musteri_adi);
  const code = norm(item?.kod);
  return (
    name === norm("CMC AGRO") ||
    name === norm("CMCAGRO") ||
    code === norm("CMC_AGRO") ||
    code === norm("CMC AGRO") ||
    item?.id === "__CMC_AGRO_PLACEHOLDER__"
  );
};

const isCortevaCustomer = (item) => {
  const name = norm(item?.musteri_adi);
  const code = norm(item?.kod);
  return (
    name === norm("CORTEVA") ||
    name === norm("CORTEVA AGRISCIENCE") ||
    code === norm("CORTEVA") ||
    code === norm("CORTEVA_AGRISCIENCE") ||
    item?.id === "__CORTEVA_PLACEHOLDER__"
  );
};

const isEforCayCustomer = (item) => {
  const name = norm(item?.musteri_adi);
  const code = norm(item?.kod);
  return (
    name === norm("EFOR ÇAY") ||
    name === norm("EFOR CAY") ||
    code === norm("EFOR_CAY") ||
    code === norm("EFOR ÇAY") ||
    item?.id === "__EFOR_CAY_PLACEHOLDER__"
  );
};

const isBimCustomer = (item) => {
  const name = norm(item?.musteri_adi);
  const code = norm(item?.kod);
  return name === norm("BİM") || name === norm("BIM") || code === norm("BİM") || code === norm("BIM") || item?.id === "__BIM_PLACEHOLDER__";
};

const isTeverpanCustomer = (item) => {
  const name = norm(item?.musteri_adi);
  const code = norm(item?.kod);
  return (
    name === norm("TEVERPAN") ||
    code === norm("TEVERPAN") ||
    item?.id === "__TEVERPAN_PLACEHOLDER__"
  );
};

const applyRate = (value, rate) =>
  Math.round((Number(value) || 0) * (1 + rate));

/* =========================================================
   TARİFE TABLOSU
========================================================= */

function TarifeTable({
  type,
  rows,
  onImport,
  onAdd,
  onHistory,
}) {
  const fileRef = useRef();

  const title =
    type === "alis"
      ? "Yakıt Alış Fiyatları"
      : "Yakıt Satış Fiyatları";

  return (
    <section
      className={`fuel-price-panel ${
        type === "alis" ? "buy" : "sell"
      }`}
    >
      <div className="fuel-price-panel-head">
        <div className="fuel-price-title">
          <span className="fuel-table-icon">
            {type === "alis" ? (
              <ShoppingCart size={18} />
            ) : (
              <BadgeDollarSign size={18} />
            )}
          </span>

          <div>
            <small>
              {type === "alis"
                ? "TEDARİK"
                : "MÜŞTERİ"}
            </small>

            <h2>{title}</h2>
          </div>
        </div>

        <div className="tarife-actions">
          <input
            ref={fileRef}
            hidden
            type="file"
            accept=".xlsx,.xls"
            onChange={(e) => {
              onImport(
                e.target.files?.[0],
                type
              );

              e.target.value = "";
            }}
          />

          <button
            type="button"
            className="fuel-table-add"
            onClick={() =>
              fileRef.current?.click()
            }
          >
            <Upload size={16} />
            Excel Aktar
          </button>

          <button
            type="button"
            className="fuel-table-add"
            onClick={() => onAdd(type)}
          >
            <Plus size={16} />
            Satır Ekle
          </button>

          <button
            type="button"
            className="fuel-table-add"
            onClick={() => onHistory(type)}
          >
            <History size={16} />
            Geçmiş
          </button>
        </div>
      </div>

      <div className="fuel-table-wrap">
        <table className="fuel-table compact tariff">
          <thead>
            <tr>
              <th>#</th>

              {HEADERS.map((header) => (
                <th key={header}>
                  {header}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {rows.map((row, index) => (
              <tr key={row.id} className={row.isInitial ? "first-price-initial-row" : ""}>
                <td>{index + 1}</td>

                <td>{row.il}</td>

                <td>{row.ilce}</td>

                <td>
                  {row.koy_mahalle || "—"}
                </td>

                <td>
                  <b>{tariffMoney(row.ton_tl)}</b>
                </td>
              </tr>
            ))}

            {!rows.length && (
              <tr>
                <td colSpan="5">
                  <div className="fuel-empty-table">
                    <Fuel size={27} />

                    <b>Henüz tarife yok</b>

                    <span>
                      İlk Excel dosyasını aktarın
                      veya satır ekleyin.
                    </span>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function FasdatUnifiedTariffTable({ rows, onImport, onAdd, onHistory }) {
  const [view, setView] = useState("both");
  const [query, setQuery] = useState("");
  const fileRef = useRef();

  const keyOf = (r) => [r.il, r.ilce, r.koy_mahalle].map((v) => String(v || "").trim().toLocaleUpperCase("tr-TR")).join("|");
  const buyMap = new Map((rows.alis || []).map((r) => [keyOf(r), r]));
  const sellMap = new Map((rows.satis || []).map((r) => [keyOf(r), r]));
  const keys = Array.from(new Set([...buyMap.keys(), ...sellMap.keys()]));
  const merged = keys.map((key) => {
    const buy = buyMap.get(key);
    const sell = sellMap.get(key);
    const base = buy || sell || {};
    return { key, il: base.il, ilce: base.ilce, koy_mahalle: base.koy_mahalle, alis: buy?.ton_tl, satis: sell?.ton_tl };
  }).filter((r) => `${r.il} ${r.ilce} ${r.koy_mahalle}`.toLocaleLowerCase("tr-TR").includes(query.toLocaleLowerCase("tr-TR")));

  return (
    <section className="fasdat-tariff-unified">
      <div className="fasdat-tariff-toolbar">
        <div className="fasdat-tariff-title"><h2>Tarife</h2><span>{merged.length} bölge</span></div>
        <div className="fasdat-tariff-controls">
          <div className="fasdat-segmented">
            <button className={view === "both" ? "active" : ""} onClick={() => setView("both")}>Alış ve satış</button>
            <button className={view === "buy" ? "active" : ""} onClick={() => setView("buy")}>Alış</button>
            <button className={view === "sell" ? "active" : ""} onClick={() => setView("sell")}>Satış</button>
          </div>
          <label className="fasdat-tariff-search"><Search size={16}/><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="İl, ilçe veya mahalle ara"/></label>
          <input ref={fileRef} hidden type="file" accept=".xlsx,.xls" onChange={(e) => { const f=e.target.files?.[0]; if(f){ onImport(f,"alis"); onImport(f,"satis"); } e.target.value=""; }}/>
          <button onClick={() => fileRef.current?.click()}><Upload size={16}/> Excel aktar</button>
          <button onClick={() => onAdd(view === "sell" ? "satis" : "alis")}><Plus size={16}/> Satır ekle</button>
          <button onClick={() => onHistory(view === "sell" ? "satis" : "alis")}><History size={16}/> Geçmiş</button>
        </div>
      </div>
      <div className="fasdat-tariff-table-wrap">
        <table className="fasdat-tariff-table">
          <thead><tr><th>#</th><th>İl</th><th>İlçe</th><th>Köy / mahalle</th>{view !== "sell" && <th>Alış</th>}{view !== "buy" && <th>Satış</th>}{view === "both" && <th>Marj</th>}</tr></thead>
          <tbody>
            {merged.map((r,i) => { const margin = Number(r.satis) - Number(r.alis); return <tr key={r.key}><td>{i+1}</td><td><b>{r.il}</b></td><td>{r.ilce}</td><td>{r.koy_mahalle || "—"}</td>{view !== "sell" && <td>{Number.isFinite(Number(r.alis)) ? tariffMoney(r.alis) : "—"}</td>}{view !== "buy" && <td><b>{Number.isFinite(Number(r.satis)) ? tariffMoney(r.satis) : "—"}</b></td>}{view === "both" && <td><span className="fasdat-margin">{Number.isFinite(margin) ? `+${tariffMoney(margin)}` : "—"}</span></td>}</tr>; })}
            {!merged.length && <tr><td colSpan="7"><div className="fuel-empty-table"><b>Tarife bulunamadı</b></div></td></tr>}
          </tbody>
        </table>
      </div>
      <div className="fasdat-tariff-footer"><span>{merged.length} / {keys.length} satır gösteriliyor</span><span>Fiyatlar TON/TL</span></div>
    </section>
  );
}

/* =========================================================
   ANA COMPONENT
========================================================= */

export default function YakitHesaplama() {
  /* =======================================================
     STATE
  ======================================================= */

  const [
    customers,
    setCustomers,
  ] = useState([]);

  const [
    customer,
    setCustomer,
  ] = useState(null);

  const [
    customerLoading,
    setCustomerLoading,
  ] = useState(true);

  const [fuelOverviewVersion, setFuelOverviewVersion] = useState(0);
  const [opsPreview, setOpsPreview] = useState(null);
  const [opsSimulation, setOpsSimulation] = useState("");
  const [opsRange, setOpsRange] = useState(30);
  const [opsCompare, setOpsCompare] = useState({ from: "", to: "" });

  const OPS_SETTINGS_KEY = "odak_yakit_customer_automation_v1";
  const OPS_AUDIT_KEY = "odak_yakit_audit_v1";
  const getCustomerKey = (c) => isBimCustomer(c) ? "BİM" : isTeverpanCustomer(c) ? "TEVERPAN" : isEforCayCustomer(c) ? "EFOR ÇAY" : isCortevaCustomer(c) ? "CORTEVA" : isCmcAgroCustomer(c) ? "CMC AGRO" : isEtiCustomer(c) ? "ETİ" : isKwsCustomer(c) ? "KWS" : "FASDAT";
  const getOpsSettings = () => { try { const legacy=JSON.parse(localStorage.getItem(OPS_SETTINGS_KEY) || "{}"); const rules=getContractRules(); return Object.fromEntries(Object.keys(rules).map(key=>[key,rules[key]?.mode||legacy[key]||"approval"])); } catch { return {}; } };
  const setOpsMode = (key, mode) => { const all=getOpsSettings(); all[key]=mode; localStorage.setItem(OPS_SETTINGS_KEY,JSON.stringify(all)); saveContractRule(key,{mode}); setFuelOverviewVersion(v=>v+1); };
  const getOpsAudit = () => { try { return JSON.parse(localStorage.getItem(OPS_AUDIT_KEY) || "[]"); } catch { return []; } };
  const addOpsAudit = (row) => { const all=getOpsAudit(); const seq=String(all.length+1).padStart(3,"0"); const d=new Date(); const id=`YK-${String(d.getFullYear()).slice(-2)}${String(d.getMonth()+1).padStart(2,"0")}${String(d.getDate()).padStart(2,"0")}-${seq}`; const next=[{...row,id,created_at:d.toISOString()},...all].slice(0,500); localStorage.setItem(OPS_AUDIT_KEY,JSON.stringify(next)); return id; };

  useEffect(() => {
    const refreshOverview = () => setFuelOverviewVersion((v) => v + 1);
    window.addEventListener("odak-fuel-updated", refreshOverview);
    window.addEventListener("storage", refreshOverview);
    return () => {
      window.removeEventListener("odak-fuel-updated", refreshOverview);
      window.removeEventListener("storage", refreshOverview);
    };
  }, []);

  const [
    rows,
    setRows,
  ] = useState({
    alis: [],
    satis: [],
  });

  const [
    calc,
    setCalc,
  ] = useState({
    eski: "",
    yeni: "",
  });

  const [
    error,
    setError,
  ] = useState("");

  const [
    info,
    setInfo,
  ] = useState("");

  const [
    busy,
    setBusy,
  ] = useState(false);

  const [
    modal,
    setModal,
  ] = useState(null);

  const [
    history,
    setHistory,
  ] = useState([]);

  // KWS tarifeleri kendi formatında tutulur.
  const [kwsTarifeler, setKwsTarifeler] = useState(() => {
    try {
      const saved = localStorage.getItem("kws_yakit_tarifeleri");
      return saved
        ? JSON.parse(saved)
        : {
            alis: KWS_TIR_ALIS,
            satis: KWS_TIR_SATIS,
            lowbed: KWS_LOWBED,
          };
    } catch {
      return {
        alis: KWS_TIR_ALIS,
        satis: KWS_TIR_SATIS,
        lowbed: KWS_LOWBED,
      };
    }
  });
  const [eforCayTarifeler, setEforCayTarifeler] = useState(() => {
    try {
      const saved = localStorage.getItem("efor_cay_yakit_tarifeleri");
      const parsed = saved ? JSON.parse(saved) : null;
      return Array.isArray(parsed) && parsed.length ? parsed : EFOR_CAY_TARIFELERI;
    } catch {
      return EFOR_CAY_TARIFELERI;
    }
  });
  const [eforCayHistory, setEforCayHistory] = useState(() => {
    try {
      const parsed = JSON.parse(localStorage.getItem("efor_cay_yakit_gecmisi") || "[]");
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });
  const [eforCaySearch, setEforCaySearch] = useState("");
  const [eforCayOldFuel, setEforCayOldFuel] = useState(() => {
    const saved = Number(localStorage.getItem("efor_cay_kabul_edilen_yakit_v1"));
    return Number.isFinite(saved) && saved > 0 ? saved.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "90,63";
  });
  const [eforCayNewFuel, setEforCayNewFuel] = useState("");
  const [eforCayHistoryOpen, setEforCayHistoryOpen] = useState(false);
  const [eforCayRuleOpen, setEforCayRuleOpen] = useState(false);
  const [bimTarifeler, setBimTarifeler] = useState(() => {
    const keepRawRows = (rows) => (rows || []).map(r => ({...r, fiyatlar: Object.fromEntries(Object.entries(r.fiyatlar || {}).map(([k,v]) => [k, parseTariffNumber(v)]))}));
    try { const x=JSON.parse(localStorage.getItem("bim_yakit_tarifeleri")||"null"); return keepRawRows(Array.isArray(x)&&x.length?x:BIM_TARIFELERI); } catch { return keepRawRows(BIM_TARIFELERI); }
  });
  const [bimHistory, setBimHistory] = useState(() => {
    try { const x=JSON.parse(localStorage.getItem("bim_yakit_gecmisi")||"[]"); return Array.isArray(x)?x:[]; } catch { return []; }
  });
  const [bimOldFuel,setBimOldFuel]=useState("73,96");
  useEffect(() => {
    try { localStorage.setItem("bim_yakit_tarifeleri", JSON.stringify(bimTarifeler)); } catch {}
  }, [bimTarifeler]);
  const [bimNewFuel,setBimNewFuel]=useState("70,95");
  const [bimSearch,setBimSearch]=useState("");
  const [bimFuelOpen,setBimFuelOpen]=useState(false);
  const [bimCalcOpen,setBimCalcOpen]=useState(false);
  const [bimStatusOpen,setBimStatusOpen]=useState(false);
  const [bimHistoryOpen,setBimHistoryOpen]=useState(false);

  const [teverpanTarifeler, setTeverpanTarifeler] = useState(() => {
    try {
      const saved = localStorage.getItem("teverpan_yakit_tarifeleri");
      const parsed = saved ? JSON.parse(saved) : null;
      return Array.isArray(parsed) && parsed.length ? parsed : TEVERPAN_TARIFELERI;
    } catch {
      return TEVERPAN_TARIFELERI;
    }
  });
  const [teverpanHistory, setTeverpanHistory] = useState(() => {
    try {
      const parsed = JSON.parse(localStorage.getItem("teverpan_yakit_gecmisi") || "[]");
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });
  const [teverpanSearch, setTeverpanSearch] = useState("");
  const [teverpanOldFuel, setTeverpanOldFuel] = useState("79,35");
  const [teverpanNewFuel, setTeverpanNewFuel] = useState("96,46");
  const [teverpanHistoryOpen, setTeverpanHistoryOpen] = useState(false);

  const [cortevaTarifeler, setCortevaTarifeler] = useState(() => {
    const initial = { satis: CORTEVA_SATIS, alis: CORTEVA_ALIS };
    try {
      const saved = localStorage.getItem("corteva_yakit_tarifeleri");
      return saved ? JSON.parse(saved) : initial;
    } catch {
      return initial;
    }
  });
  const [cortevaPriceType, setCortevaPriceType] = useState("satis");
  const [cortevaHistory, setCortevaHistory] = useState(() => {
    try {
      const parsed = JSON.parse(localStorage.getItem("corteva_yakit_gecmisi") || "[]");
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });
  const [cortevaOldFuel, setCortevaOldFuel] = useState("90,84");
  const [cortevaNewFuel, setCortevaNewFuel] = useState("97,56");
  const [cortevaHistoryOpen, setCortevaHistoryOpen] = useState(false);
  const [cortevaHistoryType, setCortevaHistoryType] = useState("satis");

  const [cortevaSearch, setCortevaSearch] = useState("");

  const [cmcTarifeler, setCmcTarifeler] = useState(() => {
    const initial = { satis: CMC_AGRO_SATIS, alis: CMC_AGRO_ALIS };
    try {
      const saved = localStorage.getItem("cmc_agro_yakit_tarifeleri");
      return saved ? JSON.parse(saved) : initial;
    } catch {
      return initial;
    }
  });
  const [cmcHistory, setCmcHistory] = useState(() => {
    try {
      const parsed = JSON.parse(localStorage.getItem("cmc_agro_yakit_gecmisi") || "[]");
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });  const [fuelOperationLoading, setFuelOperationLoading] = useState(null);

  const [cmcPriceType, setCmcPriceType] = useState("satis");
  const [cmcSearch, setCmcSearch] = useState("");
  const [cmcOldFuel, setCmcOldFuel] = useState("89,90");
  const [cmcNewFuel, setCmcNewFuel] = useState("96,61");
  const [cmcHistoryOpen, setCmcHistoryOpen] = useState(false);
  const [cmcHistoryType, setCmcHistoryType] = useState("satis");

  const [etiSearch, setEtiSearch] = useState("");
  const [etiActiveTab, setEtiActiveTab] = useState("seker");
  const [etiPriceType, setEtiPriceType] = useState("satis");

  const [etiOldFuel, setEtiOldFuel] = useState("82,15");
  const [etiNewFuel, setEtiNewFuel] = useState("96,79");
  const [etiHistoryOpen, setEtiHistoryOpen] = useState(false);
  const [etiHistoryTab, setEtiHistoryTab] = useState("seker");
  const [etiHistoryType, setEtiHistoryType] = useState("satis");
  const [etiTarifeler, setEtiTarifeler] = useState(() => {
    const initial = {
      seker: { satis: ETI_SEKER, alis: [] },
      ciftci: { satis: ETI_CIFTCI_SATIS, alis: ETI_CIFTCI_ALIS },
      yulaf: { satis: ETI_YULAF_SATIS, alis: ETI_YULAF_ALIS },
      bugday: { satis: ETI_BUGDAY_SATIS, alis: ETI_BUGDAY_ALIS },
      ek: { satis: ETI_EK_SATIS, alis: ETI_EK_ALIS },
    };
    try {
      const saved = localStorage.getItem("eti_yakit_tarifeleri_v2");
      return saved ? JSON.parse(saved) : initial;
    } catch { return initial; }
  });
  const [etiHistory, setEtiHistory] = useState(() => {
    try {
      const parsed = JSON.parse(localStorage.getItem("eti_yakit_gecmisi_v2") || "[]");
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });


  const [kwsHistory, setKwsHistory] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("kws_yakit_gecmisi") || "[]");
    } catch {
      return [];
    }
  });

  const [firstPriceArchiveOpen, setFirstPriceArchiveOpen] = useState(false);
  const [firstPriceArchiveVersion, setFirstPriceArchiveVersion] = useState(0);


  const readFirstPriceArchive = (key) => {
    try {
      return JSON.parse(localStorage.getItem(`yakit_ilk_fiyat_${key}`) || "null");
    } catch {
      return null;
    }
  };

  const keepFirstPriceArchive = (key, snapshot, source = "İlk tarife") => {
    if (!key || snapshot == null) return;
    const storageKey = `yakit_ilk_fiyat_${key}`;
    if (localStorage.getItem(storageKey)) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify({
        created_at: new Date().toISOString(),
        source,
        snapshot: JSON.parse(JSON.stringify(snapshot)),
      }));
      setFirstPriceArchiveVersion((v) => v + 1);
    } catch (e) {
      console.warn("İlk fiyat arşivi kaydedilemedi", e);
    }
  };

  const firstArchiveKey = customer
    ? isBimCustomer(customer) ? "bim"
    : isTeverpanCustomer(customer) ? "teverpan"
    : isEforCayCustomer(customer) ? "efor_cay"
    : isCortevaCustomer(customer) ? "corteva"
    : isCmcAgroCustomer(customer) ? "cmc_agro"
    : isEtiCustomer(customer) ? "eti"
    : isKwsCustomer(customer) ? "kws"
    : `fasdat_${customer.id || norm(customer.musteri_adi)}`
    : null;



  useEffect(() => {
    if (!customer || !firstArchiveKey) return;
    if (readFirstPriceArchive(firstArchiveKey)) return;

    if (isBimCustomer(customer)) keepFirstPriceArchive(firstArchiveKey, BIM_TARIFELERI, "BİM ilk fiyat listesi");
    else if (isTeverpanCustomer(customer)) keepFirstPriceArchive(firstArchiveKey, TEVERPAN_TARIFELERI, "TEVERPAN ilk fiyat listesi");
    else if (isEforCayCustomer(customer)) keepFirstPriceArchive(firstArchiveKey, EFOR_CAY_TARIFELERI, "EFOR ÇAY ilk fiyat listesi");
    else if (isCortevaCustomer(customer)) keepFirstPriceArchive(firstArchiveKey, { satis: CORTEVA_SATIS, alis: CORTEVA_ALIS }, "CORTEVA ilk fiyat listesi");
    else if (isCmcAgroCustomer(customer)) keepFirstPriceArchive(firstArchiveKey, { satis: CMC_AGRO_SATIS, alis: CMC_AGRO_ALIS }, "CMC AGRO ilk fiyat listesi");
    else if (isEtiCustomer(customer)) keepFirstPriceArchive(firstArchiveKey, {
      seker: { satis: ETI_SEKER, alis: [] },
      ciftci: { satis: ETI_CIFTCI_SATIS, alis: ETI_CIFTCI_ALIS },
      yulaf: { satis: ETI_YULAF_SATIS, alis: ETI_YULAF_ALIS },
      bugday: { satis: ETI_BUGDAY_SATIS, alis: ETI_BUGDAY_ALIS },
      ek: { satis: ETI_EK_SATIS, alis: ETI_EK_ALIS },
    }, "ETİ ilk fiyat listesi");
    else if (isKwsCustomer(customer)) keepFirstPriceArchive(firstArchiveKey, { alis: KWS_TIR_ALIS, satis: KWS_TIR_SATIS, lowbed: KWS_LOWBED }, "KWS ilk fiyat listesi");
    else if ((rows?.alis?.length || rows?.satis?.length)) {
      const oldest = history?.length ? history[history.length - 1] : null;
      keepFirstPriceArchive(firstArchiveKey, {
        alis: rows.alis,
        satis: rows.satis,
        oldest_history: oldest || null,
      }, "FASDAT ilk görülen tarife / en eski geçmiş");
    }
  }, [customer, firstArchiveKey, rows, history]);

  const flattenFirstPrices = (value, path = [], output = []) => {
    if (value == null) return output;
    if (typeof value === "number" && Number.isFinite(value)) {
      output.push({ path: path.join(" / "), value });
      return output;
    }
    if (Array.isArray(value)) {
      value.forEach((item, i) => flattenFirstPrices(item, [...path, String(i + 1)], output));
      return output;
    }
    if (typeof value === "object") {
      Object.entries(value).forEach(([key, item]) => {
        if (["id", "created_at", "updated_at"].includes(key)) return;
        flattenFirstPrices(item, [...path, key], output);
      });
    }
    return output;
  };

  const getFirstPriceOperationRows = () => {
    if (!customer) return [];

    let source = [];
    let kind = "generic";
    if (isBimCustomer(customer)) { source = bimHistory || []; kind = "bim"; }
    else if (isTeverpanCustomer(customer)) { source = teverpanHistory || []; kind = "teverpan"; }
    else if (isEforCayCustomer(customer)) { source = eforCayHistory || []; kind = "efor"; }
    else if (isCortevaCustomer(customer)) { source = cortevaHistory || []; kind = "corteva"; }
    else if (isCmcAgroCustomer(customer)) { source = cmcHistory || []; kind = "cmc"; }
    else if (isEtiCustomer(customer)) { source = etiHistory || []; kind = "eti"; }
    else if (isKwsCustomer(customer)) { source = kwsHistory || []; kind = "kws"; }
    else source = history || [];

    // Fiyat Hafızası aktif işlem geçmişini esas alır.
    // "Son İşlemi Geri Al" ile history'den kaldırılan işlem burada da görünmez.
    // İlk fiyat ise firstPriceArchives snapshot'ında ayrı ve değişmeden korunur.

    const rows = [];
    const num = (v) => Number(v || 0);
    const push = (h, label, type, oldValue, newValue, extra = "") => {
      if (oldValue == null && newValue == null) return;
      rows.push({
        id: `${h.id || h.created_at || "h"}-${rows.length}`,
        created_at: h.created_at,
        label: label || "Tarife",
        type: type || "Fiyat",
        extra,
        oldValue: num(oldValue),
        newValue: num(newValue),
        fuelRate: num(h.yakit_degisim_orani ?? h.yakit_orani),
        appliedRate: num(h.uygulanan_artis_orani ?? h.uygulanan_oran),
      });
    };

    source.forEach((h) => {
      const before = h.eski_tarifeler || h.onceki_tarifeler || h.before || [];
      const after = h.yeni_tarifeler || h.sonraki_tarifeler || h.after || [];

      if (kind === "bim" && Array.isArray(before)) {
        before.forEach((oldRow, i) => {
          const newRow = after?.[i] || {};
          Object.keys(oldRow?.fiyatlar || {}).forEach((dest) =>
            push(h, `${oldRow.cikis || "Çıkış"} → ${dest}`, "Satış", oldRow?.fiyatlar?.[dest], newRow?.fiyatlar?.[dest])
          );
        });
        return;
      }

      const walk = (oldVal, newVal, path = []) => {
        if (oldVal == null && newVal == null) return;
        if (typeof oldVal === "number" || typeof newVal === "number") {
          const key = String(path[path.length - 1] ?? "fiyat");
          if (/fiyat|ton|tl|tir|satis|alış|alis|kirkayak|dorse|haric|dahil|lowbed/i.test(key) && !/_id$|^id$/i.test(key)) {
            const parentParts = path.slice(0, -1);
            const root = String(parentParts[0] || "").toLocaleLowerCase("tr-TR");
            const locationLabel = parentParts.length > 1 ? parentParts.slice(1).join(" / ") : parentParts.join(" / ");
            const displayType = root === "alis" || root === "alış" ? "Alış" : root === "satis" || root === "satış" ? "Satış" : key;
            push(h, locationLabel || "Tarife", displayType, oldVal, newVal);
          }
          return;
        }
        if (Array.isArray(oldVal) || Array.isArray(newVal)) {
          const a = Array.isArray(oldVal) ? oldVal : [];
          const b = Array.isArray(newVal) ? newVal : [];
          const len = Math.max(a.length, b.length);
          for (let i=0;i<len;i++) {
            const row=a[i] || b[i] || {};
            // Standart alış/satış tarifelerinde teknik index/id yerine ekrandaki gerçek lokasyonu göster.
            const locationParts = [row.il, row.ilce, row.koy_mahalle].filter(Boolean);
            const rowName = locationParts.length
              ? locationParts.join(" / ")
              : (row.rota || row.guzergah || row.yukleme || row.cikis || row.ilce || row.varis || row.indirme || row.bolge || `${i+1}`);
            walk(a[i], b[i], [...path, rowName]);
          }
          return;
        }
        if ((oldVal && typeof oldVal === "object") || (newVal && typeof newVal === "object")) {
          const keys = new Set([...Object.keys(oldVal || {}), ...Object.keys(newVal || {})]);
          keys.forEach((k) => {
            if (!["id","created_at","updated_at"].includes(k))
              walk(oldVal?.[k], newVal?.[k], [...path,k]);
          });
        }
      };

      walk(before, after, []);

      // Some legacy history entries keep explicit row changes instead of before/after snapshots.
      const explicit = h.satirlar || h.rows || h.degisiklikler || h.detaylar;
      if ((!before || (Array.isArray(before) && !before.length)) && Array.isArray(explicit)) {
        explicit.forEach((r, i) => push(
          h,
          r.rota || r.guzergah || r.yukleme_bosaltma || r.yukleme || r.cikis || r.varis || `Tarife ${i+1}`,
          r.tip || r.arac_tipi || r.kategori || "Fiyat",
          r.eski_fiyat ?? r.eski ?? r.oldValue,
          r.yeni_fiyat ?? r.yeni ?? r.newValue
        ));
      }
    });

    return rows.sort((a,b) => new Date(a.created_at || 0) - new Date(b.created_at || 0));
  };

  const FirstPriceArchiveButton = () => {
    if (!customer || !firstArchiveKey) return null;
    const archive = readFirstPriceArchive(firstArchiveKey);
    const priceRows = archive ? flattenFirstPrices(archive.snapshot).filter((x) => /fiyat|ton|tl|tir|haric|dahil|satis|alis|kirkayak|dorse/i.test(x.path)) : [];
    const changeRows = getFirstPriceOperationRows();
    const hasStandardTariffSnapshot = archive?.snapshot &&
      Array.isArray(archive.snapshot.alis) && Array.isArray(archive.snapshot.satis);

    // FASDAT gibi standart tarife kullanan müşterilerde zaman çizelgesini teknik JSON yolu
    // (alis / 1 / ton_tl, musteri_id vb.) yerine ekrandaki tarife tablosu ile aynı şekilde kur.
    const initialRows = archive
      ? (hasStandardTariffSnapshot
          ? [
              ...archive.snapshot.alis.map((row, i) => ({
                id: `initial-alis-${row.id || i}`,
                created_at: archive.created_at,
                label: [row.il, row.ilce, row.koy_mahalle].filter(Boolean).join(" / ") || `Tarife ${i + 1}`,
                type: "Alış",
                oldValue: Number(row.ton_tl || 0),
                newValue: Number(row.ton_tl || 0),
                fuelRate: 0,
                appliedRate: 0,
                isInitial: true,
              })),
              ...archive.snapshot.satis.map((row, i) => ({
                id: `initial-satis-${row.id || i}`,
                created_at: archive.created_at,
                label: [row.il, row.ilce, row.koy_mahalle].filter(Boolean).join(" / ") || `Tarife ${i + 1}`,
                type: "Satış",
                oldValue: Number(row.ton_tl || 0),
                newValue: Number(row.ton_tl || 0),
                fuelRate: 0,
                appliedRate: 0,
                isInitial: true,
              })),
            ]
          : flattenFirstPrices(archive.snapshot)
              .filter((x) => /fiyat|ton|tl|tir|haric|dahil|satis|alis|kirkayak|dorse/i.test(x.path))
              .map((x, i) => ({
                id: `initial-${i}`,
                created_at: archive.created_at,
                label: x.path,
                type: "İlk Fiyat",
                oldValue: Number(x.value || 0),
                newValue: Number(x.value || 0),
                fuelRate: 0,
                appliedRate: 0,
                isInitial: true,
              })))
      : [];
    const operationRows = [...initialRows, ...changeRows].sort(
      (a,b) => new Date(a.created_at || 0) - new Date(b.created_at || 0)
    );

    const firstPriceTimelineDates = [...new Set(
      operationRows
        .filter((r) => !r.isInitial && r.created_at)
        .map((r) => r.created_at)
    )].sort((a,b) => new Date(a) - new Date(b));

    const firstPriceTimelineMap = new Map();
    operationRows.forEach((row) => {
      const key = `${row.label}|||${row.type}`;
      if (!firstPriceTimelineMap.has(key)) {
        firstPriceTimelineMap.set(key, {
          key,
          label: row.label,
          type: row.type === "İlk Fiyat" ? "Fiyat" : row.type,
          initial: null,
          changes: {},
        });
      }
      const item = firstPriceTimelineMap.get(key);
      if (row.isInitial) {
        item.initial = row.newValue;
      } else if (row.created_at) {
        item.changes[row.created_at] = row;
        if (item.initial == null) item.initial = row.oldValue;
      }
    });
    const firstPriceTimelineRows = [...firstPriceTimelineMap.values()];
    firstPriceTimelineRows.forEach((item) => {
      let last = item.initial;
      firstPriceTimelineDates.forEach((date) => {
        const change = item.changes[date];
        if (change) last = change.newValue;
        item.changes[date] = change ? { ...change, displayValue: change.newValue } : { displayValue: last, unchanged: true };
      });
      item.current = last;
    });
    return (
      <>
        <button type="button" className="first-price-floating" onClick={() => setFirstPriceArchiveOpen(true)}>
          <History size={17} />
          <span><small>FİYAT HAFIZASI</small><b>İlk Fiyatlar</b></span>
        </button>
        {firstPriceArchiveOpen && createPortal(
          <div className="fuel-modal-backdrop first-price-backdrop">
            <div className="first-price-modal">
              <div className="first-price-modal-head">
                <div>
                  <span>KALICI FİYAT HAFIZASI</span>
                  <h2>En Eski / İlk Fiyatlar</h2>
                  <p>Bu kayıt güncellemelerden ve geri alma işlemlerinden etkilenmez. İlk tarife her zaman korunur.</p>
                </div>
                <button type="button" onClick={() => setFirstPriceArchiveOpen(false)}>×</button>
              </div>
              <div className="first-price-meta">
                <div><small>MÜŞTERİ</small><b>{customer.musteri_adi || customer.kod}</b></div>
                <div><small>KAYNAK</small><b>{archive?.source || "Henüz oluşturulmadı"}</b></div>
                <div><small>İLK KAYIT</small><b>{archive?.created_at ? new Date(archive.created_at).toLocaleString("tr-TR") : "—"}</b></div>
                <div><small>KORUMA</small><b>Kalıcı</b></div>
              </div>
              {isBimCustomer(customer) && Array.isArray(archive?.snapshot) ? (
                <section className="fuel-price-panel first-price-list-panel sell bim-first-raw-panel">
                  <div className="fuel-price-panel-head">
                    <div className="fuel-price-title">
                      <span className="fuel-table-icon"><BadgeDollarSign size={18}/></span>
                      <div><small>BİM / KAYNAK EXCEL</small><h2>Ham İlk Fiyatlar (Küsuratlı)</h2></div>
                    </div>
                    <span className="first-price-protected">0,50 öncesi gerçek değer</span>
                  </div>
                  <div className="fuel-table-wrap bim-table-wrap">
                    <table className="fuel-table bim-table">
                      <thead><tr><th>SIRA</th><th>ATIK ÇIKIŞ BÖLGESİ</th>{BIM_DESTINATIONS.map(d=><th key={d}>{d}</th>)}</tr></thead>
                      <tbody>{archive.snapshot.map((r,index)=><tr key={`bim-first-raw-${r.sira || index}`}><td>{r.sira || index+1}</td><td><b>{r.cikis || "—"}</b></td>{BIM_DESTINATIONS.map(d=>{const raw=r.fiyatlar?.[d];return <td key={d} className="bim-price"><b>{tariffRaw(raw)}</b></td>})}</tr>)}</tbody>
                    </table>
                  </div>
                </section>
              ) : null}
              {archive?.snapshot && Array.isArray(archive.snapshot.alis) && Array.isArray(archive.snapshot.satis) ? (
                <div className="first-price-tariff-grid">
                  {[
                    { key: "alis", title: "İlk Yakıt Alış Fiyatları", eyebrow: "TEDARİK", rows: archive.snapshot.alis },
                    { key: "satis", title: "İlk Yakıt Satış Fiyatları", eyebrow: "MÜŞTERİ", rows: archive.snapshot.satis },
                  ].map((group) => (
                    <section key={group.key} className={`fuel-price-panel first-price-list-panel ${group.key === "alis" ? "buy" : "sell"}`}>
                      <div className="fuel-price-panel-head">
                        <div className="fuel-price-title">
                          <span className="fuel-table-icon">{group.key === "alis" ? <ShoppingCart size={18}/> : <BadgeDollarSign size={18}/>}</span>
                          <div><small>{group.eyebrow}</small><h2>{group.title}</h2></div>
                        </div>
                        <span className="first-price-protected">Korunan başlangıç listesi</span>
                      </div>
                      <div className="fuel-table-wrap">
                        <table className="fuel-table compact tariff">
                          <thead><tr><th>#</th><th>İL</th><th>İLÇE</th><th>KÖY/MAHALLE</th><th>TON/TL</th></tr></thead>
                          <tbody>
                            {group.rows.map((row, index) => (
                              <tr key={`${group.key}-${row.id || index}`}>
                                <td>{index + 1}</td><td>{row.il || "—"}</td><td>{row.ilce || "—"}</td><td>{row.koy_mahalle || "—"}</td>
                                <td><b>{tariffMoney(row.ton_tl)}</b></td>
                              </tr>
                            ))}
                            {!group.rows.length && <tr><td colSpan="5"><div className="fuel-empty-table"><b>İlk fiyat kaydı bulunamadı</b></div></td></tr>}
                          </tbody>
                        </table>
                      </div>
                    </section>
                  ))}
                </div>
              ) : null}

              <div className={`first-price-history-block first-price-horizontal-history ${archive?.snapshot && Array.isArray(archive.snapshot.alis) && Array.isArray(archive.snapshot.satis) ? "first-price-history-secondary" : ""}`}>
                <div className="first-price-section-head">
                  <div>
                    <span>İLK FİYATTAN BUGÜNE</span>
                    <h3>Fiyat Değişim Zaman Çizelgesi</h3>
                    <p>Her tarife tek satırda; yapılan işlemler tarih sırasıyla soldan sağa gösterilir.</p>
                  </div>
                  <b>{firstPriceTimelineDates.length} değişim</b>
                </div>

                <div className="first-price-timeline-scroll">
                  <table className="first-price-timeline-table">
                    <thead>
                      <tr>
                        <th className="timeline-sticky timeline-route-head">YÜKLEME / BOŞALTMA - TARİFE</th>
                        <th className="timeline-sticky timeline-type-head">TİP</th>
                        <th className="timeline-initial-head">
                          <strong>İLK FİYAT</strong>
                          <small>Başlangıç kaydı</small>
                        </th>
                        {firstPriceTimelineDates.map((date) => {
                          const dateRows = operationRows.filter((r) => !r.isInitial && r.created_at === date);
                          const sample = dateRows[0];
                          return (
                            <th key={date} className="timeline-change-head">
                              <strong>{new Date(date).toLocaleDateString("tr-TR")}</strong>
                              <small>{new Date(date).toLocaleTimeString("tr-TR",{hour:"2-digit",minute:"2-digit"})}</small>
                              {sample && (
                                <span className={sample.fuelRate < 0 ? "timeline-head-rate down" : "timeline-head-rate up"}>
                                  {sample.fuelRate < 0 ? "↓" : "↑"} %{Math.abs(sample.fuelRate*100).toLocaleString("tr-TR",{minimumFractionDigits:2,maximumFractionDigits:2})}
                                  {" · "}
                                  {sample.newValue >= sample.oldValue ? "+" : "-"}₺{Math.round(Math.abs(sample.newValue-sample.oldValue)).toLocaleString("tr-TR",{maximumFractionDigits:0})}
                                </span>
                              )}
                            </th>
                          );
                        })}
                        <th className="timeline-current-head"><strong>GÜNCEL</strong><small>Son fiyat</small></th>
                      </tr>
                    </thead>
                    <tbody>
                      {firstPriceTimelineRows.length ? firstPriceTimelineRows.map((row) => (
                        <tr key={row.key}>
                          <td className="timeline-sticky timeline-route-cell">{row.label}</td>
                          <td className="timeline-sticky timeline-type-cell"><span>{row.type}</span></td>
                          <td className="timeline-price initial">{tariffMoney(row.initial)}</td>
                          {firstPriceTimelineDates.map((date) => {
                            const cell=row.changes[date];
                            return (
                              <td key={date} className={`timeline-price ${cell?.unchanged ? "unchanged" : "changed"}`}>
                                <b>{tariffMoney(cell?.displayValue)}</b>
                                {!cell?.unchanged && (
                                  <small className={cell?.newValue < cell?.oldValue ? "down" : "up"}>
                                    {cell?.newValue < cell?.oldValue ? "↓" : "↑"} %{Math.abs(((cell?.newValue-cell?.oldValue)/(cell?.oldValue || 1))*100).toLocaleString("tr-TR",{minimumFractionDigits:2,maximumFractionDigits:2})}
                                    {" · "}
                                    {cell?.newValue >= cell?.oldValue ? "+" : "-"}₺{Math.round(Math.abs((cell?.newValue||0)-(cell?.oldValue||0))).toLocaleString("tr-TR",{maximumFractionDigits:0})}
                                  </small>
                                )}
                                {cell?.unchanged && <small className="same">Değişmedi</small>}
                              </td>
                            );
                          })}
                          <td className="timeline-price current"><b>{tariffMoney(row.current)}</b></td>
                        </tr>
                      )) : (
                        <tr><td colSpan={4+firstPriceTimelineDates.length} className="first-price-history-empty">Henüz fiyat hareketi bulunmuyor.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="first-price-original-head">
                <div><span>BAŞLANGIÇ TARİFESİ</span><h3>Korunan İlk Fiyatlar</h3></div>
                <b>Kalıcı kayıt</b>
              </div>
              <div className="first-price-table-wrap">
                {priceRows.length ? (
                  <table className="first-price-table">
                    <thead><tr><th>KAYIT YOLU</th><th>İLK FİYAT</th></tr></thead>
                    <tbody>{priceRows.map((row, i) => (
                      <tr key={`${row.path}-${i}`}><td>{row.path}</td><td>{tariffMoney(row.value)}</td></tr>
                    ))}</tbody>
                  </table>
                ) : <div className="first-price-empty">İlk fiyat arşivi müşteri tarifesi yüklendiğinde otomatik oluşturulacak.</div>}
              </div>
            </div>
          </div>,
          document.body
        )}
      </>
    );
  };

  const [
    rowForm,
    setRowForm,
  ] = useState({
    il: "",
    ilce: "",
    koy_mahalle: "",
    ton_tl: "",
  });


  const getLatestFuelOperation = () => {
    if (!customer) return null;
    let item = null;

    if (isBimCustomer(customer)) item = bimHistory?.[0] || null;
    else if (isTeverpanCustomer(customer)) item = teverpanHistory?.[0] || null;
    else if (isEforCayCustomer(customer)) item = eforCayHistory?.[0] || null;
    else if (isCortevaCustomer(customer)) item = cortevaHistory?.[0] || null;
    else if (isCmcAgroCustomer(customer)) item = cmcHistory?.[0] || null;
    else if (isEtiCustomer(customer)) item = etiHistory?.[0] || null;
    else if (isKwsCustomer(customer)) item = kwsHistory?.[0] || null;
    else item = history?.[0] || null;

    if (!item) return null;

    const oldFuel = Number(item.eski_yakit_fiyati ?? item.eski_yakit ?? 0);
    const newFuel = Number(item.yeni_yakit_fiyati ?? item.yeni_yakit ?? 0);
    const fuelRate = Number(item.yakit_degisim_orani ?? item.yakit_orani ?? 0);
    const appliedRate = Number(item.uygulanan_artis_orani ?? item.uygulanan_oran ?? 0);

    return {
      created_at: item.created_at,
      oldFuel,
      newFuel,
      fuelRate,
      appliedRate,
    };
  };

  const FuelReferenceBanner = ({ station, location, note }) => {
    let live = null;
    try {
      const allUi = JSON.parse(localStorage.getItem("odak_yakit_ui_prices_v1") || "{}");
      const key = isBimCustomer(customer) ? "BİM" : isTeverpanCustomer(customer) ? "TEVERPAN" : isEforCayCustomer(customer) ? "EFOR ÇAY" : isCortevaCustomer(customer) ? "CORTEVA" : isCmcAgroCustomer(customer) ? "CMC AGRO" : isEtiCustomer(customer) ? "ETİ" : isKwsCustomer(customer) ? "KWS" : "FASDAT";
      live = allUi[key] || null;
    } catch {}

    const oldPrice = Number(live?.old ?? live?.baseline);
    const currentPrice = Number(live?.new);
    const change = Number.isFinite(oldPrice) && oldPrice > 0 && Number.isFinite(currentPrice)
      ? ((currentPrice - oldPrice) / oldPrice) * 100
      : null;
    const priceText = (v) => Number.isFinite(v) && v > 0
      ? `${v.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺`
      : "—";
    const checkedAt = live?.checkedAt || live?.updatedAt;

    return (
      <section className="fuel-reference-panel">
        <div className="fuel-reference-banner">
          <div className={`fuel-reference-icon ${station === "Shell" ? "shell" : "po"}`} aria-hidden="true">{station === "Shell" ? <img src="/fuel-assets/shell-logo.png" alt="Shell"/> : <img src="/fuel-assets/petrol-ofisi-logo.svg" alt="Petrol Ofisi"/>}</div>
          <div className="fuel-reference-main">
            <span>YAKIT REFERANS NOKTASI</span>
            <div className="fuel-reference-title">
              <strong>{station}</strong><span className="fuel-reference-dot">•</span><b>{location}</b>
            </div>
            <small>{note || "Yakıt eskalasyon hesabında bu istasyon / lokasyon fiyatı referans alınır."}</small>
          </div>
          <div className="fuel-reference-badge"><span>REFERANS</span><b>AKTİF</b></div>
          {station === "Shell" && <div className="fuel-reference-photo" aria-hidden="true"><img src="/fuel-assets/shell-station.jpg" alt=""/></div>}
        </div>

        <div className="fuel-reference-prices">
          <div className="fuel-reference-price-card previous">
            <span>REFERANS FİYAT</span><strong>{priceText(oldPrice)}</strong><small>Son kabul edilen litre fiyatı</small>
          </div>
          <div className="fuel-reference-price-card current">
            <span>ANLIK FİYAT</span><strong>{priceText(currentPrice)}</strong><small>{live?.source || `${station} fiyat kaynağı`}</small>
          </div>
          <div className={`fuel-reference-price-card change ${change > 0 ? "up" : change < 0 ? "down" : "same"}`}>
            <span>FİYAT DEĞİŞİMİ</span>
            <strong>{change == null ? "—" : <>{change > 0 ? <TrendingUp size={18}/> : change < 0 ? <TrendingDown size={18}/> : <Minus size={18}/>} %{Math.abs(change).toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</>}</strong>
            <small>Referans fiyata göre</small>
          </div>
          <div className="fuel-reference-price-card status">
            <span>SON KONTROL</span><strong>{checkedAt ? new Date(checkedAt).toLocaleString("tr-TR", { dateStyle: "short", timeStyle: "short" }) : "Bekleniyor"}</strong><small>{live?.rulePassed ? "Eskalasyon kuralı sağlandı" : "Otomatik fiyat takibi"}</small>
          </div>
        </div>
      </section>
    );
  };

  const FasdatFuelMonitor = () => {
    let live = null;
    try {
      const allUi = JSON.parse(localStorage.getItem("odak_yakit_ui_prices_v1") || "{}");
      live = allUi.FASDAT || null;
    } catch {}
    const oldPrice = Number(live?.old ?? live?.baseline ?? 0);
    const currentPrice = Number(live?.new ?? 0);
    const change = oldPrice > 0 && currentPrice > 0 ? ((currentPrice - oldPrice) / oldPrice) * 100 : 0;
    const appliedPercent = Number(applied || 0) * 100;
    const price = (value) => Number(value || 0).toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const bars = [42, 47, 45, 55, 58, 66, 63, 73, 81, 76, 88, 94];
    return (
      <section className="fasdat-fuel-monitor" aria-label="FASDAT canlı motorin fiyat takibi">
        <div className="fasdat-monitor-title">
          <span className="fasdat-live-dot" />
          <div><small>CANLI YAKIT TAKİBİ</small><h2>Motorin fiyat hareketi</h2><p>Shell Afyon Merkez · litre bazında güncel takip</p></div>
          <span className="fasdat-live-badge"><span /> Canlı takip</span>
        </div>
        <div className="fasdat-monitor-grid">
          <div className="fasdat-gauge-card">
            <div className="fasdat-gauge-ring"><div><Fuel size={22} /><b>{currentPrice ? price(currentPrice) : "—"} ₺</b><small>/ litre</small></div></div>
            <span className="fasdat-gauge-caption">GÜNCEL MOTORİN FİYATI</span>
          </div>
          <div className="fasdat-price-flow">
            <div className="fasdat-flow-label"><span>ÖNCEKİ</span><b>{oldPrice ? `${price(oldPrice)} ₺` : "—"}</b></div>
            <div className="fasdat-flow-line"><i /><ArrowRight size={18} /></div>
            <div className="fasdat-flow-label current"><span>ŞİMDİ</span><b>{currentPrice ? `${price(currentPrice)} ₺` : "—"}</b></div>
            <div className={`fasdat-change-pill ${change >= 0 ? "up" : "down"}`}>{change >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />} %{Math.abs(change).toFixed(2)}</div>
          </div>
          <div className="fasdat-mini-chart-card">
            <div><span>FİYAT TRENDİ</span><b>{change >= 0 ? "Yükseliş" : "Düşüş"}</b></div>
            <div className="fasdat-mini-bars">{bars.map((height, index) => <i key={index} style={{ height: `${height}%`, animationDelay: `${index * 45}ms` }} />)}</div>
            <small>Son 12 fiyat kontrolü</small>
          </div>
          <div className="fasdat-impact-card"><span>TARİFE ETKİSİ</span><strong>{appliedPercent ? `%${Math.abs(appliedPercent).toFixed(2)}` : "%0,00"}</strong><small>{update ? "Güncelleme hazır" : "Eşik altında"}</small></div>
        </div>
      </section>
    );
  };

  const FuelOpsEnhancements = () => {
    if (!customer) return null;
    const key=getCustomerKey(customer), allUi=(()=>{try{return JSON.parse(localStorage.getItem("odak_yakit_ui_prices_v1")||"{}")}catch{return {}}})();
    const live=allUi[key]||{}; const oldP=Number(live.old ?? live.baseline ?? calc.eski ?? 0); const newP=Number(live.new ?? calc.yeni ?? 0);
    const change=oldP&&newP?((newP/oldP)-1)*100:0;
    const threshold=Number(live.thresholdPct ?? live.threshold ?? (key==="FASDAT"?7:7));
    const applied=Number(live.appliedRatePct ?? live.appliedPct ?? (Math.abs(change)>=threshold?change/2:0));
    const remain=Math.max(0,threshold-Math.abs(change)); const passed=Math.abs(change)>=threshold;
    const affected=(rows?.alis?.length||0)+(rows?.satis?.length||0) || Number(live.affectedRows||0) || 0;
    const mode=getOpsSettings()[key]||"approval";
    const historyKey=`odak_fuel_price_history_${key}`; let priceHistory=[]; try{priceHistory=JSON.parse(localStorage.getItem(historyKey)||"[]")}catch{}
    if(newP && (!priceHistory.length || priceHistory[priceHistory.length-1]?.price!==newP)){ priceHistory=[...priceHistory,{date:new Date().toISOString(),price:newP}].slice(-90); localStorage.setItem(historyKey,JSON.stringify(priceHistory)); }
    const points=priceHistory.slice(-opsRange); const vals=points.map(x=>Number(x.price)).filter(Number.isFinite); const min=Math.min(...vals,newP||0), max=Math.max(...vals,newP||0); const span=Math.max(1,max-min);
    const sim=Number(String(opsSimulation).replace(",",".")); const simChange=oldP&&sim?((sim/oldP)-1)*100:null; const simPassed=simChange!=null&&Math.abs(simChange)>=threshold;
    const smartText=passed?`Motorin ${change>=0?"+":""}%${Math.abs(change).toLocaleString("tr-TR",{minimumFractionDigits:2,maximumFractionDigits:2})} değişti. ${key} kuralı tetiklendi. Alış ve satış tarifelerine %${Math.abs(applied).toLocaleString("tr-TR",{minimumFractionDigits:2,maximumFractionDigits:2})} yansıtılacak. ${affected||"Mevcut"} fiyat etkilenecek.`:`Motorin değişimi %${Math.abs(change).toLocaleString("tr-TR",{minimumFractionDigits:2,maximumFractionDigits:2})}. ${key} için %${threshold} eşiğine %${remain.toLocaleString("tr-TR",{minimumFractionDigits:2,maximumFractionDigits:2})} kaldı.`;
    const ruleMap={
      "FASDAT":{threshold:7,factor:50,comparison:"%7’yi geçerse",provider:"Shell",location:"Afyon Merkez",logo:"/fuel-assets/shell-logo.png"},
      "KWS":{threshold:12,factor:30,comparison:"%12 veya üzeri",provider:"Petrol Ofisi",location:"Eskişehir Merkez",logo:"/fuel-assets/petrol-ofisi-logo.svg"},
      "ETİ":{threshold:10,factor:50,comparison:"%10’u geçerse",provider:"Petrol Ofisi",location:"Eskişehir Odunpazarı",logo:"/fuel-assets/petrol-ofisi-logo.svg"},
      "CMC AGRO":{threshold:5,factor:50,comparison:"%5 veya üzeri",provider:"Petrol Ofisi",location:"Bursa Karacabey",logo:"/fuel-assets/petrol-ofisi-logo.svg"},
      "CORTEVA":{threshold:5,factor:40,comparison:"%5’i geçerse",provider:"Petrol Ofisi",location:"Adana Merkez",logo:"/fuel-assets/petrol-ofisi-logo.svg"},
      "EFOR ÇAY":{threshold:5,factor:50,comparison:"%5 veya üzeri",provider:"Petrol Ofisi",location:"Tokat Erbaa",logo:"/fuel-assets/petrol-ofisi-logo.svg"},
      "TEVERPAN":{threshold:5,factor:50,comparison:"%5 veya üzeri",provider:"Petrol Ofisi",location:"Tekirdağ Çerkezköy",logo:"/fuel-assets/petrol-ofisi-logo.svg"},
      "BİM":{threshold:5,factor:40,comparison:"%5 veya üzeri",provider:"Petrol Ofisi",location:"İstanbul Sancaktepe",logo:"/fuel-assets/petrol-ofisi-logo.svg",vatIncluded:false,priceMode:"KDV hariç (+KDV)"}
    };
    const rule=ruleMap[key]||ruleMap.FASDAT;
    const ruleThreshold=Number(live.thresholdPct ?? live.threshold ?? rule.threshold);
    const ruleFactor=Number(live.factorPct ?? live.factor ?? rule.factor);
    const ruleApplied=Math.abs(change)>=ruleThreshold?change*(ruleFactor/100):0;
    const manualMode=mode==="manual";
    const setManualFuelPrice=(value)=>{
      let all={}; try{all=JSON.parse(localStorage.getItem("odak_yakit_ui_prices_v1")||"{}")}catch{}
      const parsed=Number(String(value).replace(",","."));
      const previous=Number(all[key]?.new);
      all[key]={...(all[key]||{}),new:Number.isFinite(parsed)?parsed:value,source:"Manuel giriş",updatedAt:new Date().toISOString()};
      localStorage.setItem("odak_yakit_ui_prices_v1",JSON.stringify(all));
      if(Number.isFinite(parsed))createFuelPriceNotification({customer:key,oldPrice:previous,newPrice:parsed,referencePrice:oldP,threshold:ruleThreshold,source:"Manuel giriş"});
      window.dispatchEvent(new Event("odak-fuel-updated"));
    };
    const openPreview=()=>{ const base=[...(rows?.alis||[]),...(rows?.satis||[])]; const values=base.map(r=>Number(r.ton_tl??r.fiyat??r.tlTon??r.tir??0)).filter(Number.isFinite); const total=values.reduce((a,b)=>a+b,0); const rate=applied/100; setOpsPreview({key,affected:values.length||affected,total,next:total*(1+rate),diff:total*rate,rate,oldP,newP}); };
    const approve=()=>{ if(!opsPreview)return; const id=addOpsAudit({customer:key,oldFuel:opsPreview.oldP,newFuel:opsPreview.newP,appliedRate:opsPreview.rate,affected:opsPreview.affected,status:"Onaylandı",mode}); const notices=(()=>{try{return JSON.parse(localStorage.getItem("odak_sistem_bildirimleri_v1")||"[]")}catch{return []}})(); localStorage.setItem("odak_sistem_bildirimleri_v1",JSON.stringify([{id,title:`${key} yakıt eskalasyonu onaylandı`,message:`${id} • ${opsPreview.affected} fiyat için onay verildi.`,type:"success",read:false,created_at:new Date().toISOString(),action_path:"/finans/yakit-hesaplama"},...notices])); window.dispatchEvent(new Event("odak-notifications-changed")); setOpsPreview(null); setInfo(`${id} numaralı eskalasyon onayı kaydedildi. Mevcut müşteri güncelleme butonuyla tarifeye uygulayabilirsiniz.`); };
    const exportAudit=()=>{ const audit=getOpsAudit().filter(x=>x.customer===key); const data=audit.map(x=>({"İşlem No":x.id,"Müşteri":x.customer,"Eski Yakıt":x.oldFuel,"Yeni Yakıt":x.newFuel,"Uygulanan Oran":x.appliedRate,"Etkilenen":x.affected,"Durum":x.status,"Tarih":x.created_at})); const wb=XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(data.length?data:[{"Bilgi":"Henüz işlem yok"}]),"Değişiklik Raporu"); XLSX.writeFile(wb,`${key}_Yakit_Denetim_Raporu.xlsx`); };
    return <>
      <section className={`ops-smart-summary ${passed?"danger":remain<=1?"warning":"normal"}`}><div><b>{passed?"Eskalasyon kuralı tetiklendi":remain<=1?"Eşiğe yaklaşılıyor":"Yakıt değişimi kontrol altında"}</b><p>{smartText}</p></div><span>{passed?"Güncelleme Gerekli":remain<=1?"Eşiğe Yakın":"Normal"}</span></section>
      <section className={`customer-rule-command ${rule.provider==="Shell"?"is-shell":"is-po"}`}>
        <div className="crc-provider">
          <div className="crc-logo"><img src={rule.logo} alt={rule.provider}/></div>
          <div><small>YAKIT REFERANS KAYNAĞI</small><h3>{rule.provider}</h3><p>{rule.location} · Motorin</p><span>● Otomatik fiyat bağlantısı aktif</span></div>
        </div>
        <div className="crc-rule">
          <small>{key} MÜŞTERİ KURALI</small><h3>%{ruleThreshold} eşik <i>→</i> %{ruleFactor} yansıtma</h3>
          <p><b>{rule.comparison}</b> yakıt değişiminde, değişimin <b>%{ruleFactor}</b>’si tarifeye uygulanır. Hesaplanan tüm tarife tutarları <b>standart yuvarlanır: 0,50 ve üzeri yukarı, 0,50 altı aşağı.</b></p><div className="crc-formula">Formül: ((Yeni Yakıt ÷ Eski Yakıt) − 1) × 100 → eşik kontrolü → × %{ruleFactor} yansıtma → Yeni Tarife (0,50↑ / 0,49↓)</div>
          <div className="crc-rule-tags"><b>Mevcut %{Math.abs(change).toFixed(2)}</b><span>{Math.abs(change)>=ruleThreshold?"Kural sağlandı":"Eşiğe %"+Math.max(0,ruleThreshold-Math.abs(change)).toFixed(2)+" kaldı"}</span></div>
        </div>
        <div className="crc-price old"><small>ESKİ YAKIT DEĞERİ</small><strong>{oldP?money(oldP):"—"}</strong><p>🔒 Son kaydedilmiş değer</p><em>Kullanıcı değiştiremez</em></div>
        <div className="crc-arrow"><ArrowRight size={20}/></div>
        <div className={`crc-price current ${manualMode?"manual":"auto"}`}><small>YENİ YAKIT DEĞERİ</small>{manualMode?<input defaultValue={newP?String(newP).replace(".",","):""} onBlur={e=>setManualFuelPrice(e.target.value)} placeholder="Yeni fiyatı yazın"/>:<strong>{newP?money(newP):"Bekleniyor"}</strong>}<p>{manualMode?"✎ Manuel fiyat girişi":"⚡ Otomatik olarak yerleştirildi"}</p><em>{manualMode?"Sadece bu modda düzenlenebilir":rule.provider+" / "+rule.location}</em></div>
        <div className="crc-result"><small>HESAPLAMA SONUCU</small><strong>{Math.abs(change)>=ruleThreshold?`%${Math.abs(ruleApplied).toFixed(2)} tarife etkisi`:`%0,00 tarife etkisi`}</strong><p>{Math.abs(change)>=ruleThreshold?"Kural sağlandı · uygulamaya hazır":"Kural sağlanmadı · işlem yapılmaz"}</p><span>{manualMode?"MANUEL MOD":"OTOMATİK MOD"}</span></div>
      </section>
      <section className="ops-grid legacy-ops-grid">
        <div className="ops-card ops-chart"><div className="ops-head"><div><b>Yakıt Fiyat Grafiği</b><small>Referans fiyat hareketi ve eşik takibi</small></div><div className="ops-seg"><button className={opsRange===30?"active":""} onClick={()=>setOpsRange(30)}>30 Gün</button><button className={opsRange===90?"active":""} onClick={()=>setOpsRange(90)}>90 Gün</button></div></div><div className="ops-chart-area">{vals.length>1?points.map((x,i)=><i key={i} style={{height:`${20+((Number(x.price)-min)/span)*70}%`}} title={`${new Date(x.date).toLocaleDateString("tr-TR")} • ${money(x.price)}`}/>):<div className="ops-empty-chart">Fiyat geçmişi biriktikçe grafik burada oluşacak.</div>}<em style={{bottom:`${Math.min(92,20+(threshold/Math.max(threshold+3,10))*70)}%`}}>Eşik %{threshold}</em></div></div>
        <div className="ops-card"><div className="ops-head"><div><b>Simülasyon Modu</b><small>Gerçek tarifeyi değiştirmeden test edin</small></div><span className="ops-badge">TEST</span></div><label className="ops-input-label">Motorin fiyatı kaç TL olursa?</label><div className="ops-sim-row"><input value={opsSimulation} onChange={e=>setOpsSimulation(e.target.value)} placeholder="105,00"/><div className={simPassed?"sim-result hit":"sim-result"}>{simChange==null?"Fiyat girin":`${simChange>=0?"+":""}%${Math.abs(simChange).toFixed(2)} • ${simPassed?"Eşik tetiklenir":"Eşik tetiklenmez"}`}</div></div></div>
        <div className="ops-card"><div className="ops-head"><div><b>Otomasyon Modu</b><small>Müşteri bazlı çalışma şekli</small></div></div><div className="ops-mode">{[["notify","Sadece Bildir"],["approval","Onay İste"],["auto","Otomatik Uygula"]].map(([v,l])=><button key={v} className={mode===v?"active":""} onClick={()=>setOpsMode(key,v)}>{l}</button>)}</div><div className="ops-actions"><button onClick={exportAudit}><Download size={14}/> Denetim Excel'i</button>{passed&&<button className="primary" onClick={openPreview}>Önizle ve Onayla</button>}</div></div>
      </section>
      <section className="ops-compare legacy-ops-compare"><div><b>Değişiklik Karşılaştırması</b><span>İki tarih arasındaki tarife hareketlerini karşılaştırın.</span></div><input type="date" value={opsCompare.from} onChange={e=>setOpsCompare(v=>({...v,from:e.target.value}))}/><span>↔</span><input type="date" value={opsCompare.to} onChange={e=>setOpsCompare(v=>({...v,to:e.target.value}))}/><button onClick={()=>setInfo(opsCompare.from&&opsCompare.to?`${opsCompare.from} ↔ ${opsCompare.to} karşılaştırması hazır. Geçmiş kayıtlarındaki değişimler filtrelendi.`:"Karşılaştırma için iki tarih seçin.")}>Karşılaştır</button></section>
      {opsPreview&&createPortal(<div className="ops-modal-backdrop"><div className="ops-modal"><div className="ops-modal-head"><div><small>UYGULAMADAN ÖNCE KONTROL</small><h2>{opsPreview.key} Eskalasyon Önizlemesi</h2></div><button onClick={()=>setOpsPreview(null)}>×</button></div><div className="ops-preview-stats"><div><small>DEĞİŞECEK SATIR</small><b>{opsPreview.affected}</b></div><div><small>MEVCUT TOPLAM</small><b>{money(opsPreview.total)}</b></div><div><small>YENİ TOPLAM</small><b>{money(opsPreview.next)}</b></div><div><small>FARK</small><b className="green">+{money(opsPreview.diff)}</b></div></div><div className="ops-preview-note">Eski fiyatlar korunur. Onay kaydı işlem numarasıyla denetim geçmişine yazılır; mevcut müşteri güncelleme fonksiyonu fiyatları uygular.</div><div className="ops-modal-actions"><button onClick={()=>setOpsPreview(null)}>Vazgeç</button><button className="primary" onClick={approve}><CheckCircle2 size={16}/> Onayla ve Uygula</button></div></div></div>,document.body)}
    </>;
  };

  const CustomerUnifiedOverview = () => {
    if (!customer) return null;
    // BİM kendi V48 başlık/sekme/accordion şablonunu kullanıyor.
    // Eski ortak müşteri başlığı ve durum bandını BİM'de tekrar göstermiyoruz;
    // yalnızca alttaki yakıt kuralı / kontrol alanları korunuyor.
    if (isBimCustomer(customer)) return <FuelOpsEnhancements />;
    const latest = getLatestFuelOperation();
    const customerName = customer.musteri_adi || customer.kod || "Müşteri";
    const isFasdat = norm(customerName) === "FASDAT";
    const money = (v) =>
      Number(v || 0).toLocaleString("tr-TR", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 3,
      });
    const percent = (v) =>
      `%${Math.abs(Number(v || 0) * 100).toLocaleString("tr-TR", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`;

    let fuelUiStatus = null;
    try {
      const allUi = JSON.parse(localStorage.getItem("odak_yakit_ui_prices_v1") || "{}");
      const key = isBimCustomer(customer) ? "BİM" : isTeverpanCustomer(customer) ? "TEVERPAN" : isEforCayCustomer(customer) ? "EFOR ÇAY" : isCortevaCustomer(customer) ? "CORTEVA" : isCmcAgroCustomer(customer) ? "CMC AGRO" : isEtiCustomer(customer) ? "ETİ" : isKwsCustomer(customer) ? "KWS" : "FASDAT";
      fuelUiStatus = allUi[key] || null;
    } catch {}

    const undoCurrentCustomer = () => {
      if (isBimCustomer(customer)) return undoLastBimUpdate();
      if (isTeverpanCustomer(customer)) return undoLastTeverpanUpdate();
      if (isEforCayCustomer(customer)) return undoLastEforCayUpdate();
      if (isCortevaCustomer(customer)) return undoLastCortevaUpdate();
      if (isCmcAgroCustomer(customer)) return undoLastCmcUpdate();
      if (isEtiCustomer(customer)) return undoLastEtiUpdate();
      if (isKwsCustomer(customer)) return undoLastKwsUpdate();
      return undoLastUpdate();
    };

    return (
      <section className="fuel-v5-overview">
        <div className="fuel-v5-breadcrumb">
          <button type="button" onClick={() => setCustomer(null)}>Yakıt Hesaplama</button>
          <span>›</span>
          <b>{customerName}</b>
        </div>

        <div className={`fuel-v5-titlebar ${isFasdat ? "fasdat-fuel-hero" : ""}`}>
          <div className="fuel-v5-brand">
            <div className="fuel-v5-brandmark">{isFasdat ? <Fuel size={27} strokeWidth={2.4} /> : customerName.slice(0, 2).toUpperCase()}</div>
            <div>
              <span>{isFasdat ? "FASDAT / MOTORİN FİYAT HESAPLAMA" : "YAKIT HESAPLAMA / MÜŞTERİ"}</span>
              <h1>{isFasdat ? "FASDAT Yakıt Eskalasyon Merkezi" : `${customerName} – Yakıt Hesaplama`}</h1>
              <p>{isFasdat ? "Motorin fiyatını kontrol edin, değişimi hesaplayın ve TON/TL tarifesine yansıtın." : "Yakıt fiyat değişimlerine göre güncel tarife yönetimi ve fiyat geçmişi"}</p>
            </div>
          </div>
          <div className="fuel-v5-title-actions">
            <button type="button" className="fuel-v5-undo-main" onClick={undoCurrentCustomer} disabled={busy} title="Bu müşteri için son tarife güncellemesini geri al">
              <Undo2 size={17}/> Son Yapılan İşlemi Geri Al
            </button>
            {isKwsCustomer(customer) && (
              <button type="button" className="fuel-v5-memory-export" onClick={exportAllKwsHistoryExcel}>
                <Download size={17}/>
                Geçmiş Kayıtları Excel'e Aktar
              </button>
            )}
            {isEtiCustomer(customer) && <button type="button" className="fuel-v5-memory-export" onClick={exportEtiPriceMemoryExcel}><Download size={17}/> Geçmiş Kayıtları Excel'e Aktar</button>}
            {isCmcAgroCustomer(customer) && <button type="button" className="fuel-v5-memory-export" onClick={exportCmcPriceMemoryExcel}><Download size={17}/> Geçmiş Kayıtları Excel'e Aktar</button>}
            {isCortevaCustomer(customer) && <button type="button" className="fuel-v5-memory-export" onClick={exportCortevaPriceMemoryExcel}><Download size={17}/> Geçmiş Kayıtları Excel'e Aktar</button>}
            {isEforCayCustomer(customer) && <button type="button" className="fuel-v5-memory-export" onClick={exportEforPriceMemoryExcel}><Download size={17}/> Geçmiş Kayıtları Excel'e Aktar</button>}
            {isTeverpanCustomer(customer) && <button type="button" className="fuel-v5-memory-export" onClick={exportTeverpanPriceMemoryExcel}><Download size={17}/> Geçmiş Kayıtları Excel'e Aktar</button>}
            {isBimCustomer(customer) && <button type="button" className="fuel-v5-memory-export" onClick={exportBimPriceMemoryExcel}><Download size={17}/> Geçmiş Kayıtları Excel'e Aktar</button>}
            {!isKwsCustomer(customer) && !isEtiCustomer(customer) && !isCmcAgroCustomer(customer) && !isCortevaCustomer(customer) && !isEforCayCustomer(customer) && !isTeverpanCustomer(customer) && !isBimCustomer(customer) && (
              <button type="button" className="fuel-v5-memory-export" onClick={exportFasdatPriceMemoryExcel}>
                <Download size={17}/>
                Geçmiş Kayıtları Excel'e Aktar
              </button>
            )}
            <button type="button" className="fuel-v5-other" onClick={() => setCustomer(null)}>
              <span className="fuel-v5-grid-icon" aria-hidden="true">▦</span>
              Diğer Müşteriler
            </button>
          </div>
        </div>

        <div className="fuel-v5-kpis">
          <div className="fuel-v5-kpi">
            <div className="fuel-v5-kpi-icon green"><History size={19}/></div>
            <div><small>SON YAKIT İŞLEMİ</small><b>{latest?.created_at ? new Date(latest.created_at).toLocaleString("tr-TR") : "Henüz işlem yok"}</b><span>Son kayıtlı güncelleme</span></div>
          </div>
          <div className="fuel-v5-kpi">
            <div className="fuel-v5-kpi-icon slate">⛽</div>
            <div><small>ESKİ YAKIT FİYATI</small><b>{latest ? `₺${money(latest.oldFuel)}` : "—"}</b><span>Son işlemdeki önceki fiyat</span></div>
          </div>
          <div className="fuel-v5-kpi">
            <div className="fuel-v5-kpi-icon blue">⛽</div>
            <div><small>YENİ YAKIT FİYATI</small><b>{latest ? `₺${money(latest.newFuel)}` : "—"}</b><span>Son işlemdeki yeni fiyat</span></div>
          </div>
          <div className="fuel-v5-kpi">
            <div className="fuel-v5-kpi-icon green">↗</div>
            <div><small>DEĞİŞİM ORANI</small><b>{latest ? percent(latest.fuelRate) : "—"}</b><span>Son yakıt değişimi</span></div>
          </div>
          <div className="fuel-v5-kpi">
            <div className="fuel-v5-kpi-icon blue">%</div>
            <div><small>UYGULANAN ETKİ</small><b>{latest ? percent(latest.appliedRate) : "—"}</b><span>Tarifeye yansıtılan oran</span></div>
          </div>
        </div>

        {fuelUiStatus?.message && (
          <div className={`fuel-sync-result ${fuelUiStatus.rulePassed ? "success" : "info"}`}>
            <CheckCircle2 size={18}/>
            <div><b>{fuelUiStatus.rulePassed ? "İşlem yapıldı — kural sağlandı" : "İşlem yapıldı — kural sağlanmadı"}</b><span>{fuelUiStatus.message}</span></div>
          </div>
        )}

        {!isFasdat && <FuelOpsEnhancements />}

        <div className="fuel-v5-tabs">
          <div className="fuel-v5-tab active">▦ <span>Tarife Tablosu</span></div>
          <button type="button" className="fuel-v5-tab" onClick={() => setFirstPriceArchiveOpen(true)}>
            <History size={16}/> <span>İlk Fiyatlar</span>
          </button>
          <div className="fuel-v5-memory-note">
            <b>İlk Fiyatlar Korunur</b>
            <span>Başlangıç fiyatları güncellemelerden etkilenmez.</span>
          </div>
        </div>
      </section>
    );
  };

  /* =======================================================
     MÜŞTERİLER
     Sadece FASDAT ve KWS
  ======================================================= */

  const loadCustomers = async () => {
    setCustomerLoading(true);
    setError("");

    try {
      const {
        data,
        error: customerError,
      } = await supabase
        .from("yakit_musterileri")
        .select(
          "id,musteri_adi,kod"
        );

      if (customerError) {
        throw customerError;
      }

      /*
        Veritabanında BİM, ARKAS veya başka
        müşteriler bulunsa bile burada
        gösterilmeyecek.

        Sadece:
        FASDAT
        KWS
      */
      // Bu ekranda yalnızca FASDAT ve KWS gösterilir.
      // BİM, ARKAS ve diğer tüm müşteriler bilinçli olarak filtrelenir.
      const filtered = (data || [])
        .filter((item) => {
          const name = norm(item?.musteri_adi);
          const code = norm(item?.kod);

          return (
            name === "FASDAT" ||
            code === "FASDAT" ||
            name === "KWS" ||
            code === "KWS" ||
            name === "ETİ" ||
            name === "ETI" ||
            code === "ETİ" ||
            code === "ETI"
          );
        })
        .sort((a, b) => {
          const aName = norm(a?.musteri_adi);
          const aCode = norm(a?.kod);
          const bName = norm(b?.musteri_adi);
          const bCode = norm(b?.kod);

          const customerOrder = (name, code) => {
            if (name === "FASDAT" || code === "FASDAT") return 1;
            if (name === "KWS" || code === "KWS") return 2;
            if (
              name === "ETİ" ||
              name === "ETI" ||
              code === "ETİ" ||
              code === "ETI"
            ) return 3;
            if (name === "EFOR ÇAY" || name === "EFOR CAY" || code === "EFOR_CAY") return 6;
            return 99;
          };

          const aOrder = customerOrder(aName, aCode);
          const bOrder = customerOrder(bName, bCode);

          return aOrder - bOrder;
        });

      // KWS henüz Supabase tablosunda yoksa bile seçim ekranında
      // FASDAT'ın yanında kart olarak göster.
      const hasKws = filtered.some((item) => {
        const name = norm(item?.musteri_adi);
        const code = norm(item?.kod);
        return name === "KWS" || code === "KWS";
      });

      const hasEti = filtered.some((item) => {
        const name = norm(item?.musteri_adi);
        const code = norm(item?.kod);
        return (
          name === "ETİ" ||
          name === "ETI" ||
          code === "ETİ" ||
          code === "ETI"
        );
      });

      const hasCmcAgro = filtered.some((item) => isCmcAgroCustomer(item));
      const hasCorteva = filtered.some((item) => isCortevaCustomer(item));
      const hasEforCay = filtered.some((item) => isEforCayCustomer(item));
      const hasTeverpan = filtered.some((item) => isTeverpanCustomer(item));
      const hasBim = filtered.some((item) => isBimCustomer(item));

      const visibleCustomers = [...filtered];

      if (!hasKws) {
        visibleCustomers.push({
          id: "__KWS_PLACEHOLDER__",
          musteri_adi: "KWS",
          kod: "KWS",
          isPlaceholder: true,
        });
      }

      if (!hasEti) {
        visibleCustomers.push({
          id: "__ETI_PLACEHOLDER__",
          musteri_adi: "ETİ",
          kod: "ETI",
          isPlaceholder: true,
        });
      }

      if (!hasCmcAgro) {
        visibleCustomers.push({
          id: "__CMC_AGRO_PLACEHOLDER__",
          musteri_adi: "CMC AGRO",
          kod: "CMC_AGRO",
          isPlaceholder: true,
        });
      }

      if (!hasCorteva) {
        visibleCustomers.push({
          id: "__CORTEVA_PLACEHOLDER__",
          musteri_adi: "CORTEVA",
          kod: "CORTEVA",
          isPlaceholder: true,
        });
      }

      if (!hasEforCay) {
        visibleCustomers.push({
          id: "__EFOR_CAY_PLACEHOLDER__",
          musteri_adi: "EFOR ÇAY",
          kod: "EFOR_CAY",
          isPlaceholder: true,
        });
      }

      if (!hasTeverpan) {
        visibleCustomers.push({
          id: "__TEVERPAN_PLACEHOLDER__",
          musteri_adi: "TEVERPAN",
          kod: "TEVERPAN",
          isPlaceholder: true,
        });
      }
      if (!hasBim) {
        visibleCustomers.push({ id:"__BIM_PLACEHOLDER__", musteri_adi:"BİM", kod:"BIM", isPlaceholder:true });
      }

      setCustomers(
        visibleCustomers.sort((a, b) => {
          const getOrder = (item) => {
            const name = norm(item?.musteri_adi);
            const code = norm(item?.kod);
            if (name === "FASDAT" || code === "FASDAT") return 1;
            if (name === "KWS" || code === "KWS") return 2;
            if (
              name === "ETİ" ||
              name === "ETI" ||
              code === "ETİ" ||
              code === "ETI"
            ) return 3;
            if (isCmcAgroCustomer(item)) return 4;
            if (isCortevaCustomer(item)) return 5;
            if (isEforCayCustomer(item)) return 6;
            if (isTeverpanCustomer(item)) return 7;
            if (isBimCustomer(item)) return 8;
            return 99;
          };

          return getOrder(a) - getOrder(b);
        })
      );
    } catch (e) {
      console.error(
        "Yakıt müşterileri yüklenemedi:",
        e
      );

      setCustomers([]);

      setError(
        e?.message ||
          "Müşteriler alınamadı."
      );
    } finally {
      setCustomerLoading(false);
    }
  };

  /* =======================================================
     MÜŞTERİ TARİFELERİNİ YÜKLE
  ======================================================= */

  const loadCustomerData = async (
    selectedCustomer
  ) => {
    const activeCustomer =
      selectedCustomer || customer;

    if (!activeCustomer) {
      return;
    }

    setError("");

    try {
      const [
        alisResult,
        satisResult,
      ] = await Promise.all([
        supabase
          .from(
            "yakit_alis_tarifeleri"
          )
          .select("*")
          .eq(
            "musteri_id",
            activeCustomer.id
          )
          .eq("aktif", true)
          .order("id"),

        supabase
          .from(
            "yakit_satis_tarifeleri"
          )
          .select("*")
          .eq(
            "musteri_id",
            activeCustomer.id
          )
          .eq("aktif", true)
          .order("id"),
      ]);

      if (
        alisResult.error ||
        satisResult.error
      ) {
        throw (
          alisResult.error ||
          satisResult.error
        );
      }

      setRows({
        alis:
          alisResult.data || [],

        satis:
          satisResult.data || [],
      });
    } catch (e) {
      console.error(
        "Yakıt tarifeleri yüklenemedi:",
        e
      );

      setError(
        e?.message ||
          "Tarifeler yüklenemedi."
      );
    }
  };

  /* =======================================================
     İLK AÇILIŞ

     FASDAT artık otomatik açılmaz.
     Önce müşteri seçim ekranı gelir.
  ======================================================= */

  useEffect(() => {
    loadCustomers();
  }, []);

  /* =======================================================
     MÜŞTERİ AÇ
  ======================================================= */

  const openCustomer = async (
    selectedCustomer
  ) => {
    setCustomer(selectedCustomer);

    setRows({
      alis: [],
      satis: [],
    });

    const selectedName = norm(selectedCustomer?.musteri_adi || selectedCustomer?.kod || "");
    const isFasdatSelected = selectedName.includes("FASDAT");
    setCalc(isFasdatSelected ? { eski: "91,15", yeni: "97,93" } : { eski: "", yeni: "" });

    setModal(null);
    setHistory([]);
    setError("");
    setInfo("");

    if (
      !isKwsCustomer(selectedCustomer) &&
      !isEtiCustomer(selectedCustomer) &&
      !isCmcAgroCustomer(selectedCustomer) &&
      !isCortevaCustomer(selectedCustomer) &&
      !isEforCayCustomer(selectedCustomer) &&
      !isTeverpanCustomer(selectedCustomer) &&
      !isBimCustomer(selectedCustomer)
    ) {
      await loadCustomerData(
        selectedCustomer
      );
    }
  };

  /* =======================================================
     MÜŞTERİ SEÇİMİNE DÖN
  ======================================================= */

  const FuelOperationLoader = () => {
    if (!fuelOperationLoading) return null;
    const bimLoading = isBimCustomer(customer);

    return createPortal(
      <div className={`fuel-operation-loader-backdrop ${bimLoading ? "bim-fuel-loading-backdrop" : ""}`}>
        <div className={`fuel-operation-loader-card ${bimLoading ? "bim-fuel-loading-card" : ""}`}>
          {bimLoading ? (
            <>
              <div className="bim-fill-title"><span>YAKIT HESAPLANIYOR</span><h3>{fuelOperationLoading}</h3><p>Yeni yakıt fiyatı alınıyor ve BİM tarifeleri yeniden hesaplanıyor.</p></div>
              <div className="bim-fuel-gauge" aria-label="Yakıt dolum animasyonu">
                <div className="bim-pump-top"><img src="/fuel-assets/bim-logo-user.png" alt="BİM" /></div>
                <div className="bim-pump-window"><div className="bim-liquid"><i></i><i></i></div><div className="bim-bubbles"><b></b><b></b><b></b><b></b></div></div>
                <div className="bim-pump-base"></div><div className="bim-hose"></div>
              </div>
              <div className="bim-fill-status"><Fuel size={18}/><span>Depo doldukça hesaplama tamamlanıyor</span></div>
              <div className="bim-loader-steps"><span className="done"><CheckCircle2 size={15}/> Güncel fiyat alındı</span><span className="active"><RefreshCw size={15}/> Tarifeler hesaplanıyor</span><span>Kaydediliyor</span></div>
            </>
          ) : (<>
            <div className="fuel-operation-loader-visual"><div className="fuel-operation-loader-ring"></div><div className="fuel-operation-loader-ring inner"></div><RefreshCw className="fuel-operation-loader-icon" size={22} /></div>
            <span>İŞLEM YAPILIYOR</span><h3>{fuelOperationLoading}</h3><p>Yeni oranlar hesaplanıyor ve tarifeler güncelleniyor.</p><div className="fuel-operation-progress"><i></i></div>
          </>)}
        </div>
      </div>, document.body
    );
  };

  const runFuelOperation = (label, fn) => {
    setFuelOperationLoading(label);
    const bimOperation = isBimCustomer(customer);
    // V51: BİM yakıt animasyonu gözle görülür biçimde tamamen dolsun.
    // Hesaplama animasyonun son bölümünde uygulanır, ardından kısa bir tamamlanma süresi bırakılır.
    const executeAfter = bimOperation ? 3200 : 180;
    const closeAfter = bimOperation ? 650 : 650;
    window.setTimeout(() => {
      try {
        fn();
      } finally {
        window.setTimeout(() => setFuelOperationLoading(null), closeAfter);
      }
    }, executeAfter);
  };

  const goBackCustomers = () => {
    setCustomer(null);

    setRows({
      alis: [],
      satis: [],
    });

    setCalc({
      eski: "",
      yeni: "",
    });

    setModal(null);
    setHistory([]);
    setError("");
    setInfo("");
  };

  // V37: BİM referans/eski yakıt fiyatını mevcut kurulumlarda da 73,96 TL/LT'ye eşitle.
  // Sürüm anahtarı yenilendiği için V33'ü daha önce çalıştırmış tarayıcılarda da düzeltme bir kez uygulanır.
  useEffect(() => {
    const migrationKey = "odak_bim_reference_7396_v37";
    if (localStorage.getItem(migrationKey) === "1") return;
    let all = {}; try { all = JSON.parse(localStorage.getItem("odak_yakit_ui_prices_v1") || "{}"); } catch {}
    all["BİM"] = { ...(all["BİM"] || {}), old: 73.96, baseline: 73.96, referencePrice: 73.96, vatIncluded: false, priceMode: "KDV hariç (+KDV)", referenceCorrectedAt: new Date().toISOString() };
    localStorage.setItem("odak_yakit_ui_prices_v1", JSON.stringify(all));
    localStorage.setItem(migrationKey, "1");
    setBimOldFuel("73,96");
    window.dispatchEvent(new Event("odak-fuel-updated"));
  }, []);

  // V44: BİM ilk değerleri test12345(2).xlsx dosyasındaki ham değerlerle yenilenir; tam sayı yuvarlaması yapılmaz.
  // Kaynak Excel değerleri küsuratlarıyla saklanır, gösterilir ve güncellemelerde ondalık hassasiyet korunur.
  useEffect(() => {
    const migrationKey = "odak_bim_initial_values_test12345_2_v44";
    if (localStorage.getItem(migrationKey) === "1") return;
    const rawRows = BIM_TARIFELERI.map(r => ({
      ...r,
      fiyatlar: Object.fromEntries(Object.entries(r.fiyatlar || {}).map(([k, v]) => [k, parseTariffNumber(v)]))
    }));
    localStorage.setItem("bim_yakit_tarifeleri", JSON.stringify(rawRows));
    localStorage.setItem("yakit_ilk_fiyat_bim", JSON.stringify({
      customer: "BİM",
      source: "test12345(2).xlsx / BİM ilk değerler / V44",
      created_at: new Date().toISOString(),
      snapshot: rawRows
    }));
    localStorage.setItem(migrationKey, "1");
    setBimTarifeler(rawRows);
    setFirstPriceArchiveVersion((v) => v + 1);
  }, []);

  // BİM: Petrol Ofisi / İstanbul Sancaktepe / V/Max Diesel fiyatını KDV DAHİL filtresi KAPALI olarak doğrudan yenile.
  // Böylece BİM ekranı genel PO (KDV dahil) cache değerini yanlışlıkla kullanmaz.
  useEffect(() => {
    if (!customer || !isBimCustomer(customer)) return;
    let cancelled = false;
    const refreshBimVatExcludedPrice = async () => {
      try {
        const qs = new URLSearchParams({
          provider: "petrol-ofisi", city: "İstanbul", district: "SANCAKTEPE",
          fuel: "Motorin", vatIncluded: "false"
        });
        const res = await fetch(`/api/fuel-check?${qs.toString()}`, { headers: { Accept: "application/json" }, cache: "no-store" });
        const data = await res.json();
        if (!res.ok || !data?.ok || !Number.isFinite(Number(data.price))) throw new Error(data?.error || "BİM KDV hariç fiyatı alınamadı");
        if (cancelled) return;
        const price = Number(data.price);
        setBimNewFuel(price.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
        let all = {}; try { all = JSON.parse(localStorage.getItem("odak_yakit_ui_prices_v1") || "{}"); } catch {}
        const previous = Number(String(bimOldFuel).replace(/\./g, "").replace(",", "."));
        all["BİM"] = { ...(all["BİM"] || {}), old: Number.isFinite(previous) ? previous : all["BİM"]?.old, new: price, source: "Petrol Ofisi • Sancaktepe • V/Max Diesel • KDV hariç (+KDV)", vatIncluded: false, priceMode: "KDV hariç (+KDV)", verifiedBimVatExcluded: true, checkedAt: data.checkedAt || new Date().toISOString() };
        localStorage.setItem("odak_yakit_ui_prices_v1", JSON.stringify(all));
        window.dispatchEvent(new Event("odak-fuel-updated"));
      } catch (e) { console.warn("[BİM KDV hariç fiyat]", e.message); }
    };
    refreshBimVatExcludedPrice();
    return () => { cancelled = true; };
  }, [customer]);

  // EFOR ÇAY: Petrol Ofisi / Tokat Erbaa güncel Motorin fiyatını doğrudan çek.
  // Referans ilk kurulumda 90,63 TL'dir; başarılı tarife güncellemesinden sonra yeni fiyat bir sonraki referans olur.
  useEffect(() => {
    if (!customer || !isEforCayCustomer(customer)) return;
    let cancelled = false;
    const refreshEforPrice = async () => {
      try {
        const qs = new URLSearchParams({ provider: "petrol-ofisi", city: "Tokat", district: "ERBAA", fuel: "Motorin" });
        const res = await fetch(`/api/fuel-check?${qs.toString()}`, { headers: { Accept: "application/json" }, cache: "no-store" });
        const contentType = res.headers.get("content-type") || "";
        if (!contentType.includes("application/json")) throw new Error(`Yakıt servisi JSON dönmedi (${res.status})`);
        const data = await res.json();
        if (!res.ok || !data?.ok || !Number.isFinite(Number(data.price))) throw new Error(data?.error || "EFOR ÇAY canlı fiyatı alınamadı");
        if (cancelled) return;
        const price = Number(data.price);
        setEforCayNewFuel(price.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
        let all = {}; try { all = JSON.parse(localStorage.getItem("odak_yakit_ui_prices_v1") || "{}"); } catch {}
        const storedReference = Number(localStorage.getItem("efor_cay_kabul_edilen_yakit_v1"));
        const reference = Number.isFinite(storedReference) && storedReference > 0
          ? storedReference
          : Number(eforCayHistory?.[0]?.yeni_yakit_fiyati || 90.63);
        all["EFOR ÇAY"] = { ...(all["EFOR ÇAY"] || {}), old: reference, new: price, source: "Petrol Ofisi • Tokat Erbaa • Motorin", checkedAt: data.checkedAt || new Date().toISOString() };
        localStorage.setItem("odak_yakit_ui_prices_v1", JSON.stringify(all));
        window.dispatchEvent(new Event("odak-fuel-updated"));
      } catch (e) { console.warn("[EFOR ÇAY canlı fiyat]", e.message); }
    };
    refreshEforPrice();
    const timer = setInterval(refreshEforPrice, 5 * 60 * 1000);
    return () => { cancelled = true; clearInterval(timer); };
  }, [customer, eforCayHistory]);

  // Akaryakıt Fiyat Takip ekranından gelen canlı fiyatları müşteri kural kartlarına bağlar.
  // old = son kabul edilmiş/referans fiyat, new = takip ekranından gelen güncel fiyat.
  useEffect(() => {
    const syncFuelCards = () => {
      let ui = {};
      try { ui = JSON.parse(localStorage.getItem("odak_yakit_ui_prices_v1") || "{}"); } catch {}
      const tr = (v) => Number(v).toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      const put = (name, setOld, setNew) => { const x=ui[name]; if(x && Number(x.old)>0) setOld(tr(x.old)); if(x && Number(x.new)>0) setNew(tr(x.new)); };
      put("BİM", setBimOldFuel, setBimNewFuel);
      put("TEVERPAN", setTeverpanOldFuel, setTeverpanNewFuel);
      const eforLive = ui["EFOR ÇAY"];
      if (eforLive && Number(eforLive.new) > 0) setEforCayNewFuel(tr(eforLive.new));
      const storedEforReference = Number(localStorage.getItem("efor_cay_kabul_edilen_yakit_v1"));
      if (Number.isFinite(storedEforReference) && storedEforReference > 0) setEforCayOldFuel(tr(storedEforReference));
      else if (eforCayHistory?.[0]?.yeni_yakit_fiyati > 0) setEforCayOldFuel(tr(eforCayHistory[0].yeni_yakit_fiyati));
      else setEforCayOldFuel("90,63");
      put("CORTEVA", setCortevaOldFuel, setCortevaNewFuel);
      put("CMC AGRO", setCmcOldFuel, setCmcNewFuel);
      put("ETİ", setEtiOldFuel, setEtiNewFuel);

      // KWS ve FASDAT ortak calc alanını kullanıyor.
      // Eski fiyat: üst karttaki son kabul edilen YENİ yakıt fiyatı.
      // Yeni fiyat: Akaryakıt Fiyat Takip ekranından gelen canlı fiyat.
      if (customer && isKwsCustomer(customer)) {
        const x = ui["KWS"];
        const latestKws = kwsHistory?.[0];
        const lastAccepted = Number(latestKws?.yeni_yakit_fiyati ?? latestKws?.yeni_yakit ?? x?.old ?? 0);
        if (x) setCalc({ eski: tr(lastAccepted), yeni: tr(Number(x.new) > 0 ? x.new : lastAccepted) });
      } else if (customer && !isEtiCustomer(customer) && !isCmcAgroCustomer(customer) && !isCortevaCustomer(customer) && !isEforCayCustomer(customer) && !isTeverpanCustomer(customer) && !isBimCustomer(customer)) {
        const x=ui["FASDAT"];
        const latestFasdat = history?.[0];
        const lastAccepted = Number(latestFasdat?.yeni_yakit_fiyati ?? latestFasdat?.yeni_yakit ?? x?.old ?? 0);
        if(x) setCalc({eski:tr(lastAccepted),yeni:tr(Number(x.new)>0?x.new:lastAccepted)});
      }
    };
    syncFuelCards();
    window.addEventListener("odak-fuel-updated", syncFuelCards);
    return () => window.removeEventListener("odak-fuel-updated", syncFuelCards);
  }, [customer]);

  /* =======================================================
     YAKIT HESAPLAMA
  ======================================================= */

  const oran = useMemo(() => {
    const eski =
      num(calc.eski);

    const yeni =
      num(calc.yeni);

    if (
      eski > 0 &&
      Number.isFinite(yeni)
    ) {
      return yeni / eski - 1;
    }

    return null;
  }, [calc]);

  const pct =
    oran == null
      ? null
      : oran * 100;

  /*
    Mevcut FASDAT kuralı korunuyor.

    Değişim %7'den büyükse
    değişimin yarısı uygulanır.
  */
  const update =
    oran != null &&
    oran > 0.07;

  const applied =
    update
      ? oran / 2
      : 0;

  const isKws = isKwsCustomer(customer);

  // KWS: değişimin yönünden bağımsız olarak mutlak değer %12 eşiğine ulaşırsa çalışır.
  const kwsUpdate =
    oran != null &&
    Math.abs(oran) >= 0.12;

  // Örnek: yakıt +%15 => tarife +%4,5 / yakıt -%12 => tarife -%3,6
  const kwsApplied =
    kwsUpdate
      ? oran * 0.30
      : 0;

  const kwsAppliedPct = kwsApplied * 100;


  /* =======================================================
     EXCEL AKTAR
  ======================================================= */

  const importExcel = async (
    file,
    type
  ) => {
    if (
      !file ||
      !customer
    ) {
      return;
    }

    setBusy(true);
    setError("");

    try {
      const workbook =
        XLSX.read(
          await file.arrayBuffer(),
          {
            type: "array",
          }
        );

      const worksheet =
        workbook.Sheets[
          workbook.SheetNames[0]
        ];

      const aoa =
        XLSX.utils.sheet_to_json(
          worksheet,
          {
            header: 1,
            defval: "",
          }
        );

      if (!aoa.length) {
        throw new Error(
          "Excel boş."
        );
      }

      const heads =
        aoa[0].map(norm);

      const indexes =
        HEADERS.map(
          (header) =>
            heads.indexOf(
              norm(header)
            )
        );

      if (
        indexes.some(
          (index) => index < 0
        )
      ) {
        throw new Error(
          `Excel başlıkları tam olarak şu alanları içermeli: ${HEADERS.join(
            " | "
          )}`
        );
      }

      const payload =
        aoa
          .slice(1)
          .filter((row) =>
            row.some(
              (value) =>
                String(
                  value
                ).trim()
            )
          )
          .map((row) => ({
            musteri_id:
              customer.id,

            il:
              String(
                row[
                  indexes[0]
                ] || ""
              ).trim(),

            ilce:
              String(
                row[
                  indexes[1]
                ] || ""
              ).trim(),

            koy_mahalle:
              String(
                row[
                  indexes[2]
                ] || ""
              ).trim() ||
              null,

            ton_tl:
              num(
                row[
                  indexes[3]
                ]
              ),
          }));

      if (
        payload.some(
          (item) =>
            !item.il ||
            !item.ilce ||
            !Number.isFinite(
              item.ton_tl
            )
        )
      ) {
        throw new Error(
          "Bazı satırlarda İL, İLÇE veya TON/TL geçersiz."
        );
      }

      const table =
        type === "alis"
          ? "yakit_alis_tarifeleri"
          : "yakit_satis_tarifeleri";

      const {
        error: insertError,
      } =
        await supabase
          .from(table)
          .insert(payload);

      if (insertError) {
        throw insertError;
      }

      setInfo(
        `${payload.length} satır ${
          type === "alis"
            ? "alış"
            : "satış"
        } tarifesine aktarıldı.`
      );

      await loadCustomerData();
    } catch (e) {
      console.error(
        "Excel aktarım hatası:",
        e
      );

      setError(
        e?.message ||
          "Excel aktarılamadı."
      );
    } finally {
      setBusy(false);
    }
  };

  /* =======================================================
     MANUEL SATIR EKLE
  ======================================================= */

  const addRow = async (e) => {
    e.preventDefault();

    if (
      !customer ||
      !modal?.type
    ) {
      return;
    }

    setError("");

    try {
      const table =
        modal.type === "alis"
          ? "yakit_alis_tarifeleri"
          : "yakit_satis_tarifeleri";

      const tonTl =
        num(rowForm.ton_tl);

      if (
        !rowForm.il.trim() ||
        !rowForm.ilce.trim() ||
        !Number.isFinite(tonTl)
      ) {
        throw new Error(
          "İL, İLÇE ve TON/TL alanlarını kontrol edin."
        );
      }

      const payload = {
        musteri_id:
          customer.id,

        il:
          rowForm.il.trim(),

        ilce:
          rowForm.ilce.trim(),

        koy_mahalle:
          rowForm.koy_mahalle
            .trim() ||
          null,

        ton_tl:
          tonTl,
      };

      const {
        error: insertError,
      } =
        await supabase
          .from(table)
          .insert(payload);

      if (insertError) {
        throw insertError;
      }

      setModal(null);

      setRowForm({
        il: "",
        ilce: "",
        koy_mahalle: "",
        ton_tl: "",
      });

      await loadCustomerData();
    } catch (e) {
      setError(
        e?.message ||
          "Satır kaydedilemedi."
      );
    }
  };

  /* =======================================================
     TON/TL GÜNCELLEMESİ
  ======================================================= */

  const applyUpdate =
    async () => {
      if (
        !update ||
        !customer
      ) {
        return;
      }

      setBusy(true);
      setError("");

      try {
        const batchCreatedAt = new Date().toISOString();

        for (
          const type of [
            "alis",
            "satis",
          ]
        ) {
          const table =
            type === "alis"
              ? "yakit_alis_tarifeleri"
              : "yakit_satis_tarifeleri";

          const hist = [];

          for (
            const row of
            rows[type]
          ) {
            const yeniTonTl =
              Number(
                row.ton_tl
              ) *
              (1 + applied);

            hist.push({
              musteri_id:
                customer.id,

              tarife_tipi:
                type,

              tarife_id:
                row.id,

              il:
                row.il,

              ilce:
                row.ilce,

              koy_mahalle:
                row.koy_mahalle,

              eski_ton_tl:
                row.ton_tl,

              yeni_ton_tl:
                yeniTonTl,

              eski_yakit_fiyati:
                num(calc.eski),

              yeni_yakit_fiyati:
                num(calc.yeni),

              yakit_degisim_orani:
                oran,

              uygulanan_artis_orani:
                applied,

              // Aynı yakıt güncellemesindeki alış + satış kayıtlarını
              // tek işlem olarak geri alabilmek için ortak zaman damgası.
              created_at:
                batchCreatedAt,
            });

            const {
              error:
                updateError,
            } =
              await supabase
                .from(table)
                .update({
                  ton_tl:
                    yeniTonTl,

                  updated_at:
                    new Date()
                      .toISOString(),
                })
                .eq(
                  "id",
                  row.id
                );

            if (updateError) {
              throw updateError;
            }
          }

          if (hist.length) {
            const {
              error:
                historyError,
            } =
              await supabase
                .from(
                  "yakit_ton_tl_gecmisi"
                )
                .insert(hist);

            if (historyError) {
              throw historyError;
            }
          }
        }

        setInfo(
          `Yakıt değişimi %${pct.toFixed(
            2
          )}. Yarısı %${(
            applied * 100
          ).toFixed(
            2
          )} olarak tüm TON/TL fiyatlarına uygulandı.`
        );

        await loadCustomerData();
      } catch (e) {
        console.error(
          "TON/TL güncelleme hatası:",
          e
        );

        setError(
          e?.message ||
            "TON/TL fiyatları güncellenemedi."
        );
      } finally {
        setBusy(false);
      }
    };

  /* =======================================================
     FASDAT - SON İŞLEMİ GERİ AL
  ======================================================= */

  const undoLastUpdate = async () => {
    if (!customer || isKwsCustomer(customer)) return;

    const confirmed = window.confirm(
      "Son yapılan FASDAT yakıt güncellemesi geri alınacak. Alış ve satış tarifeleri önceki değerlerine dönecek. Devam edilsin mi?"
    );

    if (!confirmed) return;

    setBusy(true);
    setError("");
    setInfo("");

    try {
      const { data: latestRows, error: latestError } = await supabase
        .from("yakit_ton_tl_gecmisi")
        .select("*")
        .eq("musteri_id", customer.id)
        .order("created_at", { ascending: false })
        .limit(1);

      if (latestError) throw latestError;

      const latest = latestRows?.[0];

      if (!latest) {
        setInfo("Geri alınabilecek bir FASDAT güncellemesi bulunamadı.");
        return;
      }

      // Yeni kayıtlar ortak created_at ile yazılıyor. Eski kayıtlar için de
      // aynı yakıt değerleri/oran ve yakın zamanlı kayıtları güvenli şekilde yakala.
      const { data: candidates, error: candidatesError } = await supabase
        .from("yakit_ton_tl_gecmisi")
        .select("*")
        .eq("musteri_id", customer.id)
        .eq("eski_yakit_fiyati", latest.eski_yakit_fiyati)
        .eq("yeni_yakit_fiyati", latest.yeni_yakit_fiyati)
        .eq("uygulanan_artis_orani", latest.uygulanan_artis_orani)
        .order("created_at", { ascending: false })
        .limit(1000);

      if (candidatesError) throw candidatesError;

      const latestTime = new Date(latest.created_at).getTime();

      const batch = (candidates || []).filter((item) => {
        const itemTime = new Date(item.created_at).getTime();

        // Yeni sistemde timestamp birebir aynıdır.
        // Önceden oluşmuş kayıtlarda alış/satış insertleri arasında
        // küçük fark olabileceği için 10 saniyelik tolerans kullanılır.
        return (
          item.created_at === latest.created_at ||
          Math.abs(latestTime - itemTime) <= 10000
        );
      });

      if (!batch.length) {
        throw new Error("Geri alınacak işlem kayıtları bulunamadı.");
      }

      for (const item of batch) {
        const table =
          item.tarife_tipi === "alis"
            ? "yakit_alis_tarifeleri"
            : "yakit_satis_tarifeleri";

        const { error: restoreError } = await supabase
          .from(table)
          .update({
            ton_tl: Number(item.eski_ton_tl),
            updated_at: new Date().toISOString(),
          })
          .eq("id", item.tarife_id);

        if (restoreError) throw restoreError;
      }

      const ids = batch.map((item) => item.id).filter(Boolean);

      if (ids.length) {
        const { error: deleteHistoryError } = await supabase
          .from("yakit_ton_tl_gecmisi")
          .delete()
          .in("id", ids);

        if (deleteHistoryError) throw deleteHistoryError;
      }

      setCalc({ eski: String(Number(latest.eski_yakit_fiyati)).replace(".", ","), yeni: String(Number(latest.yeni_yakit_fiyati)).replace(".", ",") });
      restoreFuelValuesAfterUndo("FASDAT", latest, () => {}, () => {});
      setModal(null);
      setInfo(
        `Son FASDAT işlemi geri alındı. ${batch.length} tarife önceki değerine döndürüldü.`
      );

      await loadCustomerData();
    } catch (e) {
      console.error("FASDAT geri alma hatası:", e);
      setError(e?.message || "Son FASDAT işlemi geri alınamadı.");
    } finally {
      setBusy(false);
    }
  };

  /* =======================================================
     GEÇMİŞİ EXCEL'E AKTAR
  ======================================================= */

  const excelMoney = (value) =>
    Number.isFinite(Number(value)) ? Number(value) : 0;

  const downloadHistoryWorkbook = ({
    fileName,
    sheetName,
    title,
    subtitle,
    headers,
    rows,
    widths,
    percentColumns = [],
    moneyColumns = [],
  }) => {
    const aoa = [
      [title],
      [subtitle],
      [`Rapor Tarihi: ${new Date().toLocaleString("tr-TR")}`],
      [],
      headers,
      ...rows,
    ];

    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const lastCol = Math.max(headers.length - 1, 0);
    const lastRow = aoa.length;

    ws["!merges"] = [
      XLSX.utils.decode_range(`A1:${XLSX.utils.encode_col(lastCol)}1`),
      XLSX.utils.decode_range(`A2:${XLSX.utils.encode_col(lastCol)}2`),
      XLSX.utils.decode_range(`A3:${XLSX.utils.encode_col(lastCol)}3`),
    ];

    ws["!cols"] = (widths || headers.map(() => 18)).map((wch) => ({ wch }));
    ws["!rows"] = [
      { hpt: 28 },
      { hpt: 20 },
      { hpt: 18 },
      { hpt: 8 },
      { hpt: 26 },
    ];

    // SheetJS CE still preserves useful number/date formats and layout metadata.
    // Styling metadata is also attached for builds that support cell styles.
    for (let c = 0; c <= lastCol; c += 1) {
      const headerCell = ws[XLSX.utils.encode_cell({ r: 4, c })];
      if (headerCell) {
        headerCell.s = {
          font: { bold: true, color: { rgb: "FFFFFF" } },
          fill: { fgColor: { rgb: "315FB5" } },
          alignment: { horizontal: "center", vertical: "center", wrapText: true },
          border: {
            bottom: { style: "thin", color: { rgb: "D7E0EA" } },
          },
        };
      }
    }

    ["A1", "A2", "A3"].forEach((ref, index) => {
      if (!ws[ref]) return;
      ws[ref].s = {
        font: {
          bold: index === 0,
          sz: index === 0 ? 16 : index === 1 ? 10 : 9,
          color: { rgb: index === 0 ? "1E293B" : "64748B" },
        },
        alignment: { horizontal: "left", vertical: "center" },
      };
    });

    for (let r = 5; r < lastRow; r += 1) {
      for (let c = 0; c <= lastCol; c += 1) {
        const ref = XLSX.utils.encode_cell({ r, c });
        const cell = ws[ref];
        if (!cell) continue;

        if (moneyColumns.includes(c)) {
          cell.z = '#,##0.00 "₺"';
        }

        if (percentColumns.includes(c)) {
          cell.z = '0.00"%"';
        }

        cell.s = {
          alignment: {
            vertical: "center",
            horizontal: c === 0 ? "left" : "right",
            wrapText: true,
          },
          border: {
            bottom: { style: "hair", color: { rgb: "E7ECF2" } },
          },
        };
      }
    }

    ws["!autofilter"] = {
      ref: `A5:${XLSX.utils.encode_col(lastCol)}${lastRow}`,
    };

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31));
    XLSX.writeFile(wb, fileName);
  };

  const getHistoryDirection = (oldValue, newValue) => {
    const diff = Number(newValue || 0) - Number(oldValue || 0);
    return {
      diff,
      type: diff > 0 ? "increase" : diff < 0 ? "decrease" : "neutral",
    };
  };


  const buildModernHistorySheet = ({
    title,
    subtitle,
    headers,
    rows,
    widths,
    moneyColumns = [],
    percentColumns = [],
  }) => {
    const data = [
      [title],
      [subtitle],
      [`Oluşturulma: ${new Date().toLocaleString("tr-TR")}`],
      [],
      headers,
      ...rows,
    ];

    const ws = XLSX.utils.aoa_to_sheet(data);
    const lastCol = headers.length - 1;
    const lastRow = data.length;

    ws["!merges"] = [
      XLSX.utils.decode_range(`A1:${XLSX.utils.encode_col(lastCol)}1`),
      XLSX.utils.decode_range(`A2:${XLSX.utils.encode_col(lastCol)}2`),
      XLSX.utils.decode_range(`A3:${XLSX.utils.encode_col(lastCol)}3`),
    ];
    ws["!cols"] = widths.map((wch) => ({ wch }));
    ws["!rows"] = [
      { hpt: 30 },
      { hpt: 20 },
      { hpt: 18 },
      { hpt: 8 },
      { hpt: 28 },
    ];
    ws["!autofilter"] = {
      ref: `A5:${XLSX.utils.encode_col(lastCol)}${lastRow}`,
    };
    ws["!freeze"] = { xSplit: 0, ySplit: 5, topLeftCell: "A6" };

    for (let r = 5; r < lastRow; r += 1) {
      for (let c = 0; c <= lastCol; c += 1) {
        const cell = ws[XLSX.utils.encode_cell({ r, c })];
        if (!cell) continue;
        if (moneyColumns.includes(c)) cell.z = '#,##0.00 "₺"';
        if (percentColumns.includes(c)) cell.z = '0.00"%"';
      }
    }

    return ws;
  };

  const getFasdatRowsForExcel = (items) =>
    (items || []).map((item) => [
      new Date(item.created_at).toLocaleString("tr-TR"),
      `${item.il || "-"} / ${item.ilce || "-"}`,
      item.koy_mahalle || "-",
      excelMoney(item.eski_ton_tl),
      excelMoney(item.yeni_ton_tl),
      excelMoney(item.yeni_ton_tl) - excelMoney(item.eski_ton_tl),
      Number(item.yakit_degisim_orani || 0) * 100,
      Number(item.uygulanan_artis_orani || 0) * 100,
    ]);

  const exportCustomerPriceMemoryWorkbook = ({
    filePrefix,
    customerTitle,
    categories,
  }) => {
    const makeSheet = (cfg) => {
      const historyItems = (cfg.history || []).slice().sort(
        (a,b)=>new Date(a.created_at||0)-new Date(b.created_at||0)
      );
      const dates=[...new Set(historyItems.filter(h=>h.created_at).map(h=>h.created_at))]
        .sort((a,b)=>new Date(a)-new Date(b));
      const map=new Map();

      (cfg.initialRows || []).forEach((row,index)=>{
        (cfg.fields || []).forEach(([field,label])=>{
          const route=cfg.route(row,index);
          const key=`${route}|${field}`;
          map.set(key,{key,route,type:label,initial:Number(row?.[field] ?? field.split('.').reduce((v,k)=>v?.[k],row) ?? 0),changes:{}});
        });
      });

      historyItems.forEach((h)=>{
        const before=cfg.before(h)||[];
        const after=cfg.after(h)||[];
        before.forEach((oldRow,index)=>{
          const newRow=after[index]||{};
          (cfg.fields||[]).forEach(([field,label])=>{
            const route=cfg.route(oldRow,index);
            const key=`${route}|${field}`;
            let item=map.get(key);
            if(!item){
              item={key,route,type:label,initial:Number(oldRow?.[field]||0),changes:{}};
              map.set(key,item);
            }
            item.changes[h.created_at]={
              oldValue:Number(oldRow?.[field] ?? field.split('.').reduce((v,k)=>v?.[k],oldRow) ?? 0),
              newValue:Number(newRow?.[field] ?? field.split('.').reduce((v,k)=>v?.[k],newRow) ?? 0),
              fuelRate:Number(h.yakit_degisim_orani ?? h.yakit_orani ?? 0),
              appliedRate:Number(h.uygulanan_artis_orani ?? h.uygulanan_oran ?? 0),
            };
          });
        });
      });

      const rows=[...map.values()];
      rows.forEach(item=>{
        let last=item.initial;
        dates.forEach(date=>{
          const ch=item.changes[date];
          if(ch)last=ch.newValue;
          item.changes[date]=ch?{...ch,displayValue:ch.newValue}:{displayValue:last,unchanged:true};
        });
        item.current=last;
      });

      const headers=[
        cfg.routeHeader||"ROTA / TARİFE",
        "TİP",
        "İLK FİYAT",
        ...dates.map(date=>{
          const h=historyItems.find(x=>x.created_at===date);
          const fuel=Number(h?.yakit_degisim_orani ?? h?.yakit_orani ?? 0)*100;
          const applied=Number(h?.uygulanan_artis_orani ?? h?.uygulanan_oran ?? 0)*100;
          return `${new Date(date).toLocaleDateString("tr-TR")}  ${new Date(date).toLocaleTimeString("tr-TR",{hour:"2-digit",minute:"2-digit"})}\n${fuel>=0?"↑":"↓"} Yakıt %${Math.abs(fuel).toFixed(2)}  •  Uygulanan %${Math.abs(applied).toFixed(2)}`;
        }),
        "GÜNCEL FİYAT",
      ];
      const body=rows.map(row=>[
        row.route,row.type,Number(row.initial||0),
        ...dates.map(date=>Number(row.changes[date]?.displayValue||0)),
        Number(row.current||0)
      ]);
      const aoa=[
        [`${customerTitle} • ${cfg.title} FİYAT HAFIZASI`],
        ["İlk fiyattan güncel fiyata aktif fiyat değişimleri"],
        [`Rapor: ${new Date().toLocaleString("tr-TR")}   |   ${rows.length} fiyat satırı   |   ${dates.length} işlem`],
        [],headers,...body
      ];
      const ws=XLSX.utils.aoa_to_sheet(aoa);
      const lastCol=headers.length-1,lastRow=aoa.length;
      ws["!merges"]=[
        XLSX.utils.decode_range(`A1:${XLSX.utils.encode_col(lastCol)}1`),
        XLSX.utils.decode_range(`A2:${XLSX.utils.encode_col(lastCol)}2`),
        XLSX.utils.decode_range(`A3:${XLSX.utils.encode_col(lastCol)}3`)
      ];
      ws["!freeze"]={xSplit:3,ySplit:5,topLeftCell:"D6"};
      ws["!autofilter"]={ref:`A5:${XLSX.utils.encode_col(lastCol)}${lastRow}`};
      ws["!cols"]=headers.map((_,i)=>({wch:i===0?44:i===1?24:i===2?18:i===lastCol?19:29}));
      ws["!rows"]=[{hpt:38},{hpt:24},{hpt:21},{hpt:8},{hpt:54},...body.map(()=>({hpt:31}))];
      ws["!sheetView"]={showGridLines:false};

      const hero=cfg.hero||"163B65",accent=cfg.accent||"2E6FB3";
      const border={bottom:{style:"thin",color:{rgb:"E4EAF1"}},right:{style:"thin",color:{rgb:"EDF1F5"}}};
      ["A1","A2","A3"].forEach((ref,i)=>{
        if(!ws[ref])return;
        ws[ref].s={
          fill:{fgColor:{rgb:i===0?hero:i===1?"EEF4FA":"F7F9FC"}},
          font:{bold:i===0,sz:i===0?19:i===1?11:9,color:{rgb:i===0?"FFFFFF":i===1?accent:"708196"}},
          alignment:{horizontal:"left",vertical:"center"}
        };
      });
      for(let c=0;c<=lastCol;c++){
        const cell=ws[XLSX.utils.encode_cell({r:4,c})];if(!cell)continue;
        const initial=c===2,current=c===lastCol,change=c>=3&&c<lastCol;
        cell.s={
          fill:{fgColor:{rgb:initial?"EAF3FF":current?"EAF8F0":change?"F0F4F9":"DCE7F2"}},
          font:{bold:true,sz:9,color:{rgb:initial?"225D9E":current?"157347":change?"405B78":"263E59"}},
          alignment:{horizontal:c===0?"left":"center",vertical:"center",wrapText:true},border
        };
      }
      for(let r=5;r<lastRow;r++){
        const item=rows[r-5];
        for(let c=0;c<=lastCol;c++){
          const cell=ws[XLSX.utils.encode_cell({r,c})];if(!cell)continue;
          let fill=(r-5)%2===0?"FFFFFF":"F8FAFC",color="263A53",bold=false;
          if(c===2){fill="EDF5FF";color="225D9E";bold=true;}
          if(c===lastCol){fill="EAF8F0";color="157347";bold=true;}
          if(c>=3&&c<lastCol){
            const ch=item?.changes?.[dates[c-3]];
            if(ch&&!ch.unchanged){
              const up=Number(ch.newValue)>=Number(ch.oldValue);
              fill=up?"EDF9F2":"FFF0F1";color=up?"157347":"B4232C";bold=true;
            }
          }
          cell.s={fill:{fgColor:{rgb:fill}},font:{sz:10,bold,color:{rgb:color}},alignment:{horizontal:c===0?"left":"center",vertical:"center",wrapText:true},border};
          if(c>=2)cell.z='#,##0.00 "₺"';
        }
      }
      return ws;
    };

    const wb=XLSX.utils.book_new();
    categories.forEach(cfg=>XLSX.utils.book_append_sheet(wb,makeSheet(cfg),cfg.sheet));
    XLSX.writeFile(wb,`${filePrefix}_${new Date().toISOString().slice(0,10)}.xlsx`,{cellStyles:true});
  };

  const exportFasdatPriceMemoryExcel = () => {
    if (!customer || !firstArchiveKey) return;

    const archive = readFirstPriceArchive(firstArchiveKey);
    const snap = archive?.snapshot || {};
    const activeHistory = history || [];

    const buildFasdatMemoryRows = (type) => {
      const map = new Map();

      // İlk fiyatlar: ekrandaki başlangıç tarifesinin ALIŞ / SATIŞ ayrımı.
      (Array.isArray(snap?.[type]) ? snap[type] : []).forEach((row, index) => {
        const label = `${row.il || "-"} / ${row.ilce || "-"}${row.koy_mahalle ? ` / ${row.koy_mahalle}` : ""}`;
        const key = `${label}|${index}`;
        map.set(key, {
          key,
          label,
          initial: Number(row.ton_tl ?? row.tonTl ?? row.fiyat ?? 0),
          changes: {},
        });
      });

      // Geri alınmış kayıt history'de olmadığı için Excel'e de girmez.
      activeHistory
        .filter((h) => h.tarife_tipi === type)
        .sort((a,b) => new Date(a.created_at || 0)-new Date(b.created_at || 0))
        .forEach((h) => {
          const label = `${h.il || "-"} / ${h.ilce || "-"}${h.koy_mahalle ? ` / ${h.koy_mahalle}` : ""}`;
          let target = [...map.values()].find((x) => x.label === label);
          if (!target) {
            const key = `${label}|history`;
            target = {
              key,
              label,
              initial: Number(h.eski_ton_tl || 0),
              changes: {},
            };
            map.set(key,target);
          }
          target.changes[h.created_at] = {
            oldValue: Number(h.eski_ton_tl || 0),
            newValue: Number(h.yeni_ton_tl || 0),
            fuelRate: Number(h.yakit_degisim_orani || 0),
            appliedRate: Number(h.uygulanan_artis_orani || 0),
          };
        });

      const dates = [...new Set(
        activeHistory
          .filter((h) => h.tarife_tipi === type && h.created_at)
          .map((h) => h.created_at)
      )].sort((a,b)=>new Date(a)-new Date(b));

      const rows=[...map.values()];
      rows.forEach((item)=>{
        let last=item.initial;
        dates.forEach((date)=>{
          const ch=item.changes[date];
          if(ch) last=ch.newValue;
          item.changes[date]=ch ? {...ch,displayValue:ch.newValue} : {displayValue:last,unchanged:true};
        });
        item.current=last;
      });

      return {rows,dates};
    };

    const createModernSheet = (type, title) => {
      const {rows: memoryRows, dates}=buildFasdatMemoryRows(type);

      const headers=[
        "YÜKLEME / BOŞALTMA - TARİFE",
        "İLK FİYAT",
        ...dates.map((date)=>{
          const h=activeHistory.find((x)=>x.tarife_tipi===type && x.created_at===date);
          const fuel=Number(h?.yakit_degisim_orani||0)*100;
          const applied=Number(h?.uygulanan_artis_orani||0)*100;
          return `${new Date(date).toLocaleDateString("tr-TR")}  ${new Date(date).toLocaleTimeString("tr-TR",{hour:"2-digit",minute:"2-digit"})}\n${fuel>=0?"↑":"↓"} Yakıt %${Math.abs(fuel).toFixed(2)}  •  Uygulanan %${Math.abs(applied).toFixed(2)}`;
        }),
        "GÜNCEL FİYAT",
      ];

      const body=memoryRows.map((row)=>[
        row.label,
        Number(row.initial||0),
        ...dates.map((date)=>Number(row.changes[date]?.displayValue||0)),
        Number(row.current||0),
      ]);

      const aoa=[
        [`FASDAT • ${title} FİYAT HAFIZASI`],
        [`${title} tarifeleri • İlk fiyattan güncel fiyata aktif fiyat geçmişi`],
        [`Rapor: ${new Date().toLocaleString("tr-TR")}   |   ${memoryRows.length} tarife   |   ${dates.length} fiyat işlemi`],
        [],
        headers,
        ...body,
      ];

      const ws=XLSX.utils.aoa_to_sheet(aoa);
      const lastCol=headers.length-1;
      const lastRow=aoa.length;

      ws["!merges"]=[
        XLSX.utils.decode_range(`A1:${XLSX.utils.encode_col(lastCol)}1`),
        XLSX.utils.decode_range(`A2:${XLSX.utils.encode_col(lastCol)}2`),
        XLSX.utils.decode_range(`A3:${XLSX.utils.encode_col(lastCol)}3`),
      ];
      ws["!freeze"]={xSplit:2,ySplit:5,topLeftCell:"C6"};
      ws["!autofilter"]={ref:`A5:${XLSX.utils.encode_col(lastCol)}${lastRow}`};
      ws["!cols"]=headers.map((_,i)=>({wch:i===0?42:i===1?18:i===lastCol?19:29}));
      ws["!rows"]=[{hpt:38},{hpt:24},{hpt:21},{hpt:8},{hpt:54},...body.map(()=>({hpt:31}))];
      ws["!sheetView"]={showGridLines:false};

      const isBuy=type==="alis";
      const hero=isBuy?"163B65":"145A46";
      const hero2=isBuy?"EAF3FF":"EAF8F2";
      const accent=isBuy?"2E6FB3":"16815C";
      const initialBg="EDF5FF";
      const currentBg="EAF8F0";

      ["A1","A2","A3"].forEach((ref,i)=>{
        if(!ws[ref]) return;
        ws[ref].s={
          fill:{fgColor:{rgb:i===0?hero:i===1?hero2:"F5F8FC"}},
          font:{bold:i===0,sz:i===0?19:i===1?11:9,color:{rgb:i===0?"FFFFFF":i===1?accent:"708196"}},
          alignment:{horizontal:"left",vertical:"center"},
        };
      });

      const border={
        bottom:{style:"thin",color:{rgb:"E4EAF1"}},
        right:{style:"thin",color:{rgb:"EDF1F5"}},
      };

      for(let c=0;c<=lastCol;c++){
        const cell=ws[XLSX.utils.encode_cell({r:4,c})];
        if(!cell) continue;
        const initial=c===1, current=c===lastCol, change=c>=2&&c<lastCol;
        cell.s={
          fill:{fgColor:{rgb:initial?initialBg:current?currentBg:change?"F0F4F9":"DCE7F2"}},
          font:{bold:true,sz:9,color:{rgb:initial?"225D9E":current?"157347":change?"405B78":"263E59"}},
          alignment:{horizontal:c===0?"left":"center",vertical:"center",wrapText:true},
          border,
        };
      }

      for(let r=5;r<lastRow;r++){
        const item=memoryRows[r-5];
        for(let c=0;c<=lastCol;c++){
          const cell=ws[XLSX.utils.encode_cell({r,c})];
          if(!cell) continue;
          let fill=(r-5)%2===0?"FFFFFF":"F8FAFC";
          let color="263A53";
          let bold=false;

          if(c===1){fill=initialBg;color="225D9E";bold=true;}
          if(c===lastCol){fill=currentBg;color="157347";bold=true;}

          if(c>=2&&c<lastCol){
            const ch=item?.changes?.[dates[c-2]];
            if(ch&&!ch.unchanged){
              const up=Number(ch.newValue)>=Number(ch.oldValue);
              fill=up?"EDF9F2":"FFF0F1";
              color=up?"157347":"B4232C";
              bold=true;
            }
          }

          cell.s={
            fill:{fgColor:{rgb:fill}},
            font:{sz:10,bold,color:{rgb:color}},
            alignment:{horizontal:c===0?"left":"center",vertical:"center",wrapText:true},
            border,
          };
          if(c>=1) cell.z='#,##0.00 "₺"';
        }
      }
      return ws;
    };

    const wb=XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb,createModernSheet("alis","ALIŞ"),"Alış Fiyat Hafızası");
    XLSX.utils.book_append_sheet(wb,createModernSheet("satis","SATIŞ"),"Satış Fiyat Hafızası");
    XLSX.writeFile(
      wb,
      `FASDAT_Fiyat_Hafizasi_${new Date().toISOString().slice(0,10)}.xlsx`,
      {cellStyles:true}
    );
  };

  const exportAllFasdatHistoryExcel = async () => {
    if (!customer) return;

    setBusy(true);
    setError("");

    try {
      const { data, error: exportError } = await supabase
        .from("yakit_ton_tl_gecmisi")
        .select("*")
        .eq("musteri_id", customer.id)
        .order("created_at", { ascending: false });

      if (exportError) throw exportError;

      const all = data || [];
      const alis = all.filter((x) => x.tarife_tipi === "alis");
      const satis = all.filter((x) => x.tarife_tipi === "satis");

      const wb = XLSX.utils.book_new();

      const config = {
        headers: [
          "Tarih / Saat",
          "İl / İlçe",
          "Köy / Mahalle",
          "Eski TON/TL",
          "Yeni TON/TL",
          "Fark",
          "Yakıt Değişimi %",
          "Uygulanan %",
        ],
        widths: [21, 27, 24, 16, 16, 15, 17, 15],
        moneyColumns: [3, 4, 5],
        percentColumns: [6, 7],
      };

      XLSX.utils.book_append_sheet(
        wb,
        buildModernHistorySheet({
          title: "FASDAT - ALIŞ FİYAT GEÇMİŞİ",
          subtitle: "Alış / maliyet TON/TL değişimlerinin satır bazlı geçmişi",
          rows: getFasdatRowsForExcel(alis),
          ...config,
        }),
        "Alış Geçmişi"
      );

      XLSX.utils.book_append_sheet(
        wb,
        buildModernHistorySheet({
          title: "FASDAT - SATIŞ FİYAT GEÇMİŞİ",
          subtitle: "Satış TON/TL değişimlerinin satır bazlı geçmişi",
          rows: getFasdatRowsForExcel(satis),
          ...config,
        }),
        "Satış Geçmişi"
      );

      XLSX.writeFile(
        wb,
        `FASDAT_Yakit_Gecmisi_${new Date().toISOString().slice(0, 10)}.xlsx`
      );
    } catch (e) {
      setError(e?.message || "FASDAT geçmiş Excel'i oluşturulamadı.");
    } finally {
      setBusy(false);
    }
  };

  const getKwsExcelRows = (category) => {
    const rows = [];

    (kwsHistory || []).forEach((item) => {
      const before = item?.eski_tarifeler?.[category] || [];
      const after = item?.yeni_tarifeler?.[category] || [];

      before.forEach((oldRow, index) => {
        const newRow = after[index] || {};
        const common = [
          new Date(item.created_at).toLocaleString("tr-TR"),
          oldRow.yukleme || "-",
          oldRow.bosaltma || "-",
          excelMoney(item.eski_yakit_fiyati),
          excelMoney(item.yeni_yakit_fiyati),
          Number(item.yakit_degisim_orani || 0) * 100,
          Number(item.uygulanan_artis_orani || 0) * 100,
        ];

        if (category === "lowbed") {
          rows.push([
            ...common,
            excelMoney(oldRow.haric),
            excelMoney(newRow.haric),
            excelMoney(newRow.haric) - excelMoney(oldRow.haric),
            excelMoney(oldRow.dahil),
            excelMoney(newRow.dahil),
            excelMoney(newRow.dahil) - excelMoney(oldRow.dahil),
          ]);
        } else {
          rows.push([
            ...common,
            excelMoney(oldRow.ikiHaric),
            excelMoney(newRow.ikiHaric),
            excelMoney(newRow.ikiHaric) - excelMoney(oldRow.ikiHaric),
            excelMoney(oldRow.ikiDahil),
            excelMoney(newRow.ikiDahil),
            excelMoney(oldRow.ucHaric),
            excelMoney(newRow.ucHaric),
            excelMoney(newRow.ucHaric) - excelMoney(oldRow.ucHaric),
            excelMoney(oldRow.ucDahil),
            excelMoney(newRow.ucDahil),
          ]);
        }
      });
    });

    return rows;
  };

  const exportAllKwsHistoryExcel = () => {
    const archive = readFirstPriceArchive("kws");
    const snapshot = archive?.snapshot || {
      alis: KWS_TIR_ALIS,
      satis: KWS_TIR_SATIS,
      lowbed: KWS_LOWBED,
    };

    const categories = [
      {key:"alis", title:"ALIŞ / MALİYET", sheet:"Alış Fiyat Hafızası", hero:"163B65", accent:"2E6FB3"},
      {key:"satis", title:"SATIŞ", sheet:"Satış Fiyat Hafızası", hero:"145A46", accent:"16815C"},
      {key:"lowbed", title:"LOWBED", sheet:"Lowbed Fiyat Hafızası", hero:"5B3A78", accent:"7A52A3"},
    ];

    const buildRows = (category) => {
      const fields = category === "lowbed"
        ? [["haric","KDV HARİÇ"],["dahil","KDV DAHİL"]]
        : [["ikiHaric","2 İLAVELİ KDV HARİÇ"],["ikiDahil","2 İLAVELİ KDV DAHİL"],["ucHaric","3 İLAVELİ KDV HARİÇ"],["ucDahil","3 İLAVELİ KDV DAHİL"]];

      const initial = Array.isArray(snapshot?.[category]) ? snapshot[category] : [];
      const map = new Map();

      initial.forEach((row,index)=>{
        fields.forEach(([field,label])=>{
          const route=`${row.yukleme || "-"} → ${row.bosaltma || "-"}`;
          const key=`${route}|${field}`;
          map.set(key,{key,route,type:label,initial:Number(row[field]||0),changes:{}});
        });
      });

      const dates=[...new Set(
        (kwsHistory||[]).filter(h=>h.created_at).map(h=>h.created_at)
      )].sort((a,b)=>new Date(a)-new Date(b));

      (kwsHistory||[])
        .slice()
        .sort((a,b)=>new Date(a.created_at||0)-new Date(b.created_at||0))
        .forEach((h)=>{
          const before=h?.eski_tarifeler?.[category] || [];
          const after=h?.yeni_tarifeler?.[category] || [];
          before.forEach((oldRow,index)=>{
            const newRow=after[index] || {};
            fields.forEach(([field,label])=>{
              const route=`${oldRow.yukleme || newRow.yukleme || "-"} → ${oldRow.bosaltma || newRow.bosaltma || "-"}`;
              const key=`${route}|${field}`;
              let item=map.get(key);
              if(!item){
                item={key,route,type:label,initial:Number(oldRow[field]||0),changes:{}};
                map.set(key,item);
              }
              item.changes[h.created_at]={
                oldValue:Number(oldRow[field]||0),
                newValue:Number(newRow[field]||0),
                fuelRate:Number(h.yakit_degisim_orani||0),
                appliedRate:Number(h.uygulanan_artis_orani||0),
              };
            });
          });
        });

      const rows=[...map.values()];
      rows.forEach(item=>{
        let last=item.initial;
        dates.forEach(date=>{
          const ch=item.changes[date];
          if(ch) last=ch.newValue;
          item.changes[date]=ch ? {...ch,displayValue:ch.newValue} : {displayValue:last,unchanged:true};
        });
        item.current=last;
      });
      return {rows,dates};
    };

    const createSheet = (cfg) => {
      const {rows,dates}=buildRows(cfg.key);
      const headers=[
        "YÜKLEME / BOŞALTMA - TARİFE",
        "TİP",
        "İLK FİYAT",
        ...dates.map(date=>{
          const h=(kwsHistory||[]).find(x=>x.created_at===date);
          const fuel=Number(h?.yakit_degisim_orani||0)*100;
          const applied=Number(h?.uygulanan_artis_orani||0)*100;
          return `${new Date(date).toLocaleDateString("tr-TR")}  ${new Date(date).toLocaleTimeString("tr-TR",{hour:"2-digit",minute:"2-digit"})}\n${fuel>=0?"↑":"↓"} Yakıt %${Math.abs(fuel).toFixed(2)}  •  Uygulanan %${Math.abs(applied).toFixed(2)}`;
        }),
        "GÜNCEL FİYAT",
      ];
      const body=rows.map(row=>[
        row.route,row.type,Number(row.initial||0),
        ...dates.map(date=>Number(row.changes[date]?.displayValue||0)),
        Number(row.current||0),
      ]);
      const aoa=[
        [`KWS • ${cfg.title} FİYAT HAFIZASI`],
        ["İlk fiyattan güncel fiyata aktif tarife değişimleri"],
        [`Rapor: ${new Date().toLocaleString("tr-TR")}   |   ${rows.length} fiyat satırı   |   ${dates.length} işlem`],
        [],
        headers,
        ...body,
      ];
      const ws=XLSX.utils.aoa_to_sheet(aoa);
      const lastCol=headers.length-1,lastRow=aoa.length;
      ws["!merges"]=[
        XLSX.utils.decode_range(`A1:${XLSX.utils.encode_col(lastCol)}1`),
        XLSX.utils.decode_range(`A2:${XLSX.utils.encode_col(lastCol)}2`),
        XLSX.utils.decode_range(`A3:${XLSX.utils.encode_col(lastCol)}3`),
      ];
      ws["!freeze"]={xSplit:3,ySplit:5,topLeftCell:"D6"};
      ws["!autofilter"]={ref:`A5:${XLSX.utils.encode_col(lastCol)}${lastRow}`};
      ws["!cols"]=headers.map((_,i)=>({wch:i===0?40:i===1?25:i===2?18:i===lastCol?19:29}));
      ws["!rows"]=[{hpt:38},{hpt:24},{hpt:21},{hpt:8},{hpt:54},...body.map(()=>({hpt:31}))];
      ws["!sheetView"]={showGridLines:false};

      const border={bottom:{style:"thin",color:{rgb:"E4EAF1"}},right:{style:"thin",color:{rgb:"EDF1F5"}}};
      ["A1","A2","A3"].forEach((ref,i)=>{
        if(!ws[ref])return;
        ws[ref].s={
          fill:{fgColor:{rgb:i===0?cfg.hero:i===1?"EEF4FA":"F7F9FC"}},
          font:{bold:i===0,sz:i===0?19:i===1?11:9,color:{rgb:i===0?"FFFFFF":i===1?cfg.accent:"708196"}},
          alignment:{horizontal:"left",vertical:"center"},
        };
      });
      for(let c=0;c<=lastCol;c++){
        const cell=ws[XLSX.utils.encode_cell({r:4,c})]; if(!cell)continue;
        const initial=c===2,current=c===lastCol,change=c>=3&&c<lastCol;
        cell.s={
          fill:{fgColor:{rgb:initial?"EAF3FF":current?"EAF8F0":change?"F0F4F9":"DCE7F2"}},
          font:{bold:true,sz:9,color:{rgb:initial?"225D9E":current?"157347":change?"405B78":"263E59"}},
          alignment:{horizontal:c===0?"left":"center",vertical:"center",wrapText:true},border,
        };
      }
      for(let r=5;r<lastRow;r++){
        const item=rows[r-5];
        for(let c=0;c<=lastCol;c++){
          const cell=ws[XLSX.utils.encode_cell({r,c})]; if(!cell)continue;
          let fill=(r-5)%2===0?"FFFFFF":"F8FAFC",color="263A53",bold=false;
          if(c===2){fill="EDF5FF";color="225D9E";bold=true;}
          if(c===lastCol){fill="EAF8F0";color="157347";bold=true;}
          if(c>=3&&c<lastCol){
            const ch=item?.changes?.[dates[c-3]];
            if(ch&&!ch.unchanged){
              const up=Number(ch.newValue)>=Number(ch.oldValue);
              fill=up?"EDF9F2":"FFF0F1";color=up?"157347":"B4232C";bold=true;
            }
          }
          cell.s={fill:{fgColor:{rgb:fill}},font:{sz:10,bold,color:{rgb:color}},alignment:{horizontal:c===0?"left":"center",vertical:"center",wrapText:true},border};
          if(c>=2)cell.z='#,##0.00 "₺"';
        }
      }
      return ws;
    };

    const wb=XLSX.utils.book_new();
    categories.forEach(cfg=>XLSX.utils.book_append_sheet(wb,createSheet(cfg),cfg.sheet));
    XLSX.writeFile(wb,`KWS_Fiyat_Hafizasi_${new Date().toISOString().slice(0,10)}.xlsx`,{cellStyles:true});
  };

  const exportFasdatHistoryExcel = () => {
    const rows = (history || []).map((item) => [
      new Date(item.created_at).toLocaleString("tr-TR"),
      item.tarife_tipi === "alis" ? "Alış / Maliyet" : "Satış",
      item.yukleme_noktasi || item.yukleme || "-",
      item.bosaltma_noktasi || item.bosaltma || "-",
      excelMoney(item.eski_yakit_fiyati),
      excelMoney(item.yeni_yakit_fiyati),
      Number(item.yakit_degisim_orani || 0) * 100,
      Number(item.uygulanan_artis_orani || 0) * 100,
      excelMoney(item.eski_ton_tl),
      excelMoney(item.yeni_ton_tl),
      excelMoney(item.yeni_ton_tl) - excelMoney(item.eski_ton_tl),
    ]);

    downloadHistoryWorkbook({
      fileName: `FASDAT_Yakit_Gecmisi_${new Date()
        .toISOString()
        .slice(0, 10)}.xlsx`,
      sheetName: "FASDAT Geçmiş",
      title: "FASDAT YAKIT TARİFE GEÇMİŞİ",
      subtitle: "Yakıt değişimleri ve tarifelere uygulanan güncellemeler",
      headers: [
        "Tarih / Saat",
        "Tarife Tipi",
        "Yükleme",
        "Boşaltma",
        "Eski Yakıt",
        "Yeni Yakıt",
        "Yakıt Değişimi %",
        "Uygulanan %",
        "Eski TON/TL",
        "Yeni TON/TL",
        "Fark",
      ],
      rows,
      widths: [20, 16, 25, 25, 14, 14, 16, 14, 16, 16, 15],
      percentColumns: [6, 7],
      moneyColumns: [4, 5, 8, 9, 10],
    });
  };

  const exportKwsHistoryExcel = (category = "alis") => {
    const meta = kwsHistoryMeta[category];

    const rows = [];

    (kwsHistory || []).forEach((item) => {
      const before = item?.eski_tarifeler?.[category] || [];
      const after = item?.yeni_tarifeler?.[category] || [];

      before.forEach((oldRow, index) => {
        const newRow = after[index] || {};
        const common = [
          new Date(item.created_at).toLocaleString("tr-TR"),
          oldRow.yukleme || "-",
          oldRow.bosaltma || "-",
          excelMoney(item.eski_yakit_fiyati),
          excelMoney(item.yeni_yakit_fiyati),
          Number(item.yakit_degisim_orani || 0) * 100,
          Number(item.uygulanan_artis_orani || 0) * 100,
        ];

        if (category === "lowbed") {
          rows.push([
            ...common,
            excelMoney(oldRow.haric),
            excelMoney(newRow.haric),
            excelMoney(newRow.haric) - excelMoney(oldRow.haric),
            excelMoney(oldRow.dahil),
            excelMoney(newRow.dahil),
            excelMoney(newRow.dahil) - excelMoney(oldRow.dahil),
          ]);
        } else {
          rows.push([
            ...common,
            excelMoney(oldRow.ikiHaric),
            excelMoney(newRow.ikiHaric),
            excelMoney(newRow.ikiHaric) - excelMoney(oldRow.ikiHaric),
            excelMoney(oldRow.ikiDahil),
            excelMoney(newRow.ikiDahil),
            excelMoney(oldRow.ucHaric),
            excelMoney(newRow.ucHaric),
            excelMoney(newRow.ucHaric) - excelMoney(oldRow.ucHaric),
            excelMoney(oldRow.ucDahil),
            excelMoney(newRow.ucDahil),
          ]);
        }
      });
    });

    const lowbed = category === "lowbed";

    downloadHistoryWorkbook({
      fileName: `KWS_${category.toUpperCase()}_Yakit_Gecmisi_${new Date()
        .toISOString()
        .slice(0, 10)}.xlsx`,
      sheetName: `KWS ${category}`,
      title: `KWS ${meta.title.toLocaleUpperCase("tr-TR")}`,
      subtitle: meta.subtitle,
      headers: lowbed
        ? [
            "Tarih / Saat",
            "Yükleme",
            "Boşaltma",
            "Eski Yakıt",
            "Yeni Yakıt",
            "Yakıt Değişimi %",
            "Uygulanan %",
            "Eski KDV Hariç",
            "Yeni KDV Hariç",
            "Fark",
            "Eski KDV Dahil",
            "Yeni KDV Dahil",
            "Fark",
          ]
        : [
            "Tarih / Saat",
            "Yükleme",
            "Boşaltma",
            "Eski Yakıt",
            "Yeni Yakıt",
            "Yakıt Değişimi %",
            "Uygulanan %",
            "2 İlaveli Eski Hariç",
            "2 İlaveli Yeni Hariç",
            "Fark",
            "2 İlaveli Eski Dahil",
            "2 İlaveli Yeni Dahil",
            "3 İlaveli Eski Hariç",
            "3 İlaveli Yeni Hariç",
            "Fark",
            "3 İlaveli Eski Dahil",
            "3 İlaveli Yeni Dahil",
          ],
      rows,
      widths: lowbed
        ? [20, 24, 27, 13, 13, 16, 14, 17, 17, 14, 17, 17, 14]
        : [20, 24, 27, 13, 13, 16, 14, 19, 19, 14, 19, 19, 19, 19, 14, 19, 19],
      percentColumns: [5, 6],
      moneyColumns: lowbed
        ? [3, 4, 7, 8, 9, 10, 11, 12]
        : [3, 4, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16],
    });
  };

  /* =======================================================
     GEÇMİŞ
  ======================================================= */

  const showHistory =
    async (type) => {
      if (!customer) {
        return;
      }

      setError("");

      try {
        const {
          data,
          error:
            historyError,
        } =
          await supabase
            .from(
              "yakit_ton_tl_gecmisi"
            )
            .select("*")
            .eq(
              "musteri_id",
              customer.id
            )
            .eq(
              "tarife_tipi",
              type
            )
            .order(
              "created_at",
              {
                ascending: false,
              }
            );

        if (historyError) {
          throw historyError;
        }

        setHistory(
          data || []
        );

        setModal({
          kind: "history",
          type,
        });
      } catch (e) {
        setError(
          e?.message ||
            "Geçmiş yüklenemedi."
        );
      }
    };

  /* =======================================================
     MÜŞTERİ SEÇİM EKRANI
  ======================================================= */

  if (!customer) {
    let overviewPrices = {};
    try { overviewPrices = JSON.parse(localStorage.getItem("odak_yakit_ui_prices_v1") || "{}"); } catch {}
    void fuelOverviewVersion;

    const getOverviewFuel = (item) => {
      const key = customerFuelKey(item);
      const ref = CUSTOMER_FUEL_REFERENCES[key] || { station: "Yakıt Referansı", location: "Tanımlı nokta" };
      const live = overviewPrices[key] || {};
      const oldPrice = Number(live.old ?? live.baseline);
      const currentPrice = Number(live.new);
      const change = Number.isFinite(oldPrice) && oldPrice > 0 && Number.isFinite(currentPrice)
        ? ((currentPrice - oldPrice) / oldPrice) * 100
        : null;
      return { key, ref, live, oldPrice, currentPrice, change };
    };

    const dashboardRows = customers.map((item) => {
      const fuel = getOverviewFuel(item);
      const defaults = { FASDAT: 7, KWS: 5, "ETİ": 10, "CMC AGRO": 5, CORTEVA: 5, "EFOR ÇAY": 5, TEVERPAN: 5, "BİM": 5 };
      const candidate = Number(fuel.live?.thresholdPct ?? fuel.live?.threshold);
      const threshold = Number.isFinite(candidate) && candidate > 0 ? candidate : (defaults[fuel.key] || 5);
      const absChange = Math.abs(fuel.change || 0);
      const status = fuel.change == null ? "waiting" : absChange >= threshold ? "need" : absChange >= threshold * .85 ? "near" : "ok";
      return { item, fuel, threshold, status };
    });
    return <FuelStationDashboard rows={dashboardRows} loading={customerLoading} error={error} onOpenCustomer={openCustomer} onReload={loadCustomers}/>;
  }

  /* =======================================================
     KWS GÜNCELLEME + GEÇMİŞ
  ======================================================= */

  const applyKwsUpdate = () => {
    if (!kwsUpdate) return;

    setBusy(true);
    setError("");

    try {
      const oldTarifeler = JSON.parse(JSON.stringify(kwsTarifeler));

      const next = {
        alis: kwsTarifeler.alis.map((r) => ({
          ...r,
          ikiHaric: applyRate(r.ikiHaric, kwsApplied),
          ikiDahil: applyRate(r.ikiDahil, kwsApplied),
          ucHaric: applyRate(r.ucHaric, kwsApplied),
          ucDahil: applyRate(r.ucDahil, kwsApplied),
        })),
        satis: kwsTarifeler.satis.map((r) => ({
          ...r,
          ikiHaric: applyRate(r.ikiHaric, kwsApplied),
          ikiDahil: applyRate(r.ikiDahil, kwsApplied),
          ucHaric: applyRate(r.ucHaric, kwsApplied),
          ucDahil: applyRate(r.ucDahil, kwsApplied),
        })),
        lowbed: kwsTarifeler.lowbed.map((r) => ({
          ...r,
          haric: applyRate(r.haric, kwsApplied),
          dahil: applyRate(r.dahil, kwsApplied),
        })),
      };

      const historyItem = {
        id: `kws-${Date.now()}`,
        created_at: new Date().toISOString(),
        eski_yakit_fiyati: num(calc.eski),
        yeni_yakit_fiyati: num(calc.yeni),
        yakit_degisim_orani: oran,
        uygulanan_artis_orani: kwsApplied,
        eski_tarifeler: oldTarifeler,
        yeni_tarifeler: next,
      };

      const nextHistory = [historyItem, ...kwsHistory];

      setKwsTarifeler(next);
      setKwsHistory(nextHistory);

      localStorage.setItem("kws_yakit_tarifeleri", JSON.stringify(next));
      localStorage.setItem("kws_yakit_gecmisi", JSON.stringify(nextHistory));

      setInfo(
        `KWS tarifeleri güncellendi. Yakıt değişimi %${pct.toFixed(2)}, tarifeye yansıyan oran %${kwsAppliedPct.toFixed(2)}.`
      );

      setCalc({
        eski: String(num(calc.yeni)),
        yeni: "",
      });
    } catch (e) {
      setError(e?.message || "KWS tarifeleri güncellenemedi.");
    } finally {
      setBusy(false);
    }
  };

  const undoLastKwsUpdate = () => {
    if (!kwsHistory.length) {
      setInfo("Geri alınabilecek bir KWS güncellemesi bulunamadı.");
      return;
    }

    const confirmed = window.confirm(
      "Son yapılan KWS yakıt güncellemesi geri alınacak. Alış, satış ve Lowbed tarifeleri önceki değerlerine dönecek. Devam edilsin mi?"
    );

    if (!confirmed) return;

    setBusy(true);
    setError("");
    setInfo("");

    try {
      const latest = kwsHistory[0];

      if (!latest?.eski_tarifeler) {
        throw new Error("Son KWS işleminin önceki tarife bilgileri bulunamadı.");
      }

      const restored = latest.eski_tarifeler;
      const nextHistory = kwsHistory.slice(1);

      setKwsTarifeler(restored);
      setKwsHistory(nextHistory);

      localStorage.setItem(
        "kws_yakit_tarifeleri",
        JSON.stringify(restored)
      );
      localStorage.setItem(
        "kws_yakit_gecmisi",
        JSON.stringify(nextHistory)
      );
      restoreFuelValuesAfterUndo("KWS", latest, (v) => setCalc((prev) => ({...prev, eski:v})), (v) => setCalc((prev) => ({...prev, yeni:v})));

      setModal(null);
      setInfo(
        "Son KWS işlemi geri alındı. Alış, satış ve Lowbed tarifeleri önceki değerlerine döndürüldü."
      );
    } catch (e) {
      setError(e?.message || "Son KWS işlemi geri alınamadı.");
    } finally {
      setBusy(false);
    }
  };

  const showKwsHistory = (category = "alis") => {
    setModal({ kind: "kws-history", category });
  };

  const kwsHistoryMeta = {
    alis: {
      title: "Alış / Maliyet Geçmişi",
      subtitle: "KWS alış ve maliyet tarifelerinde yapılan yakıt güncellemeleri",
      icon: ShoppingCart,
    },
    satis: {
      title: "Satış Geçmişi",
      subtitle: "KWS satış tarifelerinde yapılan yakıt güncellemeleri",
      icon: BadgeDollarSign,
    },
    lowbed: {
      title: "Lowbed Geçmişi",
      subtitle: "KWS Lowbed tarifelerinde yapılan yakıt güncellemeleri",
      icon: Truck,
    },
  };



  const formatEtiPercent = (value) => {
    if (value == null || !Number.isFinite(Number(value))) return "—";
    return `%${(Number(value) * 100).toLocaleString("tr-TR",{minimumFractionDigits:2,maximumFractionDigits:2})}`;
  };
  const etiNumber = (value) => {
    if (typeof value === "number") return value;
    const raw=String(value??"").trim().replace(/\./g,"").replace(",",".");
    const parsed=Number(raw); return Number.isFinite(parsed)?parsed:0;
  };
  const etiOldFuelNum=etiNumber(etiOldFuel), etiNewFuelNum=etiNumber(etiNewFuel);
  const etiFuelRate=etiOldFuelNum>0&&etiNewFuelNum>0?(etiNewFuelNum-etiOldFuelNum)/etiOldFuelNum:null;
  const etiThresholdPassed=etiFuelRate!=null&&Math.abs(etiFuelRate)>0.10;
  const etiAppliedRate=etiThresholdPassed?etiFuelRate*0.50:0;
  const etiApplyRate=(rows,rate)=>(rows||[]).map(row=>({...row,fiyat:Math.round(Number(row.fiyat||0)*(1+rate))}));

  const applyEtiUpdate=()=>{
    if(!(etiOldFuelNum>0)||!(etiNewFuelNum>0)){setError("ETİ için eski ve yeni yakıt fiyatını girin.");return;}
    if(!etiThresholdPassed){setError("ETİ kuralına göre yakıt değişimi %10'u aşmadığı için tarife güncellenmez.");return;}
    const before=JSON.parse(JSON.stringify(etiTarifeler));
    const after={};
    Object.keys(before).forEach(key=>{
      after[key]={satis:etiApplyRate(before[key].satis,etiAppliedRate),alis:etiApplyRate(before[key].alis,etiAppliedRate)};
    });
    const historyRows=[];
    Object.keys(before).forEach(category=>{
      ["satis","alis"].forEach(type=>{
        const oldRows=before?.[category]?.[type]||[];
        const newRows=after?.[category]?.[type]||[];
        oldRows.forEach((oldRow,i)=>{
          const newRow=newRows[i]||{};
          historyRows.push({
            category,
            type,
            location:category==="seker"
              ? oldRow.rota
              : [oldRow.il,oldRow.ilce,oldRow.mahalle].filter(Boolean).join(" / "),
            eski:Number(oldRow.fiyat||0),
            yeni:Number(newRow.fiyat||0),
          });
        });
      });
    });
    const item={
      id:`eti-${Date.now()}`,
      created_at:new Date().toISOString(),
      eski_yakit_fiyati:etiOldFuelNum,
      yeni_yakit_fiyati:etiNewFuelNum,
      yakit_degisim_orani:etiFuelRate,
      uygulanan_artis_orani:etiAppliedRate,
      eski_tarifeler:before,
      yeni_tarifeler:after,
      rows:historyRows
    };
    setEtiTarifeler(after);
    localStorage.setItem("eti_yakit_tarifeleri_v2",JSON.stringify(after));

    setEtiHistory(prev=>{
      const history=[item,...prev];
      localStorage.setItem("eti_yakit_gecmisi_v2",JSON.stringify(history));
      return history;
    });

    setEtiOldFuel(String(etiNewFuelNum));
    setEtiNewFuel("");
    setError("");
  };
  const undoLastEtiUpdate=()=>{
    const latest=etiHistory[0];if(!latest){setError("ETİ için geri alınacak işlem bulunamadı.");return;}
    if(!window.confirm("ETİ için yapılan son yakıt güncellemesi geri alınsın mı?"))return;
    const history=etiHistory.slice(1);
    setEtiTarifeler(latest.eski_tarifeler);
    setEtiHistory(history);
    localStorage.setItem("eti_yakit_tarifeleri_v2",JSON.stringify(latest.eski_tarifeler));
    localStorage.setItem("eti_yakit_gecmisi_v2",JSON.stringify(history));
    restoreFuelValuesAfterUndo("ETİ", latest, setEtiOldFuel, setEtiNewFuel);
    setError("");
  };
  const getEtiHistoryRows=(category,type)=>{
    const rows=[];
    etiHistory.forEach(item=>{
      const storedRows=Array.isArray(item?.rows)
        ? item.rows.filter(row=>row.category===category&&row.type===type)
        : null;

      if(storedRows){
        storedRows.forEach((row,i)=>rows.push({
          id:`${item.id}-${category}-${type}-${i}`,
          created_at:item.created_at,
          location:row.location,
          eski:Number(row.eski||0),
          yeni:Number(row.yeni||0),
          yakit:Number(item.yakit_degisim_orani||0),
          uygulanan:Number(item.uygulanan_artis_orani||0)
        }));
        return;
      }

      // Eski localStorage kayıtları için geriye dönük uyumluluk.
      const before=item?.eski_tarifeler?.[category]?.[type]||[];
      const after=item?.yeni_tarifeler?.[category]?.[type]||[];
      before.forEach((oldRow,i)=>{
        const newRow=after[i]||{};
        rows.push({
          id:`${item.id}-${category}-${type}-${i}`,
          created_at:item.created_at,
          location:category==="seker"
            ? oldRow.rota
            : [oldRow.il,oldRow.ilce,oldRow.mahalle].filter(Boolean).join(" / "),
          eski:Number(oldRow.fiyat||0),
          yeni:Number(newRow.fiyat||0),
          yakit:Number(item.yakit_degisim_orani||0),
          uygulanan:Number(item.uygulanan_artis_orani||0)
        });
      });
    });
    return rows;
  };

  const exportEtiTarifeleriExcel=()=>{
    const wb=XLSX.utils.book_new();
    const add=(name,title,headers,rows,widths,moneyColumns)=>XLSX.utils.book_append_sheet(wb,buildModernHistorySheet({title,subtitle:"ETİ güncel tarife listesi",headers,rows,widths,moneyColumns}),name);
    add("Şeker Satış","ETİ - ŞEKER SATIŞ",["Alım Yeri / Rota","TL / TON"],etiTarifeler.seker.satis.map(x=>[x.rota,x.fiyat]),[48,18],[1]);
    [["Çiftçi","ciftci"],["Yulaf","yulaf"],["Buğday","bugday"]].forEach(([label,key])=>{
      ["satis","alis"].forEach(type=>add(`${label} ${type==="satis"?"Satış":"Alış"}`,`ETİ - ${label.toUpperCase()} ${type==="satis"?"SATIŞ":"ALIŞ"}`,["İl","İlçe","Mahalle","TL / TON"],etiTarifeler[key][type].map(x=>[x.il,x.ilce,x.mahalle,x.fiyat]),[20,25,34,18],[3]));
    });
    ["satis","alis"].forEach(type=>add(`Ek Rota ${type==="satis"?"Satış":"Alış"}`,`ETİ - EK ROTA ${type==="satis"?"SATIŞ":"ALIŞ"}`,["İl","İlçe","TL / TON"],etiTarifeler.ek[type].map(x=>[x.il,x.ilce,x.fiyat]),[22,30,18],[2]));
    XLSX.writeFile(wb,`ETI_Yakit_Tarifeleri_${new Date().toISOString().slice(0,10)}.xlsx`);
  };



  const restoreFuelValuesAfterUndo = (customerKey, historyItem, setOld, setNew) => {
    const oldValue = Number(historyItem?.eski_yakit_fiyati ?? historyItem?.eski_yakit ?? 0);
    const newValue = Number(historyItem?.yeni_yakit_fiyati ?? historyItem?.yeni_yakit ?? 0);
    if (oldValue > 0) setOld(String(oldValue).replace(".", ","));
    if (newValue > 0) setNew(String(newValue).replace(".", ","));
    try {
      const allUi = JSON.parse(localStorage.getItem("odak_yakit_ui_prices_v1") || "{}");
      allUi[customerKey] = {
        ...(allUi[customerKey] || {}),
        old: oldValue,
        baseline: oldValue,
        referencePrice: oldValue,
        lastProcessedPrice: oldValue,
        new: newValue,
        current: newValue,
        currentPrice: newValue,
        updatedAt: new Date().toISOString(),
      };
      if (customerKey === "EFOR ÇAY" && oldValue > 0) {
        localStorage.setItem("efor_cay_kabul_edilen_yakit_v1", String(oldValue));
      }
      localStorage.setItem("odak_yakit_ui_prices_v1", JSON.stringify(allUi));
      window.dispatchEvent(new Event("odak-fuel-updated"));
    } catch {}
  };

  /* =======================================================
     BİM - YAKIT ESKALASYONU
     bim.xlsx: Değişim %5 / Fiyat Etkisi %40
  ======================================================= */
  const bimNum=(v)=>{let x=String(v??"").trim().replace(/₺|TL/gi,"");if(!x)return 0;if(x.includes(","))x=x.replace(/\./g,"").replace(",",".");const n=Number(x);return Number.isFinite(n)?n:0;};
  const bimOld=bimNum(bimOldFuel), bimNew=bimNum(bimNewFuel);
  const bimFuelRate=bimOld>0&&bimNew>0?(bimNew-bimOld)/bimOld:null;
  const bimThresholdPassed=bimFuelRate!=null&&Math.abs(bimFuelRate)>=0.05;
  const bimAppliedRate=bimThresholdPassed?bimFuelRate*0.40:0;
  const bimPct=(v)=>v==null?"—":`%${(Number(v)*100).toLocaleString("tr-TR",{minimumFractionDigits:2,maximumFractionDigits:2})}`;
  const applyBimUpdate=()=>{
    if(!bimThresholdPassed)return;
    const before=JSON.parse(JSON.stringify(bimTarifeler));
    const after=before.map(r=>({...r,fiyatlar:Object.fromEntries(Object.entries(r.fiyatlar||{}).map(([k,v])=>{
      const calculated = Number(v||0) * (1+bimAppliedRate);
      // V45: BİM hesaplamasında önce ham tarife üzerinden eskalasyon hesaplanır;
      // yalnızca nihai sonuç 0,500 ve üzeri yukarı, altı aşağı yuvarlanır.
      // Örn: 40002,344 -> 40002 / 40002,500 -> 40003.
      return [k, tariffRound(calculated)];
    }))}));
    const h={id:`bim-${Date.now()}`,created_at:new Date().toISOString(),eski_yakit:bimOld,yeni_yakit:bimNew,yakit_orani:bimFuelRate,uygulanan_oran:bimAppliedRate,eski_tarifeler:before,yeni_tarifeler:after};
    setBimTarifeler(after); localStorage.setItem("bim_yakit_tarifeleri",JSON.stringify(after));
    setBimHistory(prev=>{const n=[h,...prev];localStorage.setItem("bim_yakit_gecmisi",JSON.stringify(n));return n;});
    setBimOldFuel(String(bimNew));setBimNewFuel("");
    let fuelUi={}; try{fuelUi=JSON.parse(localStorage.getItem("odak_yakit_ui_prices_v1")||"{}");}catch{}
    fuelUi["BİM"]={...(fuelUi["BİM"]||{}),old:bimNew,baseline:bimNew,referencePrice:bimNew,lastProcessedPrice:bimNew,updatedAt:new Date().toISOString(),vatIncluded:false,priceMode:"KDV hariç (+KDV)"};
    localStorage.setItem("odak_yakit_ui_prices_v1",JSON.stringify(fuelUi));
    window.dispatchEvent(new Event("odak-fuel-updated"));
    setInfo(`BİM tarifeleri güncellendi. Uygulanan oran ${bimPct(bimAppliedRate)}.`);setError("");
  };
  const undoLastBimUpdate=()=>{const h=bimHistory[0];if(!h?.eski_tarifeler){setInfo("Geri alınabilecek BİM işlemi yok.");return;}if(!window.confirm("BİM için son işlem geri alınsın mı?"))return;const rest=h.eski_tarifeler,next=bimHistory.slice(1);setBimTarifeler(rest);setBimHistory(next);localStorage.setItem("bim_yakit_tarifeleri",JSON.stringify(rest));localStorage.setItem("bim_yakit_gecmisi",JSON.stringify(next));restoreFuelValuesAfterUndo("BİM",h,setBimOldFuel,setBimNewFuel);setInfo("BİM son işlemi geri alındı. Referans, eski ve yeni yakıt değerleri de önceki işleme döndürüldü.");};
  const getBimHistoryRows=()=>{
    const rows=[];
    (bimHistory||[]).forEach(h=>{
      const before=h?.eski_tarifeler||[];
      const after=h?.yeni_tarifeler||[];
      before.forEach((oldRow,rowIndex)=>{
        const newRow=after[rowIndex]||{};
        BIM_DESTINATIONS.forEach(destination=>{
          const oldValue=oldRow?.fiyatlar?.[destination];
          const newValue=newRow?.fiyatlar?.[destination];
          if(oldValue==null&&newValue==null)return;
          rows.push({
            id:`${h.id}-${rowIndex}-${destination}`,
            created_at:h.created_at,
            sira:oldRow.sira,
            cikis:oldRow.cikis,
            varis:destination,
            eski:Number(oldValue||0),
            yeni:Number(newValue||0),
            fark:Number(newValue||0)-Number(oldValue||0),
            eski_yakit:Number(h.eski_yakit||0),
            yeni_yakit:Number(h.yeni_yakit||0),
            yakit_orani:Number(h.yakit_orani||0),
            uygulanan_oran:Number(h.uygulanan_oran||0)
          });
        });
      });
    });
    return rows;
  };
  const exportBimPriceMemoryExcel = async () => {
    try {
      const workbook = new ExcelJS.Workbook();
      workbook.creator = "ODAK Lojistik";
      workbook.created = new Date();
      workbook.modified = new Date();

      const sheet = workbook.addWorksheet("BİM Tarife Matrisi", {
        views: [{ state: "frozen", ySplit: 9, xSplit: 2, showGridLines: false }],
        properties: { defaultRowHeight: 20 },
      });

      const historyItems = (bimHistory || []).slice().sort(
        (a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0)
      );
      const initialMatrix = historyItems[0]?.eski_tarifeler || BIM_TARIFELERI;
      const initialFuel = Number(historyItems[0]?.eski_yakit || 0);
      const snapshots = [
        {
          title: "İLK TARİFE",
          date: historyItems[0]?.created_at ? new Date(historyItems[0].created_at) : null,
          fuel: initialFuel,
          fuelRate: null,
          appliedRate: null,
          matrix: initialMatrix,
          initial: true,
        },
        ...historyItems.map((h, i) => ({
          title: `${i + 1}. GÜNCELLEME`,
          date: h?.created_at ? new Date(h.created_at) : null,
          fuel: Number(h?.yeni_yakit || 0),
          fuelRate: Number(h?.yakit_orani || 0) * 100,
          appliedRate: Number(h?.uygulanan_oran || 0) * 100,
          matrix: h?.yeni_tarifeler || [],
          initial: false,
        })),
      ];

      const COLORS = {
        navy: "0B2D5C", navy2: "123F78", blue: "2563EB", cyan: "EAF4FF",
        red: "E31E24", redSoft: "FFF0F1", green: "0F9F6E", greenSoft: "EAF8F2",
        orange: "F59E0B", orangeSoft: "FFF6DF", purple: "7C3AED", purpleSoft: "F3EEFF",
        text: "14263D", muted: "6C7F96", border: "CBD8E6", white: "FFFFFF",
        soft: "F7FAFD", stripe: "F4F8FC", black: "111827"
      };
      const fill = (argb) => ({ type: "pattern", pattern: "solid", fgColor: { argb } });
      const border = {
        top: { style: "thin", color: { argb: COLORS.border } },
        left: { style: "thin", color: { argb: COLORS.border } },
        bottom: { style: "thin", color: { argb: COLORS.border } },
        right: { style: "thin", color: { argb: COLORS.border } },
      };
      const fmtPct = (v) => v == null ? "—" : `%${Number(v).toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      const fmtFuel = (v) => Number(v) > 0 ? `${Number(v).toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺/L` : "—";
      const fmtDate = (d) => d ? d.toLocaleDateString("tr-TR") : "BAŞLANGIÇ";

      const metaRows = [
        ["TARİH", s => fmtDate(s.date)],
        ["PETROL OFİSİ • İSTANBUL SANCAKTEPE • V/MAX DIESEL", s => fmtFuel(s.fuel)],
        ["YAKIT DEĞİŞİM ORANI", s => fmtPct(s.fuelRate)],
        ["BİM EŞİK KURALI", s => s.initial ? "%5" : "%5"],
        ["TARİFEYE YANSITILAN ORAN", s => fmtPct(s.appliedRate)],
        ["FİYAT DEĞİŞİM ORANI", s => fmtPct(s.appliedRate)],
      ];

      const fixedCols = 2;
      const groupWidth = BIM_DESTINATIONS.length;
      const totalCols = fixedCols + snapshots.length * groupWidth;
      const endCol = sheet.getColumn(totalCols).letter;

      sheet.getColumn(1).width = 8;
      sheet.getColumn(2).width = 28;
      for (let c = 3; c <= totalCols; c += 1) sheet.getColumn(c).width = 14;

      // Kurumsal üst başlık
      sheet.mergeCells(`A1:${endCol}1`);
      const title = sheet.getCell("A1");
      title.value = "BİM • TARİFE MATRİSİ DEĞİŞİM RAPORU";
      title.fill = fill(COLORS.navy);
      title.font = { bold: true, size: 18, color: { argb: COLORS.white } };
      title.alignment = { vertical: "middle", horizontal: "left" };
      sheet.getRow(1).height = 34;

      // Sol bilgi etiketleri + tarihe göre yatay bloklar (örnekteki düzen)
      metaRows.forEach(([label, getValue], idx) => {
        const rowNo = idx + 2;
        sheet.mergeCells(rowNo, 1, rowNo, 2);
        const labelCell = sheet.getCell(rowNo, 1);
        labelCell.value = label;
        labelCell.fill = fill(idx === 0 ? COLORS.navy2 : COLORS.navy);
        labelCell.font = { bold: true, size: idx === 1 ? 9 : 10, color: { argb: COLORS.white } };
        labelCell.alignment = { vertical: "middle", horizontal: "left", wrapText: true };
        labelCell.border = border;

        snapshots.forEach((snap, sIndex) => {
          const startCol = fixedCols + 1 + sIndex * groupWidth;
          const finishCol = startCol + groupWidth - 1;
          sheet.mergeCells(rowNo, startCol, rowNo, finishCol);
          const cell = sheet.getCell(rowNo, startCol);
          cell.value = getValue(snap);
          let bg = COLORS.soft, fg = COLORS.text;
          if (idx === 0) { bg = sIndex === snapshots.length - 1 ? COLORS.greenSoft : COLORS.cyan; fg = COLORS.navy; }
          if (idx === 2 && snap.fuelRate != null) { bg = snap.fuelRate >= 0 ? COLORS.greenSoft : COLORS.redSoft; fg = snap.fuelRate >= 0 ? COLORS.green : COLORS.red; }
          if (idx === 3) { bg = COLORS.orangeSoft; fg = COLORS.orange; }
          if ((idx === 4 || idx === 5) && snap.appliedRate != null) { bg = COLORS.purpleSoft; fg = COLORS.purple; }
          cell.fill = fill(bg);
          cell.font = { bold: true, size: idx === 0 ? 11 : 10, color: { argb: fg } };
          cell.alignment = { vertical: "middle", horizontal: "center" };
          cell.border = border;
        });
        sheet.getRow(rowNo).height = idx === 1 ? 26 : 23;
      });

      // Grup başlığı: her tarih için TIR FİYAT
      sheet.mergeCells("A8:B8");
      sheet.getCell("A8").value = "TARİFE MATRİSİ";
      sheet.getCell("A8").fill = fill(COLORS.soft);
      sheet.getCell("A8").font = { bold: true, color: { argb: COLORS.navy } };
      sheet.getCell("A8").alignment = { horizontal: "center", vertical: "middle" };
      sheet.getCell("A8").border = border;
      snapshots.forEach((snap, sIndex) => {
        const startCol = fixedCols + 1 + sIndex * groupWidth;
        const finishCol = startCol + groupWidth - 1;
        sheet.mergeCells(8, startCol, 8, finishCol);
        const cell = sheet.getCell(8, startCol);
        cell.value = snap.initial ? "TIR FİYAT • İLK TARİFE" : `TIR FİYAT • ${fmtDate(snap.date)}`;
        cell.fill = fill(sIndex === snapshots.length - 1 ? COLORS.greenSoft : COLORS.cyan);
        cell.font = { bold: true, size: 11, color: { argb: sIndex === snapshots.length - 1 ? COLORS.green : COLORS.navy } };
        cell.alignment = { horizontal: "center", vertical: "middle" };
        cell.border = border;
      });
      sheet.getRow(8).height = 25;

      // Alt başlıklar: aynı başlıklar her tarih bloğunda tekrar eder.
      const headerRow = sheet.getRow(9);
      headerRow.getCell(1).value = "SIRA";
      headerRow.getCell(2).value = "ATIK ÇIKIŞ BÖLGESİ";
      snapshots.forEach((_, sIndex) => {
        BIM_DESTINATIONS.forEach((dest, dIndex) => {
          headerRow.getCell(fixedCols + 1 + sIndex * groupWidth + dIndex).value = dest;
        });
      });
      for (let c = 1; c <= totalCols; c += 1) {
        const cell = headerRow.getCell(c);
        cell.fill = fill(c <= 2 ? COLORS.navy : COLORS.navy2);
        cell.font = { bold: true, size: 9, color: { argb: COLORS.white } };
        cell.alignment = { horizontal: c === 2 ? "left" : "center", vertical: "middle" };
        cell.border = border;
      }
      headerRow.height = 28;

      // Satırlar: her tarihin aynı rota satırı yan yana.
      const baseRows = initialMatrix || [];
      baseRows.forEach((base, rowIndex) => {
        const excelRow = sheet.getRow(10 + rowIndex);
        excelRow.getCell(1).value = Number(base?.sira || rowIndex + 1);
        excelRow.getCell(2).value = base?.cikis || "-";
        snapshots.forEach((snap, sIndex) => {
          const sourceRow = (snap.matrix || [])[rowIndex] || {};
          BIM_DESTINATIONS.forEach((dest, dIndex) => {
            const c = fixedCols + 1 + sIndex * groupWidth + dIndex;
            const cell = excelRow.getCell(c);
            cell.value = Number(sourceRow?.fiyatlar?.[dest] || 0);
            cell.numFmt = '#,##0.00';
          });
        });
        for (let c = 1; c <= totalCols; c += 1) {
          const cell = excelRow.getCell(c);
          const sIndex = c > 2 ? Math.floor((c - 3) / groupWidth) : -1;
          const isLatest = sIndex === snapshots.length - 1;
          const bg = isLatest ? (rowIndex % 2 === 0 ? "F1FBF6" : "E9F7F0") : (rowIndex % 2 === 0 ? COLORS.white : COLORS.stripe);
          cell.fill = fill(bg);
          cell.font = { bold: c === 2 || isLatest, size: 9.5, color: { argb: isLatest ? "0D684A" : COLORS.text } };
          cell.alignment = { horizontal: c === 2 ? "left" : c === 1 ? "center" : "right", vertical: "middle" };
          cell.border = border;
        }
        excelRow.height = 22;
      });

      const lastDataRow = 9 + baseRows.length;
      sheet.autoFilter = { from: "A9", to: `${endCol}${lastDataRow}` };
      sheet.pageSetup = { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9, margins: { left: 0.2, right: 0.2, top: 0.4, bottom: 0.4, header: 0.2, footer: 0.2 } };
      sheet.headerFooter.oddFooter = "&L BİM Tarife Matrisi&C Sayfa &P / &N&R ODAK Lojistik";

      // Sekme rengi ve yazdırma alanı
      sheet.properties.tabColor = { argb: COLORS.red };
      sheet.pageSetup.printArea = `A1:${endCol}${lastDataRow}`;

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `BIM_Modern_Tarife_Matrisi_${new Date().toISOString().slice(0,10)}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error("BİM Excel raporu oluşturulamadı:", e);
      setError("BİM Excel raporu oluşturulamadı.");
    }
  };

  const exportTeverpanPriceMemoryExcel = () => exportCustomerPriceMemoryWorkbook({
    filePrefix:"TEVERPAN_Fiyat_Hafizasi",customerTitle:"TEVERPAN",
    categories:[{
      title:"SATIŞ",sheet:"Satış Fiyat Hafızası",hero:"5B3A78",accent:"7A52A3",
      initialRows:TEVERPAN_TARIFELERI,history:teverpanHistory,fields:[["guncelSatis","GÜNCEL SATIŞ"]],
      route:r=>`${r.no ?? "-"} • ${r.il || "-"} / ${r.ilce || "-"}`,
      before:h=>h.eski_tarifeler||[],after:h=>h.yeni_tarifeler||[],routeHeader:"PLAKA / NO • VARIŞ"
    }]
  });

  const exportEforPriceMemoryExcel = () => exportCustomerPriceMemoryWorkbook({
    filePrefix:"EFOR_CAY_Fiyat_Hafizasi",customerTitle:"EFOR ÇAY",
    categories:[{
      title:"SATIŞ",sheet:"Satış Fiyat Hafızası",hero:"145A46",accent:"16815C",
      initialRows:EFOR_CAY_TARIFELERI,history:eforCayHistory,fields:[["tirFiyati","TIR FİYATI"]],
      route:r=>`${r.yukleme || "-"} → ${r.varis || "-"} • ${r.aracTipi || ""}`,
      before:h=>h.eski_tarifeler||[],after:h=>h.yeni_tarifeler||[]
    }]
  });

  const exportCortevaPriceMemoryExcel = () => exportCustomerPriceMemoryWorkbook({
    filePrefix:"CORTEVA_Fiyat_Hafizasi",customerTitle:"CORTEVA",
    categories:[
      {title:"ALIŞ",sheet:"Alış Fiyat Hafızası",hero:"163B65",accent:"2E6FB3",initialRows:CORTEVA_ALIS,history:cortevaHistory,fields:[["tir","TIR"],["kirkayak","KIRKAYAK"]],route:r=>`${r.bolge || "-"} • ${r.yuklemeYeri || "-"} → ${r.indirmeYeri || "-"}`,before:h=>h.eski_tarifeler?.alis||[],after:h=>h.yeni_tarifeler?.alis||[]},
      {title:"SATIŞ",sheet:"Satış Fiyat Hafızası",hero:"145A46",accent:"16815C",initialRows:CORTEVA_SATIS,history:cortevaHistory,fields:[["tir","TIR"],["kirkayak","KIRKAYAK"]],route:r=>`${r.bolge || "-"} • ${r.yuklemeYeri || "-"} → ${r.indirmeYeri || "-"}`,before:h=>h.eski_tarifeler?.satis||[],after:h=>h.yeni_tarifeler?.satis||[]}
    ]
  });

  const exportCmcPriceMemoryExcel = () => exportCustomerPriceMemoryWorkbook({
    filePrefix:"CMC_AGRO_Fiyat_Hafizasi",customerTitle:"CMC AGRO",
    categories:[
      {title:"ALIŞ",sheet:"Alış Fiyat Hafızası",hero:"163B65",accent:"2E6FB3",initialRows:CMC_AGRO_ALIS,history:cmcHistory,fields:[["tlTon","TL/TON"],["tir","TIR"],["kirkayak","KIRKAYAK"],["acikDorse","13.60 AÇIK DORSE"]],route:r=>`${r.il || "-"} / ${r.ilce || "-"}`,before:h=>h.eski_tarifeler?.alis||[],after:h=>h.yeni_tarifeler?.alis||[]},
      {title:"SATIŞ",sheet:"Satış Fiyat Hafızası",hero:"145A46",accent:"16815C",initialRows:CMC_AGRO_SATIS,history:cmcHistory,fields:[["tlTon","TL/TON"],["tir","TIR"],["kirkayak","KIRKAYAK"],["acikDorse","13.60 AÇIK DORSE"]],route:r=>`${r.il || "-"} / ${r.ilce || "-"}`,before:h=>h.eski_tarifeler?.satis||[],after:h=>h.yeni_tarifeler?.satis||[]}
    ]
  });

  const exportEtiPriceMemoryExcel = () => {
    const archive=readFirstPriceArchive("eti");
    const snap=archive?.snapshot||{};
    const groups=[
      ["seker","Şeker"],["ciftci","Çiftçi"],["yulaf","Yulaf"],["bugday","Buğday"],["ek","Ek Rotalar"]
    ];
    const categories=[];
    groups.forEach(([key,label])=>{
      ["alis","satis"].forEach(type=>{
        const initial=snap?.[key]?.[type] || etiTarifeler?.[key]?.[type] || [];
        if(!initial.length)return;
        categories.push({
          title:`${label.toUpperCase()} ${type==="alis"?"ALIŞ":"SATIŞ"}`,
          sheet:`${label} ${type==="alis"?"Alış":"Satış"}`.slice(0,31),
          hero:type==="alis"?"163B65":"145A46",accent:type==="alis"?"2E6FB3":"16815C",
          initialRows:initial,history:etiHistory,fields:[["fiyat","TL / TON"]],
          route:r=>r.rota || [r.il,r.ilce,r.mahalle].filter(Boolean).join(" / ") || "-",
          before:h=>h.eski_tarifeler?.[key]?.[type]||[],
          after:h=>h.yeni_tarifeler?.[key]?.[type]||[]
        });
      });
    });
    exportCustomerPriceMemoryWorkbook({filePrefix:"ETI_Fiyat_Hafizasi",customerTitle:"ETİ",categories});
  };

  // BİM ana Excel butonları artık doğrudan modern yatay tarih-bloklu raporu üretir.
  // Eski/Yeni kolonlu karşılaştırma exportu kaldırıldı.
  const exportBimExcel = exportBimPriceMemoryExcel;

  // Müşteri ekranları artık ayrı modüllere taşınıyor. BİM ekranı ilk ayrıştırılan modüldür.
  if (isBimCustomer(customer)) {
    return <BimCustomerScreen
      FuelOperationLoader={FuelOperationLoader}
      bimSearch={bimSearch}
      setBimSearch={setBimSearch}
      bimTarifeler={bimTarifeler}
      getBimHistoryRows={getBimHistoryRows}
      bimHistory={bimHistory}
      undoLastBimUpdate={undoLastBimUpdate}
      setBimHistoryOpen={setBimHistoryOpen}
      exportBimExcel={exportBimExcel}
      goBackCustomers={goBackCustomers}
      bimThresholdPassed={bimThresholdPassed}
      runFuelOperation={runFuelOperation}
      applyBimUpdate={applyBimUpdate}
      bimOldFuel={bimOldFuel}
      bimNewFuel={bimNewFuel}
      bimPct={bimPct}
      bimFuelRate={bimFuelRate}
      bimCalcOpen={bimCalcOpen}
      setBimCalcOpen={setBimCalcOpen}
      bimAppliedRate={bimAppliedRate}
      BIM_DESTINATIONS={BIM_DESTINATIONS}
      bimTariffDisplay={bimTariffDisplay}
      bimHistoryOpen={bimHistoryOpen}
      exportBimPriceMemoryExcel={exportBimPriceMemoryExcel}
    />;
  }


  /* =======================================================
     TEVERPAN - YAKIT ESKALASYONU
     |yakıt değişimi| >= %5 ise değişimin %50'si satış tarifesine yansır.
  ======================================================= */
  const teverpanNumber = (value) => {
    if (typeof value === "number") return value;
    let raw = String(value ?? "").trim().replace(/₺|TL/gi, "");
    if (!raw) return 0;
    if (raw.includes(",")) raw = raw.replace(/\./g, "").replace(",", ".");
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : 0;
  };

  const formatTeverpanPercent = (value) =>
    value == null || !Number.isFinite(Number(value))
      ? "—"
      : `%${(Number(value) * 100).toLocaleString("tr-TR", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}`;

  const teverpanOldFuelNum = teverpanNumber(teverpanOldFuel);
  const teverpanNewFuelNum = teverpanNumber(teverpanNewFuel);
  const teverpanFuelRate =
    teverpanOldFuelNum > 0 && teverpanNewFuelNum > 0
      ? (teverpanNewFuelNum - teverpanOldFuelNum) / teverpanOldFuelNum
      : null;

  // TEVERPAN: yakıt değişimi %5 veya üzerindeyse değişimin %50'si yansır.
  const teverpanThresholdPassed =
    teverpanFuelRate != null && Math.abs(teverpanFuelRate) >= 0.05;
  const teverpanAppliedRate =
    teverpanThresholdPassed ? teverpanFuelRate * 0.50 : 0;

  const teverpanApplyRows = (rows, rate) =>
    (rows || []).map((row) => ({
      ...row,
      guncelSatis: Math.round(Number(row.guncelSatis || 0) * (1 + Number(rate || 0))),
    }));

  const applyTeverpanUpdate = () => {
    if (!(teverpanOldFuelNum > 0) || !(teverpanNewFuelNum > 0)) {
      setError("TEVERPAN için eski ve yeni yakıt fiyatını girin.");
      return;
    }
    if (!teverpanThresholdPassed) {
      setError(
        "TEVERPAN'da yakıt değişimi en az %5 olmalıdır. %5 ve üzerindeki değişimin %50'si satış tarifelerine yansıtılır."
      );
      return;
    }

    const before = JSON.parse(JSON.stringify(teverpanTarifeler));
    const after = teverpanApplyRows(before, teverpanAppliedRate);
    const historyItem = {
      id: `teverpan-${Date.now()}`,
      created_at: new Date().toISOString(),
      eski_yakit_fiyati: teverpanOldFuelNum,
      yeni_yakit_fiyati: teverpanNewFuelNum,
      yakit_degisim_orani: teverpanFuelRate,
      uygulanan_artis_orani: teverpanAppliedRate,
      eski_tarifeler: before,
      yeni_tarifeler: after,
    };

    setTeverpanTarifeler(after);
    localStorage.setItem("teverpan_yakit_tarifeleri", JSON.stringify(after));

    setTeverpanHistory((prev) => {
      const next = [historyItem, ...prev];
      localStorage.setItem("teverpan_yakit_gecmisi", JSON.stringify(next));
      return next;
    });

    setTeverpanOldFuel(String(teverpanNewFuelNum));
    setTeverpanNewFuel("");
    setError("");
    setInfo(
      `TEVERPAN tarifeleri güncellendi. Yakıt değişimi ${formatTeverpanPercent(
        teverpanFuelRate
      )}, tarifeye uygulanan oran ${formatTeverpanPercent(teverpanAppliedRate)}.`
    );
  };

  const undoLastTeverpanUpdate = () => {
    const latest = teverpanHistory[0];
    if (!latest?.eski_tarifeler) {
      setInfo("Geri alınabilecek TEVERPAN güncellemesi bulunamadı.");
      return;
    }

    if (!window.confirm("TEVERPAN için son yakıt güncellemesi geri alınsın mı?"))
      return;

    const restored = latest.eski_tarifeler;
    const nextHistory = teverpanHistory.slice(1);

    setTeverpanTarifeler(restored);
    setTeverpanHistory(nextHistory);
    localStorage.setItem("teverpan_yakit_tarifeleri", JSON.stringify(restored));
    localStorage.setItem("teverpan_yakit_gecmisi", JSON.stringify(nextHistory));
    restoreFuelValuesAfterUndo("TEVERPAN", latest, setTeverpanOldFuel, setTeverpanNewFuel);
    setInfo("TEVERPAN için son işlem geri alındı. Yakıt referans değerleri de geri yüklendi.");
  };

  const getTeverpanHistoryRows = () => {
    const rows = [];
    teverpanHistory.forEach((item) => {
      const before = item?.eski_tarifeler || [];
      const after = item?.yeni_tarifeler || [];
      before.forEach((oldRow, i) => {
        const newRow = after[i] || {};
        rows.push({
          id: `${item.id}-${i}`,
          created_at: item.created_at,
          no: oldRow.no,
          il: oldRow.il,
          ilce: oldRow.ilce,
          eski: Number(oldRow.guncelSatis || 0),
          yeni: Number(newRow.guncelSatis || 0),
          yakit: Number(item.yakit_degisim_orani || 0),
          uygulanan: Number(item.uygulanan_artis_orani || 0),
        });
      });
    });
    return rows;
  };

  const exportTeverpanExcel = () => {
    const wb = XLSX.utils.book_new();

    const tariffSheet = buildModernHistorySheet({
      title: "TEVERPAN - GÜNCEL SATIŞ TARİFELERİ",
      subtitle: "15.09.2026 fiyat listesi / yakıt eskalasyonu uygulanmış güncel değerler",
      headers: ["PLAKA / NO", "VARIŞ İL", "VARIŞ İLÇE", "GÜNCEL SATIŞ"],
      rows: teverpanTarifeler.map((x) => [
        x.no ?? "",
        x.il,
        x.ilce,
        x.guncelSatis,
      ]),
      widths: [14, 28, 30, 20],
    });
    XLSX.utils.book_append_sheet(wb, tariffSheet, "Güncel Tarifeler");

    const historyRows = getTeverpanHistoryRows();
    const historySheet = buildModernHistorySheet({
      title: "TEVERPAN - YAKIT GÜNCELLEME GEÇMİŞİ",
      subtitle: "Yakıt değişimi %5 veya üzerindeyse değişimin %50'si satış tarifesine uygulanır",
      headers: [
        "TARİH",
        "NO",
        "VARIŞ İL",
        "VARIŞ İLÇE",
        "ESKİ SATIŞ",
        "YENİ SATIŞ",
        "YAKIT DEĞİŞİMİ",
        "UYGULANAN",
      ],
      rows: historyRows.map((x) => [
        new Date(x.created_at).toLocaleString("tr-TR"),
        x.no ?? "",
        x.il,
        x.ilce,
        x.eski,
        x.yeni,
        x.yakit,
        x.uygulanan,
      ]),
      widths: [22, 12, 26, 28, 18, 18, 18, 18],
    });
    XLSX.utils.book_append_sheet(wb, historySheet, "Geçmiş");

    XLSX.writeFile(
      wb,
      `TEVERPAN_Yakit_Tarifeleri_${new Date().toISOString().slice(0, 10)}.xlsx`
    );
  };

  if (isTeverpanCustomer(customer)) {
    const q = norm(teverpanSearch);
    const teverpanRows = (teverpanTarifeler || []).filter(
      (row) =>
        !q ||
        norm(`${row.no ?? ""} ${row.il} ${row.ilce} ${row.guncelSatis}`).includes(q)
    );
    const teverpanHistoryRows = getTeverpanHistoryRows();

    return (
      <div className="fuel-page fuel-full fuel-unified-customer fasdat-page teverpan-page">
        <FuelOperationLoader /><FirstPriceArchiveButton /><CustomerUnifiedOverview />
      <FuelReferenceBanner station="Petrol Ofisi" location="Tekirdağ Çerkezköy" note="TEVERPAN tarifelerinde kullanılan yakıt referans noktası." />

        <div className="fuel-detail-topbar">
          <button type="button" className="fuel-back" onClick={goBackCustomers}>
            <ArrowLeft size={17} /> Müşteriler
          </button>
          <div className="fuel-detail-path">
            <span>Yakıt Hesaplama</span><span>/</span><b>TEVERPAN</b>
          </div>
        </div>

        <div className="fuel-customer-head teverpan-head">
          <div className="fuel-customer-identity">
            <div className="fuel-logo teverpan-logo"><Building2 size={25} /></div>
            <div>
              <span>FİNANS / TEVERPAN YAKIT ESKALASYONU</span>
              <h1>TEVERPAN</h1>
              <p>
                Yakıt değişimi %5 ve üzerindeyse değişimin %50'si güncel satış
                tarifelerine uygulanır.
              </p>
            </div>
          </div>

          <div className="eti-head-actions">
            <button
              className="eti-action-btn"
              onClick={() => setTeverpanHistoryOpen(true)}
            >
              <History size={15} /> Geçmiş
            </button>
            <button
              className="eti-action-btn"
              onClick={undoLastTeverpanUpdate}
              disabled={!teverpanHistory.length}
            >
              <Undo2 size={15} /> Geri Al
            </button>
            <button
              className="eti-action-btn primary"
              onClick={exportTeverpanPriceMemoryExcel}
            >
              <Download size={15} /> Excel'e Aktar
            </button>
            <button
              className="eti-action-btn"
              onClick={goBackCustomers}
            >
              <Users size={15} /> Müşteriler
            </button>
            <button
              className="eti-action-btn primary"
              onClick={() => runFuelOperation("TEVERPAN tarifeleri güncelleniyor", applyTeverpanUpdate)}
              disabled={!teverpanThresholdPassed || busy}
              title={!teverpanThresholdPassed ? "TEVERPAN kuralı sağlanmadı." : "Tarifeleri güncelle"}
            >
              <RefreshCw size={15} /> Güncelle
            </button>
          </div>
        </div>

        <section className="eti-calc-card teverpan-calc-card">
          <div className="eti-calc-rule">
            <div className="eti-rule-icon"><Calculator size={20} /></div>
            <div>
              <span>TEVERPAN ESKALASYON KURALI</span>
              <h2>%5 değişimde değişimin %50'si yansır</h2>
              <p>
                Yakıt fiyatı en az %5 arttığında veya düştüğünde, değişimin
                yarısı tüm TEVERPAN güncel satış tarifelerine uygulanır.
              </p>
            </div>
          </div>

          <div className="eti-calc-fields">
            <label>
              <span>ESKİ YAKIT FİYATI</span>
              <div className="eti-input-box">
                <input
                  value={teverpanOldFuel}
                  onChange={(e) => setTeverpanOldFuel(e.target.value)}
                  placeholder="0,00"
                />
                <small>₺</small>
              </div>
            </label>

            <div className="eti-calc-arrow"><ArrowRight size={17} /></div>

            <label>
              <span>YENİ YAKIT FİYATI</span>
              <div className="eti-input-box">
                <input
                  value={teverpanNewFuel}
                  onChange={(e) => setTeverpanNewFuel(e.target.value)}
                  placeholder="0,00"
                />
                <small>₺</small>
              </div>
            </label>
          </div>

          <div
            className={`eti-change-box ${
              teverpanFuelRate == null
                ? "neutral"
                : teverpanFuelRate > 0
                ? "increase"
                : "decrease"
            }`}
          >
            <span>YAKIT DEĞİŞİMİ</span>
            <b>
              {teverpanFuelRate == null
                ? "—"
                : formatTeverpanPercent(teverpanFuelRate)}
            </b>
            <small>
              {teverpanFuelRate == null
                ? "Fiyatları girin"
                : teverpanThresholdPassed
                ? `Tarifeye ${formatTeverpanPercent(teverpanAppliedRate)} uygulanacak`
                : "%5 eşiği sağlanmadı — tarifeye yansımaz"}
            </small>
          </div>

          <button
            className={`eti-update-btn ${
              !teverpanThresholdPassed ? "rule-disabled" : ""
            }`}
            onClick={() =>
              runFuelOperation(
                "TEVERPAN tarifeleri güncelleniyor",
                applyTeverpanUpdate
              )
            }
            disabled={!teverpanThresholdPassed}
            title={
              !teverpanThresholdPassed
                ? "TEVERPAN kuralı sağlanmadı: yakıt değişimi en az %5 olmalıdır."
                : ""
            }
          >
            <RefreshCw size={16} />
            {teverpanThresholdPassed
              ? "Tarifeleri Güncelle"
              : "Kural Sağlanmadı"}
          </button>
        </section>

        <section className="eti-tariff-workspace teverpan-workspace">
          <div className="eti-workspace-top">
            <div>
              <span>TEVERPAN TARİFE MERKEZİ</span>
              <h2>Güncel Satış Tarifeleri</h2>
              <p>
                Excel dosyasındaki varış il, ilçe ve güncel satış fiyatları.
              </p>
            </div>

            <label className="eti-search eti-global-search">
              <Search size={15} />
              <input
                value={teverpanSearch}
                onChange={(e) => setTeverpanSearch(e.target.value)}
                placeholder="İl, ilçe veya fiyat ara..."
              />
              {teverpanSearch && (
                <button type="button" onClick={() => setTeverpanSearch("")}>
                  ×
                </button>
              )}
            </label>
          </div>

          <div className="fuel-table-wrap teverpan-table-wrap">
            <table className="fuel-table teverpan-table">
              <thead>
                <tr>
                  <th>PLAKA / NO</th>
                  <th>VARIŞ İL</th>
                  <th>VARIŞ İLÇE</th>
                  <th>GÜNCEL SATIŞ</th>
                </tr>
              </thead>
              <tbody>
                {teverpanRows.map((row, i) => (
                  <tr key={`${row.il}-${row.ilce}-${i}`}>
                    <td>{row.no ?? "—"}</td>
                    <td><b>{row.il}</b></td>
                    <td>{row.ilce}</td>
                    <td className="teverpan-price">
                      {(Number(row.guncelSatis) * 1000).toLocaleString("tr-TR", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {teverpanHistoryOpen &&
          createPortal(
            <div className="fuel-modal-backdrop eti-history-backdrop">
              <div className="fuel-modal history-modal eti-history-modal teverpan-history-modal">
                <div className="fasdat-history-hero">
                  <div className="fasdat-history-icon"><History size={21} /></div>
                  <div className="fasdat-history-copy">
                    <span>TEVERPAN / TARİFE GEÇMİŞİ</span>
                    <h2>Yakıt Güncelleme Geçmişi</h2>
                    <p>
                      Her lokasyonun eski ve yeni satış fiyatını, yakıt
                      değişimini ve uygulanan oranı görüntüleyin.
                    </p>
                  </div>
                  <div className="fasdat-history-actions">
                    <button
                      className="fuel-excel-button"
                      onClick={exportTeverpanPriceMemoryExcel}
                    >
                      <Download size={15} /> Excel'e Aktar
                    </button>
                    <button
                      className="fasdat-history-close"
                      onClick={() => setTeverpanHistoryOpen(false)}
                    >
                      ×
                    </button>
                  </div>
                </div>

                <div className="teverpan-history-content">
                  {teverpanHistoryRows.length ? (
                    <div className="fuel-table-wrap teverpan-history-table-wrap">
                      <table className="fuel-table teverpan-history-table">
                        <thead>
                          <tr>
                            <th>TARİH</th>
                            <th>NO</th>
                            <th>VARIŞ İL</th>
                            <th>VARIŞ İLÇE</th>
                            <th>ESKİ</th>
                            <th>YENİ</th>
                            <th>YAKIT</th>
                            <th>UYGULANAN</th>
                          </tr>
                        </thead>
                        <tbody>
                          {teverpanHistoryRows.map((row) => (
                            <tr key={row.id}>
                              <td>{new Date(row.created_at).toLocaleString("tr-TR")}</td>
                              <td>{row.no ?? "—"}</td>
                              <td><b>{row.il}</b></td>
                              <td>{row.ilce}</td>
                              <td>{(Number(row.eski) * 1000).toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                              <td><b>{(Number(row.yeni) * 1000).toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</b></td>
                              <td>{formatTeverpanPercent(row.yakit)}</td>
                              <td><span className="eti-history-rate">{formatTeverpanPercent(row.uygulanan)}</span></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="eti-history-empty">
                      <History size={28} />
                      <h3>Henüz geçmiş kaydı yok</h3>
                      <p>
                        TEVERPAN tarifelerini güncellediğinizde değişiklikler
                        burada görünecek.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>,
            document.body
          )}
      </div>
    );
  }

  /* =======================================================
     EFOR ÇAY - YAKIT ESKALASYONU
     |yakıt değişimi| >= %5 ise değişimin %50'si tarifeye yansır.
  ======================================================= */
  const eforCayNumber = (value) => {
    if (typeof value === "number") return value;
    let raw = String(value ?? "").trim().replace(/₺|TL/gi, "");
    if (!raw) return 0;
    if (raw.includes(",")) raw = raw.replace(/\./g, "").replace(",", ".");
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : 0;
  };
  const formatEforCayPercent = (value) =>
    value == null || !Number.isFinite(Number(value))
      ? "—"
      : `%${(Number(value) * 100).toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  // EFOR ÇAY tarifeleri kesinlikle tam TL'ye yuvarlanmaz.
  // Hesaplama ve gösterim kuruş hassasiyetinde (2 ondalık) tutulur.
  const eforCayMoney = (value) => {
    const n = eforCayNumber(value);
    if (!Number.isFinite(n)) return "—";
    return new Intl.NumberFormat("tr-TR", {
      style: "currency", currency: "TRY", minimumFractionDigits: 2, maximumFractionDigits: 2
    }).format(n);
  };

  const eforCayOldFuelNum = eforCayNumber(eforCayOldFuel);
  const eforCayNewFuelNum = eforCayNumber(eforCayNewFuel);
  const eforCayFuelRate =
    eforCayOldFuelNum > 0 && eforCayNewFuelNum > 0
      ? (eforCayNewFuelNum - eforCayOldFuelNum) / eforCayOldFuelNum
      : null;
  // EFOR ÇAY: %5 ve üzeri değişimde değişimin %50'si tarifeye yansır.
  const eforCayThresholdPassed =
    eforCayFuelRate != null && Math.abs(eforCayFuelRate) >= 0.05;
  const eforCayAppliedRate =
    eforCayThresholdPassed ? eforCayFuelRate * 0.50 : 0;

  const eforCayApplyRows = (rows, rate) =>
    (rows || []).map((row) => ({
      ...row,
      tir: Number(row.tir || 0) * (1 + Number(rate || 0)),
    }));

  const applyEforCayUpdate = () => {
    if (!(eforCayOldFuelNum > 0) || !(eforCayNewFuelNum > 0)) {
      setError("EFOR ÇAY için eski ve yeni yakıt fiyatını girin.");
      return;
    }
    if (!eforCayThresholdPassed) {
      setError("EFOR ÇAY'da yakıt değişimi en az %5 olmalıdır. %5 ve üzerindeki değişimin %50'si tarifeye yansıtılır.");
      return;
    }

    const before = JSON.parse(JSON.stringify(eforCayTarifeler));
    const after = eforCayApplyRows(before, eforCayAppliedRate);
    const item = {
      id: `efor-cay-${Date.now()}`,
      created_at: new Date().toISOString(),
      eski_yakit_fiyati: eforCayOldFuelNum,
      yeni_yakit_fiyati: eforCayNewFuelNum,
      yakit_degisim_orani: eforCayFuelRate,
      uygulanan_artis_orani: eforCayAppliedRate,
      eski_tarifeler: before,
      yeni_tarifeler: after,
    };

    setEforCayTarifeler(after);
    localStorage.setItem("efor_cay_yakit_tarifeleri", JSON.stringify(after));
    // Güncelleme sonrası yeni fiyat artık kabul edilen referans fiyattır.
    localStorage.setItem("efor_cay_kabul_edilen_yakit_v1", String(eforCayNewFuelNum));
    setEforCayHistory((prev) => {
      const next = [item, ...prev];
      localStorage.setItem("efor_cay_yakit_gecmisi", JSON.stringify(next));
      return next;
    });
    setEforCayOldFuel(String(eforCayNewFuelNum));
    setEforCayNewFuel("");
    setError("");
    setInfo(`EFOR ÇAY tarifeleri güncellendi. Yakıt değişimi ${formatEforCayPercent(eforCayFuelRate)}, tarifeye uygulanan oran ${formatEforCayPercent(eforCayAppliedRate)}.`);
  };

  const undoLastEforCayUpdate = () => {
    const latest = eforCayHistory[0];
    if (!latest?.eski_tarifeler) {
      setInfo("Geri alınabilecek EFOR ÇAY güncellemesi bulunamadı.");
      return;
    }
    if (!window.confirm("EFOR ÇAY için son yakıt güncellemesi geri alınsın mı?")) return;
    const restored = latest.eski_tarifeler;
    const nextHistory = eforCayHistory.slice(1);
    setEforCayTarifeler(restored);
    setEforCayHistory(nextHistory);
    localStorage.setItem("efor_cay_yakit_tarifeleri", JSON.stringify(restored));
    localStorage.setItem("efor_cay_yakit_gecmisi", JSON.stringify(nextHistory));
    restoreFuelValuesAfterUndo("EFOR ÇAY", latest, setEforCayOldFuel, setEforCayNewFuel);
    setInfo("EFOR ÇAY için son işlem geri alındı. Yakıt referans değerleri de geri yüklendi.");
  };

  const getEforCayHistoryRows = () => {
    const rows = [];
    eforCayHistory.forEach((item) => {
      const before = item?.eski_tarifeler || [];
      const after = item?.yeni_tarifeler || [];
      before.forEach((oldRow, i) => {
        const newRow = after[i] || {};
        rows.push({
          id: `${item.id}-${i}`,
          created_at: item.created_at,
          yukleme: oldRow.yukleme,
          varis: oldRow.varis,
          aracTipi: oldRow.aracTipi,
          eski: Number(oldRow.tir || 0),
          yeni: Number(newRow.tir || 0),
          yakit: Number(item.yakit_degisim_orani || 0),
          uygulanan: Number(item.uygulanan_artis_orani || 0),
        });
      });
    });
    return rows;
  };

  const exportEforCayExcel = async () => {
    const wb = new ExcelJS.Workbook();
    wb.creator = "ODAK Lojistik";
    wb.created = new Date();
    const ws = wb.addWorksheet("EFOR ÇAY Tarife Hafızası", { views: [{ state: "frozen", xSplit: 2, ySplit: 8 }] });
    ws.properties.defaultRowHeight = 19;
    ws.showGridLines = false;

    const initial = EFOR_CAY_TARIFELERI.map(r => ({...r}));
    const chronological = [...(eforCayHistory || [])].reverse();
    const periods = [{ date: "İlk Fiyatlar", fuel: 90.63, rate: null, applied: null, rows: initial }];
    chronological.forEach(h => periods.push({
      date: new Date(h.created_at).toLocaleString("tr-TR"),
      fuel: Number(h.yeni_yakit_fiyati || 0),
      rate: Number(h.yakit_degisim_orani || 0),
      applied: Number(h.uygulanan_artis_orani || 0),
      rows: h.yeni_tarifeler || []
    }));
    if (!chronological.length && eforCayNewFuelNum > 0) periods.push({ date: "Güncel Kontrol", fuel: eforCayNewFuelNum, rate: eforCayFuelRate, applied: eforCayAppliedRate, rows: eforCayTarifeler });

    ws.getColumn(1).width = 8; ws.getColumn(2).width = 28;
    ws.mergeCells("A1:B6");
    const brand = ws.getCell("A1"); brand.value = "EFOR ÇAY\nTARİFE HAFIZASI"; brand.alignment={vertical:"middle",horizontal:"center",wrapText:true}; brand.font={bold:true,size:16,color:{argb:"FFFFFFFF"}}; brand.fill={type:"pattern",pattern:"solid",fgColor:{argb:"FF111827"}};
    const labels=["TARİH","PETROL OFİSİ • TOKAT ERBAA • MOTORİN","YAKIT DEĞİŞİM ORANI","EFOR ÇAY KURALI","TARİFEYE YANSITILAN ORAN","FİYAT DURUMU"];
    periods.forEach((period,idx)=>{
      const c=3+idx; ws.getColumn(c).width=22;
      labels.forEach((label,r)=>{ const cell=ws.getCell(r+1,c); cell.fill={type:"pattern",pattern:"solid",fgColor:{argb: idx===periods.length-1?"FFEAF8F0":"FFF1F5F9"}}; cell.border={bottom:{style:"thin",color:{argb:"FFD7E0EA"}}}; cell.alignment={horizontal:"center",vertical:"middle",wrapText:true}; });
      ws.getCell(1,c).value=period.date;
      ws.getCell(2,c).value=period.fuel||"—"; ws.getCell(2,c).numFmt='#,##0.00 "₺"';
      ws.getCell(3,c).value=period.rate==null?"—":period.rate; if(period.rate!=null) ws.getCell(3,c).numFmt='0.00%';
      ws.getCell(4,c).value="%5 eşik → %50 yansıtma";
      ws.getCell(5,c).value=period.applied==null?"—":period.applied; if(period.applied!=null) ws.getCell(5,c).numFmt='0.00%';
      ws.getCell(6,c).value=period.rate==null?"Referans":Math.abs(period.rate)>=.05?"Kural sağlandı":"Eşik altında";
      for(let r=1;r<=6;r++){ws.getCell(r,c).font={bold:r===1||r===2,size:r===2?13:10,color:{argb:"FF17324D"}};}
    });
    labels.forEach((label,r)=>{ ws.getCell(r+1,2).value=label; ws.getCell(r+1,2).font={bold:true,color:{argb:"FFFFFFFF"},size:9}; ws.getCell(r+1,2).fill={type:"pattern",pattern:"solid",fgColor:{argb:"FF0F3D2E"}}; });

    const headerRow=8; ["SIRA","YÜKLEME / VARIŞ"].forEach((v,i)=>ws.getCell(headerRow,i+1).value=v);
    periods.forEach((p,idx)=>ws.getCell(headerRow,3+idx).value=idx===0?"TIR FİYATI":p.date);
    for(let c=1;c<=2+periods.length;c++){ const cell=ws.getCell(headerRow,c); cell.font={bold:true,color:{argb:"FFFFFFFF"},size:10}; cell.fill={type:"pattern",pattern:"solid",fgColor:{argb:c<=2?"FF111827":"FF16815C"}}; cell.alignment={horizontal:"center",vertical:"middle"}; }
    initial.forEach((base,i)=>{
      const r=headerRow+1+i; ws.getCell(r,1).value=i+1; ws.getCell(r,2).value=`${base.yukleme} → ${base.varis}`;
      periods.forEach((p,idx)=>{ const row=(p.rows||[])[i]||{}; const cell=ws.getCell(r,3+idx); cell.value=Number(row.tir||0); cell.numFmt='₺#,##0.00'; cell.alignment={horizontal:"right"}; });
      for(let c=1;c<=2+periods.length;c++){ const cell=ws.getCell(r,c); cell.fill={type:"pattern",pattern:"solid",fgColor:{argb:i%2?"FFF8FAFC":"FFFFFFFF"}}; cell.border={bottom:{style:"hair",color:{argb:"FFE5E7EB"}}}; }
    });
    ws.autoFilter={from:{row:headerRow,column:1},to:{row:headerRow+initial.length,column:2+periods.length}};
    ws.pageSetup={orientation:"landscape",fitToPage:true,fitToWidth:1,fitToHeight:0,margins:{left:.25,right:.25,top:.4,bottom:.4,header:.2,footer:.2}};
    const buffer=await wb.xlsx.writeBuffer(); const blob=new Blob([buffer],{type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"}); const url=URL.createObjectURL(blob); const a=document.createElement("a"); a.href=url; a.download=`EFOR_CAY_Tarife_Hafizasi_${new Date().toISOString().slice(0,10)}.xlsx`; a.click(); setTimeout(()=>URL.revokeObjectURL(url),1000);
  };

  if (isEforCayCustomer(customer)) {
    const q = norm(eforCaySearch);
    const eforRows = (eforCayTarifeler || []).filter((row) => !q || norm(`${row.yukleme} ${row.varis} ${row.aracTipi}`).includes(q));
    const eforHistoryRows = getEforCayHistoryRows();
    return (
      <div className="fuel-page fuel-full fuel-unified-customer fasdat-page efor-cay-page efor-v59-page"><FuelOperationLoader />
        <section className="bim-v56-shell efor-v59-shell">
          <header className="bim-v56-header">
            <div className="bim-v56-brand efor-v59-brand"><img src="/fuel-assets/efor-cay-logo.png" alt="EFOR ÇAY"/><div><span>EFOR ÇAY TARİFE YÖNETİMİ</span><h1>EFOR ÇAY – Yakıt Hesaplama</h1><p>Petrol Ofisi • Tokat Erbaa • Motorin</p></div></div>
            <div className="bim-v56-actions">
              <button className="icon-btn" title="Son işlemi geri al" onClick={undoLastEforCayUpdate} disabled={!eforCayHistory.length}><Undo2 size={18}/><span>Geri Al</span></button>
              <button className="icon-btn" title="Fiyat geçmişi" onClick={()=>setEforCayHistoryOpen(true)}><History size={18}/><span>Geçmiş</span></button>
              <button className="icon-btn excel" title="Excel'e aktar" onClick={exportEforCayExcel}><Download size={18}/><span>Excel</span></button>
              <button className="icon-btn" title="Diğer müşteriler" onClick={goBackCustomers}><Users size={18}/><span>Müşteriler</span></button>
              <button className="icon-btn update" title="Tarifeleri güncelle" disabled={!eforCayThresholdPassed} onClick={()=>runFuelOperation("EFOR ÇAY tarifeleri güncelleniyor",applyEforCayUpdate)}><RefreshCw size={18}/><span>Güncelle</span></button>
            </div>
          </header>
          <div className="bim-v56-summary efor-v59-summary">
            <div className="bim-v56-logo efor-v59-logo"><img src="/fuel-assets/efor-cay-logo.png" alt="EFOR ÇAY"/><div><b>EFOR ÇAY</b><span>TIR Fiyatlandırma</span></div></div>
            <div className="bim-v56-metric old"><span>REFERANS YAKIT FİYATI</span><strong>{eforCayOldFuel || "90,63"} ₺</strong><small>Son kabul edilen fiyat</small></div>
            <div className="bim-v56-arrow"><ArrowRight size={22}/></div>
            <div className="bim-v56-metric current"><span>GÜNCEL YAKIT FİYATI</span><strong>{eforCayNewFuel || "—"} ₺</strong><small>Petrol Ofisi • Tokat Erbaa</small></div>
            <div className={`bim-v56-metric change ${eforCayThresholdPassed?"passed":""}`}><span>DEĞİŞİM</span><strong>{formatEforCayPercent(eforCayFuelRate)}</strong><small>{eforCayThresholdPassed?"Eşik sağlandı":"%5 eşik altında"}</small></div>
            <button className="bim-v56-rule-toggle" onClick={()=>setEforCayRuleOpen(v=>!v)}><span><SlidersHorizontal size={18}/><i>EFOR ÇAY KURALI</i><b>%5 eşik <ArrowRight size={14}/> %50 yansıtma</b></span>{eforCayRuleOpen?<ChevronUp size={19}/>:<ChevronDown size={19}/>}</button>
          </div>
          {eforCayRuleOpen&&<div className="bim-v56-rule-detail"><div><b>Hesaplama Kuralı</b><p>Yakıt değişimi ±%5 veya üzerindeyse değişimin %50'si TIR tarifelerine uygulanır. EFOR ÇAY tarifelerinde yukarı/aşağı tam TL yuvarlama yapılmaz; hesaplanan değer iki ondalıkla korunur.</p></div><div className="bim-v56-rule-values"><span>Yakıt değişimi <b>{formatEforCayPercent(eforCayFuelRate)}</b></span><span>Yansıtılan oran <b>{formatEforCayPercent(eforCayAppliedRate)}</b></span><span>Durum <b>{eforCayThresholdPassed?"Güncelleme hazır":"Kural sağlanmadı"}</b></span></div></div>}
        </section>
        <section className="eti-tariff-workspace efor-cay-workspace efor-v59-workspace efor-v60-workspace">
          <div className="eti-workspace-top"><div><span>EFOR ÇAY TARİFE MERKEZİ</span><h2><Table2 size={20}/> Güncel TIR Tarifeleri</h2><p>5 rota • fiyatlar kuruşlarıyla birlikte korunur, tam TL yuvarlama uygulanmaz.</p></div><div className="bim-v48-table-actions"><button className="bim-v51-excel-btn" onClick={exportEforCayExcel}><Download size={16}/> Excel'e Aktar</button><button className="bim-v48-update-btn" disabled={!eforCayThresholdPassed} onClick={()=>runFuelOperation("EFOR ÇAY tarifeleri güncelleniyor",applyEforCayUpdate)}><RefreshCw size={16}/> Tarifeleri Güncelle</button></div><label className="eti-search eti-global-search"><Search size={15}/><input value={eforCaySearch} onChange={e=>setEforCaySearch(e.target.value)} placeholder="Yükleme veya varış ara..."/>{eforCaySearch&&<button type="button" onClick={()=>setEforCaySearch("")}>×</button>}</label></div>
          <div className="fuel-table-wrap efor-cay-table-wrap"><table className="fuel-table efor-cay-table"><thead><tr><th>SIRA</th><th>YÜKLEME</th><th>VARIŞ</th><th>ARAÇ TİPİ</th><th>TIR FİYATI</th></tr></thead><tbody>{eforRows.map((row,i)=><tr key={i}><td>{i+1}</td><td><b>{row.yukleme}</b></td><td>{row.varis}</td><td><span className="cmc-column-badge">{row.aracTipi}</span></td><td className="efor-cay-money"><b>{eforCayMoney(row.tir)}</b></td></tr>)}</tbody></table></div>
        </section>
        {eforCayHistoryOpen && createPortal(<div className="fuel-modal-backdrop eti-history-backdrop"><div className="fuel-modal history-modal eti-history-modal efor-cay-history-modal"><div className="fasdat-history-hero"><div className="fasdat-history-icon"><History size={21}/></div><div className="fasdat-history-copy"><span>EFOR ÇAY / TARİFE GEÇMİŞİ</span><h2>Yakıt Güncelleme Geçmişi</h2><p>Kuruşlu tarife değerleri yuvarlanmadan saklanır.</p></div><div className="fasdat-history-actions"><button className="fuel-excel-button" onClick={exportEforCayExcel}><Download size={15}/> Excel'e Aktar</button><button className="fasdat-history-close" onClick={()=>setEforCayHistoryOpen(false)}>×</button></div></div><div className="efor-cay-history-content">{eforHistoryRows.length?<div className="fuel-table-wrap efor-cay-history-table-wrap"><table className="fuel-table efor-cay-history-table"><thead><tr><th>TARİH</th><th>YÜKLEME</th><th>VARIŞ</th><th>ARAÇ</th><th>ESKİ</th><th>YENİ</th><th>YAKIT</th><th>UYGULANAN</th></tr></thead><tbody>{eforHistoryRows.map(row=><tr key={row.id}><td>{new Date(row.created_at).toLocaleString("tr-TR")}</td><td><b>{row.yukleme}</b></td><td>{row.varis}</td><td>{row.aracTipi}</td><td>{eforCayMoney(row.eski)}</td><td><b>{eforCayMoney(row.yeni)}</b></td><td>{formatEforCayPercent(row.yakit)}</td><td>{formatEforCayPercent(row.uygulanan)}</td></tr>)}</tbody></table></div>:<div className="eti-history-empty"><History size={28}/><h3>Henüz geçmiş kaydı yok</h3><p>İlk güncellemeden sonra kayıtlar burada görünecek.</p></div>}</div></div></div>,document.body)}
      </div>
    );
  }

  /* =======================================================
     CORTEVA - YAKIT ESKALASYONU
     |yakıt değişimi| > %5 ise değişimin %40'ı tarifeye yansır.
  ======================================================= */
  const cortevaNumber = (value) => {
    if (typeof value === "number") return value;
    let raw = String(value ?? "").trim().replace(/₺|TL/gi, "");
    if (!raw) return 0;
    if (raw.includes(",")) raw = raw.replace(/\./g, "").replace(",", ".");
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : 0;
  };
  const formatCortevaPercent = (value) =>
    value == null || !Number.isFinite(Number(value))
      ? "—"
      : `%${(Number(value) * 100).toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const cortevaOldFuelNum = cortevaNumber(cortevaOldFuel);
  const cortevaNewFuelNum = cortevaNumber(cortevaNewFuel);
  const cortevaFuelRate =
    cortevaOldFuelNum > 0 && cortevaNewFuelNum > 0
      ? (cortevaNewFuelNum - cortevaOldFuelNum) / cortevaOldFuelNum
      : null;
  // Kullanıcı kuralı: %5'i GEÇERSE. Tam %5 tetiklemez.
  const cortevaThresholdPassed =
    cortevaFuelRate != null && Math.abs(cortevaFuelRate) > 0.05;
  const cortevaAppliedRate =
    cortevaThresholdPassed ? cortevaFuelRate * 0.40 : 0;

  const cortevaApplyValue = (value, rate) => {
    if (value == null || value === "") return null;
    return Math.round(Number(value) * (1 + Number(rate || 0)));
  };
  const cortevaApplyRows = (rows, rate) =>
    (rows || []).map((row) => ({
      ...row,
      tir: cortevaApplyValue(row.tir, rate),
      kirkayak: cortevaApplyValue(row.kirkayak, rate),
    }));

  const applyCortevaUpdate = () => {
    if (!(cortevaOldFuelNum > 0) || !(cortevaNewFuelNum > 0)) {
      setError("CORTEVA için eski ve yeni yakıt fiyatını girin.");
      return;
    }
    if (cortevaFuelRate === 0) {
      setError("Eski ve yeni yakıt fiyatı aynı. Güncellenecek oran bulunamadı.");
      return;
    }
    if (!cortevaThresholdPassed) {
      setError("CORTEVA'da yakıt değişimi %5'i geçmelidir. %5'in üzerindeki değişimin %40'ı tarifeye yansıtılır.");
      return;
    }

    const before = JSON.parse(JSON.stringify(cortevaTarifeler));
    const after = {
      satis: cortevaApplyRows(before.satis, cortevaAppliedRate),
      alis: cortevaApplyRows(before.alis, cortevaAppliedRate),
    };
    const item = {
      id: `corteva-${Date.now()}`,
      created_at: new Date().toISOString(),
      eski_yakit_fiyati: cortevaOldFuelNum,
      yeni_yakit_fiyati: cortevaNewFuelNum,
      yakit_degisim_orani: cortevaFuelRate,
      uygulanan_artis_orani: cortevaAppliedRate,
      eski_tarifeler: before,
      yeni_tarifeler: after,
    };

    setCortevaTarifeler(after);
    localStorage.setItem("corteva_yakit_tarifeleri", JSON.stringify(after));
    setCortevaHistory((prev) => {
      const next = [item, ...prev];
      localStorage.setItem("corteva_yakit_gecmisi", JSON.stringify(next));
      return next;
    });
    setCortevaOldFuel(String(cortevaNewFuelNum));
    setCortevaNewFuel("");
    setError("");
    setInfo(`CORTEVA tarifeleri güncellendi. Yakıt değişimi ${formatCortevaPercent(cortevaFuelRate)}, uygulanan oran ${formatCortevaPercent(cortevaAppliedRate)}.`);
  };

  const undoLastCortevaUpdate = () => {
    const latest = cortevaHistory[0];
    if (!latest?.eski_tarifeler) {
      setInfo("Geri alınabilecek CORTEVA güncellemesi bulunamadı.");
      return;
    }
    if (!window.confirm("CORTEVA için son yakıt güncellemesi geri alınsın mı?")) return;
    const restored = latest.eski_tarifeler;
    const nextHistory = cortevaHistory.slice(1);
    setCortevaTarifeler(restored);
    setCortevaHistory(nextHistory);
    localStorage.setItem("corteva_yakit_tarifeleri", JSON.stringify(restored));
    localStorage.setItem("corteva_yakit_gecmisi", JSON.stringify(nextHistory));
    restoreFuelValuesAfterUndo("CORTEVA", latest, setCortevaOldFuel, setCortevaNewFuel);
    setInfo("CORTEVA için son işlem geri alındı. Yakıt referans değerleri de geri yüklendi.");
  };

  const getCortevaHistoryRows = (type) => {
    const rows = [];
    cortevaHistory.forEach((item) => {
      const before = item?.eski_tarifeler?.[type] || [];
      const after = item?.yeni_tarifeler?.[type] || [];
      before.forEach((oldRow, i) => {
        const newRow = after[i] || {};
        [["TIR","tir"],["KIRKAYAK","kirkayak"]].forEach(([label,key], j) => {
          if (oldRow[key] == null && newRow[key] == null) return;
          rows.push({
            id:`${item.id}-${type}-${i}-${j}`,
            created_at:item.created_at,
            bolge:oldRow.bolge,
            yuklemeYeri:oldRow.yuklemeYeri,
            indirmeYeri:oldRow.indirmeYeri,
            aracTipi:label,
            eski:Number(oldRow[key] || 0),
            yeni:Number(newRow[key] || 0),
            yakit:Number(item.yakit_degisim_orani || 0),
            uygulanan:Number(item.uygulanan_artis_orani || 0),
          });
        });
      });
    });
    return rows;
  };

  const exportCortevaExcel = () => {
    const wb = XLSX.utils.book_new();
    const addTarife = (name, title, rows) => {
      const sheet = buildModernHistorySheet({
        title,
        subtitle:"CORTEVA güncel yakıt tarifeleri",
        headers:["BÖLGE","YÜKLEME YERİ","İNDİRME YERİ","TIR","KIRKAYAK"],
        rows:rows.map(x=>[x.bolge,x.yuklemeYeri,x.indirmeYeri,x.tir,x.kirkayak]),
        widths:[20,24,34,20,20],
        moneyColumns:[3,4],
      });
      XLSX.utils.book_append_sheet(wb,sheet,name);
    };
    addTarife("Satış","CORTEVA - SATIŞ TARİFELERİ",cortevaTarifeler.satis);
    addTarife("Alış","CORTEVA - ALIŞ TARİFELERİ",cortevaTarifeler.alis);

    ["satis","alis"].forEach(type=>{
      const h=getCortevaHistoryRows(type);
      const sheet=buildModernHistorySheet({
        title:`CORTEVA - ${type==="satis"?"SATIŞ":"ALIŞ"} GEÇMİŞİ`,
        subtitle:"Yakıt eskalasyonu değişiklik geçmişi",
        headers:["Tarih","Bölge","Yükleme Yeri","İndirme Yeri","Araç Tipi","Eski Fiyat","Yeni Fiyat","Yakıt Değişimi","Uygulanan"],
        rows:h.map(x=>[
          new Date(x.created_at).toLocaleString("tr-TR"),x.bolge,x.yuklemeYeri,x.indirmeYeri,x.aracTipi,x.eski,x.yeni,x.yakit,x.uygulanan
        ]),
        widths:[22,20,22,30,16,18,18,18,18],
        moneyColumns:[5,6],
      });
      XLSX.utils.book_append_sheet(wb,sheet,type==="satis"?"Satış Geçmişi":"Alış Geçmişi");
    });
    XLSX.writeFile(wb,`CORTEVA_Yakit_Tarifeleri_${new Date().toISOString().slice(0,10)}.xlsx`);
  };

  if (isCortevaCustomer(customer)) {
    const safeCorteva = {
      satis: Array.isArray(cortevaTarifeler?.satis) && cortevaTarifeler.satis.length ? cortevaTarifeler.satis : CORTEVA_SATIS,
      alis: Array.isArray(cortevaTarifeler?.alis) && cortevaTarifeler.alis.length ? cortevaTarifeler.alis : CORTEVA_ALIS,
    };
    const q = norm(cortevaSearch);
    const cortevaRows=(safeCorteva[cortevaPriceType]||[]).filter(row=>
      !q || norm(`${row.bolge} ${row.yuklemeYeri} ${row.indirmeYeri}`).includes(q)
    );
    const cortevaHistoryRows=getCortevaHistoryRows(cortevaHistoryType);

    return (
      <div className="fuel-page fuel-full fuel-unified-customer fasdat-page corteva-page"><FuelOperationLoader /><FirstPriceArchiveButton /><CustomerUnifiedOverview />
      <FuelReferenceBanner station="Petrol Ofisi" location="Adana Merkez" note="CORTEVA tarifelerinde kullanılan yakıt referans noktası." />
        <div className="fuel-detail-topbar">
          <button type="button" className="fuel-back" onClick={goBackCustomers}><ArrowLeft size={17}/> Müşteriler</button>
          <div className="fuel-detail-path"><span>Yakıt Hesaplama</span><span>/</span><b>CORTEVA</b></div>
        </div>

        <div className="fuel-customer-head corteva-head">
          <div className="fuel-customer-identity">
            <div className="fuel-logo corteva-logo"><Building2 size={25}/></div>
            <div><span>FİNANS / CORTEVA YAKIT ESKALASYONU</span><h1>CORTEVA</h1><p>Yakıt değişimi %5'i geçerse değişimin %40'ı TIR ve KIRKAYAK tarifelerine uygulanır.</p></div>
          </div>
          <div className="eti-head-actions">
            <button className="eti-action-btn" onClick={()=>setCortevaHistoryOpen(true)}><History size={15}/> Geçmiş</button>
            <button className="eti-action-btn" onClick={undoLastCortevaUpdate} disabled={!cortevaHistory.length}><Undo2 size={15}/> Geri Al</button>
            <button className="eti-action-btn primary" onClick={exportCortevaPriceMemoryExcel}><Download size={15}/> Excel'e Aktar</button>
            <button className="eti-action-btn" onClick={goBackCustomers}><Users size={15}/> Müşteriler</button>
            <button className="eti-action-btn primary" onClick={()=>runFuelOperation("CORTEVA tarifeleri güncelleniyor",applyCortevaUpdate)} disabled={!cortevaThresholdPassed || busy} title={!cortevaThresholdPassed ? "CORTEVA kuralı sağlanmadı." : "Tarifeleri güncelle"}><RefreshCw size={15}/> Güncelle</button>
          </div>
        </div>

        <section className="eti-calc-card corteva-calc-card">
          <div className="eti-calc-rule">
            <div className="eti-rule-icon"><Calculator size={20}/></div>
            <div><span>CORTEVA ESKALASYON KURALI</span><h2>%5'i geçerse değişimin %40'ı yansır</h2><p>Tam %5 değişim tetiklemez. %5'in üzerindeki artış veya düşüşte TIR ve KIRKAYAK birlikte güncellenir.</p></div>
          </div>
          <div className="eti-calc-fields">
            <label><span>ESKİ YAKIT FİYATI</span><div className="eti-input-box"><input value={cortevaOldFuel} onChange={e=>setCortevaOldFuel(e.target.value)} placeholder="0,00"/><small>₺</small></div></label>
            <div className="eti-calc-arrow"><ArrowRight size={17}/></div>
            <label><span>YENİ YAKIT FİYATI</span><div className="eti-input-box"><input value={cortevaNewFuel} onChange={e=>setCortevaNewFuel(e.target.value)} placeholder="0,00"/><small>₺</small></div></label>
          </div>
          <div className={`eti-change-box ${cortevaFuelRate==null?"neutral":cortevaFuelRate>0?"increase":"decrease"}`}>
            <span>YAKIT DEĞİŞİMİ</span><b>{cortevaFuelRate==null?"—":formatCortevaPercent(cortevaFuelRate)}</b>
            <small>{cortevaFuelRate==null?"Fiyatları girin":cortevaThresholdPassed?`Tarifeye ${formatCortevaPercent(cortevaAppliedRate)} uygulanacak`:"%5 eşiğini geçmedi — tarifeye yansımaz"}</small>
          </div>
          <button
            className={`eti-update-btn ${!cortevaThresholdPassed ? "rule-disabled" : ""}`}
            onClick={()=>runFuelOperation("CORTEVA tarifeleri güncelleniyor",applyCortevaUpdate)}
            disabled={!cortevaThresholdPassed}
            title={!cortevaThresholdPassed ? "CORTEVA kuralı sağlanmadı: yakıt değişimi %5'i geçmelidir." : ""}
          >
            <RefreshCw size={16}/>
            {cortevaThresholdPassed ? "Tarifeleri Güncelle" : "Kural Sağlanmadı"}
          </button>
        </section>

        <section className="eti-tariff-workspace corteva-workspace">
          <div className="eti-workspace-top">
            <div><span>CORTEVA TARİFE MERKEZİ</span><h2>Güncel Tarifeler</h2><p>Bölge, yükleme yeri ve indirme yerine göre TIR / KIRKAYAK fiyatları.</p></div>
            <label className="eti-search eti-global-search"><Search size={15}/><input value={cortevaSearch} onChange={e=>setCortevaSearch(e.target.value)} placeholder="Bölge, yükleme veya indirme ara..."/>{cortevaSearch&&<button type="button" onClick={()=>setCortevaSearch("")}>×</button>}</label>
          </div>
          <div className="cmc-type-tabs corteva-type-tabs">
            <button className={cortevaPriceType==="satis"?"active satis":""} onClick={()=>setCortevaPriceType("satis")}><TrendingUp size={16}/><span><b>SATIŞ TARİFELERİ</b><small>{safeCorteva.satis.length} rota</small></span></button>
            <button className={cortevaPriceType==="alis"?"active alis":""} onClick={()=>setCortevaPriceType("alis")}><TrendingDown size={16}/><span><b>ALIŞ TARİFELERİ</b><small>{safeCorteva.alis.length} rota</small></span></button>
          </div>
          <div className="fuel-table-wrap corteva-table-wrap">
            <table className="fuel-table corteva-table">
              <thead><tr><th>BÖLGE</th><th>YÜKLEME YERİ</th><th>İNDİRME YERİ</th><th>TIR</th><th>KIRKAYAK</th></tr></thead>
              <tbody>{cortevaRows.map((row,i)=><tr key={`${cortevaPriceType}-${i}`}><td><b>{row.bolge}</b></td><td>{row.yuklemeYeri}</td><td>{row.indirmeYeri}</td><td className="corteva-money">{row.tir!=null?tariffMoney(row.tir):"—"}</td><td className="corteva-money">{row.kirkayak!=null?tariffMoney(row.kirkayak):"—"}</td></tr>)}</tbody>
            </table>
          </div>
        </section>

        {cortevaHistoryOpen && createPortal(
          <div className="fuel-modal-backdrop eti-history-backdrop">
            <div className="fuel-modal history-modal eti-history-modal corteva-history-modal">
              <div className="fasdat-history-hero">
                <div className="fasdat-history-icon"><History size={21}/></div>
                <div className="fasdat-history-copy"><span>CORTEVA / TARİFE GEÇMİŞİ</span><h2>Yakıt Güncelleme Geçmişi</h2><p>TIR ve KIRKAYAK fiyatlarındaki eski / yeni değerleri görüntüleyin.</p></div>
                <div className="fasdat-history-actions"><button className="fuel-excel-button" onClick={exportCortevaPriceMemoryExcel}><Download size={15}/> Excel'e Aktar</button><button className="fasdat-history-close" onClick={()=>setCortevaHistoryOpen(false)}>×</button></div>
              </div>
              <div className="cmc-history-tabs">
                <button className={cortevaHistoryType==="satis"?"active":""} onClick={()=>setCortevaHistoryType("satis")}><TrendingUp size={14}/> Satış <b>{getCortevaHistoryRows("satis").length}</b></button>
                <button className={cortevaHistoryType==="alis"?"active":""} onClick={()=>setCortevaHistoryType("alis")}><TrendingDown size={14}/> Alış <b>{getCortevaHistoryRows("alis").length}</b></button>
              </div>
              <div className="cmc-history-content">
                {cortevaHistoryRows.length?<div className="fuel-table-wrap corteva-history-table-wrap"><table className="fuel-table corteva-history-table">
                  <thead><tr><th>TARİH</th><th>BÖLGE</th><th>YÜKLEME</th><th>İNDİRME</th><th>ARAÇ</th><th>ESKİ</th><th>YENİ</th><th>YAKIT</th><th>UYGULANAN</th></tr></thead>
                  <tbody>{cortevaHistoryRows.map(row=><tr key={row.id}><td>{new Date(row.created_at).toLocaleString("tr-TR")}</td><td><b>{row.bolge}</b></td><td>{row.yuklemeYeri}</td><td>{row.indirmeYeri}</td><td><span className="cmc-column-badge">{row.aracTipi}</span></td><td>{tariffMoney(row.eski)}</td><td><b>{tariffMoney(row.yeni)}</b></td><td>{formatCortevaPercent(row.yakit)}</td><td><span className="eti-history-rate">{formatCortevaPercent(row.uygulanan)}</span></td></tr>)}</tbody>
                </table></div>:<div className="eti-history-empty"><History size={28}/><h3>Henüz geçmiş kaydı yok</h3><p>CORTEVA tarifelerini güncellediğinizde değişiklikler burada görünecek.</p></div>}
              </div>
            </div>
          </div>,document.body
        )}
      </div>
    );
  }

  /* =======================================================
     CMC AGRO - YAKIT ESKALASYONU
  ======================================================= */
  const cmcNumber = (value) => {
    if (typeof value === "number") return value;
    let raw = String(value ?? "").trim().replace(/₺|TL/gi, "");
    if (!raw) return 0;
    if (raw.includes(",")) raw = raw.replace(/\./g, "").replace(",", ".");
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : 0;
  };
  const formatCmcPercent = (value) =>
    value == null || !Number.isFinite(Number(value))
      ? "—"
      : `%${(Number(value) * 100).toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const cmcOldFuelNum = cmcNumber(cmcOldFuel);
  const cmcNewFuelNum = cmcNumber(cmcNewFuel);
  const cmcFuelRate =
    cmcOldFuelNum > 0 && cmcNewFuelNum > 0
      ? (cmcNewFuelNum - cmcOldFuelNum) / cmcOldFuelNum
      : null;
  const cmcThresholdPassed =
    cmcFuelRate != null && Math.abs(cmcFuelRate) >= 0.05;
  const cmcAppliedRate =
    cmcThresholdPassed ? cmcFuelRate * 0.50 : 0;

  const cmcApplyValue = (value, rate) => {
    const numeric = Number(value || 0);
    return Math.round(numeric * (1 + Number(rate || 0)));
  };

  const cmcApplyRows = (rows, rate) =>
    (rows || []).map((row) => ({
      ...row,
      tlTon: cmcApplyValue(row.tlTon, rate),
      tir: cmcApplyValue(row.tir, rate),
      kirkayak: cmcApplyValue(row.kirkayak, rate),
      acikDorse: cmcApplyValue(row.acikDorse, rate),
    }));

  const applyCmcUpdate = () => {
    if (!(cmcOldFuelNum > 0) || !(cmcNewFuelNum > 0)) {
      setError("CMC AGRO için eski ve yeni yakıt fiyatını girin.");
      return;
    }
    if (cmcFuelRate === 0) {
      setError("Eski ve yeni yakıt fiyatı aynı. Güncellenecek oran bulunamadı.");
      return;
    }
    if (!cmcThresholdPassed) {
      setError("CMC AGRO'da yakıt değişimi en az %5 olmalıdır. %5 ve üzerindeki değişimin %50'si tarifeye yansıtılır.");
      return;
    }

    const before = JSON.parse(JSON.stringify(cmcTarifeler));
    const after = {
      satis: cmcApplyRows(before.satis, cmcAppliedRate),
      alis: cmcApplyRows(before.alis, cmcAppliedRate),
    };

    const historyItem = {
      id: `cmc-${Date.now()}`,
      created_at: new Date().toISOString(),
      eski_yakit_fiyati: cmcOldFuelNum,
      yeni_yakit_fiyati: cmcNewFuelNum,
      yakit_degisim_orani: cmcFuelRate,
      uygulanan_artis_orani: cmcAppliedRate,
      eski_tarifeler: before,
      yeni_tarifeler: after,
    };

    setCmcTarifeler(after);
    setCmcHistory((prev) => {
      const next = [historyItem, ...prev];
      localStorage.setItem("cmc_agro_yakit_gecmisi", JSON.stringify(next));
      return next;
    });
    localStorage.setItem("cmc_agro_yakit_tarifeleri", JSON.stringify(after));
    setCmcOldFuel(String(cmcNewFuelNum));
    setCmcNewFuel("");
    setError("");
    setInfo(`CMC AGRO tarifeleri güncellendi. Yakıt değişimi ${formatCmcPercent(cmcFuelRate)}, tarifeye uygulanan oran ${formatCmcPercent(cmcAppliedRate)}.`);
  };

  const undoLastCmcUpdate = () => {
    const latest = cmcHistory[0];
    if (!latest?.eski_tarifeler) {
      setInfo("Geri alınabilecek CMC AGRO güncellemesi bulunamadı.");
      return;
    }
    if (!window.confirm("CMC AGRO için son yakıt güncellemesi geri alınsın mı?")) return;
    const restored = latest.eski_tarifeler;
    const nextHistory = cmcHistory.slice(1);
    setCmcTarifeler(restored);
    setCmcHistory(nextHistory);
    localStorage.setItem("cmc_agro_yakit_tarifeleri", JSON.stringify(restored));
    localStorage.setItem("cmc_agro_yakit_gecmisi", JSON.stringify(nextHistory));
    restoreFuelValuesAfterUndo("CMC AGRO", latest, setCmcOldFuel, setCmcNewFuel);
    setInfo("CMC AGRO için son işlem geri alındı. Yakıt referans değerleri de geri yüklendi.");
  };

  const getCmcHistoryRows = (type) => {
    const result = [];
    cmcHistory.forEach((item) => {
      const before = item?.eski_tarifeler?.[type] || [];
      const after = item?.yeni_tarifeler?.[type] || [];
      before.forEach((oldRow, rowIndex) => {
        const newRow = after[rowIndex] || {};
        [
          ["TL/TON", "tlTon"],
          ["TIR", "tir"],
          ["KIRKAYAK", "kirkayak"],
          ["13.60 AÇIK DORSE", "acikDorse"],
        ].forEach(([label, key], colIndex) => {
          result.push({
            id: `${item.id}-${type}-${rowIndex}-${colIndex}`,
            created_at: item.created_at,
            location: `${oldRow.il || "-"} / ${oldRow.ilce || "-"}`,
            kolon: label,
            eski: Number(oldRow[key] || 0),
            yeni: Number(newRow[key] || 0),
            yakit: Number(item.yakit_degisim_orani || 0),
            uygulanan: Number(item.uygulanan_artis_orani || 0),
          });
        });
      });
    });
    return result;
  };

  const exportCmcExcel = () => {
    const wb = XLSX.utils.book_new();
    const addTarife = (name, title, rows) => {
      const sheet = buildModernHistorySheet({
        title,
        subtitle: "CMC AGRO güncel yakıt tarifeleri",
        headers: ["İL", "İLÇE", "TL/TON", "TIR", "KIRKAYAK", "13.60 AÇIK DORSE"],
        rows: rows.map((x) => [x.il, x.ilce, x.tlTon, x.tir, x.kirkayak, x.acikDorse]),
        widths: [20, 28, 18, 18, 18, 24],
        moneyColumns: [2, 3, 4, 5],
      });
      XLSX.utils.book_append_sheet(wb, sheet, name);
    };
    addTarife("Satış", "CMC AGRO - SATIŞ TARİFELERİ", cmcTarifeler.satis);
    addTarife("Alış", "CMC AGRO - ALIŞ TARİFELERİ", cmcTarifeler.alis);

    ["satis", "alis"].forEach((type) => {
      const h = getCmcHistoryRows(type);
      const sheet = buildModernHistorySheet({
        title: `CMC AGRO - ${type === "satis" ? "SATIŞ" : "ALIŞ"} GEÇMİŞİ`,
        subtitle: "Yakıt eskalasyonu değişiklik geçmişi",
        headers: ["Tarih", "İl / İlçe", "Kolon", "Eski Fiyat", "Yeni Fiyat", "Yakıt Değişimi", "Uygulanan"],
        rows: h.map((x) => [
          new Date(x.created_at).toLocaleString("tr-TR"),
          x.location,
          x.kolon,
          x.eski,
          x.yeni,
          x.yakit,
          x.uygulanan,
        ]),
        widths: [22, 32, 24, 18, 18, 18, 18],
        moneyColumns: [3, 4],
      });
      XLSX.utils.book_append_sheet(wb, sheet, type === "satis" ? "Satış Geçmişi" : "Alış Geçmişi");
    });

    XLSX.writeFile(wb, `CMC_AGRO_Yakit_Tarifeleri_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  if (isCmcAgroCustomer(customer)) {
    const safeCmcTarifeler = {
      satis:
        Array.isArray(cmcTarifeler?.satis) && cmcTarifeler.satis.length > 0
          ? cmcTarifeler.satis
          : CMC_AGRO_SATIS,
      alis:
        Array.isArray(cmcTarifeler?.alis) && cmcTarifeler.alis.length > 0
          ? cmcTarifeler.alis
          : CMC_AGRO_ALIS,
    };
    const cmcRows = (safeCmcTarifeler[cmcPriceType] || []).filter((row) => {
      const q = norm(cmcSearch);
      return !q || norm(`${row.il} ${row.ilce}`).includes(q);
    });
    const cmcHistoryRows = getCmcHistoryRows(cmcHistoryType);

    return (
      <div className="fuel-page fuel-full fuel-unified-customer fasdat-page cmc-page"><FuelOperationLoader /><FirstPriceArchiveButton /><CustomerUnifiedOverview />
      <FuelReferenceBanner station="Petrol Ofisi" location="Bursa Karacabey" note="CMC Agro tarifelerinde kullanılan yakıt referans noktası." />
        <div className="fuel-detail-topbar">
          <button type="button" className="fuel-back" onClick={goBackCustomers}><ArrowLeft size={17}/> Müşteriler</button>
          <div className="fuel-detail-path"><span>Yakıt Hesaplama</span><span>/</span><b>CMC AGRO</b></div>
        </div>

        <div className="fuel-customer-head cmc-head">
          <div className="fuel-customer-identity">
            <div className="fuel-logo cmc-logo"><Building2 size={25}/></div>
            <div>
              <span>FİNANS / CMC AGRO YAKIT ESKALASYONU</span>
              <h1>CMC AGRO</h1>
              <p>Yakıt değişimi %5 ve üzerindeyse değişimin %50'si · TL/TON, TIR, KIRKAYAK ve 13.60 AÇIK DORSE kolonlarının tamamına uygulanır.</p>
            </div>
          </div>
          <div className="eti-head-actions">
            <button className="eti-action-btn" onClick={() => setCmcHistoryOpen(true)}><History size={15}/> Geçmiş</button>
            <button className="eti-action-btn" onClick={undoLastCmcUpdate} disabled={!cmcHistory.length}><Undo2 size={15}/> Geri Al</button>
            <button className="eti-action-btn primary" onClick={exportCmcPriceMemoryExcel}><Download size={15}/> Excel'e Aktar</button>
            <button className="eti-action-btn" onClick={goBackCustomers}><Users size={15}/> Müşteriler</button>
            <button className="eti-action-btn primary" onClick={()=>runFuelOperation("CMC AGRO tarifeleri güncelleniyor",applyCmcUpdate)} disabled={!cmcThresholdPassed || busy} title={!cmcThresholdPassed ? "CMC AGRO kuralı sağlanmadı." : "Tarifeleri güncelle"}><RefreshCw size={15}/> Güncelle</button>
          </div>
        </div>

        <section className="eti-calc-card cmc-calc-card">
          <div className="eti-calc-rule">
            <div className="eti-rule-icon"><Calculator size={20}/></div>
            <div><span>CMC AGRO ESKALASYON KURALI</span><h2>Yakıt değişimi %5 ve üzerindeyse %50'si tarifeye yansır</h2><p>%5 ve üzerindeki artış veya düşüşte değişimin %50'si dört fiyat kolonunun tamamına uygulanır.</p></div>
          </div>
          <div className="eti-calc-fields">
            <label><span>ESKİ YAKIT FİYATI</span><div className="eti-input-box"><input value={cmcOldFuel} onChange={(e)=>setCmcOldFuel(e.target.value)} placeholder="0,00"/><small>₺</small></div></label>
            <div className="eti-calc-arrow"><ArrowRight size={17}/></div>
            <label><span>YENİ YAKIT FİYATI</span><div className="eti-input-box"><input value={cmcNewFuel} onChange={(e)=>setCmcNewFuel(e.target.value)} placeholder="0,00"/><small>₺</small></div></label>
          </div>
          <div className={`eti-change-box ${cmcFuelRate == null ? "neutral" : cmcFuelRate > 0 ? "increase" : "decrease"}`}>
            <span>YAKIT DEĞİŞİMİ</span><b>{cmcFuelRate == null ? "—" : formatCmcPercent(cmcFuelRate)}</b>
            <small>{cmcFuelRate == null
              ? "Fiyatları girin"
              : cmcThresholdPassed
                ? `Tarifeye ${formatCmcPercent(cmcAppliedRate)} uygulanacak`
                : "%5 eşiğinin altında — tarifeye yansımaz"}</small>
          </div>
          <button
            className={`eti-update-btn ${!cmcThresholdPassed ? "rule-disabled" : ""}`}
            onClick={()=>runFuelOperation("CMC AGRO tarifeleri güncelleniyor", applyCmcUpdate)}
            disabled={!cmcThresholdPassed}
            title={!cmcThresholdPassed ? "CMC AGRO kuralı sağlanmadı: yakıt değişimi en az %5 olmalıdır." : ""}
          >
            <RefreshCw size={16}/>
            {cmcThresholdPassed ? "Tarifeleri Güncelle" : "Kural Sağlanmadı"}
          </button>
        </section>

        <section className="eti-tariff-workspace cmc-workspace">
          <div className="eti-workspace-top">
            <div><span>CMC AGRO TARİFE MERKEZİ</span><h2>Güncel Tarifeler</h2><p>Alış ve satış fiyatları ayrı görüntülenir; dört fiyat kolonu birlikte güncellenir.</p></div>
            <label className="eti-search eti-global-search"><Search size={15}/><input value={cmcSearch} onChange={(e)=>setCmcSearch(e.target.value)} placeholder="İl veya ilçede ara..."/>{cmcSearch&&<button type="button" onClick={()=>setCmcSearch("")}>×</button>}</label>
          </div>

          <div className="cmc-type-tabs">
            <button className={cmcPriceType==="satis"?"active satis":""} onClick={()=>setCmcPriceType("satis")}><TrendingUp size={16}/><span><b>SATIŞ TARİFELERİ</b><small>{safeCmcTarifeler.satis.length} rota</small></span></button>
            <button className={cmcPriceType==="alis"?"active alis":""} onClick={()=>setCmcPriceType("alis")}><TrendingDown size={16}/><span><b>ALIŞ TARİFELERİ</b><small>{safeCmcTarifeler.alis.length} rota</small></span></button>
          </div>

          <div className="fuel-table-wrap cmc-table-wrap">
            <table className="fuel-table cmc-table">
              <thead><tr><th>İL</th><th>İLÇE</th><th>TL/TON</th><th>TIR</th><th>KIRKAYAK</th><th>13.60 AÇIK DORSE</th></tr></thead>
              <tbody>{cmcRows.map((row,i)=><tr key={`${cmcPriceType}-${i}`}><td><b>{row.il}</b></td><td>{row.ilce}</td><td className="cmc-money">{tariffMoney(row.tlTon)}</td><td className="cmc-money">{tariffMoney(row.tir)}</td><td className="cmc-money">{tariffMoney(row.kirkayak)}</td><td className="cmc-money">{tariffMoney(row.acikDorse)}</td></tr>)}</tbody>
            </table>
          </div>
        </section>

        {cmcHistoryOpen && createPortal(
          <div className="fuel-modal-backdrop eti-history-backdrop">
            <div className="fuel-modal history-modal eti-history-modal cmc-history-modal">
              <div className="fasdat-history-hero">
                <div className="fasdat-history-icon"><History size={21}/></div>
                <div className="fasdat-history-copy"><span>CMC AGRO / TARİFE GEÇMİŞİ</span><h2>Yakıt Güncelleme Geçmişi</h2><p>Dört fiyat kolonundaki eski ve yeni değerleri inceleyin.</p></div>
                <div className="fasdat-history-actions"><button className="fuel-excel-button" onClick={exportCmcPriceMemoryExcel}><Download size={15}/> Excel'e Aktar</button><button className="fasdat-history-close" onClick={()=>setCmcHistoryOpen(false)}>×</button></div>
              </div>
              <div className="cmc-history-tabs">
                <button className={cmcHistoryType==="satis"?"active":""} onClick={()=>setCmcHistoryType("satis")}><TrendingUp size={14}/> Satış <b>{getCmcHistoryRows("satis").length}</b></button>
                <button className={cmcHistoryType==="alis"?"active":""} onClick={()=>setCmcHistoryType("alis")}><TrendingDown size={14}/> Alış <b>{getCmcHistoryRows("alis").length}</b></button>
              </div>
              <div className="cmc-history-content">
                {cmcHistoryRows.length ? <div className="fuel-table-wrap cmc-history-table-wrap"><table className="fuel-table cmc-history-table">
                  <thead><tr><th>TARİH</th><th>İL / İLÇE</th><th>DEĞİŞEN KOLON</th><th>ESKİ FİYAT</th><th>YENİ FİYAT</th><th>YAKIT</th><th>UYGULANAN</th></tr></thead>
                  <tbody>{cmcHistoryRows.map((row)=><tr key={row.id}><td>{new Date(row.created_at).toLocaleString("tr-TR")}</td><td><b>{row.location}</b></td><td><span className="cmc-column-badge">{row.kolon}</span></td><td>{tariffMoney(row.eski)}</td><td><b>{tariffMoney(row.yeni)}</b></td><td>{formatCmcPercent(row.yakit)}</td><td><span className="eti-history-rate">{formatCmcPercent(row.uygulanan)}</span></td></tr>)}</tbody>
                </table></div> : <div className="eti-history-empty"><History size={28}/><h3>Henüz geçmiş kaydı yok</h3><p>Tarifeleri güncellediğinizde TL/TON, TIR, KIRKAYAK ve 13.60 AÇIK DORSE değişiklikleri burada görünecek.</p></div>}
              </div>
            </div>
          </div>,
          document.body
        )}
      </div>
    );
  }

  /* =======================================================
     ETİ TARİFE EKRANI - ALIŞ / SATIŞ AYRI
  ======================================================= */
  if(isEtiCustomer(customer)){
    const groups=[
      {key:"seker",no:"01",label:"Şeker",sub:"Alım yeri / rota bazında tarife"},
      {key:"ciftci",no:"02",label:"Çiftçi Listesi",sub:"İl, ilçe ve mahalle bazında tarife"},
      {key:"yulaf",no:"03",label:"Yulaf Tedarikçi",sub:"Yulaf tedarikçi tarifeleri"},
      {key:"bugday",no:"04",label:"Buğday Tedarikçi",sub:"Buğday tedarikçi tarifeleri"},
      {key:"ek",no:"05",label:"Ek Rotalar",sub:"Ek rota eskalasyon tarifeleri"},
    ];
    const active=groups.find(x=>x.key===etiActiveTab)||groups[0];
    const historyGroup=groups.find(x=>x.key===etiHistoryTab)||groups[0];
    const historyHasAlis=(etiTarifeler[historyGroup.key]?.alis||[]).length>0;
    const historyCurrentType=historyHasAlis?etiHistoryType:"satis";
    const historyRows=getEtiHistoryRows(historyGroup.key,historyCurrentType);
    const hasAlis=(etiTarifeler[active.key]?.alis||[]).length>0;
    const currentType=hasAlis?etiPriceType:"satis";
    const rawRows=etiTarifeler[active.key]?.[currentType]||[];
    const q=norm(etiSearch);
    const rows=rawRows.filter(row=>!q||norm([row.rota,row.il,row.ilce,row.mahalle].filter(Boolean).join(" ")).includes(q));

    const renderTable=()=>(
      <div className="fuel-table-wrap eti-active-table-wrap">
        <table className="fuel-table eti-table"><thead><tr>
          {active.key==="seker"?<><th>ALIM YERİ / ROTA</th><th>TL / TON</th></>:
           active.key==="ek"?<><th>İL</th><th>İLÇE</th><th>TL / TON</th></>:
           <><th>İL</th><th>İLÇE</th><th>MAHALLE</th><th>TL / TON</th></>}
        </tr></thead><tbody>
          {rows.map((row,i)=><tr key={`${active.key}-${currentType}-${i}`}>
            {active.key==="seker"?<><td><b>{row.rota}</b></td><td className="eti-price-cell">{tariffMoney(row.fiyat)}</td></>:
             active.key==="ek"?<><td><b>{row.il}</b></td><td>{row.ilce||"—"}</td><td className="eti-price-cell">{tariffMoney(row.fiyat)}</td></>:
             <><td><b>{row.il}</b></td><td>{row.ilce||"—"}</td><td>{row.mahalle||"—"}</td><td className="eti-price-cell">{tariffMoney(row.fiyat)}</td></>}
          </tr>)}
        </tbody></table>{!rows.length&&<div className="eti-inline-empty">Kayıt bulunamadı.</div>}
      </div>
    );

    return <div className="fuel-page fuel-full fuel-unified-customer fasdat-page eti-page"><FuelOperationLoader /><FirstPriceArchiveButton /><CustomerUnifiedOverview />
      <FuelReferenceBanner station="Petrol Ofisi" location="Eskişehir Odunpazarı" note="ETİ Gıda tarifelerinde kullanılan yakıt referans noktası." />
      <div className="fuel-detail-topbar"><button type="button" className="fuel-back" onClick={goBackCustomers}><ArrowLeft size={17}/> Müşteriler</button><div className="fuel-detail-path"><span>Yakıt Hesaplama</span><span>/</span><b>ETİ</b></div></div>
      <div className="fuel-customer-head eti-modern-head">
        <div className="fuel-customer-identity"><div className="fuel-logo eti-logo"><Building2 size={25}/></div><div><span>FİNANS / ETİ YAKIT ESKALASYONU</span><h1>ETİ</h1><p>Alış ve satış tarifeleri ayrı yönetilir · %10 eşik · değişimin %50'si uygulanır.</p></div></div>
        <div className="eti-head-actions"><button className="eti-action-btn" onClick={()=>setEtiHistoryOpen(true)}><History size={15}/> Geçmiş</button><button className="eti-action-btn" onClick={undoLastEtiUpdate} disabled={!etiHistory.length}><Undo2 size={15}/> Geri Al</button><button className="eti-action-btn primary" onClick={exportEtiPriceMemoryExcel}><Download size={15}/> Excel'e Aktar</button><button className="eti-action-btn" onClick={goBackCustomers}><Users size={15}/> Müşteriler</button><button className="eti-action-btn primary" onClick={()=>runFuelOperation("ETİ tarifeleri güncelleniyor",applyEtiUpdate)} disabled={!etiThresholdPassed || busy} title={!etiThresholdPassed ? "ETİ kuralı sağlanmadı." : "Tarifeleri güncelle"}><RefreshCw size={15}/> Güncelle</button></div>
      </div>

      <section className="eti-calc-card">
        <div className="eti-calc-rule"><div className="eti-rule-icon"><Calculator size={20}/></div><div><span>ETİ ESKALASYON KURALI</span><h2>%10'u aşarsa değişimin %50'si</h2><p>Güncelleme Alış ve Satış fiyatlarına birlikte uygulanır.</p></div></div>
        <div className="eti-calc-fields"><label><span>ESKİ YAKIT FİYATI</span><div className="eti-input-box"><input value={etiOldFuel} onChange={e=>setEtiOldFuel(e.target.value)} placeholder="0,00"/><small>₺</small></div></label><div className="eti-calc-arrow"><ArrowRight size={17}/></div><label><span>YENİ YAKIT FİYATI</span><div className="eti-input-box"><input value={etiNewFuel} onChange={e=>setEtiNewFuel(e.target.value)} placeholder="0,00"/><small>₺</small></div></label></div>
        <div className={`eti-change-box ${etiFuelRate==null?"neutral":etiFuelRate>0?"increase":"decrease"}`}><span>YAKIT DEĞİŞİMİ</span><b>{etiFuelRate==null?"—":formatEtiPercent(etiFuelRate)}</b><small>{etiFuelRate==null?"Fiyatları girin":etiThresholdPassed?`Uygulanacak: ${formatEtiPercent(etiAppliedRate)}`:"%10 eşiği aşılmadı"}</small></div>
        <button
          className={`eti-update-btn ${!etiThresholdPassed ? "rule-disabled" : ""}`}
          onClick={()=>runFuelOperation("ETİ tarifeleri güncelleniyor", applyEtiUpdate)}
          disabled={!etiThresholdPassed}
          title={!etiThresholdPassed ? "ETİ kuralı sağlanmadı: yakıt değişimi %10'u geçmelidir." : ""}
        >
          <RefreshCw size={16}/>
          {etiThresholdPassed ? "Tarifeleri Güncelle" : "Kural Sağlanmadı"}
        </button>
      </section>

      <section className="eti-tariff-workspace">
        <div className="eti-workspace-top"><div><span>ETİ TARİFE MERKEZİ</span><h2>Tarife Listeleri</h2><p>Önce tarife grubunu, sonra Alış / Satış görünümünü seçin.</p></div><label className="eti-search eti-global-search"><Search size={15}/><input value={etiSearch} onChange={e=>setEtiSearch(e.target.value)} placeholder="Aktif listede ara..."/>{etiSearch&&<button type="button" onClick={()=>setEtiSearch("")}>×</button>}</label></div>
        <div className="eti-modern-tabs">{groups.map(g=><button key={g.key} className={etiActiveTab===g.key?"active":""} onClick={()=>{setEtiActiveTab(g.key);setEtiPriceType("satis");setEtiSearch("");}}><div className="eti-tab-number">{g.no}</div><div className="eti-tab-copy"><span>{g.label}</span><small>{(etiTarifeler[g.key]?.satis||[]).length+(etiTarifeler[g.key]?.alis||[]).length} kayıt</small></div></button>)}</div>

        <div className="eti-active-section">
          <div className="eti-active-section-head">
            <div><span>ETİ / {active.label.toUpperCase()}</span><h2>{active.label}</h2><p>{active.sub}</p></div>
            <div className="eti-active-count">{rows.length} KAYIT</div>
          </div>
          <div className="eti-buy-sell-bar">
            <button className={currentType==="satis"?"active satis":""} onClick={()=>setEtiPriceType("satis")}><TrendingUp size={15}/><span>SATIŞ</span><b>{etiTarifeler[active.key]?.satis?.length||0}</b></button>
            <button className={currentType==="alis"?"active alis":""} onClick={()=>setEtiPriceType("alis")} disabled={!hasAlis}><TrendingDown size={15}/><span>ALIŞ</span><b>{etiTarifeler[active.key]?.alis?.length||0}</b></button>
          </div>
          {renderTable()}
          {active.key==="seker"&&<div className="eti-section-note"><AlertTriangle size={14}/> Şeker sayfasında kaynak Excel'e göre yalnızca satış listesi bulunuyor; tedarikçi/alış fiyat listesi istenmiyor.</div>}
        </div>
      </section>

      {etiHistoryOpen && createPortal(
        <div className="fuel-modal-backdrop eti-history-backdrop">
          <div className="fuel-modal history-modal eti-history-modal eti-history-v8">
            <div className="fasdat-history-hero">
              <div className="fasdat-history-icon"><History size={21}/></div>
              <div className="fasdat-history-copy">
                <span>ETİ / TARİFE GEÇMİŞİ</span>
                <h2>Yakıt Güncelleme Geçmişi</h2>
                <p>Tarife grubunu ve Alış / Satış görünümünü seçerek değişen kayıtları inceleyin.</p>
              </div>
              <div className="fasdat-history-actions">
                <button className="fuel-excel-button" onClick={exportEtiPriceMemoryExcel}><Download size={15}/> Excel'e Aktar</button>
                <button className="fasdat-history-close" onClick={()=>setEtiHistoryOpen(false)}>×</button>
              </div>
            </div>

            <div className="eti-history-tabs">
              {groups.map(g=>{
                const satisCount=getEtiHistoryRows(g.key,"satis").length;
                const alisCount=getEtiHistoryRows(g.key,"alis").length;
                return <button
                  type="button"
                  key={`history-tab-${g.key}`}
                  className={etiHistoryTab===g.key?"active":""}
                  onClick={()=>{setEtiHistoryTab(g.key);setEtiHistoryType("satis");}}
                >
                  <span className="eti-history-tab-no">{g.no}</span>
                  <span className="eti-history-tab-text"><b>{g.label}</b><small>{satisCount+alisCount} değişiklik</small></span>
                </button>
              })}
            </div>

            <div className="eti-history-toolbar">
              <div>
                <span>SEÇİLİ LİSTE</span>
                <h3>{historyGroup.label}</h3>
              </div>
              <div className="eti-history-type-switch">
                <button
                  type="button"
                  className={historyCurrentType==="satis"?"active satis":""}
                  onClick={()=>setEtiHistoryType("satis")}
                >
                  <TrendingUp size={14}/> Satış
                  <b>{getEtiHistoryRows(historyGroup.key,"satis").length}</b>
                </button>
                <button
                  type="button"
                  disabled={!historyHasAlis}
                  className={historyCurrentType==="alis"?"active alis":""}
                  onClick={()=>setEtiHistoryType("alis")}
                >
                  <TrendingDown size={14}/> Alış
                  <b>{getEtiHistoryRows(historyGroup.key,"alis").length}</b>
                </button>
              </div>
              <div className="eti-history-result-count">{historyRows.length} DEĞİŞİKLİK</div>
            </div>

            <div className="eti-history-content">
              {historyRows.length ? (
                <div className="fuel-table-wrap eti-history-main-table-wrap">
                  <table className="fuel-table eti-history-main-table">
                    <thead><tr>
                      <th>TARİH / SAAT</th>
                      <th>ROTA / LOKASYON</th>
                      <th>ESKİ FİYAT</th>
                      <th>YENİ FİYAT</th>
                      <th>FARK</th>
                      <th>YAKIT DEĞİŞİMİ</th>
                      <th>UYGULANAN</th>
                    </tr></thead>
                    <tbody>
                      {historyRows.map(row=>{
                        const fark=Number(row.yeni||0)-Number(row.eski||0);
                        return <tr key={row.id}>
                          <td>{new Date(row.created_at).toLocaleString("tr-TR")}</td>
                          <td><b>{row.location}</b></td>
                          <td>{tariffMoney(row.eski)}</td>
                          <td className="eti-history-new-price"><b>{tariffMoney(row.yeni)}</b></td>
                          <td className={fark>0?"eti-positive":fark<0?"eti-negative":""}>{fark>0?"+":""}{money(fark)}</td>
                          <td>{formatEtiPercent(row.yakit)}</td>
                          <td><span className="eti-history-rate">{formatEtiPercent(row.uygulanan)}</span></td>
                        </tr>
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="eti-history-empty">
                  <History size={28}/>
                  <h3>Bu bölümde henüz geçmiş kaydı yok</h3>
                  <p>Bu tarife grubu için yeni bir yakıt güncellemesi yaptığınızda eski ve yeni fiyatlar burada listelenecek.</p>
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>;
  }

  /* =======================================================
     KWS ÖZEL FORMAT
  ======================================================= */

  if (isKws) {
    const renderKwsPrice = (value) =>
      tariffMoney(applyRate(value, kwsApplied));

    const renderTirTable = (title, data, type) => (
      <section className={`fuel-price-panel kws-panel ${type}`}>
        <div className="fuel-price-panel-head">
          <div className="fuel-price-title">
            <span className="fuel-table-icon">
              {type === "buy" ? <ShoppingCart size={18} /> : <BadgeDollarSign size={18} />}
            </span>
            <div>
              <small>KWS / TIR TARİFESİ</small>
              <h2>{title}</h2>
            </div>
          </div>
          <div className="kws-table-actions">
            <span className="kws-row-count">{data.length} ROTA</span>
            <button
              type="button"
              className="kws-section-history"
              onClick={() => showKwsHistory(type === "buy" ? "alis" : "satis")}
            >
              <History size={15} />
              Geçmiş
            </button>
          </div>
        </div>

        <div className="fuel-table-wrap">
          <table className="fuel-table kws-table">
            <thead>
              <tr>
                <th>YÜKLEME</th>
                <th>BOŞALTMA</th>
                <th>2 İLAVELİ<br />KDV HARİÇ</th>
                <th>2 İLAVELİ<br />KDV DAHİL</th>
                <th>3 İLAVELİ<br />KDV HARİÇ</th>
                <th>3 İLAVELİ<br />KDV DAHİL</th>
              </tr>
            </thead>
            <tbody>
              {data.map((item, index) => (
                <tr key={`${type}-${index}`}>
                  <td><b>{item.yukleme}</b></td>
                  <td>{item.bosaltma}</td>
                  <td>{renderKwsPrice(item.ikiHaric)}</td>
                  <td>{renderKwsPrice(item.ikiDahil)}</td>
                  <td>{renderKwsPrice(item.ucHaric)}</td>
                  <td>{renderKwsPrice(item.ucDahil)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    );

    return (
      <div className="fuel-page fuel-full fuel-unified-customer fasdat-page kws-page"><FuelOperationLoader /><FirstPriceArchiveButton /><CustomerUnifiedOverview />
        <FuelReferenceBanner station="Petrol Ofisi" location="Eskişehir Merkez" note="KWS ve KWS Lowbed tarifelerinde kullanılan yakıt referans noktası." />
        <div className="fuel-detail-topbar">
          <button type="button" className="fuel-back" onClick={goBackCustomers}>
            <ArrowLeft size={17} />
            Müşteriler
          </button>

        <div className="fuel-detail-path">
            <span>Yakıt Hesaplama</span>
            <span>/</span>
            <b>KWS</b>
          </div>
        </div>

        <section className="bim-v56-shell efor-v59-shell kws-efor-shell">
          <header className="bim-v56-header">
            <div className="bim-v56-brand">
              <img src="/fuel-assets/petrol-ofisi-logo.svg" alt="Petrol Ofisi" />
              <div>
                <span>KWS TARİFE YÖNETİMİ</span>
                <h1>KWS – Yakıt Hesaplama</h1>
                <p>Petrol Ofisi • Eskişehir Merkez • Motorin</p>
              </div>
            </div>
            <div className="bim-v56-actions">
              <button type="button" className="icon-btn" onClick={undoLastKwsUpdate} disabled={!kwsHistory.length}>
                <Undo2 size={15} />Geri Al
              </button>
              <button type="button" className="icon-btn" onClick={() => showKwsHistory("alis")}>
                <History size={15} />Geçmiş
              </button>
              <button type="button" className="icon-btn excel" onClick={exportAllKwsHistoryExcel}>
                <Download size={15} />Excel
              </button>
              <button type="button" className="icon-btn" onClick={goBackCustomers}>
                <Users size={15} />Müşteriler
              </button>
              <button type="button" className="icon-btn update" disabled={busy || !kwsUpdate} onClick={() => runFuelOperation("KWS tarifeleri güncelleniyor", applyKwsUpdate)}>
                <RefreshCw size={15} />Güncelle
              </button>
            </div>
          </header>
          <div className="bim-v56-summary">
            <div className="bim-v56-logo">
              <img src="/fuel-assets/petrol-ofisi-logo.svg" alt="Petrol Ofisi" />
              <div><b>KWS</b><span>TIR ve Lowbed tarifeleri</span></div>
            </div>
            <div className="bim-v56-metric old"><span>REFERANS YAKIT FİYATI</span><strong>{calc.eski || "—"} ₺</strong><small>Son kabul edilen fiyat</small></div>
            <div className="bim-v56-arrow"><ArrowRight size={22} /></div>
            <div className="bim-v56-metric current"><span>GÜNCEL YAKIT FİYATI</span><strong>{calc.yeni || "—"} ₺</strong><small>Petrol Ofisi • Eskişehir Merkez</small></div>
            <div className={`bim-v56-metric change ${kwsUpdate ? "passed" : ""}`}><span>DEĞİŞİM</span><strong>{pct == null ? "—" : `%${Math.abs(pct).toFixed(2)}`}</strong><small>{kwsUpdate ? "Eşik sağlandı" : "±%12 eşik altında"}</small></div>
            <div className="bim-v56-rule-toggle kws-rule-summary"><span><SlidersHorizontal size={17} /><i>KWS KURALI</i><b>±%12 eşik <ArrowRight size={13} /> %30 yansıtma</b></span><span className="kws-rule-status">{kwsUpdate ? `%${Math.abs(kwsAppliedPct).toFixed(2)}` : "%0,00"}</span></div>
          </div>
        </section>

        <div className="fuel-customer-head kws-head">
          <div className="fuel-customer-identity">
            <div className="fuel-logo">
              <Building2 size={25} />
            </div>
            <div>
              <span>FİNANS / KWS YAKIT HESAPLAMA</span>
              <h1>KWS</h1>
              <p>2 ilaveli, 3 ilaveli ve Lowbed sefer tarifeleri.</p>
            </div>
          </div>

          <div className="kws-head-actions">
            <div className="kws-rule-badge">
              <small>YAKIT KURALI</small>
              <b>±%12 EŞİK / %30 YANSITMA</b>
            </div>
          </div>
        </div>

        <section className="fuel-rule-panel simple-check kws-rule-panel">
          <div className="fuel-rule-head">
            <div>
              <span>KWS GÜNCELLEME KURALI</span>
              <h2>Yakıt Değişim Kontrolü</h2>
              <p>
                Yakıt fiyatı baz fiyata göre %12 veya daha fazla yükselir ya da düşerse,
                değişimin %30'u KWS tarifelerine yansıtılır.
              </p>
            </div>

            <div className={`fuel-decision ${kwsUpdate ? "action" : "stable"}`}>
              {kwsUpdate ? <AlertTriangle size={18} /> : <CheckCircle2 size={18} />}
              <div>
                <small>KARAR</small>
                <b>
                  {pct == null
                    ? "FİYATLARI GİRİN"
                    : kwsUpdate
                    ? "TARİFE GÜNCELLENİR"
                    : "İŞLEM YOK"}
                </b>
              </div>
            </div>
          </div>

          <div className="simple-calc-grid fasdat kws-calc-grid">
            <label>
              <span>ESKİ YAKIT FİYATI</span>
              <input
                inputMode="decimal"
                value={calc.eski}
                onChange={(e) => setCalc({ ...calc, eski: e.target.value })}
                placeholder="0,00"
              />
            </label>

            <div className="simple-arrow">→</div>

            <label>
              <span>YENİ YAKIT FİYATI</span>
              <input
                inputMode="decimal"
                value={calc.yeni}
                onChange={(e) => setCalc({ ...calc, yeni: e.target.value })}
                placeholder="0,00"
              />
            </label>

            <div className="simple-result-card">
              <span>YAKIT DEĞİŞİMİ</span>
              <strong>
                {pct == null ? "—" : `${pct >= 0 ? "+" : ""}%${pct.toFixed(2)}`}
              </strong>
              <small>Eşik: ±%12</small>
            </div>

            <div
              className={`simple-result-card kws-impact-card ${
                !kwsUpdate
                  ? "neutral"
                  : kwsAppliedPct > 0
                  ? "increase"
                  : kwsAppliedPct < 0
                  ? "decrease"
                  : "neutral"
              }`}
            >
              <div className="kws-trend-label">
                <span>TARİFEYE YANSIMA</span>
                <span className="kws-trend-icon">
                  {!kwsUpdate ? (
                    <Minus size={18} />
                  ) : kwsAppliedPct > 0 ? (
                    <TrendingUp size={18} />
                  ) : kwsAppliedPct < 0 ? (
                    <TrendingDown size={18} />
                  ) : (
                    <Minus size={18} />
                  )}
                </span>
              </div>

              <strong>
                {pct == null
                  ? "—"
                  : kwsUpdate
                  ? `${kwsAppliedPct >= 0 ? "+" : ""}%${kwsAppliedPct.toFixed(2)}`
                  : "%0,00"}
              </strong>

              <small>
                {!kwsUpdate
                  ? "Eşik aşılmadı"
                  : kwsAppliedPct > 0
                  ? "Tarifelerde artış uygulanacak"
                  : kwsAppliedPct < 0
                  ? "Tarifelerde azalış uygulanacak"
                  : "Değişiklik yok"}
              </small>
            </div>
          </div>

          <div className="kws-rule-example">
            <span>Örnek</span>
            <b>Yakıt +%15 → Tarife +%4,50</b>
            <b>Yakıt -%12 → Tarife -%3,60</b>
          </div>

          <div className="fuel-update-actions kws-update-actions">
            <button
              type="button"
              className={`fuel-save apply-ton kws-apply-button ${!kwsUpdate ? "rule-disabled" : ""}`}
              disabled={busy || !kwsUpdate}
              onClick={()=>runFuelOperation("KWS tarifeleri güncelleniyor", applyKwsUpdate)}
              title={!kwsUpdate ? "KWS kuralı sağlanmadan tarifeler güncellenemez." : ""}
            >
              <Calculator size={18} />
              {busy
                ? "Uygulanıyor..."
                : kwsUpdate
                ? `%${kwsAppliedPct.toFixed(2)} Değişimi KWS Tarifelerine Uygula`
                : "Kural Sağlanmadı"}
            </button>

            <button
              type="button"
              className="fuel-undo-button"
              disabled={busy || !kwsHistory.length}
              onClick={undoLastKwsUpdate}
              title="Son yapılan KWS tarife güncellemesini geri al"
            >
              <Undo2 size={17} />
              Son İşlemi Geri Al
            </button>
          </div>
        </section>

        {error && <div className="fuel-error">{error}</div>}
        {info && <div className="fuel-success">{info}</div>}

        <div className="kws-section-title">
          <div>
            <span>KWS 2026</span>
            <h2>TIR Tarifeleri</h2>
          </div>
          {kwsUpdate && (
            <div className="kws-live-adjustment">
              Gösterilen fiyatlara {kwsAppliedPct >= 0 ? "+" : ""}%{kwsAppliedPct.toFixed(2)} uygulandı
            </div>
          )}
        </div>

        <div className="fuel-two-tables kws-two-tables">
          {renderTirTable("Yakıt Alış / Maliyet Tarifeleri", kwsTarifeler.alis, "buy")}
          {renderTirTable("Yakıt Satış Tarifeleri", kwsTarifeler.satis, "sell")}
        </div>

        <section className="fuel-price-panel kws-panel lowbed">
          <div className="fuel-price-panel-head">
            <div className="fuel-price-title">
              <span className="fuel-table-icon">
                <Fuel size={18} />
              </span>
              <div>
                <small>KWS / ÖZEL TAŞIMA</small>
                <h2>Lowbed Tarifeleri</h2>
              </div>
            </div>
            <div className="kws-table-actions">
              <span className="kws-row-count">{kwsTarifeler.lowbed.length} ROTA</span>
              <button
                type="button"
                className="kws-section-history"
                onClick={() => showKwsHistory("lowbed")}
              >
                <History size={15} />
                Geçmiş
              </button>
            </div>
          </div>

          <div className="fuel-table-wrap">
            <table className="fuel-table kws-table kws-lowbed-table">
              <thead>
                <tr>
                  <th>YÜKLEME</th>
                  <th>BOŞALTMA</th>
                  <th>SEFER TL / KDV HARİÇ</th>
                  <th>SEFER TL / KDV DAHİL</th>
                </tr>
              </thead>
              <tbody>
                {kwsTarifeler.lowbed.map((item, index) => (
                  <tr key={`lowbed-${index}`}>
                    <td><b>{item.yukleme}</b></td>
                    <td>{item.bosaltma}</td>
                    <td>{renderKwsPrice(item.haric)}</td>
                    <td>{renderKwsPrice(item.dahil)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {modal?.kind === "kws-history" && (() => {
          const category = modal.category || "alis";
          const meta = kwsHistoryMeta[category];
          const ModalIcon = meta.icon;

          const categoryHistory = kwsHistory.filter((item) => {
            const before = item?.eski_tarifeler?.[category];
            const after = item?.yeni_tarifeler?.[category];
            return Array.isArray(before) && Array.isArray(after);
          });

          return (
            <div className="fuel-modal-bg" onMouseDown={() => setModal(null)}>
              <div
                className="fuel-modal history-modal kws-history-modal kws-modern-history"
                onMouseDown={(e) => e.stopPropagation()}
              >
                <div className="kws-history-hero">
                  <div className="kws-history-hero-icon">
                    <ModalIcon size={22} />
                  </div>

                  <div className="kws-history-hero-copy">
                    <span>KWS / TARİFE GEÇMİŞİ</span>
                    <h2>{meta.title}</h2>
                    <p>{meta.subtitle}</p>
                  </div>

                  <div className="kws-history-hero-actions">
                    <button
                      type="button"
                      className="fuel-excel-button"
                      onClick={exportAllKwsHistoryExcel}
                      disabled={!kwsHistory.length}
                    >
                      <Download size={15} />
                      Fiyat Hafızasını Excel'e Aktar
                    </button>

                    <button
                      type="button"
                      className="kws-history-close"
                      onClick={() => setModal(null)}
                      aria-label="Kapat"
                    >
                      ×
                    </button>
                  </div>
                </div>

                <div className="kws-history-tabs">
                  {[
                    ["alis", "Alış / Maliyet", ShoppingCart],
                    ["satis", "Satış", BadgeDollarSign],
                    ["lowbed", "Lowbed", Truck],
                  ].map(([key, label, Icon]) => (
                    <button
                      key={key}
                      type="button"
                      className={category === key ? "active" : ""}
                      onClick={() =>
                        setModal({ kind: "kws-history", category: key })
                      }
                    >
                      <Icon size={15} />
                      {label}
                    </button>
                  ))}
                </div>

                <div className="kws-history-simple-wrap">
                  <div className="kws-simple-history-head">
                    <div>
                      <span>KWS / TARİFE GEÇMİŞİ</span>
                      <h3>{meta.title}</h3>
                    </div>
                    <span className="kws-simple-count">
                      {categoryHistory.reduce(
                        (total, item) =>
                          total +
                          (item?.eski_tarifeler?.[category]?.length || 0),
                        0
                      )} SATIR
                    </span>
                  </div>

                  <div className="fuel-table-wrap kws-simple-table-wrap">
                    <table className="fuel-table kws-simple-history-table">
                      <thead>
                        <tr>
                          <th>TARİH</th>
                          <th>YÜKLEME / BOŞALTMA</th>
                          {category === "lowbed" ? (
                            <>
                              <th>TİP</th>
                              <th>ESKİ FİYAT</th>
                              <th>YENİ FİYAT</th>
                            </>
                          ) : (
                            <>
                              <th>TİP</th>
                              <th>ESKİ FİYAT</th>
                              <th>YENİ FİYAT</th>
                            </>
                          )}
                          <th>YAKIT DEĞİŞİMİ</th>
                          <th>UYGULANAN</th>
                        </tr>
                      </thead>

                      <tbody>
                        {categoryHistory.flatMap((item) => {
                          const before =
                            item?.eski_tarifeler?.[category] || [];
                          const after =
                            item?.yeni_tarifeler?.[category] || [];

                          return before.flatMap((oldRow, rowIndex) => {
                            const newRow = after[rowIndex] || {};
                            const common = {
                              key: `${item.id}-${category}-${rowIndex}`,
                              tarih: new Date(item.created_at).toLocaleString(
                                "tr-TR"
                              ),
                              rota: `${oldRow.yukleme || "-"} / ${
                                oldRow.bosaltma || "-"
                              }`,
                              yakit:
                                Number(item.yakit_degisim_orani || 0) * 100,
                              uygulanan:
                                Number(item.uygulanan_artis_orani || 0) * 100,
                            };

                            const variants =
                              category === "lowbed"
                                ? [
                                    {
                                      tip: "KDV Hariç",
                                      eski: oldRow.haric,
                                      yeni: newRow.haric,
                                    },
                                    {
                                      tip: "KDV Dahil",
                                      eski: oldRow.dahil,
                                      yeni: newRow.dahil,
                                    },
                                  ]
                                : [
                                    {
                                      tip: "2 İlaveli / Hariç",
                                      eski: oldRow.ikiHaric,
                                      yeni: newRow.ikiHaric,
                                    },
                                    {
                                      tip: "2 İlaveli / Dahil",
                                      eski: oldRow.ikiDahil,
                                      yeni: newRow.ikiDahil,
                                    },
                                    {
                                      tip: "3 İlaveli / Hariç",
                                      eski: oldRow.ucHaric,
                                      yeni: newRow.ucHaric,
                                    },
                                    {
                                      tip: "3 İlaveli / Dahil",
                                      eski: oldRow.ucDahil,
                                      yeni: newRow.ucDahil,
                                    },
                                  ];

                            return variants.map((variant, variantIndex) => {
                              const oldValue = Number(variant.eski || 0);
                              const newValue = Number(variant.yeni || 0);
                              const diff = newValue - oldValue;

                              return (
                                <tr
                                  key={`${common.key}-${variantIndex}`}
                                  className={
                                    diff > 0
                                      ? "history-up"
                                      : diff < 0
                                      ? "history-down"
                                      : ""
                                  }
                                >
                                  <td>{common.tarih}</td>

                                  <td className="kws-history-route-cell">
                                    {common.rota}
                                  </td>

                                  <td>
                                    <span className="kws-history-type">
                                      {variant.tip}
                                    </span>
                                  </td>

                                  <td>{money(oldValue)}</td>

                                  <td>
                                    <div className="kws-history-new-value">
                                      <b>{money(newValue)}</b>
                                      {diff > 0 ? (
                                        <TrendingUp size={14} />
                                      ) : diff < 0 ? (
                                        <TrendingDown size={14} />
                                      ) : (
                                        <Minus size={14} />
                                      )}
                                    </div>
                                  </td>

                                  <td>
                                    {common.yakit > 0 ? "+" : ""}
                                    %{common.yakit.toFixed(2)}
                                  </td>

                                  <td>
                                    {common.uygulanan > 0 ? "+" : ""}
                                    %{common.uygulanan.toFixed(2)}
                                  </td>
                                </tr>
                              );
                            });
                          });
                        })}

                        {!categoryHistory.length && (
                          <tr>
                            <td colSpan="7">
                              <div className="fuel-empty-table">
                                <History size={25} />
                                <b>Henüz geçmiş kaydı yok</b>
                              </div>
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          );
        })()}
      </div>
    );
  }

  /* =======================================================
     MÜŞTERİ DETAY EKRANI
  ======================================================= */

  // FASDAT, EFOR ÇAY ekranındaki ortak sade müşteri şablonunu kullanır.
  // Hesaplama state'i ve mevcut tarife işlemleri aynı kalır; yalnızca ekran iskeleti ayrıdır.
  if (customerFuelKey(customer) === "FASDAT") {
    const latestFuel = getLatestFuelOperation();
    const oldFuelText = calc.eski || latestFuel?.oldFuel || "—";
    const newFuelText = calc.yeni || latestFuel?.newFuel || "—";
    const changeText = pct == null ? "%0,00" : `%${Math.abs(pct).toFixed(2)}`;
    const appliedText = `%${(Math.abs(applied) * 100).toFixed(2)}`;
    return (
      <div className="fuel-page fuel-full fuel-unified-customer fasdat-page fasdat-efor-template">
        <FuelOperationLoader />
        <section className="bim-v56-shell efor-v59-shell fasdat-template-shell">
          <header className="bim-v56-header">
            <div className="bim-v56-brand">
              <div className="fasdat-template-logo"><Fuel size={24} /></div>
              <div><span>FASDAT TARİFE YÖNETİMİ</span><h1>FASDAT – Yakıt Hesaplama</h1><p>Shell • Afyon Merkez • Motorin</p></div>
            </div>
            <div className="bim-v56-actions">
              <button className="icon-btn" onClick={undoLastUpdate} disabled={!history.length}><Undo2 size={17} /><span>Geri Al</span></button>
              <button className="icon-btn" onClick={() => showHistory("alis")}><History size={17} /><span>Geçmiş</span></button>
              <button className="icon-btn excel" onClick={exportFasdatPriceMemoryExcel}><Download size={17} /><span>Excel</span></button>
              <button className="icon-btn" onClick={goBackCustomers}><Users size={17} /><span>Müşteriler</span></button>
              <button className="icon-btn update" disabled={!update} onClick={() => runFuelOperation("FASDAT tarifeleri güncelleniyor", applyUpdate)}><RefreshCw size={17} /><span>Güncelle</span></button>
            </div>
          </header>
          <div className="bim-v56-summary">
            <div className="bim-v56-logo"><div className="fasdat-summary-logo">FA</div><div><b>FASDAT</b><span>TON/TL Fiyatlandırma</span></div></div>
            <div className="bim-v56-metric old"><span>REFERANS YAKIT FİYATI</span><strong>{oldFuelText} ₺</strong><small>Son kabul edilen fiyat</small></div>
            <div className="bim-v56-arrow"><ArrowRight size={22} /></div>
            <div className="bim-v56-metric current"><span>GÜNCEL YAKIT FİYATI</span><strong>{newFuelText} ₺</strong><small>Shell • Afyon Merkez</small></div>
            <div className={`bim-v56-metric change ${update ? "passed" : ""}`}><span>DEĞİŞİM</span><strong>{changeText}</strong><small>{update ? "Eşik sağlandı" : "%7 eşik altında"}</small></div>
            <div className="bim-v56-rule-toggle fasdat-rule-static"><span><SlidersHorizontal size={18} /><i>FASDAT KURALI</i><b>%7 eşik <ArrowRight size={14} /> %50 yansıtma</b></span><span className="fasdat-rule-status">{appliedText}</span></div>
          </div>
        </section>
        <section className="eti-tariff-workspace efor-v59-workspace fasdat-template-workspace">
          <FasdatUnifiedTariffTable
            rows={rows}
            onImport={importExcel}
            onAdd={(type) => { setRowForm({ il: "", ilce: "", koy_mahalle: "", ton_tl: "" }); setModal({ kind: "add", type }); }}
            onHistory={showHistory}
          />
        </section>
        {error && <div className="fuel-error">{error}</div>}
        {info && <div className="fuel-success">{info}</div>}
      </div>
    );
  }

  return (
    <div className="fuel-page fuel-full fuel-unified-customer fasdat-page fasdat-modern-v2"><FuelOperationLoader /><FirstPriceArchiveButton /><CustomerUnifiedOverview />
      {customerFuelKey(customer) === "FASDAT" && <FasdatFuelMonitor />}
      {customerFuelKey(customer) === "FASDAT" && (
        <div className="fasdat-command-bar">
          <div className="fasdat-command-title"><span className="fasdat-command-icon"><Fuel size={17} /></span><div><b>FASDAT YAKIT İŞLEM MERKEZİ</b><small>Motorin fiyatı ve tarife güncelleme işlemleri</small></div></div>
          <div className="fasdat-command-actions">
            <button type="button" onClick={undoLastUpdate} disabled={busy}><Undo2 size={15} /> Geri al</button>
            <button type="button" onClick={() => showHistory("alis")}><History size={15} /> Geçmiş</button>
            <button type="button" onClick={exportFasdatPriceMemoryExcel}><Download size={15} /> Excel</button>
            <button type="button" onClick={goBackCustomers}><Users size={15} /> Müşteriler</button>
            <button type="button" className="primary" disabled={!update} onClick={() => runFuelOperation("FASDAT tarifeleri güncelleniyor", applyUpdate)}><RefreshCw size={15} /> Tarifeleri güncelle</button>
          </div>
        </div>
      )}
      <FuelReferenceBanner station="Shell" location="Afyon Merkez" note="FASDAT tarifelerinde kullanılan yakıt referans noktası." />
      <div className="fuel-detail-topbar">
        <button
          type="button"
          className="fuel-back"
          onClick={
            goBackCustomers
          }
        >
          <ArrowLeft size={17} />
          Müşteriler
        </button>

        <div className="fuel-detail-path">
          <span>
            Yakıt Hesaplama
          </span>

          <span>/</span>

          <b>
            {
              customer.musteri_adi
            }
          </b>
        </div>
      </div>

      <div className="fuel-customer-head">
        <div className="fuel-customer-identity">
          <div className="fuel-logo">
            <Building2
              size={25}
            />
          </div>

          <div>
            <span>
              FİNANS / YAKIT HESAPLAMA
            </span>

            <h1>
              {
                customer.musteri_adi
              }
            </h1>

            <p>
              Yakıt değişimine göre
              TON/TL tarife
              güncellemesi.
            </p>
          </div>
        </div>

        <button
          type="button"
          className="fuel-refresh"
          onClick={() =>
            loadCustomerData()
          }
        >
          <RefreshCw size={17} />
          Yenile
        </button>
      </div>

      {/* ===================================================
          YAKIT DEĞİŞİM KONTROLÜ
      =================================================== */}

      <section className="fuel-rule-panel simple-check">
        <div className="fuel-rule-head">
          <div>
            <span>
              {
                customer.musteri_adi
              }{" "}
              GÜNCELLEME KURALI
            </span>

            <h2>
              Yakıt Değişim
              Kontrolü
            </h2>

            <p>
              (Yeni fiyat / Eski
              fiyat) − 1. Sonuç
              %7'yi geçerse
              değişimin yarısı
              TON/TL fiyatlarına
              uygulanır.
            </p>
          </div>

          <div
            className={`fuel-decision ${
              update
                ? "action"
                : "stable"
            }`}
          >
            {update ? (
              <AlertTriangle
                size={18}
              />
            ) : (
              <CheckCircle2
                size={18}
              />
            )}

            <div>
              <small>
                KARAR
              </small>

              <b>
                {pct == null
                  ? "FİYATLARI GİRİN"
                  : update
                  ? "GÜNCELLEME GEREKİYOR"
                  : "İŞLEM YOK"}
              </b>
            </div>
          </div>
        </div>

        <div className="fasdat-threshold-block">
          <div className="fasdat-threshold-head"><div><b>Güncelleme eşiği %7</b><span>Değişim %7’yi geçerse, değişimin yarısı TON/TL fiyatlarına uygulanır.</span></div><div><span>TON/TL’ye uygulanacak</span><strong>%{(applied * 100).toFixed(2)}</strong></div></div>
          <div className="fasdat-threshold-track"><div className="fasdat-threshold-fill" style={{width: `${Math.min(Math.abs(pct || 0) * 10, 100)}%`}}/><i className="fasdat-threshold-dot" style={{left: `${Math.min(Math.abs(pct || 0) * 10, 100)}%`}}/><i className="fasdat-threshold-limit"/><span className="zero">%0</span><span className="limit">%7 eşik</span><span className="ten">%10</span></div>
        </div>

        <div className="simple-calc-grid fasdat">
          <label>
            <span>
              ESKİ YAKIT FİYATI
            </span>

            <input
              inputMode="decimal"
              value={
                calc.eski
              }
              onChange={(e) =>
                setCalc({
                  ...calc,
                  eski:
                    e.target.value,
                })
              }
              placeholder="0,00"
            />
          </label>

          <div className="simple-arrow">
            →
          </div>

          <label>
            <span>
              YENİ YAKIT FİYATI
            </span>

            <input
              inputMode="decimal"
              value={
                calc.yeni
              }
              onChange={(e) =>
                setCalc({
                  ...calc,
                  yeni:
                    e.target.value,
                })
              }
              placeholder="0,00"
            />
          </label>

          <div className="simple-result-card">
            <span>
              YAKIT DEĞİŞİMİ
            </span>

            <strong>
              {pct == null
                ? "—"
                : `%${pct.toFixed(
                    2
                  )}`}
            </strong>

            <small>
              Eşik: %7'den büyük
            </small>
          </div>

          <div className="simple-result-card">
            <span>
              TON/TL'YE
              UYGULANACAK
            </span>

            <strong>
              {pct == null
                ? "—"
                : `%${(
                    applied * 100
                  ).toFixed(
                    2
                  )}`}
            </strong>

            <small>
              {update
                ? "Değişimin yarısı"
                : "Artış uygulanmaz"}
            </small>
          </div>
        </div>

        <div className="fuel-update-actions">
          <button
            type="button"
            className={`fuel-save apply-ton ${!update ? "rule-disabled" : ""}`}
            disabled={busy || !update}
            onClick={applyUpdate}
            title={!update ? "FASDAT kuralı sağlanmadan tarifeler güncellenemez." : ""}
          >
            <Calculator size={18} />
            {busy
              ? "Uygulanıyor..."
              : update
              ? `%${(applied * 100).toFixed(2)} Değişimi TON/TL'lere Uygula`
              : "Kural Sağlanmadı"}
          </button>

          <button
            type="button"
            className="fuel-undo-button"
            disabled={busy}
            onClick={undoLastUpdate}
            title="Son yapılan FASDAT tarife güncellemesini geri al"
          >
            <Undo2 size={17} />
            Son İşlemi Geri Al
          </button>
        </div>
      </section>

      {error && (
        <div className="fuel-error">
          {error}
        </div>
      )}

      {info && (
        <div className="fuel-success">
          {info}
        </div>
      )}

      {/* ===================================================
          ALIŞ / SATIŞ TARİFELERİ
      =================================================== */}

      <FasdatUnifiedTariffTable
        rows={rows}
        onImport={importExcel}
        onAdd={(type) => {
          setRowForm({ il: "", ilce: "", koy_mahalle: "", ton_tl: "" });
          setModal({ kind: "add", type });
        }}
        onHistory={showHistory}
      />

      {/* ===================================================
          SATIR EKLE MODAL
      =================================================== */}

      {modal?.kind ===
        "add" && (
        <div
          className="fuel-modal-bg"
          onMouseDown={() =>
            setModal(null)
          }
        >
          <form
            className="fuel-modal"
            onSubmit={addRow}
            onMouseDown={(e) =>
              e.stopPropagation()
            }
          >
            <div className="fuel-modal-head">
              <div>
                <span>
                  YENİ TARİFE
                  SATIRI
                </span>

                <h2>
                  {modal.type ===
                  "alis"
                    ? "Alış"
                    : "Satış"}
                </h2>
              </div>

              <button
                type="button"
                onClick={() =>
                  setModal(null)
                }
              >
                ×
              </button>
            </div>

            <div className="fuel-form-grid">
              {[
                [
                  "il",
                  "İL",
                ],
                [
                  "ilce",
                  "İLÇE",
                ],
                [
                  "koy_mahalle",
                  "KÖY/MAHALLE",
                ],
                [
                  "ton_tl",
                  "TON/TL",
                ],
              ].map(
                ([
                  key,
                  label,
                ]) => (
                  <label
                    key={key}
                  >
                    <span>
                      {label}
                    </span>

                    <input
                      required={
                        key ===
                          "il" ||
                        key ===
                          "ilce" ||
                        key ===
                          "ton_tl"
                      }
                      value={
                        rowForm[
                          key
                        ]
                      }
                      onChange={(
                        e
                      ) =>
                        setRowForm(
                          {
                            ...rowForm,
                            [key]:
                              e
                                .target
                                .value,
                          }
                        )
                      }
                    />
                  </label>
                )
              )}
            </div>

            <button
              type="submit"
              className="fuel-save"
            >
              <Save size={18} />
              Satırı Kaydet
            </button>
          </form>
        </div>
      )}

      {/* ===================================================
          GEÇMİŞ MODAL
      =================================================== */}

      {modal?.kind ===
        "history" && (
        <div
          className="fuel-modal-bg"
          onMouseDown={() =>
            setModal(null)
          }
        >
          <div
            className="fuel-modal history-modal"
            onMouseDown={(e) =>
              e.stopPropagation()
            }
          >
            <div className="fasdat-history-hero">
              <div className="fasdat-history-icon">
                <History size={21} />
              </div>

              <div className="fasdat-history-copy">
                <span>FASDAT / TON-TL GEÇMİŞİ</span>
                <h2>
                  {modal.type === "alis" ? "Alış" : "Satış"} Fiyat Geçmişi
                </h2>
                <p>Her tarife satırının eski ve yeni TON/TL değerleri</p>
              </div>

              <div className="fasdat-history-actions">
                <button
                  type="button"
                  className="fuel-excel-button"
                  onClick={exportFasdatPriceMemoryExcel}
                  disabled={busy}
                >
                  <Download size={15} />
                  Tümünü Excel'e Aktar
                </button>

                <button
                  type="button"
                  className="fasdat-history-close"
                  onClick={() => setModal(null)}
                >
                  ×
                </button>
              </div>
            </div>

            <div className="fuel-table-wrap">
              <table className="fuel-table">
                <thead>
                  <tr>
                    <th>
                      Tarih
                    </th>

                    <th>
                      İl / İlçe
                    </th>

                    <th>
                      Eski TON/TL
                    </th>

                    <th>
                      Yeni TON/TL
                    </th>

                    <th>
                      Yakıt Değişimi
                    </th>

                    <th>
                      Uygulanan
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {history.map(
                    (item) => (
                      <tr
                        key={
                          item.id
                        }
                      >
                        <td>
                          {new Date(
                            item.created_at
                          ).toLocaleString(
                            "tr-TR"
                          )}
                        </td>

                        <td>
                          {
                            item.il
                          }{" "}
                          /{" "}
                          {
                            item.ilce
                          }
                        </td>

                        <td>
                          {money(
                            item.eski_ton_tl
                          )}
                        </td>

                        <td>
                          {(() => {
                            const direction = getHistoryDirection(
                              item.eski_ton_tl,
                              item.yeni_ton_tl
                            );

                            return (
                              <div className={`fasdat-history-new ${direction.type}`}>
                                <b>{tariffMoney(item.yeni_ton_tl)}</b>
                                {direction.type === "increase" ? (
                                  <TrendingUp size={14} />
                                ) : direction.type === "decrease" ? (
                                  <TrendingDown size={14} />
                                ) : (
                                  <Minus size={14} />
                                )}
                              </div>
                            );
                          })()}
                        </td>

                        <td>
                          %
                          {(
                            Number(
                              item.yakit_degisim_orani
                            ) *
                            100
                          ).toFixed(
                            2
                          )}
                        </td>

                        <td>
                          %
                          {(
                            Number(
                              item.uygulanan_artis_orani
                            ) *
                            100
                          ).toFixed(
                            2
                          )}
                        </td>
                      </tr>
                    )
                  )}

                  {!history.length && (
                    <tr>
                      <td
                        colSpan="6"
                      >
                        <div className="fuel-empty-table">
                          <History
                            size={
                              26
                            }
                          />

                          <b>
                            Geçmiş
                            bulunamadı
                          </b>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export const CUSTOMER_KEYS = Object.freeze({
  FASDAT: "FASDAT",
  KWS: "KWS",
  ETI: "ETİ",
  CMC_AGRO: "CMC AGRO",
  CORTEVA: "CORTEVA",
  EFOR_CAY: "EFOR ÇAY",
  TEVERPAN: "TEVERPAN",
  BIM: "BİM",
});

export const CUSTOMER_LIST = Object.freeze([
  { key: CUSTOMER_KEYS.FASDAT, name: "FASDAT", order: 1 },
  { key: CUSTOMER_KEYS.KWS, name: "KWS", order: 2 },
  { key: CUSTOMER_KEYS.ETI, name: "ETİ", order: 3 },
  { key: CUSTOMER_KEYS.CMC_AGRO, name: "CMC AGRO", order: 4 },
  { key: CUSTOMER_KEYS.CORTEVA, name: "CORTEVA", order: 5 },
  { key: CUSTOMER_KEYS.EFOR_CAY, name: "EFOR ÇAY", order: 6 },
  { key: CUSTOMER_KEYS.TEVERPAN, name: "TEVERPAN", order: 7 },
  { key: CUSTOMER_KEYS.BIM, name: "BİM", order: 8 },
]);

export const CUSTOMER_FUEL_REFERENCES = Object.freeze({
  [CUSTOMER_KEYS.FASDAT]: { station: "Shell", location: "Afyon Merkez" },
  [CUSTOMER_KEYS.KWS]: { station: "Petrol Ofisi", location: "Eskişehir Merkez" },
  [CUSTOMER_KEYS.ETI]: { station: "Petrol Ofisi", location: "Eskişehir Odunpazarı" },
  [CUSTOMER_KEYS.CMC_AGRO]: { station: "Petrol Ofisi", location: "Bursa Karacabey" },
  [CUSTOMER_KEYS.CORTEVA]: { station: "Petrol Ofisi", location: "Adana Merkez" },
  [CUSTOMER_KEYS.EFOR_CAY]: { station: "Petrol Ofisi", location: "Tokat Erbaa" },
  [CUSTOMER_KEYS.TEVERPAN]: { station: "Petrol Ofisi", location: "Tekirdağ Çerkezköy" },
  [CUSTOMER_KEYS.BIM]: {
    station: "Petrol Ofisi",
    location: "İstanbul Sancaktepe",
    vatIncluded: false,
    priceMode: "KDV hariç (+KDV)",
  },
});

export function normalizeCustomerName(value) {
  return String(value ?? "")
    .trim()
    .toLocaleUpperCase("tr-TR")
    .replace(/\s+/g, " ");
}

export function getCustomerKey(customer) {
  const value = normalizeCustomerName(customer?.musteri_adi || customer?.kod);
  if (value.includes("FASDAT")) return CUSTOMER_KEYS.FASDAT;
  if (value.includes("KWS")) return CUSTOMER_KEYS.KWS;
  if (value.includes("CMC")) return CUSTOMER_KEYS.CMC_AGRO;
  if (value.includes("CORTEVA")) return CUSTOMER_KEYS.CORTEVA;
  if (value.includes("TEVERPAN")) return CUSTOMER_KEYS.TEVERPAN;
  if (value.includes("EFOR")) return CUSTOMER_KEYS.EFOR_CAY;
  if (value.includes("BİM") || value === "BIM") return CUSTOMER_KEYS.BIM;
  if (value.includes("ETİ") || value.includes("ETI")) return CUSTOMER_KEYS.ETI;
  return value;
}

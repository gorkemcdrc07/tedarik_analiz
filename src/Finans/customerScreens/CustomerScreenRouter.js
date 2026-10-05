import React from "react";
import { CUSTOMER_KEYS, getCustomerKey } from "./customerConfig";

/**
 * Müşteri ekranlarının tek bir dev koşul bloğunda birleşmesini önleyen router.
 * Ekran bileşenleri taşındıkça `screens` registry'sine eklenir.
 */
export default function CustomerScreenRouter({ customer, screens, fallback }) {
  const key = getCustomerKey(customer);
  const Screen = screens?.[key] || screens?.[CUSTOMER_KEYS.FASDAT] || fallback;
  if (!Screen) return null;
  return <Screen customer={customer} customerKey={key} />;
}

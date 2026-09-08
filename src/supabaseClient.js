import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseKey = process.env.REACT_APP_SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
    throw new Error("Supabase env değişkenleri eksik. .env dosyasını kontrol edin.");
}

// React Fast Refresh / HMR sırasında aynı storage key ile birden fazla
// GoTrueClient oluşmasını önlemek için tarayıcı genelinde tek instance kullanılır.
const globalScope = typeof window !== "undefined" ? window : {};
const clientKey = "__odak_supabase_client__";

const supabase =
    globalScope[clientKey] || createClient(supabaseUrl, supabaseKey);

if (!globalScope[clientKey]) {
    globalScope[clientKey] = supabase;
}

export default supabase;
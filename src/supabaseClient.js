// src/supabaseClient.js
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseKey = process.env.REACT_APP_SUPABASE_KEY; // REACT_APP_SUPABASE_ANON_KEY de olabilir

if (!supabaseUrl || !supabaseKey) {
    console.warn("Supabase env deðiþkenleri eksik. .env dosyasýný kontrol edin.");
}

const supabase = createClient(supabaseUrl, supabaseKey);

export default supabase;
// (opsiyonel) named export da istersen:
// export { supabase };

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseKey = process.env.REACT_APP_SUPABASE_KEY; 

if (!supabaseUrl || !supabaseKey) {
    console.warn("Supabase env de�i�kenleri eksik. .env dosyas�n� kontrol edin.");
}

const supabase = createClient(supabaseUrl, supabaseKey);

export default supabase;

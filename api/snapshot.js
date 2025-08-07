// /api/snapshot.js
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
    try {
        const response = await fetch(`${process.env.REACT_APP_API_BASE_URL}/odak-detay`, {
            headers: {
                'Authorization': `Bearer ${process.env.REACT_APP_ODAK_API_KEY}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error(`API error: ${response.status}`);
        }

        const apiData = await response.json();

        const { error } = await supabase
            .from('history_snapshots')  // ← Tablo ismini burada kontrol et
            .insert([{
                timestamp: new Date().toISOString(),
                source: 'cron',
                data: apiData
            }]);

        if (error) {
            console.error('Supabase insert error:', error);
            return res.status(500).json({ error });
        }

        return res.status(200).json({ message: 'Snapshot saved successfully' });

    } catch (err) {
        console.error('Snapshot error:', err);
        return res.status(500).json({ error: err.message });
    }
}

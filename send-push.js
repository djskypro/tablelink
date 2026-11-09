const webpush = require('web-push');
const { createClient } = require('@supabase/supabase-js');

// --- CONFIGURATION ---
const SUPABASE_URL = 'https://tejggbwdjxwuqvsaxfft.supabase.co';
// TOMORROW: Paste your Service Role key in the quotes below
const SUPABASE_SERVICE_KEY = 'PASTE_YOUR_SERVICE_ROLE_KEY_HERE'; 

// Your Public Key is already inserted here!
const PUBLIC_VAPID_KEY = 'BKl3SYu7VZIVoFS4AX-bQuE3xbsM9rpCoZgcNrVKdNuk_X0TTSKeLDP9SbyNtwWA2bnJVs0n_FoyzrVj_1LC8ls';

// TOMORROW: Paste your Private VAPID key in the quotes below
const PRIVATE_VAPID_KEY = 'PASTE_YOUR_PRIVATE_VAPID_KEY_HERE'; 

webpush.setVapidDetails('mailto:test@tablelink.com', PUBLIC_VAPID_KEY, PRIVATE_VAPID_KEY);
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function sendTestPush() {
    console.log("Fetching subscriptions...");
    const { data, error } = await supabase.from('push_subscriptions').select('*');
    
    if (error || !data || data.length === 0) {
        console.log("No subscriptions found. Make sure you clicked 'Enable Push Notifications' in the app.");
        return;
    }

    console.log(`Found ${data.length} device(s). Sending push...`);
    const payload = JSON.stringify({
        title: 'Food is Ready! 🍽️',
        body: 'Your order is hot and ready. Come and get it!',
        url: '/my-orders.html'
    });

    for (const row of data) {
        try {
            await webpush.sendNotification(row.subscription, payload);
            console.log(`✅ Sent to subscription ${row.id}`);
        } catch (err) {
            console.log(`❌ Failed to send to ${row.id}`, err.statusCode);
            if (err.statusCode === 404 || err.statusCode === 410) {
                await supabase.from('push_subscriptions').delete().eq('id', row.id);
            }
        }
    }
}
sendTestPush();

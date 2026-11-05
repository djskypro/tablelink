const webpush = require('web-push');
const fs = require('fs');
const readline = require('readline');

// 1. Generate brand new, valid keys
const vapidKeys = webpush.generateVAPIDKeys();
const pubKey = vapidKeys.publicKey;
const privKey = vapidKeys.privateKey;

console.log('🔑 Generated fresh VAPID keys.');

// 2. Update Frontend files
let scriptJs = fs.readFileSync('public/script.js', 'utf8');
let profileJs = fs.readFileSync('public/profile.js', 'utf8');
scriptJs = scriptJs.replace(/const VAPID_PUBLIC_KEY = '.*?';/, `const VAPID_PUBLIC_KEY = '${pubKey}';`);
profileJs = profileJs.replace(/const VAPID_PUBLIC_KEY = '.*?';/, `const VAPID_PUBLIC_KEY = '${pubKey}';`);
fs.writeFileSync('public/script.js', scriptJs);
fs.writeFileSync('public/profile.js', profileJs);

// 3. Update Backend file
let pushServerJs = fs.readFileSync('push-server.js', 'utf8');
pushServerJs = pushServerJs.replace(/const PUBLIC_VAPID_KEY = '.*?';/, `const PUBLIC_VAPID_KEY = '${pubKey}';`);
pushServerJs = pushServerJs.replace(/const PRIVATE_VAPID_KEY = '.*?';/, `const PRIVATE_VAPID_KEY = '${privKey}';`);

// 4. Ask for the Service Key
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
rl.question('\nPaste your SUPABASE SERVICE_ROLE key (starts with eyJ): ', (serviceKey) => {
    pushServerJs = pushServerJs.replace(/const SUPABASE_SERVICE_KEY = '.*?';/, `const SUPABASE_SERVICE_KEY = '${serviceKey.trim()}';`);
    fs.writeFileSync('push-server.js', pushServerJs);
    console.log('\n✅ All keys fixed and injected perfectly!');
    console.log('👉 You can now run: node push-server.js');
    rl.close();
});

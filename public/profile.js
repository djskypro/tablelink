let currentUser = null;
const userEmail = document.getElementById('profileEmail');

// 1. Load User Data
async function initProfile() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) { window.location.href = 'auth.html'; return; }
    
    currentUser = session.user;
    
    const email = currentUser.email;
    const name = email.split('@')[0];
    
    document.getElementById('profileName').textContent = name;
    userEmail.textContent = email;
    document.getElementById('avatarLetter').textContent = name.charAt(0).toUpperCase();
}

// 2. Modal Logic
const modal = document.getElementById('deleteModal');
const verifyEmailInput = document.getElementById('verifyEmail');
const verifyTextInput = document.getElementById('verifyText');
const confirmBtn = document.getElementById('confirmDeleteBtn');

document.getElementById('openDeleteModal').addEventListener('click', () => {
    verifyEmailInput.value = '';
    verifyTextInput.value = '';
    confirmBtn.disabled = true;
    modal.classList.add('open');
});

document.getElementById('cancelDeleteBtn').addEventListener('click', () => {
    modal.classList.remove('open');
});

// 3. The 2-Step Verification Checker
function checkVerification() {
    const emailMatch = verifyEmailInput.value.trim().toLowerCase() === currentUser.email.toLowerCase();
    const textMatch = verifyTextInput.value.trim() === 'DELETE';
    
    // The button only unlocks if BOTH are correct
    if (emailMatch && textMatch) {
        confirmBtn.disabled = false;
    } else {
        confirmBtn.disabled = true;
    }
}

verifyEmailInput.addEventListener('input', checkVerification);
verifyTextInput.addEventListener('input', checkVerification);

// 4. Execute Deletion
confirmBtn.addEventListener('click', async () => {
    confirmBtn.textContent = "Deleting...";
    confirmBtn.disabled = true;
    
    // Call the secure SQL function we created in Step 1
    const { error } = await supabaseClient.rpc('delete_user_account');
    
    if (error) {
        alert("Error deleting account: " + error.message);
        confirmBtn.textContent = "Permanently Delete";
        checkVerification();
    } else {
        // Success! Sign out and redirect
        await supabaseClient.auth.signOut();
        alert("Your account has been permanently deleted. We're sorry to see you go!");
        window.location.href = 'index.html';
    }
});

initProfile();

// ============================================================
// WEB PUSH NOTIFICATIONS (Must be here so profile.html can use it)
// ============================================================
const VAPID_PUBLIC_KEY = 'BKgo8QjvQAaqLXEFKSpmAfzT_7xKmd-ESOdsopst8OOxaRS885IErzXObhEkk2RfsHa824t_gg-MSKSjBm0qXyc';

function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}

async function subscribeToPush() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        return alert("Push notifications are not supported on this browser.");
    }
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) return alert("Please log in first to enable notifications.");

    try {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
        });

        const { error } = await supabaseClient.from('push_subscriptions').insert([{
            user_id: session.user.id,
            subscription: subscription
        }]);

        if (error) {
            if (error.message.includes('duplicate key')) alert("✅ Push Notifications are already enabled for this device.");
            else alert("Failed to save subscription: " + error.message);
        } else {
            alert("✅ Push Notifications Enabled! You will now get alerts.");
        }

    } catch (error) {
        console.error('Push subscription failed:', error);
        alert("Could not enable notifications: " + error.message);
    }
}

let currentUser = null;

async function initProfile() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) { window.location.href = 'auth.html'; return; }
    
    currentUser = session.user;
    const email = currentUser.email;
    const name = email.split('@')[0];
    
    document.getElementById('profileName').textContent = name;
    document.getElementById('profileEmail').textContent = email;
    document.getElementById('avatarLetter').textContent = name.charAt(0).toUpperCase();

    await fetchWallets();
}

async function fetchWallets() {
    const container = document.getElementById('walletsContainer');
    
    // 1. Fetch the wallets WITHOUT joining the restaurants table (avoids RLS errors)
    const { data: wallets, error } = await supabaseClient
        .from('loyalty_wallets')
        .select('coins, restaurant_id')
        .eq('user_id', currentUser.id);

    if (error) {
        console.error("Wallet Fetch Error:", error);
        container.innerHTML = `<p style="color:red; font-size:0.9rem;">Database Error: ${error.message}</p>`;
        return;
    }

    if (!wallets || wallets.length === 0) {
        container.innerHTML = `<p style="color: #94A3B8; font-size: 0.9rem; text-align:center;">You haven't earned any coins yet. Place an order to start earning!</p>`;
        return;
    }

    // 2. Get the names of the restaurants for those wallets
    const restIds = wallets.map(w => w.restaurant_id);
    const { data: restaurants } = await supabaseClient
        .from('restaurants')
        .select('id, name')
        .in('id', restIds);

    container.innerHTML = '';
    wallets.forEach(wallet => {
        // Find the restaurant name, or show a fallback
        const rest = restaurants?.find(r => r.id === wallet.restaurant_id);
        const restName = rest ? rest.name : 'Unknown Restaurant';
        
        container.innerHTML += `
            <div class="wallet-item">
                <strong>📍 ${restName}</strong>
                <span class="wallet-coins">${wallet.coins} Coins</span>
            </div>
        `;
    });
}

// --- MODAL FLOW ---
window.openWalletModal = function() {
    document.getElementById('walletModal').classList.add('open');
    fetchWallets(); // Refresh coins every time they open it!
};

window.openSettingsModal = function() {
    document.getElementById('walletModal').classList.remove('open');
    document.getElementById('settingsModal').classList.add('open');
};

window.openDeleteModal = function() {
    document.getElementById('settingsModal').classList.remove('open');
    document.getElementById('deleteModal').classList.add('open');
};

// Delete Account Logic
const verifyEmailInput = document.getElementById('verifyEmail');
const verifyTextInput = document.getElementById('verifyText');
const confirmBtn = document.getElementById('confirmDeleteBtn');

document.getElementById('cancelDeleteBtn').addEventListener('click', () => {
    document.getElementById('deleteModal').classList.remove('open');
    document.getElementById('settingsModal').classList.add('open');
});

function checkVerification() {
    const emailMatch = verifyEmailInput.value.trim().toLowerCase() === currentUser.email.toLowerCase();
    const textMatch = verifyTextInput.value.trim() === 'DELETE';
    confirmBtn.disabled = !(emailMatch && textMatch);
}

verifyEmailInput.addEventListener('input', checkVerification);
verifyTextInput.addEventListener('input', checkVerification);

confirmBtn.addEventListener('click', async () => {
    confirmBtn.textContent = "Deleting...";
    confirmBtn.disabled = true;
    
    const { error } = await supabaseClient.rpc('delete_user_account');
    
    if (error) {
        alert("Error deleting account: " + error.message);
        confirmBtn.textContent = "Permanently Delete";
        checkVerification();
    } else {
        await supabaseClient.auth.signOut();
        alert("Your account has been permanently deleted.");
        window.location.href = 'index.html';
    }
});

initProfile();

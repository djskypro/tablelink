const searchInput = document.getElementById('searchInput');
const nearMeBtn = document.getElementById('nearMeBtn');
const restaurantGrid = document.getElementById('restaurantGrid');
const emptyState = document.getElementById('emptyState');
const cartToggleBtn = document.getElementById('cartToggleBtn');
const cartPanel = document.getElementById('cartPanel');
const cartOverlay = document.getElementById('cartOverlay');
const closeCartBtn = document.getElementById('closeCartBtn');
const cartItemsContainer = document.getElementById('cartItems');
const cartBadge = document.getElementById('cartBadge');
const cartTotalAmount = document.getElementById('cartTotalAmount');
const checkoutBtn = document.getElementById('checkoutBtn');

let cart = [];
let liveMenuItems = [];
let myMap = null;
const urlParams = new URLSearchParams(window.location.search);
const restIdFromUrl = urlParams.get('restaurant');

function toggleCart(open) {
    if (open) { cartPanel.classList.add('open'); cartOverlay.classList.add('open'); } 
    else { cartPanel.classList.remove('open'); cartOverlay.classList.remove('open'); }
}

window.addToCart = function(id, name, priceStr, restaurantName, btnElement) {
    const item = liveMenuItems.find(i => i.id === id);
    if (!item || !item.is_available) return; 
    const price = parseInt(priceStr.replace(/[^0-9]/g, ''), 10);
    const existingItem = cart.find(item => item.id === id);
    if (existingItem) existingItem.qty += 1;
    else cart.push({ id, name, price, restaurantName, qty: 1 });
    renderCart(); 
    if (btnElement) {
        const originalText = btnElement.innerHTML;
        btnElement.innerHTML = "✅ Added!";
        btnElement.style.background = "#2a9d8f"; btnElement.style.color = "white";
        btnElement.disabled = true;
        setTimeout(() => { btnElement.innerHTML = originalText; btnElement.style.background = ""; btnElement.style.color = ""; btnElement.disabled = false; }, 1500);
    }
};

window.removeFromCart = function(index) { cart.splice(index, 1); renderCart(); };

function renderCart() {
    const totalItems = cart.reduce((sum, item) => sum + item.qty, 0);
    if (cartBadge) cartBadge.textContent = totalItems;
    if (cartBadge) cartBadge.style.display = totalItems > 0 ? 'flex' : 'none';
    if (cart.length === 0) {
        cartItemsContainer.innerHTML = '<p style="color:var(--text-muted);text-align:center;margin-top:20px;">Your cart is empty.</p>';
        cartTotalAmount.textContent = 'UGX 0'; return;
    }
    let totalPrice = 0;
    cartItemsContainer.innerHTML = '';
    cart.forEach((item, index) => {
        totalPrice += item.price * item.qty;
        cartItemsContainer.innerHTML += `
            <div class="cart-item">
                <div><h4>${item.qty}x ${item.name}</h4><p class="cart-item-price">${item.restaurantName}</p></div>
                <div style="display:flex; align-items:center; gap:10px;">
                    <span style="font-size:0.85rem; font-weight:600;">UGX ${(item.price * item.qty).toLocaleString()}</span>
                    <button class="remove-item-btn" onclick="removeFromCart(${index})">✕</button>
                </div>
            </div>`;
    });
    cartTotalAmount.textContent = `UGX ${totalPrice.toLocaleString()}`;
}

if (cartToggleBtn) cartToggleBtn.addEventListener('click', () => toggleCart(true));
if (closeCartBtn) closeCartBtn.addEventListener('click', () => toggleCart(false));
if (cartOverlay) cartOverlay.addEventListener('click', () => toggleCart(false));
async function fetchLiveMenu() {
    let query = supabaseClient.from('menu_items').select(`*, restaurants ( name, location, cuisine, latitude, longitude, wait_time_mins, subscription_tier )`);
    if (restIdFromUrl) { 
        query = query.eq('restaurant_id', restIdFromUrl); 
        if (searchInput) searchInput.style.display = 'none'; 
        if (nearMeBtn) nearMeBtn.style.display = 'none';
    }
    const { data, error } = await query;
    if (error) { restaurantGrid.innerHTML = `<p style="color:red;">${error.message}</p>`; return; }
    liveMenuItems = data;
    
    if (restIdFromUrl && data.length > 0) {
        const restName = data[0].restaurants.name;
        const tier = data[0].restaurants.subscription_tier || 'free';
        const header = document.querySelector('.section-header h2');
        if (header) header.textContent = `Welcome to ${restName}`;
        const exploreBtn = document.getElementById('exploreAllBtn');
        if (exploreBtn) exploreBtn.style.display = 'inline-block';
        const brand = document.querySelector('.brand');
        if (brand) brand.innerHTML = `🍽️ TABLELINK <span style="font-size:0.8rem; color:#e85d04; background:#fff0e6; padding:4px 8px; border-radius:6px; margin-left:8px; vertical-align:middle;">${restName}</span>`;
        const actionButtons = document.getElementById('customerActionButtons');
        if (actionButtons) {
            if (tier === 'vip' || tier === 'vvip') actionButtons.style.display = 'flex';
            else actionButtons.style.display = 'none';
        }
    }
    renderMenu(liveMenuItems);
}

function generateStars(rating) { let starsHtml = ''; for (let i = 1; i <= 5; i++) starsHtml += i <= Math.round(rating) ? '★' : '☆'; return starsHtml; }

function renderMenu(items) {
    restaurantGrid.innerHTML = '';
    if (items.length === 0) { emptyState.style.display = 'block'; return; }
    emptyState.style.display = 'none';

    items.forEach(item => {
        const isSoldOut = !item.is_available;
        const card = document.createElement('div');
        card.className = `restaurant-card ${isSoldOut ? 'sold-out' : ''}`;
        const restName = item.restaurants?.name || 'Unknown Restaurant';
        const restLoc = item.restaurants?.location || 'Kampala';
        const imgUrl = item.image_url || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600&h=400&fit=crop&q=80';
        const avgRating = item.average_rating ? Number(item.average_rating).toFixed(1) : "0.0";
        const ratingCount = item.rating_count || 0;
        const lat = item.restaurants?.latitude || null;
        const lng = item.restaurants?.longitude || null;
        const waitMins = item.restaurants?.wait_time_mins || 0;
        const waitBadge = waitMins > 0 ? `<span style="background:#fee2e2; color:#dc2626; padding:2px 8px; border-radius:10px; font-size:0.75rem; font-weight:bold; margin-left:8px;">⏱️ ${waitMins} min wait</span>` : `<span style="background:#dcfce7; color:#166534; padding:2px 8px; border-radius:10px; font-size:0.75rem; font-weight:bold; margin-left:8px;">✅ No Wait</span>`;
        
        let distanceHtml = '';
        if (item.distance !== undefined && item.distance !== null) { distanceHtml = `<span style="background:#e0f2fe; color:#0369a1; padding:2px 8px; border-radius:10px; font-size:0.75rem; font-weight:bold; margin-left:8px;">📍 ${item.distance.toFixed(1)} km away</span>`; }
        
        const stampHtml = isSoldOut ? `<div class="sold-out-stamp">SOLD OUT</div>` : '';
        const buttonHtml = isSoldOut ? `<button class="add-btn disabled-btn">Sold Out</button>` : `<button class="add-btn" onclick="addToCart('${item.id}', '${item.name}', '${item.price_ugx}', '${restName}', this)">+ Add to Cart</button>`;

        card.innerHTML = `
            <div class="card-image" style="background-image: url('${imgUrl}')">
                ${stampHtml}
                <span class="card-badge">${item.restaurants?.cuisine || 'Food'}</span>
            </div>
            <div class="card-body">
                <h3>${item.name} ${waitBadge} ${distanceHtml}</h3>
                <div style="margin: 4px 0;"><span class="display-stars" style="color:#fbbf24; font-size:0.9rem;">${generateStars(avgRating)}</span><span class="rating-text" style="font-size:0.8rem; color:#6b6b6b;">(${avgRating} • ${ratingCount})</span></div>
                <p class="card-cuisine">${restName} • ${restLoc}</p>
                <p class="card-signature">🍴 ${item.description || 'Delicious meal'}</p>
                <div class="card-meta"><span style="font-size:1.1rem; font-weight:700; color:#e85d04;">UGX ${item.price_ugx.toLocaleString()}</span></div>
                ${buttonHtml}
                <button class="rate-btn" onclick="openRatingModal('${item.id}')">⭐ Rate this dish</button>
                <button class="view-map-btn" onclick="openMap(${lat}, ${lng}, '${restName}')">🗺️ View Exact Location</button>
            </div>
        `;
        restaurantGrid.appendChild(card);
    });
}

if (searchInput) {
    searchInput.addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase();
        renderMenu(liveMenuItems.filter(item => item.name.toLowerCase().includes(term) || (item.restaurants?.name || '').toLowerCase().includes(term)));
    });
}
if (nearMeBtn) {
    nearMeBtn.addEventListener('click', () => {
        nearMeBtn.innerHTML = "📍 Locating..."; nearMeBtn.style.background = "#e85d04";
        if (!navigator.geolocation) return alert("Geolocation is not supported by your browser.");
        navigator.geolocation.getCurrentPosition((position) => {
            const userLat = position.coords.latitude; const userLng = position.coords.longitude;
            nearMeBtn.innerHTML = "📍 Sorted by Nearest"; nearMeBtn.style.background = "#10b981";
            liveMenuItems.forEach(item => {
                if(!item.restaurants?.latitude || !item.restaurants?.longitude) item.distance = null;
                else {
                    const R = 6371; const dLat = (item.restaurants.latitude - userLat) * Math.PI / 180; const dLon = (item.restaurants.longitude - userLng) * Math.PI / 180;
                    const a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(userLat * Math.PI / 180) * Math.cos(item.restaurants.latitude * Math.PI / 180) * Math.sin(dLon/2) * Math.sin(dLon/2);
                    item.distance = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
                }
            });
            const sorted = [...liveMenuItems].sort((a, b) => { if (a.distance === null) return 1; if (b.distance === null) return -1; return a.distance - b.distance; });
            renderMenu(sorted);
        }, (error) => { alert("Could not get your location."); nearMeBtn.innerHTML = "📍 Near Me"; nearMeBtn.style.background = "#1e293b"; });
    });
}
window.openRatingModal = function(itemId) {
    const item = liveMenuItems.find(i => i.id === itemId);
    if (!item) return;
    const modal = document.getElementById('ratingModal');
    const nameEl = document.getElementById('ratingDishName');
    if (nameEl) nameEl.textContent = item.name;
    const textEl = document.getElementById('reviewText'); if (textEl) textEl.value = '';
    document.querySelectorAll('.star').forEach(s => s.classList.remove('active')); 
    if (modal) modal.classList.add('open');
    window.currentRatingId = itemId;
};

const closeRatingBtn = document.getElementById('closeRatingBtn');
if (closeRatingBtn) closeRatingBtn.addEventListener('click', () => { const m = document.getElementById('ratingModal'); if (m) m.classList.remove('open'); });

let selectedRating = 0;
document.querySelectorAll('.star').forEach(star => { star.addEventListener('click', (e) => { selectedRating = parseInt(e.target.dataset.value); document.querySelectorAll('.star').forEach(s => { if (parseInt(s.dataset.value) <= selectedRating) s.classList.add('active'); else s.classList.remove('active'); }); }); });

const submitRatingBtn = document.getElementById('submitRatingBtn');
if (submitRatingBtn) {
    submitRatingBtn.addEventListener('click', async () => {
        if (selectedRating === 0) return alert("Please tap a star to rate!");
        const { data: { session } } = await supabaseClient.auth.getSession();
        if (!session) { alert("Please log in to rate this dish."); window.location.href = 'auth.html'; return; }
        submitRatingBtn.textContent = "Submitting..."; submitRatingBtn.disabled = true;
        const textEl = document.getElementById('reviewText'); const text = textEl ? textEl.value.trim() : '';
        const { error } = await supabaseClient.from('menu_item_reviews').upsert([{ menu_item_id: window.currentRatingId, customer_id: session.user.id, rating: selectedRating, review_text: text }], { onConflict: 'menu_item_id, customer_id' });
        if (error) alert("Error: " + error.message); else { const m = document.getElementById('ratingModal'); if (m) m.classList.remove('open'); fetchLiveMenu(); }
        submitRatingBtn.textContent = "Submit Rating"; submitRatingBtn.disabled = false;
    });
}

window.openMap = function(lat, lng, restName) {
    if (!lat || !lng) return alert("This restaurant hasn't pinned their exact GPS location yet.");
    const mapName = document.getElementById('mapRestaurantName'); if (mapName) mapName.textContent = `📍 ${restName}`;
    const mapM = document.getElementById('mapModal'); if (mapM) mapM.classList.add('open');
    const navBtn = document.getElementById('googleMapsNavBtn'); if (navBtn) navBtn.href = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
    setTimeout(() => {
        if (myMap) myMap.remove(); 
        const container = document.getElementById('mapContainer'); if (!container) return;
        myMap = L.map('mapContainer', { zoomControl: true }).setView([parseFloat(lat), parseFloat(lng)], 16);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '&copy; OpenStreetMap', maxZoom: 19 }).addTo(myMap);
        L.marker([parseFloat(lat), parseFloat(lng)]).addTo(myMap).bindPopup(`<b>${restName}</b>`).openPopup();
        setTimeout(() => { myMap.invalidateSize(); }, 100);
    }, 300); 
};

const closeMapBtn = document.getElementById('closeMapBtn');
if (closeMapBtn) closeMapBtn.addEventListener('click', () => { const mapM = document.getElementById('mapModal'); if (mapM) mapM.classList.remove('open'); if (myMap) { myMap.remove(); myMap = null; } });

// --- BOOKING LOGIC ---
const bookTableBtn = document.getElementById('bookTableBtn');
const reservationModal = document.getElementById('reservationModal');
const closeReservationBtn = document.getElementById('closeReservationBtn');

if (bookTableBtn && reservationModal) {
    bookTableBtn.addEventListener('click', async () => {
        reservationModal.classList.add('open');
        const select = document.getElementById('resRestaurant');
        if (!select) return;
        if (restIdFromUrl) {
            select.style.display = 'none'; 
            const dd = document.getElementById('resDropdownLabel'); if(dd) dd.style.display = 'none'; 
            const ld = document.getElementById('lockedRestaurantDisplay'); if(ld) ld.style.display = 'block';
            const { data } = await supabaseClient.from('restaurants').select('name').eq('id', restIdFromUrl).single();
            if (data) { const ln = document.getElementById('lockedRestaurantName'); if(ln) ln.textContent = data.name; }
        } else {
            select.style.display = 'block'; 
            const dd = document.getElementById('resDropdownLabel'); if(dd) dd.style.display = 'block'; 
            const ld = document.getElementById('lockedRestaurantDisplay'); if(ld) ld.style.display = 'none';
            select.innerHTML = '<option value="">Loading...</option>';
            const { data, error } = await supabaseClient.from('restaurants').select('id, name, location').eq('is_active', true);
            if (error || !data || data.length === 0) { select.innerHTML = '<option value="">No restaurants available</option>'; return; }
            select.innerHTML = '<option value="">Select a restaurant...</option>';
            data.forEach(rest => { select.innerHTML += `<option value="${rest.id}">${rest.name} (${rest.location})</option>`; });
        }
    });
}

if (closeReservationBtn) closeReservationBtn.addEventListener('click', () => { if(reservationModal) reservationModal.classList.remove('open'); });

const submitReservationBtn = document.getElementById('submitReservationBtn');
if (submitReservationBtn) {
    submitReservationBtn.addEventListener('click', async () => {
        let restaurantId = restIdFromUrl;
        const select = document.getElementById('resRestaurant');
        if (!restaurantId && select) restaurantId = select.value;
        const dateEl = document.getElementById('resDate'); const timeEl = document.getElementById('resTime'); const partyEl = document.getElementById('resPartySize'); const reqEl = document.getElementById('resRequests');
        const date = dateEl ? dateEl.value : ''; const time = timeEl ? timeEl.value : ''; const partySize = partyEl ? partyEl.value : ''; const requests = reqEl ? reqEl.value : '';
        if (!restaurantId || !date || !time || !partySize) return alert("Please fill in all the required fields.");
        const { data: { session } } = await supabaseClient.auth.getSession();
        if (!session) { alert("Please log in to book a table."); window.location.href = 'auth.html'; return; }
        submitReservationBtn.textContent = "Booking..."; submitReservationBtn.disabled = true;
        const { error } = await supabaseClient.from('reservations').insert([{ restaurant_id: restaurantId, customer_id: session.user.id, reservation_date: date, reservation_time: time, party_size: parseInt(partySize), special_requests: requests, status: 'pending' }]);
        if (error) alert("Error booking table: " + error.message);
        else { alert("🎉 Table booked successfully!"); if (reservationModal) reservationModal.classList.remove('open'); if(dateEl) dateEl.value = ''; if(timeEl) timeEl.value = ''; if(partyEl) partyEl.value = '2'; if(reqEl) reqEl.value = ''; }
        submitReservationBtn.textContent = "Confirm Booking"; submitReservationBtn.disabled = false;
    });
}

// --- CHECKOUT ---
if (checkoutBtn) {
    checkoutBtn.addEventListener('click', async (e) => {
        e.preventDefault(); 
        if (cart.length === 0) return alert("Your cart is empty!");
        const originalText = checkoutBtn.textContent; checkoutBtn.textContent = "Processing..."; checkoutBtn.disabled = true;
        const { data: { session } } = await supabaseClient.auth.getSession();
        if (!session) { alert("Please log in to place an order."); window.location.href = 'auth.html'; return; }
        let custLat = null, custLng = null;
        try { const pos = await new Promise((resolve, reject) => { navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 }); }); custLat = pos.coords.latitude; custLng = pos.coords.longitude; } catch (e) { console.log("Location denied."); }
        let targetRestId = restIdFromUrl;
        if (!targetRestId) { const { data: menuItem } = await supabaseClient.from('menu_items').select('restaurant_id').eq('id', cart[0].id).single(); if (menuItem) targetRestId = menuItem.restaurant_id; }
        if (!targetRestId) { alert("Error: Could not find restaurant."); checkoutBtn.textContent = originalText; checkoutBtn.disabled = false; return; }
        const total = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
        const { data: orderData, error: orderError } = await supabaseClient.from('orders').insert([{ restaurant_id: targetRestId, customer_id: session.user.id, total_ugx: total, status: 'pending', payment_status: 'unpaid', customer_latitude: custLat, customer_longitude: custLng }]).select();
        if (orderError) { alert("Failed: " + orderError.message); checkoutBtn.textContent = originalText; checkoutBtn.disabled = false; return; }
        const newOrderId = orderData[0].id;
        await supabaseClient.from('order_items').insert(cart.map(item => ({ order_id: newOrderId, menu_item_id: item.id, quantity: item.qty, unit_price_ugx: item.price })));
        if (window.showToast) window.showToast('Order Placed! 🎉', 'Check "My Orders" in the top menu to see your ticket.'); else alert("🎉 Order placed successfully!");
        cart = []; renderCart(); toggleCart(false);
        checkoutBtn.textContent = originalText; checkoutBtn.disabled = false;
    });
}

window.callWaiter = async function(type) {
    if (!restIdFromUrl) return alert("You must be inside a restaurant to use this feature.");
    let tableNumber = prompt("What is your Table Number?");
    if (!tableNumber) return;
    try {
        const { error } = await supabaseClient.from('waiter_calls').insert([{ restaurant_id: restIdFromUrl, table_number: tableNumber, request_type: type, status: 'pending' }]);
        if (error) throw error;
        if (window.showToast) window.showToast('Request Sent! 🛎️', `Your waiter has been notified for Table ${tableNumber}.`); else alert(`✅ Request sent! Waiter is on the way to Table ${tableNumber}.`);
    } catch (error) { alert("Error sending request: " + error.message); }
}

// --- NAVBAR & INIT ---
async function updateNavbar() {
    const navLinks = document.querySelector('.nav-links');
    if (!navLinks || typeof supabaseClient === 'undefined') return;
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (session) {
        const restQuery = restIdFromUrl ? `?restaurant=${restIdFromUrl}` : '';
        navLinks.innerHTML = `
            <a href="group-dining.html${restQuery}" style="color:#e85d04; font-weight:bold; font-size:0.85rem;">Groups</a>
            <a href="my-orders.html${restQuery}" style="color:#e85d04; font-weight:bold; font-size:0.85rem;">Orders</a>
            <a href="my-reservations.html${restQuery}" style="color:#e85d04; font-weight:bold; font-size:0.85rem;">Bookings</a>
            <a href="profile.html${restQuery}" class="btn-outline" id="accountLink" style="font-size:0.85rem; text-decoration: none;">${session.user.email.split('@')[0]}</a>
            <a href="#" id="logoutLink" style="color:#6b6b6b; font-weight:600; font-size: 0.85rem;">Logout</a>
        `;
        const logoutBtn = document.getElementById('logoutLink');
        if (logoutBtn) logoutBtn.addEventListener('click', async (e) => { e.preventDefault(); await supabaseClient.auth.signOut(); window.location.reload(); });
    }
}

let adminTapCount = 0; let adminTapTimer;
document.addEventListener('DOMContentLoaded', () => {
    const secretBtn = document.getElementById('secretAdminBtn');
    if (secretBtn) {
        secretBtn.addEventListener('click', () => {
            adminTapCount++;
            if (adminTapCount === 5) { if (navigator.vibrate) navigator.vibrate(200); window.location.href = 'admin.html'; adminTapCount = 0; return; }
            clearTimeout(adminTapTimer); adminTapTimer = setTimeout(() => { adminTapCount = 0; }, 2000);
        });
    }
});

fetchLiveMenu(); updateNavbar(); renderCart();

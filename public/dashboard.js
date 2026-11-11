let currentUser = null;
let myRestaurant = null;
let myCategoryId = null;
let html5QrCode = null;
let gpsMap = null;
let gpsMarker = null;

window.switchTab = function(tabId, btnElement) {
    document.querySelectorAll('.tab-section').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.dash-nav-item, .nav-item').forEach(el => el.classList.remove('active'));
    document.getElementById(`tab-${tabId}`).classList.add('active');
    if (btnElement) btnElement.classList.add('active');

    const titles = { overview: 'Overview', orders: 'Live Orders', scanner: 'Scan Ticket', reservations: 'Table Bookings', menu: 'Menu Manager', analytics: 'Analytics', reviews: 'Customer Reviews', qrcode: 'My QR Code', requests: 'Table Requests' };
    document.getElementById('page-title').textContent = titles[tabId];

    if (tabId !== 'scanner' && html5QrCode) { html5QrCode.stop().then(() => { html5QrCode = null; }).catch(err => console.log(err)); }

    if (tabId === 'menu') fetchMenuItems();
    if (tabId === 'reviews') fetchReviews();
    if (tabId === 'reservations') fetchReservations();
    
    if (tabId === 'requests') {
        const tier = myRestaurant.subscription_tier || 'free';
        if (tier === 'free') {
            document.getElementById('requests-container').innerHTML = `
                <div style="text-align: center; padding: 40px;">
                    <div style="font-size: 4rem; margin-bottom: 20px;">🔒</div>
                    <h3 style="color: #1e293b;">VIP Feature Locked</h3>
                    <p style="color: #64748b; margin-bottom: 20px;">Upgrade to VIP to let customers call waiters and request bills from their phones.</p>
                    <button onclick="window.location.href='payment.html'" class="btn-primary" style="max-width: 200px; margin: 0 auto;">Upgrade Now</button>
                </div>`;
        } else {
            fetchRequests();
        }
    }

    if (tabId === 'analytics') {
        const tier = myRestaurant.subscription_tier || 'free';
        if (tier === 'free') {
            document.getElementById('analyticsContent').innerHTML = `
                <div style="text-align: center; padding: 40px; background: white; border-radius: 16px; box-shadow: 0 4px 15px rgba(0,0,0,0.05);">
                    <div style="font-size: 4rem; margin-bottom: 20px;">🔒</div>
                    <h3 style="color: #1e293b;">VIP Feature Locked</h3>
                    <p style="color: #64748b; margin-bottom: 20px;">Upgrade to VIP to unlock your business analytics, top-selling dishes, and revenue charts.</p>
                    <button onclick="window.location.href='payment.html'" class="btn-primary" style="max-width: 200px; margin: 0 auto;">Upgrade Now</button>
                </div>`;
        } else {
            fetchAnalytics();
        }
    }

    if (tabId === 'scanner') startScanner();
    if (tabId === 'qrcode' && myRestaurant) {
        const baseUrl = window.location.origin; 
        const restaurantUrl = `${baseUrl}/index.html?restaurant=${myRestaurant.id}`;
        document.getElementById('qrImage').src = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(restaurantUrl)}`;
        document.getElementById('qrLinkText').textContent = restaurantUrl;
    }
};

async function initDashboard() {
    try {
        const { data: { session } } = await supabaseClient.auth.getSession();
        if (!session) return window.location.href = 'restaurant-auth.html';
        currentUser = session.user;
        document.getElementById('owner-name').textContent = currentUser.email;

        const { data: restaurants } = await supabaseClient.from('restaurants').select('*').eq('owner_id', currentUser.id);
        document.getElementById('loading-section').style.display = 'none';

        if (!restaurants || restaurants.length === 0) {
            document.getElementById('setup-section').style.display = 'block';
        } else {
            myRestaurant = restaurants[0];
            document.getElementById('dashboard-section').style.display = 'block';

            const { data: categories } = await supabaseClient.from('menu_categories').select('id').eq('restaurant_id', myRestaurant.id).limit(1);
            if (categories && categories.length > 0) myCategoryId = categories[0].id;
            else {
                const { data: newCat } = await supabaseClient.from('menu_categories').insert([{ restaurant_id: myRestaurant.id, name: 'Main Menu' }]).select();
                if (newCat) myCategoryId = newCat[0].id;
            }
            fetchOrders();
            listenToNewOrders();
            fetchRequests();
            listenToNewRequests();
        }
    } catch (error) {
        document.getElementById('loading-section').innerHTML = `<h2 style="color:red;">Error: ${error.message}</h2>`;
    }
}

document.getElementById('create-restaurant-btn').addEventListener('click', async () => {
    const name = document.getElementById('setup-name').value.trim();
    const cuisine = document.getElementById('setup-cuisine').value.trim();
    const location = document.getElementById('setup-location').value.trim();
    if (!name || !cuisine) return alert("Please fill in name and cuisine.");
    const { error } = await supabaseClient.from('restaurants').insert([{ owner_id: currentUser.id, name, cuisine, location, is_active: true, is_visible: true }]);
    if (error) alert(error.message); else window.location.reload();
});

window.updateWaitTime = async function(mins, btnElement) {
    if (!myRestaurant) return alert("Create your restaurant first!");
    document.querySelectorAll('.wait-btn').forEach(b => b.classList.remove('active'));
    btnElement.classList.add('active');
    const { error } = await supabaseClient.from('restaurants').update({ wait_time_mins: mins }).eq('id', myRestaurant.id);
    if (error) { alert("Error: " + error.message); btnElement.classList.remove('active'); }
};

document.getElementById('update-gps-btn').addEventListener('click', function() {
    if (!myRestaurant) return alert("Create your restaurant first!");
    let startLat = myRestaurant.latitude || 0.3476;
    let startLng = myRestaurant.longitude || 32.5825;
    openGpsMap(startLat, startLng);
});

function openGpsMap(lat, lng) {
    document.getElementById('gpsModal').classList.add('open');
    setTimeout(() => {
        if (gpsMap) gpsMap.remove();
        gpsMap = L.map('gpsMapContainer').setView([lat, lng], 16);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '&copy; OpenStreetMap' }).addTo(gpsMap);
        gpsMarker = L.marker([lat, lng], { draggable: true }).addTo(gpsMap);
        gpsMarker.bindPopup("<b>Drag me to the exact spot!</b>").openPopup();
        setTimeout(() => { gpsMap.invalidateSize(); }, 200);
    }, 300);
}

window.closeGpsModal = function() {
    document.getElementById('gpsModal').classList.remove('open');
    if (gpsMap) { gpsMap.remove(); gpsMap = null; }
};

window.searchGpsLocation = async function() {
    const query = document.getElementById('gpsSearchInput').value;
    if (!query) return;
    try {
        const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`);
        const data = await response.json();
        if (data && data.length > 0) {
            const lat = parseFloat(data[0].lat);
            const lon = parseFloat(data[0].lon);
            gpsMap.flyTo([lat, lon], 17);
            gpsMarker.setLatLng([lat, lon]);
        } else {
            alert("Location not found. Try a different search term.");
        }
    } catch (error) { alert("Error searching for location."); }
};

window.useCurrentLocation = function() {
    if (!navigator.geolocation) return alert("Geolocation is not supported by your browser.");
    navigator.geolocation.getCurrentPosition((position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        gpsMap.flyTo([lat, lng], 17);
        gpsMarker.setLatLng([lat, lng]);
    }, (error) => { alert("Could not get your current location. Please ensure location permissions are allowed."); });
};

window.saveConfirmedLocation = async function() {
    if (!gpsMarker) return;
    const finalPosition = gpsMarker.getLatLng();
    const btn = document.querySelector('#gpsModal .btn-primary');
    btn.textContent = "Saving..."; btn.disabled = true;
    const { error } = await supabaseClient.from('restaurants').update({ latitude: finalPosition.lat, longitude: finalPosition.lng }).eq('id', myRestaurant.id);
    if (error) { alert("Error saving location: " + error.message); btn.textContent = "✅ Confirm Location"; btn.disabled = false; } 
    else {
        alert("✅ Location successfully saved! Customers will now be directed to this exact spot.");
        myRestaurant.latitude = finalPosition.lat; myRestaurant.longitude = finalPosition.lng;
        closeGpsModal();
        btn.textContent = "✅ Confirm Location"; btn.disabled = false;
    }
};

function startScanner() {
    document.getElementById('scanResult').style.display = 'none';
    document.getElementById('reader').style.display = 'block';
    if (!html5QrCode) html5QrCode = new Html5Qrcode("reader");
    const config = { fps: 10, qrbox: { width: 250, height: 250 } };
    html5QrCode.start({ facingMode: "environment" }, config, onScanSuccess)
    .catch(err => { document.getElementById('reader').innerHTML = `<p style="color:red; padding:20px; text-align:center;">Camera Error: ${err}. Please allow camera permissions.</p>`; });
}

function onScanSuccess(decodedText, decodedResult) {
    html5QrCode.pause(true);
    if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
    fetchScannedOrder(decodedText);
}

async function fetchScannedOrder(orderId) {
    try {
        const { data: order, error } = await supabaseClient.from('orders').select('*, order_items(*, menu_items(name))').eq('id', orderId).eq('restaurant_id', myRestaurant.id).single();
        if (error || !order) { alert("❌ Invalid Ticket."); html5QrCode.resume(); return; }
        document.getElementById('reader').style.display = 'none';
        document.getElementById('scanResult').style.display = 'block';
        const shortCode = order.id.split('-')[0].toUpperCase();
        document.getElementById('scanOrderCode').textContent = `#${shortCode}`;
        document.getElementById('scanOrderTotal').textContent = `UGX ${order.total_ugx.toLocaleString()}`;
        let itemsHtml = '';
        order.order_items.forEach(item => {
            itemsHtml += `<div style="display:flex; justify-content:space-between; margin-bottom:8px; border-bottom:1px solid var(--border); padding-bottom:8px;"><span><strong>${item.quantity}x</strong> ${item.menu_items?.name}</span><span>UGX ${(item.quantity * item.unit_price_ugx).toLocaleString()}</span></div>`;
        });
        document.getElementById('scanOrderItems').innerHTML = itemsHtml;
    } catch (err) { console.error(err); alert("Error verifying ticket."); html5QrCode.resume(); }
}

window.resetScanner = function() {
    document.getElementById('scanResult').style.display = 'none';
    document.getElementById('reader').style.display = 'block';
    if (html5QrCode) html5QrCode.resume();
};

async function fetchOrders() {
    if (!myRestaurant) return;
    const { data, error } = await supabaseClient.from('orders').select('*, order_items(*, menu_items(name))').eq('restaurant_id', myRestaurant.id).order('created_at', { ascending: false });
    const container = document.getElementById('orders-container');
    container.innerHTML = ''; 
    if (error) { container.innerHTML = `<p style="color:red;">Database Error: ${error.message}</p>`; return; }
    let revenue = 0; let activeCount = 0;
    if (!data || data.length === 0) container.innerHTML = '<p style="color:var(--text-muted); text-align:center; padding:40px;">No orders yet.</p>';
    data?.forEach(order => {
        revenue += order.total_ugx; if (order.status === 'pending') activeCount++;
        const time = new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        let itemsList = order.order_items.map(i => `${i.quantity}x ${i.menu_items?.name || 'Item'}`).join(', ');
        const mapBtnHtml = order.customer_latitude ? `<button style="background:#38bdf8; color:white; border:none; padding:8px 12px; border-radius:8px; font-weight:700; cursor:pointer; margin-top:10px; font-size:0.85rem;" onclick="window.open('https://www.google.com/maps/dir/?api=1&destination=${order.customer_latitude},${order.customer_longitude}', '_blank')">📍 View Customer Location</button>` : '';
        let actionHtml = '';
        if (order.status === 'pending') { actionHtml = `<button class="btn-accept" onclick="updateOrderStatus('${order.id}', 'accepted')">Accept Order</button>`; }
        else if (order.status === 'accepted') { actionHtml = `<div style="font-size:0.75rem; font-weight:700; margin-bottom:5px; color:var(--text-muted); text-transform:uppercase;">Set Prep Time:</div><div style="display:flex; gap:5px;"><button class="prep-btn" onclick="setPrepTime('${order.id}', 10)">10m</button><button class="prep-btn" onclick="setPrepTime('${order.id}', 20)">20m</button><button class="prep-btn" onclick="setPrepTime('${order.id}', 30)">30m</button></div>`; }
        else if (order.status === 'preparing') { actionHtml = `<button class="btn-accept" style="background:#3b82f6;" onclick="updateOrderStatus('${order.id}', 'ready')">✅ Mark Ready</button>`; }
        let etaText = '';
        if (order.estimated_ready_at && order.status === 'preparing') { const eta = new Date(order.estimated_ready_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); etaText = `<p style="color:#3b82f6; font-weight:700; font-size:0.85rem;">⏱️ Ready by ${eta}</p>`; }
        container.innerHTML += `<div class="order-card ${order.status}"><div class="order-info"><h4>Ticket <span style="background:var(--primary); color:white; padding:2px 8px; border-radius:6px;">#${order.id.split('-')[0].toUpperCase()}</span> <span style="font-size:0.8rem; font-weight:normal; color:var(--text-muted);">(${time})</span></h4><p><strong>Items:</strong> ${itemsList}</p><p style="color:var(--primary); font-weight:700; font-size:1rem; margin-top:5px;">UGX ${order.total_ugx.toLocaleString()}</p>${etaText}${mapBtnHtml}</div><div class="order-actions">${actionHtml}</div></div>`;
    });
    document.getElementById('stat-revenue').textContent = `UGX ${revenue.toLocaleString()}`;
    document.getElementById('stat-live-orders').textContent = activeCount;
}

window.setPrepTime = async function(orderId, mins) {
    const now = new Date(); const readyAt = new Date(now.getTime() + mins * 60000);
    await supabaseClient.from('orders').update({ estimated_ready_at: readyAt.toISOString(), status: 'preparing' }).eq('id', orderId);
    fetchOrders();
};

function listenToNewOrders() {
    supabaseClient.channel('order-changes').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders', filter: `restaurant_id=eq.${myRestaurant.id}` }, () => fetchOrders()).subscribe();
}

window.updateOrderStatus = async function(orderId, newStatus) {
    await supabaseClient.from('orders').update({ status: newStatus }).eq('id', orderId); fetchOrders();
};

async function fetchMenuItems() {
    if (!myRestaurant) return;
    const container = document.getElementById('menu-list-container');
    const badge = document.getElementById('dishLimitBadge');
    const { data, error } = await supabaseClient.from('menu_items').select('*').eq('restaurant_id', myRestaurant.id);
    if (error) return console.error(error);
    const count = data ? data.length : 0;
    const tier = myRestaurant.subscription_tier || 'free';
    if (tier === 'free') {
        badge.textContent = `${count} / 15 Dishes`;
        badge.style.background = count >= 15 ? '#fee2e2' : '#e2e8f0';
        badge.style.color = count >= 15 ? '#dc2626' : '#1e293b';
    } else {
        badge.textContent = `${count} Dishes (Unlimited)`;
        badge.style.background = '#dcfce7';
        badge.style.color = '#166534';
    }
    if (!data || data.length === 0) return container.innerHTML = '<p style="color:var(--text-muted); text-align:center;">No items yet.</p>';
    container.innerHTML = data.map(item => {
        const rating = item.average_rating ? Number(item.average_rating).toFixed(1) : "0.0";
        const ratingCount = item.rating_count || 0;
        const isChecked = item.is_available ? 'checked' : '';
        const soldOutClass = item.is_available ? '' : 'sold-out-item';
        const soldOutBadge = item.is_available ? '' : '<span class="sold-out-badge">SOLD OUT</span>';
        return `<div class="menu-item-row ${soldOutClass}"><div style="display:flex; align-items:center; gap:12px;"><img src="${item.image_url || 'https://placehold.co/50x50?text=Food'}" alt="${item.name}"><div><strong>${item.name} ${soldOutBadge}</strong><br><span style="font-size:0.85rem; color:var(--text-muted);">UGX ${item.price_ugx.toLocaleString()}</span><br><span style="font-size:0.8rem; color:#fbbf24; font-weight:700;">★ ${rating} (${ratingCount})</span></div></div><div style="display:flex; align-items:center; gap:15px;"><label class="switch"><input type="checkbox" ${isChecked} onchange="toggleAvailability('${item.id}', this.checked)"><span class="slider"></span></label><button class="delete-btn" onclick="deleteMenuItem('${item.id}')">Delete</button></div></div>`;
    }).join('');
}

window.toggleAvailability = async function(id, isAvailable) {
    const { error } = await supabaseClient.from('menu_items').update({ is_available: isAvailable }).eq('id', id);
    if (error) alert("Error updating status: " + error.message);
    fetchMenuItems();
};

document.getElementById('add-menu-btn').addEventListener('click', async () => {
    const tier = myRestaurant.subscription_tier || 'free';
    if (tier === 'free') {
        const { count } = await supabaseClient.from('menu_items').select('*', { count: 'exact', head: true }).eq('restaurant_id', myRestaurant.id);
        if (count >= 15) { document.getElementById('limitModal').classList.add('open'); return; }
    }
    const name = document.getElementById('menu-name').value.trim();
    const desc = document.getElementById('menu-desc').value.trim();
    const price = parseInt(document.getElementById('menu-price').value, 10);
    const fileInput = document.getElementById('menu-image');
    if (!name || !price || !myCategoryId) return alert("Fill in name and price.");
    const btn = document.getElementById('add-menu-btn'); btn.textContent = "Uploading..."; btn.disabled = true;
    let imageUrl = null;
    if (fileInput.files.length > 0) {
        const file = fileInput.files[0]; const fileExt = file.name.split('.').pop(); const filePath = `${myRestaurant.id}/${Math.random()}.${fileExt}`;
        const { error: uploadError } = await supabaseClient.storage.from('menu-images').upload(filePath, file);
        if (uploadError) { alert("Upload failed: " + uploadError.message); btn.textContent = "Upload Dish"; btn.disabled = false; return; }
        imageUrl = supabaseClient.storage.from('menu-images').getPublicUrl(filePath).data.publicUrl;
    }
    const { error } = await supabaseClient.from('menu_items').insert([{ category_id: myCategoryId, restaurant_id: myRestaurant.id, name: name, description: desc, price_ugx: price, image_url: imageUrl, is_available: true }]);
    if (error) alert("Error: " + error.message);
    else { document.getElementById('menu-name').value = ''; document.getElementById('menu-desc').value = ''; document.getElementById('menu-price').value = ''; fileInput.value = ''; fetchMenuItems(); }
    btn.textContent = "Upload Dish"; btn.disabled = false;
});

window.deleteMenuItem = async function(id) {
    if (!confirm("Delete this dish permanently?")) return;
    await supabaseClient.from('menu_items').delete().eq('id', id); fetchMenuItems();
};

async function fetchAnalytics() {
    const container = document.getElementById('analyticsContent');
    container.style.display = 'block';
    const { data: orders, error } = await supabaseClient.from('orders').select('created_at, total_ugx, order_items(quantity, menu_items(name))').eq('restaurant_id', myRestaurant.id);
    if (error) { console.error(error); return; }
    let totalRevenue = 0; let todayRevenue = 0; let todayOrders = 0; let dishSales = {};
    const todayStr = new Date().toDateString();
    orders.forEach(order => {
        totalRevenue += order.total_ugx;
        const orderDate = new Date(order.created_at).toDateString();
        if (orderDate === todayStr) { todayRevenue += order.total_ugx; todayOrders++; }
        if (order.order_items) { order.order_items.forEach(item => { const dishName = item.menu_items?.name || 'Unknown Dish'; dishSales[dishName] = (dishSales[dishName] || 0) + item.quantity; }); }
    });
    document.getElementById('analytics-today-orders').textContent = todayOrders;
    document.getElementById('analytics-today-revenue').textContent = `UGX ${todayRevenue.toLocaleString()}`;
    document.getElementById('analytics-total-orders').textContent = orders.length;
    document.getElementById('analytics-total-revenue').textContent = `UGX ${totalRevenue.toLocaleString()}`;
    const sortedDishes = Object.entries(dishSales).sort((a, b) => b[1] - a[1]).slice(0, 5);
    const dishesContainer = document.getElementById('analytics-top-dishes');
    if (sortedDishes.length === 0) { dishesContainer.innerHTML = '<p style="color: var(--text-muted);">No sales data yet.</p>'; } 
    else { dishesContainer.innerHTML = sortedDishes.map(([name, qty], index) => `<div class="analytics-list-item"><span>${index + 1}. ${name}</span><span>${qty} sold</span></div>`).join(''); }
}

async function fetchReviews() {
    if (!myRestaurant) return;
    const container = document.getElementById('reviews-container');
    const { data, error } = await supabaseClient.rpc('get_restaurant_reviews', { restaurant_id_param: myRestaurant.id });
    if (error || !data || data.length === 0) { container.innerHTML = '<p style="color:var(--text-muted); text-align:center; padding:20px;">No reviews yet.</p>'; return; }
    container.innerHTML = '';
    data.forEach(review => {
        const date = new Date(review.created_at).toLocaleDateString();
        let stars = ''; for(let i=1; i<=5; i++) stars += i <= review.rating ? '★' : '☆';
        container.innerHTML += `<div style="padding:15px 0; border-bottom:1px solid var(--border);"><div style="display:flex; justify-content:space-between; margin-bottom:5px;"><strong>${review.menu_item_name}</strong><span style="color:#fbbf24; font-size:1.1rem;">${stars}</span></div><div style="font-size:0.85rem; color:var(--text-muted); margin-bottom:8px;">By ${review.customer_name} on ${date}</div><div style="font-size:0.95rem; color:var(--text);">${review.review_text || '<em style="color:#94a3b8;">No comment left.</em>'}</div></div>`;
    });
}

window.downloadQRImage = async function() {
    const imgSrc = document.getElementById('qrImage').src;
    if (!imgSrc) return alert("QR code not loaded yet.");
    const btn = document.getElementById('downloadQrBtn'); const originalText = btn.innerHTML; btn.innerHTML = "Downloading..."; btn.disabled = true;
    try {
        const response = await fetch(imgSrc); const blob = await response.blob(); const blobUrl = window.URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = blobUrl; const fileName = myRestaurant.name.replace(/[^a-z0-9]/gi, '_').toLowerCase(); a.download = `tablelink_${fileName}_qr.png`;
        document.body.appendChild(a); a.click(); a.remove(); window.URL.revokeObjectURL(blobUrl);
        btn.innerHTML = "✅ Downloaded!"; setTimeout(() => { btn.innerHTML = originalText; btn.disabled = false; }, 2000);
    } catch (error) { alert("Could not download. Long-press the image to save."); btn.innerHTML = originalText; btn.disabled = false; }
};

async function fetchReservations() {
    if (!myRestaurant) return;
    const container = document.getElementById('reservations-container');
    const { data, error } = await supabaseClient.from('reservations').select('*, profiles(full_name)').eq('restaurant_id', myRestaurant.id).order('created_at', { ascending: false });
    if (error || !data || data.length === 0) { container.innerHTML = '<p style="color:var(--text-muted); text-align:center; padding:40px;">No table bookings yet.</p>'; return; }
    container.innerHTML = '';
    data.forEach(res => {
        const customerName = res.profiles?.full_name || 'Customer';
        const date = new Date(res.reservation_date).toLocaleDateString();
        container.innerHTML += `<div class="order-card ${res.status}"><div class="order-info"><h4>Table for ${res.party_size} <span style="font-size:0.85rem; font-weight:normal; color:var(--text-muted);">(${customerName})</span></h4><p><strong>${date} at ${res.reservation_time}</strong></p><p>${res.special_requests ? `<em>Note: "${res.special_requests}"</em>` : 'No special requests.'}</p><p>Status: <strong>${res.status.toUpperCase()}</strong></p></div><div class="order-actions">${res.status === 'pending' ? `<button class="btn-accept" onclick="updateReservationStatus('${res.id}', 'confirmed')">Confirm</button><button class="btn-reject" onclick="updateReservationStatus('${res.id}', 'rejected')">Reject</button>` : ''}</div></div>`;
    });
}

window.updateReservationStatus = async function(id, status) {
    await supabaseClient.from('reservations').update({ status: status }).eq('id', id); fetchReservations();
};

async function fetchRequests() {
    if (!myRestaurant) return;
    const container = document.getElementById('requests-container');
    if (!container) return;
    const { data, error } = await supabaseClient.from('waiter_calls').select('*').eq('restaurant_id', myRestaurant.id).eq('status', 'pending').order('created_at', { ascending: true });
    if (error) return;
    if (!data || data.length === 0) { container.innerHTML = '<p style="color:var(--text-muted); text-align:center; padding:40px;">No active requests.</p>'; return; }
    container.innerHTML = '';
    data.forEach(req => {
        const time = new Date(req.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const isBill = req.request_type === 'bill';
        const color = isBill ? '#e85d04' : '#3b82f6';
        const icon = isBill ? '🧾' : '🔔';
        const label = isBill ? 'Wants the Bill' : 'Needs Assistance';
        container.innerHTML += `<div style="background: white; border-radius: 12px; padding: 20px; margin-bottom: 15px; border-left: 5px solid ${color}; display: flex; justify-content: space-between; align-items: center; box-shadow: 0 4px 10px rgba(0,0,0,0.05);"><div><h4 style="margin: 0 0 5px; color: #1e293b; font-size: 1.1rem;">${icon} Table ${req.table_number || 'N/A'}</h4><p style="margin: 0; color: ${color}; font-weight: bold;">${label}</p><p style="margin: 5px 0 0; color: #64748b; font-size: 0.85rem;">Requested at ${time}</p></div><button onclick="resolveRequest('${req.id}')" style="background: #10b981; color: white; border: none; padding: 10px 20px; border-radius: 8px; font-weight: bold; cursor: pointer;">Mark Resolved</button></div>`;
    });
}

window.resolveRequest = async function(id) {
    await supabaseClient.from('waiter_calls').update({ status: 'resolved' }).eq('id', id);
    fetchRequests();
};

function listenToNewRequests() {
    supabaseClient.channel('waiter-calls-changes').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'waiter_calls', filter: `restaurant_id=eq.${myRestaurant.id}` }, (payload) => {
        const req = payload.new;
        const isBill = req.request_type === 'bill';
        const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
        audio.play().catch(e => console.log('Audio blocked by browser'));
        alert(`🔔 URGENT: Table ${req.table_number} ${isBill ? 'wants the bill' : 'needs assistance'}!`);
        fetchRequests();
    }).subscribe();
}

document.getElementById('logout-btn').addEventListener('click', async () => {
    await supabaseClient.auth.signOut(); window.location.href = 'restaurant-auth.html';
});

initDashboard();

// --- COPY RESTAURANT LINK ---
window.copyRestaurantLink = async function() {
    const linkElement = document.getElementById('qrLinkText');
    const linkText = linkElement ? linkElement.textContent : '';
    
    if (!linkText || linkText === 'Loading...') {
        return alert("Link is still loading. Please wait a moment.");
    }

    try {
        await navigator.clipboard.writeText(linkText);
        
        // Show success feedback on the button
        const btn = event.target;
        const originalText = btn.innerHTML;
        btn.innerHTML = "✅ Copied!";
        btn.style.background = "#10b981";
        
        setTimeout(() => {
            btn.innerHTML = originalText;
            btn.style.background = "#1e293b";
        }, 2000);
    } catch (err) {
        // Fallback for older Android browsers
        const textArea = document.createElement("textarea");
        textArea.value = linkText;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand("copy");
        document.body.removeChild(textArea);
        alert("✅ Link copied to clipboard!");
    }
};

// --- COPY RESTAURANT LINK ---
window.copyRestaurantLink = function() {
    const linkText = document.getElementById('qrLinkText').textContent;
    if (!linkText || linkText === 'Loading...') return alert("Link not ready yet.");
    
    navigator.clipboard.writeText(linkText).then(() => {
        if (window.showToast) window.showToast('Link Copied!', 'You can now share it.');
        else alert("Link copied!");
    }).catch(() => {
        alert("Could not copy link.");
    });
};

// --- COPY RESTAURANT LINK ---
window.copyRestaurantLink = async function() {
    const linkElement = document.getElementById('qrLinkText');
    const linkText = linkElement ? linkElement.textContent : '';
    
    if (!linkText || linkText === 'Loading...') {
        return alert("Link is still loading. Please wait a moment.");
    }

    try {
        await navigator.clipboard.writeText(linkText);
        
        const btn = event.target;
        const originalText = btn.innerHTML;
        btn.innerHTML = "✅ Copied!";
        btn.style.background = "#10b981";
        
        setTimeout(() => {
            btn.innerHTML = originalText;
            btn.style.background = "#1e293b";
        }, 2000);
    } catch (err) {
        const textArea = document.createElement("textarea");
        textArea.value = linkText;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand("copy");
        document.body.removeChild(textArea);
        alert("✅ Link copied to clipboard!");
    }
};

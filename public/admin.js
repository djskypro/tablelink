let allRestaurants = [];
let allDevices = [];

async function initAdmin() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) return document.getElementById('accessDenied').style.display = 'flex';

    const { data: profile } = await supabaseClient.from('profiles').select('role').eq('id', session.user.id).single();
    if (!profile || profile.role !== 'admin') return document.getElementById('accessDenied').style.display = 'flex';

    document.getElementById('adminPanel').style.display = 'block';

    // Fetch Data
    const { data: orders } = await supabaseClient.from('orders')
        .select('*, restaurants(name), order_items(quantity, menu_items(name))');
    
    const { data: profiles } = await supabaseClient.from('profiles').select('id');
    const { data: restaurants } = await supabaseClient.from('restaurants').select('*').order('created_at', { ascending: false });
    const { data: devices } = await supabaseClient.from('restaurant_devices').select('*');

    allRestaurants = restaurants || [];
    allDevices = devices || [];

    // 1. Top Stats
    document.getElementById('stat-restaurants').textContent = allRestaurants.length;
    document.getElementById('stat-orders').textContent = orders ? orders.length : 0;
    document.getElementById('stat-users').textContent = profiles ? profiles.length : 0;
    
    let totalRevenue = 0;
    let dishSales = {}; 
    let restRevenue = {}; 

    orders?.forEach(order => {
        totalRevenue += order.total_ugx;
        
        const rName = order.restaurants?.name || 'Unknown';
        restRevenue[rName] = (restRevenue[rName] || 0) + order.total_ugx;

        if (order.order_items) {
            order.order_items.forEach(item => {
                const dName = item.menu_items?.name || 'Unknown Dish';
                dishSales[dName] = (dishSales[dName] || 0) + item.quantity;
            });
        }
    });
    
    document.getElementById('stat-revenue').textContent = `UGX ${totalRevenue.toLocaleString()}`;

    // 2. Top Dishes
    const sortedDishes = Object.entries(dishSales).sort((a, b) => b[1] - a[1]).slice(0, 5);
    const topDishesHtml = sortedDishes.map(([name, qty]) => `
        <div class="list-item"><span>${name}</span><span>${qty} sold</span></div>
    `).join('');
    document.getElementById('topDishesList').innerHTML = topDishesHtml || '<p style="color:#64748b;">No sales data yet.</p>';

    // 3. Top Restaurants
    const sortedRests = Object.entries(restRevenue).sort((a, b) => b[1] - a[1]).slice(0, 5);
    const topRestsHtml = sortedRests.map(([name, rev]) => `
        <div class="list-item"><span>${name}</span><span>UGX ${rev.toLocaleString()}</span></div>
    `).join('');
    document.getElementById('topRestaurantsList').innerHTML = topRestsHtml || '<p style="color:#64748b;">No revenue data yet.</p>';

    // 4. Render Platform Control Table
    renderTable();
}

function renderTable() {
    const tbody = document.getElementById('restaurantsTableBody');
    tbody.innerHTML = '';

    if (allRestaurants.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align: center;">No restaurants registered yet.</td></tr>';
        return;
    }

    allRestaurants.forEach(rest => {
        const isActive = rest.is_active !== false;
        const isVisible = rest.is_visible !== false;
        const activeChecked = isActive ? 'checked' : '';
        const visibleChecked = isVisible ? 'checked' : '';

        const tier = rest.subscription_tier || 'free';
        let tierClass = tier === 'vip' ? 'tier-vip' : tier === 'vvip' ? 'tier-vvip' : 'tier-free';

        const deviceCount = allDevices.filter(d => d.restaurant_id === rest.id).length;
        const maxDevices = tier === 'free' ? 1 : tier === 'vip' ? 2 : 5;

        tbody.innerHTML += `
            <tr>
                <td><strong>${rest.name}</strong><br><span style="font-size:0.75rem; color:#94a3b8;">${rest.cuisine}</span></td>
                
                <td>
                    <label class="switch">
                        <input type="checkbox" ${activeChecked} onchange="toggleRestaurantStatus('${rest.id}', this.checked)">
                        <span class="slider"></span>
                    </label>
                    <span class="status-text" style="color: ${isActive ? '#10b981' : '#ef4444'};">${isActive ? 'LIVE' : 'SUSPENDED'}</span>
                </td>

                <td>
                    <label class="switch">
                        <input type="checkbox" ${visibleChecked} onchange="toggleRestaurantVisibility('${rest.id}', this.checked)">
                        <span class="slider"></span>
                    </label>
                    <span class="status-text" style="color: ${isVisible ? '#10b981' : '#ef4444'};">${isVisible ? 'VISIBLE' : 'HIDDEN'}</span>
                </td>
                
                <td>
                    <select onchange="updateSubscriptionTier('${rest.id}', this.value)" class="tier-select ${tierClass}">
                        <option value="free" ${tier === 'free' ? 'selected' : ''}>FREE</option>
                        <option value="vip" ${tier === 'vip' ? 'selected' : ''}>⭐ VIP</option>
                        <option value="vvip" ${tier === 'vvip' ? 'selected' : ''}>💎 VVIP</option>
                    </select>
                </td>
                
                <td><span class="device-badge">${deviceCount} / ${maxDevices}</span></td>
            
                <td>
                    <button onclick="clearRestaurant('${rest.id}', '${rest.name.replace(/'/g, "\'")}')" style="background:#DC2626;color:white;border:none;padding:6px 10px;border-radius:6px;cursor:pointer;font-size:0.8rem;font-weight:bold;">🗑️ Clear</button>
                </td>
            </tr>
        `;
    });
}

window.toggleRestaurantStatus = async function(id, isActive) {
    const { error } = await supabaseClient.from('restaurants').update({ is_active: isActive }).eq('id', id);
    if (error) alert("Error updating status: " + error.message);
    else {
        const rest = allRestaurants.find(r => r.id === id);
        if (rest) rest.is_active = isActive;
        renderTable();
    }
};

window.toggleRestaurantVisibility = async function(id, isVisible) {
    const { error } = await supabaseClient.from('restaurants').update({ is_visible: isVisible }).eq('id', id);
    if (error) alert("Error updating visibility: " + error.message);
    else {
        const rest = allRestaurants.find(r => r.id === id);
        if (rest) rest.is_visible = isVisible;
        renderTable();
    }
};

window.updateSubscriptionTier = async function(id, tier) {
    const { error } = await supabaseClient.from('restaurants').update({ subscription_tier: tier }).eq('id', id);
    if (error) alert("Error updating tier: " + error.message);
    else {
        const rest = allRestaurants.find(r => r.id === id);
        if (rest) rest.subscription_tier = tier;
        renderTable();
    }
};

initAdmin();

window.clearRestaurant = async function(id, name) {
    if (!confirm("⚠️ Are you sure you want to permanently clear " + name + "?")) return;
    
    // Try to delete completely
    const { error } = await supabaseClient.from('restaurants').delete().eq('id', id);
    
    if (error) {
        // If Supabase blocks the delete due to foreign keys (orders, menus, etc.), hide it instead
        alert("Restaurant has connected data (orders/menus). Hiding it from the app instead.");
        await supabaseClient.from('restaurants').update({ is_active: false, is_visible: false }).eq('id', id);
    } else {
        alert(name + " has been cleared.");
    }
    location.reload();
};

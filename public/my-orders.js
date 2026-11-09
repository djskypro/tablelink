let currentUser = null;

// --- SMART BACK BUTTON LOGIC ---
const urlParams = new URLSearchParams(window.location.search);
const restId = urlParams.get('restaurant');
const backBtn = document.getElementById('backToFoodBtn');

if (backBtn) {
    if (restId) {
        backBtn.href = `index.html?restaurant=${restId}`;
        backBtn.textContent = "← Back to Restaurant Menu";
    } else {
        backBtn.href = 'index.html';
        backBtn.textContent = "← Back to Home";
    }
}

async function initOrders() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) { window.location.href = 'auth.html'; return; }
    currentUser = session.user;
    fetchMyOrders();
    listenToOrderUpdates();
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') fetchMyOrders(); });
}

async function fetchMyOrders(isSilent = false) {
    const { data, error } = await supabaseClient
        .from('orders').select(`*, restaurants ( name, location ), order_items ( quantity, unit_price_ugx, menu_items ( name ) )`)
        .eq('customer_id', currentUser.id).order('created_at', { ascending: false });

    const container = document.getElementById('ordersContainer');
    
    if (error) { 
        if (!isSilent) container.innerHTML = `<p style="color:red; text-align:center;">Error: ${error.message}</p>`; 
        return; 
    }
    
    if (!data || data.length === 0) {
        if (!isSilent) {
            container.innerHTML = `<div style="text-align:center; margin-top:50px;"><p style="color:#6b6b6b; font-size:1.1rem;">You haven't ordered anything yet.</p><a href="index.html${restId ? '?restaurant='+restId : ''}" class="btn-primary" style="margin-top:15px; display:inline-block;">Find Food</a></div>`;
        }
        return;
    }

    container.innerHTML = '';
    data.forEach(order => {
        const date = new Date(order.created_at).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute:'2-digit' });
        const restName = order.restaurants?.name || 'Unknown Restaurant';
        const restLoc = order.restaurants?.location || 'Kampala';
        
        let itemsHtml = '';
        if (order.order_items) {
            order.order_items.forEach(item => {
                itemsHtml += `<div class="item-row"><span>${item.quantity}x ${item.menu_items?.name || 'Item'}</span><span>UGX ${(item.quantity * item.unit_price_ugx).toLocaleString()}</span></div>`;
            });
        }

        let etaHtml = '';
        if (order.estimated_ready_at && order.status === 'preparing') {
            const eta = new Date(order.estimated_ready_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            etaHtml = `<div style="background:#fef3c7; color:#b45309; padding:8px; border-radius:8px; margin-top:10px; font-weight:bold; font-size:0.85rem; text-align:center;">⏱️ Estimated Ready Time: ${eta}</div>`;
        } else if (order.status === 'ready') {
            etaHtml = `<div style="background:#d1fae5; color:#065f46; padding:8px; border-radius:8px; margin-top:10px; font-weight:bold; font-size:0.85rem; text-align:center; animation: pulse 2s infinite;">✅ YOUR FOOD IS READY!</div>`;
        }

        // THE TICKET BUTTON (Only shows for active orders)
        let ticketBtnHtml = '';
        if (['pending', 'accepted', 'preparing', 'ready'].includes(order.status)) {
            ticketBtnHtml = `<button onclick="showTicketFromOrders('${order.id}')" style="width:100%; padding:12px; margin-top:10px; background:#1e293b; color:#38bdf8; border:none; border-radius:8px; font-weight:bold; font-size:1rem; cursor:pointer;">🎫 Show Ticket QR Code</button>`;
        }

        const card = document.createElement('div');
        card.className = 'order-card'; card.id = `order-${order.id}`; 
        card.innerHTML = `
            <div class="order-header">
                <h3>Order #${order.id.split('-')[0].toUpperCase()} <br><span style="font-size:0.75rem; font-weight:normal; color:#6b6b6b;">${date}</span></h3>
                <span class="status-badge status-${order.status}" id="badge-${order.id}">${order.status}</span>
            </div>
            <div class="order-details">
                <div class="restaurant-info"><strong>📍 ${restName}</strong><span>${restLoc}</span></div>
                <div class="item-list">${itemsHtml}</div>
                ${etaHtml}
                <div class="order-total"><span>Total:</span><span>UGX ${order.total_ugx.toLocaleString()}</span></div>
                ${ticketBtnHtml}
            </div>
        `;
        container.appendChild(card);
    });
}

// Function to show ticket
window.showTicketFromOrders = async function(orderId) {
    const { data: items } = await supabaseClient.from('order_items').select('quantity, unit_price_ugx, menu_items(name)').eq('order_id', orderId);
    const { data: order } = await supabaseClient.from('orders').select('total_ugx').eq('id', orderId).single();

    if (items && order) {
        const shortCode = orderId.split('-')[0].toUpperCase();
        document.getElementById('receiptCode').textContent = '#' + shortCode;
        document.getElementById('receiptQrImage').src = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${orderId}`;

        let itemsHtml = '';
        items.forEach(item => {
            itemsHtml += `<div style="display:flex; justify-content:space-between; margin-bottom:8px;"><span>${item.quantity}x ${item.menu_items?.name}</span><span>UGX ${(item.quantity * item.unit_price_ugx).toLocaleString()}</span></div>`;
        });
        itemsHtml += `<div style="display:flex; justify-content:space-between; margin-top:15px; padding-top:15px; border-top:1px dashed #cbd5e1; font-weight:bold; font-size:1.1rem; color:#e85d04;"><span>Total</span><span>UGX ${order.total_ugx.toLocaleString()}</span></div>`;
        
        document.getElementById('receiptItems').innerHTML = itemsHtml;
        document.getElementById('receiptModal').classList.add('open');
    }
};

function listenToOrderUpdates() {
    supabaseClient.channel('customer-orders')
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders', filter: `customer_id=eq.${currentUser.id}` }, (payload) => { fetchMyOrders(true); }).subscribe();
}
initOrders();

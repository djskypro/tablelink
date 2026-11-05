window.showToast = function(title, message, type = 'success') {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    if (navigator.vibrate) navigator.vibrate([200, 100, 100]);
    const toast = document.createElement('div');
    toast.className = 'toast';
    const icon = type === 'success' ? '✅' : type === 'error' ? '❌' : '🔔';
    toast.innerHTML = `<div class="toast-icon">${icon}</div><div class="toast-content"><div class="toast-title">${title}</div><div class="toast-message">${message}</div></div><button class="toast-close">&times;</button>`;
    container.appendChild(toast);
    toast.querySelector('.toast-close').addEventListener('click', () => { toast.classList.add('hiding'); setTimeout(() => toast.remove(), 300); });
    setTimeout(() => { if (toast.parentNode) { toast.classList.add('hiding'); setTimeout(() => toast.remove(), 300); } }, 5000);
};

let notifiedOrders = new Set(); 

async function startNotificationEngine() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) return; 
    await supabaseClient.realtime.setAuth(session.access_token);

    // --- 1. SILENT INITIAL LOAD (STOPS THE REFRESH SPAM) ---
    // We check the current status of all orders and mark them as "already notified"
    const { data: initialOrders } = await supabaseClient.from('orders').select('id, status').eq('customer_id', session.user.id);
    initialOrders?.forEach(o => {
        if (['accepted', 'preparing', 'ready', 'served'].includes(o.status)) notifiedOrders.add(o.id + 'acc');
        if (['ready', 'served'].includes(o.status)) notifiedOrders.add(o.id + 'rdy');
    });

    const { data: initialRes } = await supabaseClient.from('reservations').select('id, status').eq('customer_id', session.user.id);
    initialRes?.forEach(r => {
        if (['confirmed', 'rejected'].includes(r.status)) notifiedOrders.add(r.id + 'res');
    });

    // --- 2. REAL-TIME WEBSOCKET LISTENER ---
    supabaseClient.channel('global-notifications')
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders', filter: `customer_id=eq.${session.user.id}` }, async (payload) => {
            const order = payload.new;
            if (order.status === 'accepted' && !notifiedOrders.has(order.id + 'acc')) {
                notifiedOrders.add(order.id + 'acc');
                const { data: rest } = await supabaseClient.from('restaurants').select('name').eq('id', order.restaurant_id).single();
                showToast('Order Accepted! 🎉', `${rest?.name || 'The restaurant'} is preparing your food now.`);
            } else if (order.status === 'ready' && !notifiedOrders.has(order.id + 'rdy')) {
                notifiedOrders.add(order.id + 'rdy');
                showToast('Food is Ready! 🍽️', 'Your order is hot and ready. Come and get it!');
            }
        })
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'reservations', filter: `customer_id=eq.${session.user.id}` }, (payload) => {
            const res = payload.new;
            if (!notifiedOrders.has(res.id + 'res')) {
                if (res.status === 'confirmed') {
                    notifiedOrders.add(res.id + 'res');
                    showToast('Table Confirmed! 🍽️', `Your table for ${res.party_size} is booked.`);
                } else if (res.status === 'rejected') {
                    notifiedOrders.add(res.id + 'res');
                    showToast('Booking Rejected ❌', `The restaurant could not accommodate your request.`, 'error');
                }
            }
        })
        .subscribe();

    // --- 3. FAILSAFE POLLING (Every 5s) ---
    setInterval(async () => {
        const { data: orders } = await supabaseClient.from('orders').select('id, status, restaurant_id, restaurants(name)').eq('customer_id', session.user.id);
        orders?.forEach(async (o) => {
            if (o.status === 'accepted' && !notifiedOrders.has(o.id + 'acc')) {
                notifiedOrders.add(o.id + 'acc');
                showToast('Order Accepted! 🎉', `${o.restaurants?.name || 'The restaurant'} is preparing your food.`);
            } else if (o.status === 'ready' && !notifiedOrders.has(o.id + 'rdy')) {
                notifiedOrders.add(o.id + 'rdy');
                showToast('Food is Ready! 🍽️', 'Your order is hot and ready. Come and get it!');
            }
        });

        const { data: res } = await supabaseClient.from('reservations').select('id, status, party_size').eq('customer_id', session.user.id);
        res?.forEach((r) => {
            if (!notifiedOrders.has(r.id + 'res')) {
                if (r.status === 'confirmed') {
                    notifiedOrders.add(r.id + 'res');
                    showToast('Table Confirmed! 🍽️', `Your table for ${r.party_size} is booked.`);
                } else if (r.status === 'rejected') {
                    notifiedOrders.add(r.id + 'res');
                    showToast('Booking Rejected ❌', `The restaurant could not accommodate your request.`, 'error');
                }
            }
        });
    }, 5000); 
}
startNotificationEngine();

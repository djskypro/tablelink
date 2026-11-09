let currentUser = null;
const urlParams = new URLSearchParams(window.location.search);
const restId = urlParams.get('restaurant');

// Lock the Back Button
const backBtn = document.getElementById('backToFoodBtn');
if (backBtn && restId) {
    backBtn.href = `index.html?restaurant=${restId}`;
    backBtn.textContent = "← Back to Restaurant Menu";
} else if (backBtn) {
    backBtn.href = 'index.html';
    backBtn.textContent = "← Back to Home";
}

async function initReservations() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) { window.location.href = 'auth.html'; return; }
    currentUser = session.user;
    fetchMyReservations();
    listenToReservationUpdates();
}

async function fetchMyReservations() {
    const { data, error } = await supabaseClient
        .from('reservations').select(`*, restaurants ( name, location )`)
        .eq('customer_id', currentUser.id).order('created_at', { ascending: false });

    const container = document.getElementById('reservationsContainer');
    if (error) { container.innerHTML = `<p style="color:red; text-align:center;">Error: ${error.message}</p>`; return; }
    if (!data || data.length === 0) {
        container.innerHTML = `<div style="text-align:center; margin-top:50px;"><p style="color:#6b6b6b; font-size:1.1rem;">You haven't booked any tables yet.</p><a href="index.html${restId ? '?restaurant='+restId : ''}" class="btn-primary" style="margin-top:15px; display:inline-block;">Book a Table</a></div>`;
        return;
    }

    container.innerHTML = '';
    data.forEach(res => {
        const restName = res.restaurants?.name || 'Unknown Restaurant';
        const restLoc = res.restaurants?.location || 'Kampala';
        const date = new Date(res.reservation_date).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });

        const card = document.createElement('div');
        card.className = 'order-card';
        card.id = `res-${res.id}`;
        card.innerHTML = `
            <div class="order-header">
                <h3>Booking #${res.id.split('-')[0].toUpperCase()}</h3>
                <span class="status-badge status-${res.status}" id="badge-${res.id}">${res.status}</span>
            </div>
            <div class="order-details">
                <div class="restaurant-info"><strong>📍 ${restName}</strong><span>${restLoc}</span></div>
                <div class="booking-meta">
                    <p><strong>📅 Date:</strong> ${date}</p>
                    <p><strong>⏰ Time:</strong> ${res.reservation_time}</p>
                    <p><strong>👥 Guests:</strong> ${res.party_size} people</p>
                    ${res.special_requests ? `<p><strong>📝 Note:</strong> ${res.special_requests}</p>` : ''}
                </div>
            </div>
        `;
        container.appendChild(card);
    });
}

function listenToReservationUpdates() {
    supabaseClient.channel('customer-reservations')
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'reservations', filter: `customer_id=eq.${currentUser.id}` }, (payload) => {
            const updatedRes = payload.new;
            const badge = document.getElementById(`badge-${updatedRes.id}`);
            if (badge) {
                badge.textContent = updatedRes.status;
                badge.className = `status-badge status-${updatedRes.status}`;
                if (updatedRes.status === 'confirmed') { badge.parentElement.style.backgroundColor = '#d1fae5'; setTimeout(() => badge.parentElement.style.backgroundColor = '', 2000); }
                if (updatedRes.status === 'rejected') { badge.parentElement.style.backgroundColor = '#fee2e2'; setTimeout(() => badge.parentElement.style.backgroundColor = '', 2000); }
            }
        }).subscribe();
}
initReservations();

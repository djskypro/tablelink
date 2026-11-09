let currentUser = null;
const urlParams = new URLSearchParams(window.location.search);
const restId = urlParams.get('restaurant');

// 1. Lock the Back Button
const backBtn = document.getElementById('backToFoodBtn');
if (backBtn && restId) {
    backBtn.href = `index.html?restaurant=${restId}`;
    backBtn.textContent = "← Back to Restaurant";
}

async function initGroup() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) { window.location.href = 'auth.html'; return; }
    currentUser = session.user;

    const select = document.getElementById('groupRestaurant');

    if (restId) {
        // LOCKED TO RESTAURANT
        const { data, error } = await supabaseClient.from('restaurants').select('id, name').eq('id', restId).single();
        if (data) {
            select.innerHTML = `<option value="${data.id}">${data.name}</option>`;
            select.disabled = true; // Lock the dropdown
        } else {
            select.innerHTML = '<option value="">Restaurant not found</option>';
        }
    } else {
        // MAIN PAGE: Show all restaurants
        const { data, error } = await supabaseClient.from('restaurants').select('id, name, location').eq('is_active', true);
        if (error || !data || data.length === 0) { select.innerHTML = '<option value="">No restaurants available</option>'; return; }
        select.innerHTML = '<option value="">Select a restaurant...</option>';
        data.forEach(r => { select.innerHTML += `<option value="${r.id}">${r.name} (${r.location})</option>`; });
    }
}

document.getElementById('createGroupBtn').addEventListener('click', async () => {
    const name = document.getElementById('groupName').value.trim();
    const restaurantId = document.getElementById('groupRestaurant').value;
    const date = document.getElementById('groupDate').value;
    const time = document.getElementById('groupTime').value;

    if (!name || !restaurantId || !date || !time) return alert("Please fill in all fields.");

    const btn = document.getElementById('createGroupBtn');
    btn.textContent = "Creating..."; btn.disabled = true;

    const shareCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    const deadline = new Date(`${date}T${time}`).toISOString();

    try {
        const { data: eventData, error: eventError } = await supabaseClient
            .from('group_events')
            .insert([{ restaurant_id: restaurantId, organizer_id: currentUser.id, title: name, event_date: date, event_time: time, deadline: deadline, share_code: shareCode, status: 'open' }])
            .select();

        if (eventError) throw eventError;
        const newEventId = eventData[0].id;

        const { error: memberError } = await supabaseClient.from('group_members').insert([{ group_event_id: newEventId, user_id: currentUser.id, is_organizer: true }]);
        if (memberError) throw memberError;

        showShareLink(newEventId, shareCode, name);

    } catch (error) {
        alert("Error creating group: " + error.message);
        btn.textContent = "Create Group & Get Link"; btn.disabled = false;
    }
});

function showShareLink(eventId, shareCode, eventName) {
    document.getElementById('create-section').style.display = 'none';
    document.getElementById('share-section').style.display = 'block';

    const baseUrl = window.location.href.replace('group-dining.html', 'group-room.html');
    const inviteLink = `${baseUrl}?code=${shareCode}`;
    document.getElementById('shareLinkInput').value = inviteLink;

    document.getElementById('copyBtn').addEventListener('click', () => {
        const copyText = document.getElementById('shareLinkInput');
        copyText.select();
        document.execCommand("copy");
        document.getElementById('copyBtn').textContent = "Copied!";
        setTimeout(() => document.getElementById('copyBtn').textContent = "Copy", 2000);
    });

    const waText = encodeURIComponent(`Hey! Join my TABLELINK group for "${eventName}". Click here to pick your food: ${inviteLink}`);
    document.getElementById('whatsappShareBtn').href = `https://wa.me/?text=${waText}`;
    document.getElementById('goToGroupBtn').href = `group-room.html?code=${shareCode}`;
}

initGroup();

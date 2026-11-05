let currentUser = null;
let currentEvent = null;
let myMemberId = null;
let isOrganizer = false;
let menuItems = [];
let mySelections = []; // Holds { menu_item_id, quantity, name, price }

// 1. Initialize Room
async function initRoom() {
    // Get the ?code= from the URL
    const urlParams = new URLSearchParams(window.location.search);
    const shareCode = urlParams.get('code');
    if (!shareCode) return alert("Invalid link. No code found.");

    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) {
        // If not logged in, save the URL and send to auth
        localStorage.setItem('redirectAfterLogin', window.location.href);
        window.location.href = 'auth.html';
        return;
    }
    currentUser = session.user;

    // 2. Find the Group Event
    const { data: events, error: eventError } = await supabaseClient
        .from('group_events')
        .select('*, restaurants(name, location)')
        .eq('share_code', shareCode)
        .single();

    if (eventError || !events) {
        document.getElementById('eventTitle').textContent = "Group not found";
        return;
    }
    currentEvent = events;

    document.getElementById('eventTitle').textContent = currentEvent.title;
    document.getElementById('eventDetails').textContent = `${currentEvent.restaurants.name} • ${currentEvent.event_date} at ${currentEvent.event_time}`;

    // 3. Check if user is already a member, or join them
    const { data: members, error: memError } = await supabaseClient
        .from('group_members')
        .select('*')
        .eq('group_event_id', currentEvent.id)
        .eq('user_id', currentUser.id);

    if (memError) return console.error(memError);

    if (members && members.length > 0) {
        myMemberId = members[0].id;
        isOrganizer = members[0].is_organizer;
    } else {
        // Join the group
        const { data: newMember, error: joinError } = await supabaseClient
            .from('group_members')
            .insert([{ group_event_id: currentEvent.id, user_id: currentUser.id, is_organizer: false }])
            .select();
        
        if (joinError) return alert("Error joining group: " + joinError.message);
        myMemberId = newMember[0].id;
        isOrganizer = false;
    }

    if (isOrganizer) {
        document.getElementById('userRole').textContent = "👑 You are the Organizer";
        document.getElementById('organizerBar').style.display = 'flex';
        document.getElementById('submitGroupOrderBtn').addEventListener('click', submitGroupOrder);
    } else {
        document.getElementById('userRole').textContent = "🙋 You are a Guest";
    }

    // 4. Load the Menu for this restaurant
    const { data: menu, error: menuError } = await supabaseClient
        .from('menu_items')
        .select('*')
        .eq('restaurant_id', currentEvent.restaurant_id)
        .eq('is_available', true);

    if (menuError) return console.error(menuError);
    menuItems = menu;

    // 5. Load existing selections (so if they refresh, their cart is saved)
    await loadMySelections();
}

// 2. Load Selections from DB
async function loadMySelections() {
    const { data } = await supabaseClient
        .from('group_member_selections')
        .select('*')
        .eq('group_member_id', myMemberId);

    mySelections = data || [];
    renderMenu();
}

// 3. Render the Menu & Update UI
function renderMenu() {
    const container = document.getElementById('menuContainer');
    container.innerHTML = '';

    menuItems.forEach(item => {
        // Find if I already selected this item
        const selection = mySelections.find(s => s.menu_item_id === item.id);
        const qty = selection ? selection.quantity : 0;

        const div = document.createElement('div');
        div.className = 'menu-item';
        div.innerHTML = `
            <img src="${item.image_url || 'https://placehold.co/70x70?text=Food'}" alt="${item.name}">
            <div class="menu-info">
                <h4>${item.name}</h4>
                <p>UGX ${item.price_ugx.toLocaleString()}</p>
            </div>
            <div class="qty-controls">
                <button class="qty-btn" onclick="updateSelection('${item.id}', ${qty - 1})">-</button>
                <span class="qty-display">${qty}</span>
                <button class="qty-btn" onclick="updateSelection('${item.id}', ${qty + 1})">+</button>
            </div>
        `;
        container.appendChild(div);
    });

    updateOrganizerTotal();
}

// 4. Update Selection (Add/Remove)
window.updateSelection = async function(menuItemId, newQty) {
    if (newQty < 0) return;
    
    const existingIndex = mySelections.findIndex(s => s.menu_item_id === menuItemId);

    // Optimistic UI update
    if (existingIndex > -1) {
        if (newQty === 0) mySelections.splice(existingIndex, 1);
        else mySelections[existingIndex].quantity = newQty;
    } else if (newQty > 0) {
        const item = menuItems.find(m => m.id === menuItemId);
        mySelections.push({ menu_item_id: menuItemId, quantity: newQty, name: item.name, price: item.price_ugx });
    }

    renderMenu(); // Re-render instantly

    // Save to Database in background
    if (newQty === 0) {
        await supabaseClient.from('group_member_selections')
            .delete().eq('group_member_id', myMemberId).eq('menu_item_id', menuItemId);
    } else {
        await supabaseClient.from('group_member_selections')
            .upsert([{ group_member_id: myMemberId, menu_item_id: menuItemId, quantity: newQty }], 
            { onConflict: 'group_member_id, menu_item_id' });
    }
};

// 5. Organizer View (Total Order)
async function updateOrganizerTotal() {
    if (!isOrganizer) return;

    // Fetch ALL selections for this group
    const { data: allSelections } = await supabaseClient
        .from('group_member_selections')
        .select('quantity, menu_items(price_ugx)')
        .in('group_member_id', (await getGroupMemberIds()));

    let total = 0;
    allSelections?.forEach(sel => {
        total += (sel.quantity * sel.menu_items.price_ugx);
    });

    document.getElementById('groupTotal').textContent = `UGX ${total.toLocaleString()}`;
}

async function getGroupMemberIds() {
    const { data } = await supabaseClient.from('group_members').select('id').eq('group_event_id', currentEvent.id);
    return data.map(m => m.id);
}

// 6. Submit the Final Group Order (Organizer Only)
async function submitGroupOrder() {
    if (!confirm("Submit the entire group order to the restaurant?")) return;

    const btn = document.getElementById('submitGroupOrderBtn');
    btn.textContent = "Submitting..."; btn.disabled = true;

    try {
        // 1. Get all selections for everyone in the group
        const memberIds = await getGroupMemberIds();
        const { data: allSelections, error: selErr } = await supabaseClient
            .from('group_member_selections')
            .select('*, menu_items(name, price_ugx)')
            .in('group_member_id', memberIds);

        if (!allSelections || allSelections.length === 0) throw new Error("No food selected yet.");

        // 2. Create the Master Order
        const total = allSelections.reduce((sum, item) => sum + (item.quantity * item.menu_items.price_ugx), 0);
        
        const { data: orderData, error: orderError } = await supabaseClient.from('orders').insert([{
            restaurant_id: currentEvent.restaurant_id,
            customer_id: currentUser.id, // Organizer pays/owns the order
            total_ugx: total,
            status: 'pending',
            payment_status: 'unpaid',
            special_instructions: `GROUP ORDER: ${currentEvent.title}`
        }]).select();

        if (orderError) throw orderError;
        const orderId = orderData[0].id;

        // 3. Move selections into the actual Order Items
        const orderItems = allSelections.map(item => ({
            order_id: orderId,
            menu_item_id: item.menu_item_id,
            quantity: item.quantity,
            unit_price_ugx: item.menu_items.price_ugx
        }));

        const { error: itemsError } = await supabaseClient.from('order_items').insert(orderItems);
        if (itemsError) throw itemsError;

        // 4. Mark event as submitted
        await supabaseClient.from('group_events').update({ status: 'submitted' }).eq('id', currentEvent.id);

        alert("🎉 Group order submitted successfully! The restaurant is preparing it now.");
        window.location.href = 'my-orders.html';

    } catch (err) {
        alert("Error: " + err.message);
        btn.textContent = "Submit Order"; btn.disabled = false;
    }
}

initRoom();

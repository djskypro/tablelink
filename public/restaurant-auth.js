// Tab Switcher
window.switchAuthTab = function(tab) {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.form-section').forEach(s => s.classList.remove('active'));
    
    if (tab === 'login') {
        document.querySelectorAll('.tab')[0].classList.add('active');
        document.getElementById('login-section').classList.add('active');
    } else {
        document.querySelectorAll('.tab')[1].classList.add('active');
        document.getElementById('register-section').classList.add('active');
    }
};

// --- LOGIN LOGIC ---
document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('login-btn');
    const errorEl = document.getElementById('login-error');
    errorEl.style.display = 'none';
    btn.textContent = "Logging in...";
    btn.disabled = true;

    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;

    const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });

    if (error) {
        errorEl.textContent = error.message;
        errorEl.style.display = 'block';
        btn.textContent = "Log In to Dashboard";
        btn.disabled = false;
    } else {
        // Redirect to the actual dashboard
        window.location.href = 'dashboard.html';
    }
});

// --- REGISTER LOGIC ---
document.getElementById('register-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('register-btn');
    const errorEl = document.getElementById('register-error');
    const successEl = document.getElementById('register-success');
    errorEl.style.display = 'none';
    successEl.style.display = 'none';

    btn.textContent = "Uploading...";
    btn.disabled = true;

    const fullName = document.getElementById('reg-name').value;
    const email = document.getElementById('reg-email').value;
    const password = document.getElementById('reg-password').value;
    const restName = document.getElementById('reg-rest-name').value;
    const cuisine = document.getElementById('reg-cuisine').value;
    const location = document.getElementById('reg-location').value;
    const phone = document.getElementById('reg-phone').value;
    const photoFile = document.getElementById('reg-photo').files[0];

    try {
        // 1. Create the Auth User
        const { data: authData, error: authError } = await supabaseClient.auth.signUp({
            email,
            password,
            options: { data: { full_name: fullName, role: 'restaurant_owner' } }
        });

        if (authError) throw new Error("Auth Error: " + authError.message);
        
        const user = authData.user;
        if (!user) throw new Error("Could not create user account. Try logging in.");

        // 2. Upload Verification Photo
        btn.textContent = "Uploading verification...";
        const fileExt = photoFile.name.split('.').pop();
        const fileName = `verify_${Math.random()}.${fileExt}`;
        const filePath = `verification/${fileName}`;

        const { error: uploadError } = await supabaseClient.storage
            .from('menu-images') // We reuse the bucket for simplicity
            .upload(filePath, photoFile);

        if (uploadError) throw new Error("Upload Error: " + uploadError.message);

        const { data: urlData } = supabaseClient.storage.from('menu-images').getPublicUrl(filePath);
        const photoUrl = urlData.publicUrl;

        // 3. Create the Restaurant Profile
        btn.textContent = "Saving profile...";
        const { error: restError } = await supabaseClient.from('restaurants').insert([{
            owner_id: user.id,
            name: restName,
            cuisine: cuisine,
            location: location,
            phone_number: phone,
            verification_image_url: photoUrl,
            is_active: true
        }]);

        if (restError) throw new Error("Profile Error: " + restError.message);

        // Success!
        successEl.textContent = "Application submitted! Logging you in...";
        successEl.style.display = 'block';
        
        setTimeout(() => {
            window.location.href = 'dashboard.html';
        }, 1500);

    } catch (err) {
        errorEl.textContent = err.message;
        errorEl.style.display = 'block';
        btn.textContent = "Submit Application";
        btn.disabled = false;
    }
});

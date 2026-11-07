document.addEventListener('DOMContentLoaded', () => {
    const chatBtn = document.getElementById('aiChatBtn');
    const chatWindow = document.getElementById('aiChatWindow');
    const closeBtn = document.getElementById('closeAiChat');
    const sendBtn = document.getElementById('aiChatSend');
    const input = document.getElementById('aiChatInput');
    const messages = document.getElementById('aiChatMessages');

    if (!chatBtn) return;

    chatBtn.addEventListener('click', () => {
        chatWindow.style.display = chatWindow.style.display === 'none' ? 'flex' : 'none';
    });

    closeBtn.addEventListener('click', () => {
        chatWindow.style.display = 'none';
    });

    async function sendMessage() {
        const text = input.value.trim();
        if (!text) return;

        messages.innerHTML += `<div style="background: #E5A93B; color: #0F172A; padding: 10px 15px; border-radius: 12px 0 12px 12px; align-self: flex-end; max-width: 85%; font-weight: 500;">${text}</div>`;
        input.value = '';
        messages.scrollTop = messages.scrollHeight;

        const loadingId = 'loading-' + Date.now();
        messages.innerHTML += `<div id="${loadingId}" style="background: white; padding: 10px 15px; border-radius: 0 12px 12px 12px; border: 1px solid #E2E8F0; align-self: flex-start;">...</div>`;

        try {
            const res = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: text })
            });
            const data = await res.json();
            
            document.getElementById(loadingId).remove();
            
            if (data.reply) {
                messages.innerHTML += `<div style="background: white; padding: 10px 15px; border-radius: 0 12px 12px 12px; border: 1px solid #E2E8F0; align-self: flex-start; max-width: 85%;">${data.reply}</div>`;
            } else {
                messages.innerHTML += `<div style="background: #FEE2E2; color: #DC2626; padding: 10px 15px; border-radius: 0 12px 12px 12px; align-self: flex-start;">Error: ${data.error}</div>`;
            }
        } catch (err) {
            document.getElementById(loadingId).remove();
            messages.innerHTML += `<div style="background: #FEE2E2; color: #DC2626; padding: 10px 15px; border-radius: 0 12px 12px 12px; align-self: flex-start;">Connection Error.</div>`;
        }
        messages.scrollTop = messages.scrollHeight;
    }

    sendBtn.addEventListener('click', sendMessage);
    input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendMessage();
    });
});

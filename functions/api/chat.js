export async function onRequestPost(context) {
    const { request, env } = context;
    
    try {
        const { message } = await request.json();
        if (!message) return new Response(JSON.stringify({ error: "Message required" }), { status: 400 });

        const apiKey = env.GROQ_API_KEY;
        
        if (!apiKey) {
            return new Response(JSON.stringify({ 
                error: "API key missing.",
                available_env_vars: Object.keys(env) 
            }), { status: 500 });
        }

        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'llama-3.3-70b-versatile',
                messages: [
                    { role: 'system', content: 'You are the TABLELINK AI Sales Agent. TABLELINK is a food ordering app in Kampala. Convince restaurant owners to sign up. Features: Free QR code menus, real-time orders. Free: 15 dishes. VIP: 300k UGX/mo. VVIP: 750k UGX/mo. Keep answers short and friendly.' },
                    { role: 'user', content: message }
                ],
                temperature: 0.7,
                max_tokens: 300
            })
        });

        const data = await response.json();
        
        if (!response.ok) {
            return new Response(JSON.stringify({ error: "Groq API Error: " + JSON.stringify(data) }), { status: 500 });
        }

        return new Response(JSON.stringify({ reply: data.choices[0].message.content }), {
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }
}

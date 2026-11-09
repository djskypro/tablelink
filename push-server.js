const webpush = require('web-push');
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://tejggbwdjxwuqvsaxfft.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRlamdnYndkanh3dXF2c2F4ZmZ0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI3NTkzNzgsImV4cCI6MjEwODMzNTM3OH0.GLr12HYlXuXkSbfV5cb58z0pEplhJryDklPex-q-Pi4'; 
const PUBLIC_VAPID_KEY = 'BKgo8QjvQAaqLXEFKSpmAfzT_7xKmd-ESOdsopst8OOxaRS885IErzXObhEkk2RfsHa824t_gg-MSKSjBm0qXyc';
const PRIVATE_VAPID_KEY = 'JkovVntSzLmfAKKTNAT8qEadnVp56RHx-WjHZY0XlfM'; 

webpush.setVapidDetails('mailto:test@tablelink.com', PUBLIC_VAPID_KEY, PRIVATE_VAPID_KEY);
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

console.log('🚀 Push Server & Auto-Cancel Engine is running...');

// Function to send push notifications
async function sendPushToUser(userId, title, body) {
    const { data: subs } = await supabase.from('push_subscriptions').select('subscription').eq('user_id', userId);
    if (subs && subs.length > 0) {
        const pushPayload = JSON.stringify({ title, body, url: '/my-orders.html' });
        subs.forEach(sub => {
            webpush.sendNotification(sub.subscription, pushPayload)
                .catch(err => console.error('Push failed:', err.statusCode));
        });
    }
}

supabase.channel('order-engine')
  .on(
    'postgres_changes',
    { event: 'INSERT', schema: 'public', table: 'orders' },
    (payload) => {
      const newOrder = payload.new;
      console.log(`\n🛎️ New Order Placed: ${newOrder.id}`);
      
      // START THE 10-MINUTE AUTO-CANCEL TIMER
      setTimeout(async () => {
          console.log(`⏱️ Checking order ${newOrder.id} after 10 minutes...`);
          
          // Check the current status of the order
          const { data: currentOrder, error } = await supabase
              .from('orders')
              .select('status')
              .eq('id', newOrder.id)
              .single();

          if (currentOrder && currentOrder.status === 'pending') {
              // It's still pending! Cancel it.
              console.log(`❌ Order ${newOrder.id} was ignored. Auto-cancelling...`);
              
              await supabase.from('orders').update({ 
                  status: 'cancelled', 
                  special_instructions: 'Auto-cancelled: Restaurant did not respond in time.' 
              }).eq('id', newOrder.id);

              // Notify the customer
              await sendPushToUser(
                  newOrder.customer_id, 
                  'Order Cancelled 😔', 
                  'The restaurant did not respond in time. Your order was cancelled.'
              );
          } else {
              console.log(`✅ Order ${newOrder.id} is ${currentOrder?.status}. No need to cancel.`);
          }
      }, 10 * 60 * 1000); // 10 minutes in milliseconds
    }
  )
  .on(
    'postgres_changes',
    { event: 'UPDATE', schema: 'public', table: 'orders' },
    async (payload) => {
      const newOrder = payload.new;
      
      // Handle normal status updates (accepted, preparing, ready)
      if (newOrder.status === 'accepted') {
          sendPushToUser(newOrder.customer_id, 'Order Accepted! 🎉', 'The restaurant is preparing your food.');
      } else if (newOrder.status === 'ready') {
          sendPushToUser(newOrder.customer_id, 'Food is Ready! 🍽️', 'Your order is hot and ready. Come and get it!');
      }
    }
  )
  .subscribe((status) => {
    if (status === 'SUBSCRIBED') console.log('✅ Connected to Database.');
  });

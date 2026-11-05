// ============================================================
// TABLELINK — Supabase Client Configuration
// The anon key is safe to expose ONLY because RLS is enabled.
// ============================================================

const SUPABASE_URL = 'https://tejggbwdjxwuqvsaxfft.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRlamdnYndkanh3dXF2c2F4ZmZ0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI3NTkzNzgsImV4cCI6MjEwODMzNTM3OH0.GLr12HYlXuXkSbfV5cb58z0pEplhJryDklPex-q-Pi4';

const { createClient } = supabase;
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

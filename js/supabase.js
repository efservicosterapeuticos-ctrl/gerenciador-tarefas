const SUPABASE_URL = 'COLE_SUA_URL_AQUI';
const SUPABASE_ANON_KEY = 'COLE_SUA_ANON_KEY_AQUI';

const { createClient } = supabase;
const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

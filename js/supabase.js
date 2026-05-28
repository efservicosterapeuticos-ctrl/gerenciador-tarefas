const SUPABASE_URL = 'https://hviwfcxgbqzroziqgzhy.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_xVbwm9CSTPX-G5bSiMXBuQ_3821nLUe';

const { createClient } = supabase;
const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

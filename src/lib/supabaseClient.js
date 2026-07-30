import { createClient } from '@supabase/supabase-js';

const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder-url.supabase.co').trim();
const supabaseAnonKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-key').trim();

if (typeof window !== 'undefined') {
  console.log('Supabase Client Config:', {
    url: supabaseUrl,
    keyLength: supabaseAnonKey.length,
    keyFirstChars: supabaseAnonKey.substring(0, 10),
    isPlaceholder: supabaseAnonKey === 'placeholder-key'
  });
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

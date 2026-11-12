import { createClient } from '@supabase/supabase-js'
import { IS_PREVIEW, DEV_SUPABASE } from './env'

const supabaseUrl = IS_PREVIEW ? DEV_SUPABASE.url : import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = IS_PREVIEW ? DEV_SUPABASE.key : import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables. Copy .env.example to .env and fill in your values.')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

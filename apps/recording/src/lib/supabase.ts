import { createClient } from '@supabase/supabase-js'

// 클라이언트사이드 (anon key, RLS 적용)
export const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
)

// 서버사이드 (service key, RLS 우회)
export const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

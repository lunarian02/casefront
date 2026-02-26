import { supabaseAdmin } from '@/lib/supabase'
import type { Firm } from '@/types'

export async function getFirmBySlug(slug: string): Promise<Firm | null> {
  const { data, error } = await supabaseAdmin
    .from('firms')
    .select('*')
    .eq('slug', slug)
    .maybeSingle()

  if (error) throw error

  return data as Firm | null
}

export async function getFirmByKakaoChannel(channelId: string): Promise<Firm | null> {
  const { data, error } = await supabaseAdmin
    .from('firms')
    .select('*')
    .eq('kakao_channel_id', channelId)
    .maybeSingle()

  if (error) throw error

  return data as Firm | null
}

export async function getFirmById(firmId: string): Promise<Firm | null> {
  const { data, error } = await supabaseAdmin
    .from('firms')
    .select('*')
    .eq('id', firmId)
    .maybeSingle()

  if (error) throw error

  return data as Firm | null
}

export async function getDefaultFirm(): Promise<Firm | null> {
  const { data, error } = await supabaseAdmin
    .from('firms')
    .select('*')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (error) throw error

  return data as Firm | null
}

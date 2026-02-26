import { supabaseAdmin } from '@/lib/supabase'
import type { Client, Session } from '@/types'

export interface ClientContext {
  clientId: string
  name: string
  phone: string
  isReturning: boolean
  previousCases: Array<{
    case_type: string
    summary_text: string
    created_at: string
  }>
}

// Common Korean particles/words to exclude from name extraction
const EXCLUDED_WORDS = new Set([
  '안녕', '이요', '이고', '이에요', '입니다', '저는', '제가', '이름', '성함',
  '연락처', '번호', '전화', '아니', '네요', '네가', '그게', '모르',
])

function extractPhoneAndName(content: string): { name: string | null; phone: string | null } {
  const phoneMatch = content.match(/01[016789]-?\d{3,4}-?\d{4}/)
  if (!phoneMatch) return { name: null, phone: null }

  // Normalize phone format to 010-XXXX-XXXX
  const raw = phoneMatch[0].replace(/-/g, '')
  const phone = raw.replace(/(\d{3})(\d{3,4})(\d{4})/, '$1-$2-$3')

  // Remove phone from content and find name
  const withoutPhone = content.replace(phoneMatch[0], ' ')
  const words = withoutPhone.match(/[가-힣]{2,5}/g) ?? []
  const name = words.find((w) => !EXCLUDED_WORDS.has(w) && w.length >= 2 && w.length <= 4) ?? null

  return { name, phone }
}

// Called on every message — returns ClientContext if client is identified
export async function identifyClient(
  content: string,
  firmId: string,
  session: Session
): Promise<ClientContext | null> {
  // Already identified in this session
  if (session.client_id) {
    return getClientContext(session.client_id)
  }

  const { name, phone } = extractPhoneAndName(content)
  if (!phone || !name) return null

  // Look up or create client
  const { data: existing } = await supabaseAdmin
    .from('clients')
    .select('*')
    .eq('firm_id', firmId)
    .eq('phone', phone)
    .maybeSingle()

  let client: Client

  if (existing) {
    // Update last_contact_at
    await supabaseAdmin
      .from('clients')
      .update({ last_contact_at: new Date().toISOString() })
      .eq('id', existing.id)
    client = existing as Client
  } else {
    const { data: created, error } = await supabaseAdmin
      .from('clients')
      .insert({ firm_id: firmId, name, phone })
      .select()
      .single()
    if (error) throw error
    client = created as Client
  }

  // Attach client_id to session
  await supabaseAdmin
    .from('sessions')
    .update({ client_id: client.id })
    .eq('id', session.id)

  // Update session object in memory so subsequent calls skip re-identification
  session.client_id = client.id

  const isReturning = !!existing
  const previousCases = isReturning ? await getPreviousCases(client.id) : []

  return { clientId: client.id, name: client.name, phone: client.phone, isReturning, previousCases }
}

async function getClientContext(clientId: string): Promise<ClientContext | null> {
  const { data: client } = await supabaseAdmin
    .from('clients')
    .select('*')
    .eq('id', clientId)
    .maybeSingle()

  if (!client) return null

  const previousCases = await getPreviousCases(clientId)
  const isReturning = previousCases.length > 0

  return {
    clientId: client.id,
    name: client.name,
    phone: client.phone,
    isReturning,
    previousCases,
  }
}

async function getPreviousCases(clientId: string) {
  const { data } = await supabaseAdmin
    .from('case_summaries')
    .select('case_type, summary, created_at')
    .eq('client_id', clientId)
    .order('created_at', { ascending: false })
    .limit(3)

  return (data ?? []).map((c) => ({
    case_type: c.case_type ?? '기타',
    summary_text: (c.summary as { summary_text?: string })?.summary_text ?? '',
    created_at: c.created_at,
  }))
}

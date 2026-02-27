import { supabaseAdmin } from '@/lib/supabase'
import type { Client, Session, Message } from '@/types'

export interface ClientContext {
  clientId: string
  name: string
  phone: string
  email: string | null
  isReturning: boolean
  previousCases: Array<{
    case_type: string
    case_subtype: string
    summary_text: string
    created_at: string
  }>
}

// Extract phone number from text
function extractPhone(text: string): string | null {
  const match = text.match(/01[016789]-?\d{3,4}-?\d{4}/)
  if (!match) return null
  const raw = match[0].replace(/-/g, '')
  return raw.replace(/(\d{3})(\d{3,4})(\d{4})/, '$1-$2-$3')
}

// Extract Korean name (2-5 chars) from text
const EXCLUDED_WORDS = new Set([
  '안녕', '이요', '이고', '이에요', '입니다', '저는', '제가', '이름', '성함',
  '연락처', '번호', '전화', '아니', '네요', '네가', '그게', '모르', '감사',
  '맞아', '맞습', '맞아요', '이에요', '예요', '이야', '이야요',
])

function extractName(text: string): string | null {
  const words = text.match(/[가-힣]{2,5}/g) ?? []
  return words.find((w) => !EXCLUDED_WORDS.has(w) && w.length >= 2 && w.length <= 4) ?? null
}

// Extract email from text
function extractEmail(text: string): string | null {
  const match = text.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/)
  return match ? match[0] : null
}

// Scan all messages (oldest first) to find name, phone, email
// Name is looked for in the message BEFORE or containing the phone
function extractIdentityFromHistory(
  messages: Message[],
  currentContent: string
): { name: string | null; phone: string | null; email: string | null } {
  const allTexts = [...messages.map((m) => m.content), currentContent]

  let phone: string | null = null
  let phoneMsgIndex = -1
  let email: string | null = null

  // Find phone and email anywhere
  for (let i = 0; i < allTexts.length; i++) {
    if (!phone) {
      const p = extractPhone(allTexts[i])
      if (p) {
        phone = p
        phoneMsgIndex = i
      }
    }
    if (!email) {
      email = extractEmail(allTexts[i])
    }
  }

  if (!phone) return { name: null, phone: null, email }

  // Look for name: in same message, or within 3 messages before phone
  let name: string | null = null
  const searchFrom = Math.max(0, phoneMsgIndex - 3)
  for (let i = searchFrom; i <= phoneMsgIndex; i++) {
    const n = extractName(allTexts[i])
    if (n) {
      name = n
      break
    }
  }

  return { name, phone, email }
}

// Called on every message — returns ClientContext if client is identified
export async function identifyClient(
  content: string,
  history: Message[],
  firmId: string,
  session: Session
): Promise<ClientContext | null> {
  // Already identified in this session
  if (session.client_id) {
    return getClientContext(session.client_id)
  }

  const { name, phone, email } = extractIdentityFromHistory(history, content)
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
    // Update last_contact_at and email if newly provided
    const updates: Record<string, unknown> = { last_contact_at: new Date().toISOString() }
    if (email && !existing.email) updates.email = email
    await supabaseAdmin.from('clients').update(updates).eq('id', existing.id)
    client = { ...existing, ...updates } as Client
  } else {
    const { data: created, error } = await supabaseAdmin
      .from('clients')
      .insert({ firm_id: firmId, name, phone, email: email ?? null })
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

  session.client_id = client.id

  const isReturning = !!existing
  const previousCases = isReturning ? await getPreviousCases(client.id) : []

  return {
    clientId: client.id,
    name: client.name,
    phone: client.phone,
    email: email,
    isReturning,
    previousCases,
  }
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
    email: client.email ?? null,
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
    case_subtype: (c.summary as { case_subtype?: string })?.case_subtype ?? '',
    summary_text: (c.summary as { summary_text?: string })?.summary_text ?? '',
    created_at: c.created_at,
  }))
}

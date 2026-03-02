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

// Extract phone number from text (mobile + landline)
function extractPhone(text: string): string | null {
  // Mobile: 010/011/016/017/018/019
  const mobile = text.match(/01[016789][\s-]?\d{3,4}[\s-]?\d{4}/)
  if (mobile) {
    const raw = mobile[0].replace(/[\s-]/g, '')
    return raw.replace(/(\d{3})(\d{3,4})(\d{4})/, '$1-$2-$3')
  }
  // Landline: 02 (Seoul), 031-099 (local), etc.
  const landline = text.match(/0\d{1,2}[\s-]\d{3,4}[\s-]\d{4}/)
  if (landline) {
    const raw = landline[0].replace(/[\s-]/g, '')
    if (raw.length >= 9 && raw.length <= 11) {
      return raw.replace(/(\d{2,3})(\d{3,4})(\d{4})/, '$1-$2-$3')
    }
  }
  return null
}

// Extract Korean name (2-4 chars) from text, handling common particles
const EXCLUDED_WORDS = new Set([
  '안녕', '이요', '이고', '이에요', '입니다', '저는', '제가', '이름', '성함',
  '연락처', '번호', '전화', '아니', '네요', '네가', '그게', '모르', '감사',
  '맞아', '맞습', '맞아요', '이에요', '예요', '이야', '이야요', '없어요',
  '있어요', '했어요', '했습', '합니다', '하고', '하는', '이고', '에요',
])

const KOREAN_PARTICLES = ['이에요', '이고요', '이요', '입니다', '예요', '이야', '이에', '이거든', '이']

function stripParticle(word: string): string {
  for (const p of KOREAN_PARTICLES) {
    if (word.endsWith(p) && word.length - p.length >= 2) {
      return word.slice(0, -p.length)
    }
  }
  return word
}

function extractName(text: string): string | null {
  // Match up to 7 chars to catch name+particle (e.g., "홍길동이요" = 5 chars)
  const words = text.match(/[가-힣]{2,7}/g) ?? []
  for (const raw of words) {
    const w = stripParticle(raw)
    if (w.length >= 2 && w.length <= 4 && !EXCLUDED_WORDS.has(w)) {
      return w
    }
  }
  return null
}

// Extract email from text (always lowercase)
function extractEmail(text: string): string | null {
  const match = text.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/)
  return match ? match[0].toLowerCase() : null
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

  // Search for name in ALL messages from beginning up to (and including) phone message
  let name: string | null = null
  for (let i = 0; i <= phoneMsgIndex; i++) {
    const n = extractName(allTexts[i])
    if (n) {
      name = n
      // keep searching — later occurrence closer to phone is more reliable
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

// Called at case completion — uses AI's validated caseSummary to reliably upsert client
// If the customer corrected their contact info mid-chat, the AI summary has the latest values.
export async function upsertClientFromSummary(
  sessionId: string,
  firmId: string,
  summary: { client_name: string | null; client_phone: string | null; client_email?: string | null }
): Promise<string | null> {
  if (!summary.client_name || !summary.client_phone) return null

  const name = summary.client_name
  const phone = summary.client_phone
  const email = summary.client_email ?? null

  // First: check if session already has a client_id (from mid-chat identification)
  const { data: sessionRow } = await supabaseAdmin
    .from('sessions')
    .select('client_id')
    .eq('id', sessionId)
    .single()

  if (sessionRow?.client_id) {
    // Update the existing client with the AI's final (possibly corrected) values
    const updates: Record<string, unknown> = {
      last_contact_at: new Date().toISOString(),
      name,
      phone,
    }
    if (email) updates.email = email
    await supabaseAdmin.from('clients').update(updates).eq('id', sessionRow.client_id)
    return sessionRow.client_id
  }

  // No existing client — look up by phone or create new
  const { data: existing } = await supabaseAdmin
    .from('clients')
    .select('*')
    .eq('firm_id', firmId)
    .eq('phone', phone)
    .maybeSingle()

  let clientId: string

  if (existing) {
    const updates: Record<string, unknown> = { last_contact_at: new Date().toISOString() }
    if (email && !existing.email) updates.email = email
    if (name) updates.name = name
    await supabaseAdmin.from('clients').update(updates).eq('id', existing.id)
    clientId = existing.id
  } else {
    const { data: created, error } = await supabaseAdmin
      .from('clients')
      .insert({ firm_id: firmId, name, phone, email })
      .select('id')
      .single()
    if (error) throw error
    clientId = created.id
  }

  // Attach client_id to session
  await supabaseAdmin
    .from('sessions')
    .update({ client_id: clientId })
    .eq('id', sessionId)

  return clientId
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

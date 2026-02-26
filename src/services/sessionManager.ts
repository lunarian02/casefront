import { supabaseAdmin } from '@/lib/supabase'
import type { Session, Message, CaseSummary } from '@/types'

const SESSION_TIMEOUT_MINUTES = 30

export async function getOrCreateSession(
  kakaoUserId: string,
  firmId: string,
  channel: string = 'kakao'
): Promise<Session> {
  const timeoutThreshold = new Date(
    Date.now() - SESSION_TIMEOUT_MINUTES * 60 * 1000
  ).toISOString()

  // Look for an active session within the timeout window
  const { data: existing, error: fetchError } = await supabaseAdmin
    .from('sessions')
    .select('*')
    .eq('kakao_user_id', kakaoUserId)
    .eq('firm_id', firmId)
    .eq('status', 'active')
    .gte('updated_at', timeoutThreshold)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (fetchError) throw fetchError

  if (existing) return existing as Session

  // Create new session
  const { data: newSession, error: insertError } = await supabaseAdmin
    .from('sessions')
    .insert({
      kakao_user_id: kakaoUserId,
      firm_id: firmId,
      status: 'active',
      channel,
    })
    .select()
    .single()

  if (insertError) throw insertError

  return newSession as Session
}

export async function saveMessage(
  sessionId: string,
  role: 'user' | 'assistant',
  content: string
): Promise<void> {
  const { error: msgError } = await supabaseAdmin.from('messages').insert({
    session_id: sessionId,
    role,
    content,
  })

  if (msgError) throw msgError

  // Update session updated_at
  const { error: sessionError } = await supabaseAdmin
    .from('sessions')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', sessionId)

  if (sessionError) throw sessionError
}

export async function getHistory(sessionId: string): Promise<Message[]> {
  const { data, error } = await supabaseAdmin
    .from('messages')
    .select('*')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true })

  if (error) throw error

  return (data ?? []) as Message[]
}

export async function saveCaseSummary(
  sessionId: string,
  firmId: string,
  summary: CaseSummary
): Promise<void> {
  const { error: summaryError } = await supabaseAdmin
    .from('case_summaries')
    .upsert({
      session_id: sessionId,
      firm_id: firmId,
      client_name: summary.client_name,
      client_phone: summary.client_phone,
      case_type: summary.case_type,
      summary: summary, // JSONB — stores entire CaseSummary including events[], document_request, urgency_reason
      urgency: summary.urgency,
    })

  if (summaryError) throw summaryError

  await completeSession(sessionId)
}

export async function completeSession(sessionId: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from('sessions')
    .update({
      status: 'completed',
      completed_at: new Date().toISOString(),
    })
    .eq('id', sessionId)

  if (error) throw error
}

import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

async function getAuthFirmId(request: Request): Promise<string | null> {
  const token = request.headers.get('Authorization')?.replace('Bearer ', '')
  if (!token) return null

  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token)
  if (error || !user?.email) return null

  const { data: firm } = await supabaseAdmin
    .from('firms')
    .select('id')
    .eq('lawyer_email', user.email)
    .maybeSingle()

  return firm?.id ?? null
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: clientId } = await params
  const firmId = await getAuthFirmId(request)
  if (!firmId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const allowed: Record<string, unknown> = {}
  if (body.name) allowed.name = body.name
  if (body.phone) allowed.phone = body.phone
  if ('email' in body) allowed.email = body.email || null

  if (Object.keys(allowed).length === 0) {
    return NextResponse.json({ error: '수정할 항목이 없습니다.' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('clients')
    .update(allowed)
    .eq('id', clientId)
    .eq('firm_id', firmId)
    .select('id, name, phone, email')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ client: data })
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: clientId } = await params
  const firmId = await getAuthFirmId(request)
  if (!firmId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Unlink client from sessions and case_summaries before deleting
  await supabaseAdmin.from('sessions').update({ client_id: null }).eq('client_id', clientId)
  await supabaseAdmin.from('case_summaries').update({ client_id: null }).eq('client_id', clientId).eq('firm_id', firmId)

  const { error } = await supabaseAdmin
    .from('clients')
    .delete()
    .eq('id', clientId)
    .eq('firm_id', firmId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: clientId } = await params

  const firmId = await getAuthFirmId(request)
  if (!firmId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Fetch client (firm_id check = security)
  const { data: client, error: clientError } = await supabaseAdmin
    .from('clients')
    .select('id, name, phone, email, created_at, last_contact_at')
    .eq('id', clientId)
    .eq('firm_id', firmId)
    .maybeSingle()

  if (clientError || !client) {
    return NextResponse.json({ error: 'Client not found' }, { status: 404 })
  }

  // Fetch all cases for this client
  const { data: cases } = await supabaseAdmin
    .from('case_summaries')
    .select('id, session_id, case_type, urgency, urgency_reason, status, summary, created_at')
    .eq('client_id', clientId)
    .order('created_at', { ascending: false })

  // Fetch all sessions for this client (to get messages)
  const { data: sessions } = await supabaseAdmin
    .from('sessions')
    .select('id, created_at')
    .eq('client_id', clientId)
    .order('created_at', { ascending: false })

  const sessionIds = (sessions ?? []).map((s) => s.id)

  // Fetch all messages for those sessions
  const { data: messages } = sessionIds.length
    ? await supabaseAdmin
        .from('messages')
        .select('session_id, role, content, created_at')
        .in('session_id', sessionIds)
        .order('created_at', { ascending: true })
    : { data: [] }

  type MsgRow = { session_id: string; role: string; content: string; created_at: string }
  const messagesBySession: Record<string, MsgRow[]> = {}
  for (const msg of (messages ?? []) as MsgRow[]) {
    if (!messagesBySession[msg.session_id]) messagesBySession[msg.session_id] = []
    messagesBySession[msg.session_id].push(msg)
  }

  return NextResponse.json({
    client,
    cases: cases ?? [],
    sessions: (sessions ?? []).map((s) => ({
      ...s,
      messages: messagesBySession[s.id] ?? [],
    })),
  })
}

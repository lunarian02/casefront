import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

async function getAuthFirm(request: Request) {
  const token = request.headers.get('Authorization')?.replace('Bearer ', '')
  if (!token) return null
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token)
  if (error || !user?.email) return null

  const { data: firm } = await supabaseAdmin
    .from('firms')
    .select('id')
    .eq('lawyer_email', user.email)
    .maybeSingle()

  return firm ?? null
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: sessionId } = await params

  const firm = await getAuthFirm(request)
  if (!firm) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: caseData, error: caseError } = await supabaseAdmin
    .from('case_summaries')
    .select('id, session_id, client_id, client_name, client_phone, client_email, case_type, urgency, urgency_reason, status, summary, created_at')
    .eq('session_id', sessionId)
    .eq('firm_id', firm.id)
    .maybeSingle()

  if (caseError || !caseData) {
    return NextResponse.json({ error: 'Case not found' }, { status: 404 })
  }

  const { data: messages } = await supabaseAdmin
    .from('messages')
    .select('role, content, created_at')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true })

  return NextResponse.json({ case: caseData, messages: messages ?? [] })
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: sessionId } = await params

  const firm = await getAuthFirm(request)
  if (!firm) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { status } = body

  const VALID_STATUSES = ['new', 'reviewing', 'completed']
  if (!status || !VALID_STATUSES.includes(status)) {
    return NextResponse.json({ error: '유효하지 않은 상태값입니다.' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('case_summaries')
    .update({ status })
    .eq('session_id', sessionId)
    .eq('firm_id', firm.id)
    .select('id, session_id, status')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ case: data })
}

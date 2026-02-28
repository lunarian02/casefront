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
    .select('id, session_id, client_id, client_name, client_phone, client_email, is_proxy, contact_name, contact_phone, contact_email, contact_relation, case_type, urgency, urgency_reason, status, summary, parent_case_id, created_at')
    .eq('session_id', sessionId)
    .eq('firm_id', firm.id)
    .maybeSingle()

  if (caseError || !caseData) {
    return NextResponse.json({ error: 'Case not found' }, { status: 404 })
  }

  // Fetch session channel
  const { data: sessionData } = await supabaseAdmin
    .from('sessions')
    .select('channel')
    .eq('id', sessionId)
    .maybeSingle()

  const channel = sessionData?.channel ?? 'web'

  // If recording, get signed URL for audio playback
  let recordingUrl: string | null = null
  if (channel === 'recording') {
    const { data: fileData } = await supabaseAdmin
      .from('files')
      .select('storage_path')
      .eq('session_id', sessionId)
      .eq('category', 'recording')
      .maybeSingle()

    if (fileData?.storage_path) {
      const { data: signedData } = await supabaseAdmin.storage
        .from('recordings')
        .createSignedUrl(fileData.storage_path, 3600) // 1 hour
      recordingUrl = signedData?.signedUrl ?? null
    }
  }

  const { data: messages } = await supabaseAdmin
    .from('messages')
    .select('role, content, created_at')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true })

  // If there's a parent case, fetch its messages too
  let parentMessages: typeof messages = null
  if (caseData.parent_case_id) {
    const { data: parentCase } = await supabaseAdmin
      .from('case_summaries')
      .select('session_id')
      .eq('id', caseData.parent_case_id)
      .eq('firm_id', firm.id)
      .maybeSingle()

    if (parentCase?.session_id) {
      const { data: pMsgs } = await supabaseAdmin
        .from('messages')
        .select('role, content, created_at')
        .eq('session_id', parentCase.session_id)
        .order('created_at', { ascending: true })
      parentMessages = pMsgs
    }
  }

  // Fetch other cases for the same client (for connect modal)
  let clientCases: Array<{ id: number; session_id: string; case_type: string; created_at: string }> = []
  if (caseData.client_id) {
    const { data: cc } = await supabaseAdmin
      .from('case_summaries')
      .select('id, session_id, case_type, created_at')
      .eq('client_id', caseData.client_id)
      .eq('firm_id', firm.id)
      .neq('session_id', sessionId)
      .order('created_at', { ascending: false })
      .limit(20)
    clientCases = cc ?? []
  }

  return NextResponse.json({
    case: { ...caseData, channel },
    messages: messages ?? [],
    parentMessages: parentMessages ?? [],
    clientCases,
    recordingUrl,
  })
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: sessionId } = await params

  const firm = await getAuthFirm(request)
  if (!firm) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()

  // Status update
  if ('status' in body) {
    const VALID_STATUSES = ['new', 'reviewing', 'done']
    if (!VALID_STATUSES.includes(body.status)) {
      return NextResponse.json({ error: '유효하지 않은 상태값입니다.' }, { status: 400 })
    }

    const { data, error } = await supabaseAdmin
      .from('case_summaries')
      .update({ status: body.status })
      .eq('session_id', sessionId)
      .eq('firm_id', firm.id)
      .select('id, session_id, status')
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ case: data })
  }

  // Connect to parent case
  if ('parent_case_id' in body) {
    const { data, error } = await supabaseAdmin
      .from('case_summaries')
      .update({ parent_case_id: body.parent_case_id })
      .eq('session_id', sessionId)
      .eq('firm_id', firm.id)
      .select('id, session_id, parent_case_id')
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ case: data })
  }

  // Edit case fields (case_type, summary JSONB fields)
  const allowedEdits: Record<string, unknown> = {}
  if ('case_type' in body) allowedEdits.case_type = body.case_type

  // Update summary JSONB sub-fields
  if ('summary_patch' in body && typeof body.summary_patch === 'object') {
    // Fetch current summary
    const { data: current } = await supabaseAdmin
      .from('case_summaries')
      .select('summary')
      .eq('session_id', sessionId)
      .eq('firm_id', firm.id)
      .single()

    if (current?.summary) {
      allowedEdits.summary = {
        ...(current.summary as object),
        ...body.summary_patch,
      }
    }
  }

  if (Object.keys(allowedEdits).length === 0) {
    return NextResponse.json({ error: '수정할 항목이 없습니다.' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('case_summaries')
    .update(allowedEdits)
    .eq('session_id', sessionId)
    .eq('firm_id', firm.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ case: data })
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: sessionId } = await params

  const firm = await getAuthFirm(request)
  if (!firm) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Get case_summary id first (needed to delete related records)
  const { data: caseData, error: findError } = await supabaseAdmin
    .from('case_summaries')
    .select('id')
    .eq('session_id', sessionId)
    .eq('firm_id', firm.id)
    .maybeSingle()

  if (findError || !caseData) {
    return NextResponse.json({ error: '사건을 찾을 수 없습니다.' }, { status: 404 })
  }

  const caseId = caseData.id

  // Delete related records in order
  await supabaseAdmin.from('case_notes').delete().eq('case_id', caseId)
  await supabaseAdmin.from('files').delete().eq('case_id', caseId)

  const { error: deleteError } = await supabaseAdmin
    .from('case_summaries')
    .delete()
    .eq('id', caseId)
    .eq('firm_id', firm.id)

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}

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

// GET: list linked cases for a recording
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: recordingId } = await params
  const firm = await getAuthFirm(request)
  if (!firm) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabaseAdmin
    .from('recording_case_links')
    .select('id, case_id, case_client_name, case_type, created_at')
    .eq('recording_id', recordingId)
    .eq('user_id', firm.id)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Map case_id as session_id for backward compatibility
  const links = (data ?? []).map((l: Record<string, unknown>) => {
    return { ...l, session_id: l.case_id }
  })

  return NextResponse.json({ links })
}

// POST: link a case to this recording
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: recordingId } = await params
  const firm = await getAuthFirm(request)
  if (!firm) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { case_id, case_client_name, case_type } = await request.json()
  if (!case_id) {
    return NextResponse.json({ error: 'case_id is required' }, { status: 400 })
  }

  // 1. Get client_id from cases
  const { data: caseData } = await supabaseAdmin
    .from('cases')
    .select('client_id')
    .eq('id', case_id)
    .eq('firm_id', firm.id)
    .maybeSingle()

  // 2. Insert link
  const { data, error } = await supabaseAdmin
    .from('recording_case_links')
    .insert({
      recording_id: recordingId,
      case_id,
      user_id: firm.id,
      case_client_name: case_client_name ?? null,
      case_type: case_type ?? null,
    })
    .select()
    .single()

  if (error) {
    if (error.code === '23505') return NextResponse.json({ error: '이미 연결된 사건입니다.' }, { status: 409 })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // 3. Update recording.client_id (if case has client_id and recording doesn't)
  if (caseData?.client_id) {
    await supabaseAdmin
      .from('recordings')
      .update({ client_id: caseData.client_id })
      .eq('id', recordingId)
      .eq('firm_id', firm.id)
      .is('client_id', null) // Only update if currently NULL
  }

  return NextResponse.json({ link: data }, { status: 201 })
}

// DELETE: remove a link by link id (query param ?linkId=...)
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: recordingId } = await params
  const firm = await getAuthFirm(request)
  if (!firm) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const url = new URL(request.url)
  const linkId = url.searchParams.get('linkId')
  if (!linkId) return NextResponse.json({ error: 'linkId required' }, { status: 400 })

  const { error } = await supabaseAdmin
    .from('recording_case_links')
    .delete()
    .eq('id', linkId)
    .eq('recording_id', recordingId)
    .eq('user_id', firm.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return new NextResponse(null, { status: 204 })
}

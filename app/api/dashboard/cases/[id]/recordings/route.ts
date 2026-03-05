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

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: sessionId } = await params
  const firm = await getAuthFirm(request)
  if (!firm) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Look up case integer ID from session_id
  const { data: caseRow } = await supabaseAdmin
    .from('case_summaries')
    .select('id')
    .eq('session_id', sessionId)
    .eq('firm_id', firm.id)
    .maybeSingle()

  if (!caseRow) return NextResponse.json({ recordings: [] })
  const caseId = caseRow.id

  // Get recording IDs linked to this case
  const { data: links, error: linkErr } = await supabaseAdmin
    .from('recording_case_links')
    .select('recording_id')
    .eq('case_id', caseId)
    .eq('user_id', firm.id)

  if (linkErr) return NextResponse.json({ error: linkErr.message }, { status: 500 })
  if (!links || links.length === 0) return NextResponse.json({ recordings: [] })

  const recordingIds = links.map((l: { recording_id: string }) => l.recording_id)

  const { data: recordings, error: recErr } = await supabaseAdmin
    .from('recordings')
    .select('id, title, status, duration_seconds, created_at, reports(id, case_type, content, report_type)')
    .in('id', recordingIds)
    .order('created_at', { ascending: false })

  if (recErr) return NextResponse.json({ error: recErr.message }, { status: 500 })
  return NextResponse.json({ recordings: recordings ?? [] })
}

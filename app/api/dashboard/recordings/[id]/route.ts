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
  const { id: recordingId } = await params
  const firm = await getAuthFirm(request)
  if (!firm) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Recording
  const { data: recording, error: recErr } = await supabaseAdmin
    .from('recordings')
    .select('id, title, status, duration_seconds, created_at, firm_id, client_id, client_name')
    .eq('id', recordingId)
    .eq('firm_id', firm.id)
    .maybeSingle()

  if (recErr || !recording) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Report
  const { data: report } = await supabaseAdmin
    .from('reports')
    .select('id, case_type, content, created_at')
    .eq('recording_id', recordingId)
    .maybeSingle()

  // Transcript
  const { data: transcript } = await supabaseAdmin
    .from('transcripts')
    .select('id, full_text, segments')
    .eq('recording_id', recordingId)
    .maybeSingle()

  // Signed URL (1 hour)
  const storagePath = `recordings/${firm.id}/${recordingId}.m4a`
  const { data: urlData } = await supabaseAdmin.storage
    .from('recordings')
    .createSignedUrl(storagePath, 3600)

  // Linked cases
  const { data: links } = await supabaseAdmin
    .from('recording_case_links')
    .select('id, case_session_id, case_client_name, case_type')
    .eq('recording_id', recordingId)
    .eq('user_id', firm.id)

  return NextResponse.json({
    recording,
    report: report ?? null,
    transcript: transcript ?? null,
    signedUrl: urlData?.signedUrl ?? null,
    linkedCases: links ?? [],
  })
}

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
    .select('id, title, status, duration_seconds, created_at, firm_id, client_id, file_path, recording_type, client:clients(id, name, phone, email)')
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

  // Signed URL (1 hour) - use file_path from database
  let signedUrl = null
  if (recording.file_path) {
    const { data: urlData } = await supabaseAdmin.storage
      .from('recordings')
      .createSignedUrl(recording.file_path, 3600)
    signedUrl = urlData?.signedUrl ?? null
  }

  // Linked cases
  const { data: links } = await supabaseAdmin
    .from('recording_case_links')
    .select('id, case_id, case_client_name, case_type')
    .eq('recording_id', recordingId)
    .eq('user_id', firm.id)

  const linkedCases = links ?? []

  return NextResponse.json({
    recording,
    report: report ?? null,
    transcript: transcript ?? null,
    signedUrl,
    linkedCases,
  })
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: recordingId } = await params
  const firm = await getAuthFirm(request)
  if (!firm) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { title } = body

  if (!title || typeof title !== 'string' || title.trim().length === 0) {
    return NextResponse.json({ error: 'Invalid title' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('recordings')
    .update({ title: title.trim() })
    .eq('id', recordingId)
    .eq('firm_id', firm.id)
    .select('id, title, status, duration_seconds, created_at, firm_id, client_id, file_path, recording_type')
    .single()

  if (error || !data) return NextResponse.json({ error: 'Failed to update' }, { status: 500 })

  return NextResponse.json({ recording: data })
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: recordingId } = await params
  const firm = await getAuthFirm(request)
  if (!firm) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // First check if recording exists and belongs to firm
  const { data: recording } = await supabaseAdmin
    .from('recordings')
    .select('id, file_path, firm_id')
    .eq('id', recordingId)
    .eq('firm_id', firm.id)
    .maybeSingle()

  if (!recording) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Delete file from storage if exists
  if (recording.file_path) {
    await supabaseAdmin.storage.from('recordings').remove([recording.file_path])
  }

  // Delete recording (CASCADE will handle reports, transcripts, links)
  const { error } = await supabaseAdmin
    .from('recordings')
    .delete()
    .eq('id', recordingId)
    .eq('firm_id', firm.id)

  if (error) return NextResponse.json({ error: 'Failed to delete' }, { status: 500 })

  return NextResponse.json({ success: true })
}

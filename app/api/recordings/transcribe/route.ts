import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { transcribeAndSummarize } from '@/services/recordingService'

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
  return firm ? { user, firmId: firm.id as string } : null
}

export async function POST(request: Request) {
  const auth = await getAuthFirm(request)
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { recording_id, session_id, storage_path, mime_type } = await request.json()
  if (!recording_id || !session_id || !storage_path) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  // Download file from Supabase Storage
  const { data: fileData, error: downloadError } = await supabaseAdmin.storage
    .from('recordings')
    .download(storage_path)

  if (downloadError || !fileData) {
    console.error('Storage download error:', downloadError)
    return NextResponse.json({ error: '녹음 파일을 불러오지 못했습니다.' }, { status: 500 })
  }

  const audioBuffer = Buffer.from(await fileData.arrayBuffer())
  const fileName = storage_path.split('/').pop() ?? 'recording.mp3'

  // Transcribe and summarize via Gemini
  let transcript: string
  let caseSummary
  try {
    const result = await transcribeAndSummarize(audioBuffer, mime_type ?? 'audio/mpeg', fileName)
    transcript = result.transcript
    caseSummary = result.caseSummary
  } catch (err) {
    console.error('Transcription error:', err)
    return NextResponse.json({ error: 'AI 처리 중 오류가 발생했습니다.' }, { status: 500 })
  }

  // Save transcript lines as messages (role: customer / lawyer)
  const lines = transcript.split('\n').filter(Boolean)
  const messageInserts = []
  for (const line of lines) {
    if (line.startsWith('고객:') || line.startsWith('고객 :')) {
      messageInserts.push({ session_id, role: 'customer', content: line.replace(/^고객\s*:\s*/, '') })
    } else if (line.startsWith('변호사:') || line.startsWith('변호사 :')) {
      messageInserts.push({ session_id, role: 'lawyer', content: line.replace(/^변호사\s*:\s*/, '') })
    }
  }
  if (messageInserts.length > 0) {
    await supabaseAdmin.from('messages').insert(messageInserts)
  }

  // Upsert or create client if we have name + phone
  let clientId: string | null = null
  if (caseSummary.client_name && caseSummary.client_phone) {
    const phone = caseSummary.client_phone.replace(/[^0-9]/g, '')
    const { data: existingClient } = await supabaseAdmin
      .from('clients')
      .select('id')
      .eq('firm_id', auth.firmId)
      .eq('phone', caseSummary.client_phone)
      .maybeSingle()

    if (existingClient) {
      clientId = existingClient.id
      await supabaseAdmin.from('clients').update({
        last_contact_at: new Date().toISOString(),
        ...(caseSummary.client_email ? { email: caseSummary.client_email } : {}),
      }).eq('id', clientId)
    } else {
      const { data: newClient } = await supabaseAdmin
        .from('clients')
        .insert({
          firm_id: auth.firmId,
          name: caseSummary.client_name,
          phone: caseSummary.client_phone,
          email: caseSummary.client_email ?? null,
          last_contact_at: new Date().toISOString(),
        })
        .select('id')
        .single()
      if (newClient) clientId = newClient.id
    }

    // Update session with client_id
    if (clientId) {
      await supabaseAdmin.from('sessions').update({ client_id: clientId, status: 'completed', completed_at: new Date().toISOString() }).eq('id', session_id)
    }
  } else {
    // Mark session completed even without client
    await supabaseAdmin.from('sessions').update({ status: 'completed', completed_at: new Date().toISOString() }).eq('id', session_id)
  }

  // Insert case summary
  const summaryPayload = {
    session_id,
    firm_id: auth.firmId,
    client_id: clientId,
    client_name: caseSummary.client_name ?? '미확인',
    client_phone: caseSummary.client_phone ?? null,
    client_email: caseSummary.client_email ?? null,
    is_proxy: caseSummary.is_proxy ?? false,
    contact_name: caseSummary.contact_name ?? null,
    contact_phone: caseSummary.contact_phone ?? null,
    contact_email: caseSummary.contact_email ?? null,
    contact_relation: caseSummary.contact_relation ?? null,
    case_type: caseSummary.case_type ?? '기타',
    urgency: caseSummary.urgency ?? 'normal',
    urgency_reason: caseSummary.urgency_reason ?? null,
    status: 'new',
    summary: caseSummary,
  }

  const { data: savedCase, error: summaryError } = await supabaseAdmin
    .from('case_summaries')
    .insert(summaryPayload)
    .select('id')
    .single()

  if (summaryError) {
    console.error('Case summary insert error:', summaryError)
    return NextResponse.json({ error: '사건 저장에 실패했습니다.' }, { status: 500 })
  }

  return NextResponse.json({
    case_id: savedCase.id,
    session_id,
    status: 'completed',
  })
}

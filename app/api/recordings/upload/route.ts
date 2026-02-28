import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { randomUUID } from 'crypto'

const ALLOWED_MIME_TYPES: Record<string, string> = {
  mp3: 'audio/mpeg',
  m4a: 'audio/mp4',
  wav: 'audio/wav',
  ogg: 'audio/ogg',
  mp4: 'audio/mp4',
}

const MAX_FILE_SIZE = 100 * 1024 * 1024 // 100MB

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

  const formData = await request.formData()
  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: '파일 크기가 100MB를 초과합니다.' }, { status: 400 })
  }

  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
  const mimeType = ALLOWED_MIME_TYPES[ext] ?? file.type
  if (!Object.values(ALLOWED_MIME_TYPES).includes(mimeType)) {
    return NextResponse.json({ error: '지원하지 않는 파일 형식입니다. (mp3, m4a, wav, ogg)' }, { status: 400 })
  }

  const recordingId = randomUUID()
  const storagePath = `${auth.firmId}/${recordingId}.${ext}`

  const arrayBuffer = await file.arrayBuffer()
  const { error: uploadError } = await supabaseAdmin.storage
    .from('recordings')
    .upload(storagePath, arrayBuffer, { contentType: mimeType, upsert: false })

  if (uploadError) {
    console.error('Storage upload error:', uploadError)
    return NextResponse.json({ error: '파일 업로드에 실패했습니다.' }, { status: 500 })
  }

  // Create a pending session for this recording
  const sessionId = randomUUID()
  const { error: sessionError } = await supabaseAdmin.from('sessions').insert({
    id: sessionId,
    firm_id: auth.firmId,
    channel: 'recording',
    status: 'active',
    user_id: `recording_${recordingId}`,
  })

  if (sessionError) {
    console.error('Session create error:', sessionError)
    return NextResponse.json({ error: 'DB 저장 실패' }, { status: 500 })
  }

  // Save file metadata
  await supabaseAdmin.from('files').insert({
    id: recordingId,
    session_id: sessionId,
    firm_id: auth.firmId,
    storage_path: storagePath,
    file_type: ext,
    category: 'recording',
    description: file.name,
  })

  return NextResponse.json({
    recording_id: recordingId,
    session_id: sessionId,
    storage_path: storagePath,
    mime_type: mimeType,
    status: 'uploaded',
  })
}

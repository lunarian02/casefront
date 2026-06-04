import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { randomUUID } from 'crypto'

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

export async function POST(request: Request) {
  const firm = await getAuthFirm(request)
  if (!firm) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const clientName = formData.get('client_name') as string | null
    const memo = formData.get('memo') as string | null

    if (!file) {
      return NextResponse.json({ error: '파일이 없습니다.' }, { status: 400 })
    }

    if (!clientName?.trim()) {
      return NextResponse.json({ error: '의뢰인 이름을 입력해주세요.' }, { status: 400 })
    }

    // Validate file type and size
    const fileName = file.name.toLowerCase()
    const ext = fileName.match(/\.(mp3|m4a|wav|ogg)$/)?.[1]
    if (!ext) {
      return NextResponse.json({ error: '지원되지 않는 파일 형식입니다.' }, { status: 400 })
    }

    const MAX_SIZE = 500 * 1024 * 1024 // 500MB
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: '파일 크기가 500MB를 초과합니다.' }, { status: 400 })
    }

    // Generate recording ID
    const recordingId = randomUUID()

    // Upload to Supabase Storage
    const storagePath = `${firm.id}/${recordingId}.${ext}`
    const arrayBuffer = await file.arrayBuffer()
    const { error: uploadError } = await supabaseAdmin.storage
      .from('recordings')
      .upload(storagePath, arrayBuffer, {
        contentType: file.type || `audio/${ext}`,
        upsert: false,
      })

    if (uploadError) {
      console.error('Storage upload error:', uploadError)
      return NextResponse.json({ error: '파일 업로드 실패' }, { status: 500 })
    }

    // Find client by name (case-insensitive)
    const { data: existingClient } = await supabaseAdmin
      .from('clients')
      .select('id')
      .eq('firm_id', firm.id)
      .ilike('name', clientName.trim())
      .maybeSingle()

    // Insert recording
    const { data: recording, error: insertError } = await supabaseAdmin
      .from('recordings')
      .insert({
        id: recordingId,
        firm_id: firm.id,
        client_id: existingClient?.id || null,
        client_name: clientName.trim(),
        title: memo?.trim() || null,
        file_path: storagePath,
        status: 'uploaded',
        source: 'web',
        recording_type: 'uploaded',
      })
      .select('id')
      .single()

    if (insertError) {
      console.error('Recording insert error:', insertError)
      // Cleanup uploaded file
      await supabaseAdmin.storage.from('recordings').remove([storagePath])
      return NextResponse.json({ error: '녹음 정보 저장 실패' }, { status: 500 })
    }

    return NextResponse.json({ recording })
  } catch (error) {
    console.error('Upload error:', error)
    return NextResponse.json({ error: '업로드 중 오류가 발생했습니다.' }, { status: 500 })
  }
}

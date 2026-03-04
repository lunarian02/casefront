import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

async function getAuthUser(request: Request) {
  const token = request.headers.get('Authorization')?.replace('Bearer ', '')
  if (!token) return null
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token)
  if (error || !user) return null
  return user
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: sessionId } = await params
  const user = await getAuthUser(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabaseAdmin
    .from('appointments')
    .select('id, title, appointment_type, scheduled_at, memo, created_at')
    .eq('session_id', sessionId)
    .eq('user_id', user.id)
    .order('scheduled_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ appointments: data ?? [] })
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: sessionId } = await params
  const user = await getAuthUser(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { title, appointment_type, scheduled_at, memo } = body

  if (!title?.trim() || !scheduled_at) {
    return NextResponse.json({ error: '제목과 날짜/시간은 필수입니다.' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('appointments')
    .insert({
      session_id: sessionId,
      user_id: user.id,
      title: title.trim(),
      appointment_type: appointment_type ?? 'other',
      scheduled_at,
      memo: memo?.trim() || null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ appointment: data }, { status: 201 })
}

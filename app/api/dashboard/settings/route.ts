import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

async function getAuthFirm(request: Request) {
  const token = request.headers.get('Authorization')?.replace('Bearer ', '')
  if (!token) return null

  const {
    data: { user },
    error,
  } = await supabaseAdmin.auth.getUser(token)
  if (error || !user?.email) return null

  const { data: firm } = await supabaseAdmin
    .from('firms')
    .select('*')
    .eq('lawyer_email', user.email)
    .maybeSingle()

  return firm ?? null
}

export async function GET(request: Request) {
  const firm = await getAuthFirm(request)
  if (!firm) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  return NextResponse.json({ firm })
}

export async function PATCH(request: Request) {
  const firm = await getAuthFirm(request)
  if (!firm) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()

  // Only allow safe fields to be updated
  const allowed = ['name', 'lawyer_name', 'phone', 'hours', 'specialties', 'greeting', 'notification_email', 'notification_new_case', 'notification_urgent_only']
  const updates: Record<string, unknown> = {}
  for (const key of allowed) {
    if (key in body) updates[key] = body[key]
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: '수정할 항목이 없습니다.' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('firms')
    .update(updates)
    .eq('id', firm.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ firm: data })
}

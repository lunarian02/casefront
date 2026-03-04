import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

async function getAuthUser(request: Request) {
  const token = request.headers.get('Authorization')?.replace('Bearer ', '')
  if (!token) return null
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token)
  if (error || !user) return null
  return user
}

export async function PATCH(request: Request, { params }: { params: Promise<{ aptId: string }> }) {
  const { aptId } = await params
  const user = await getAuthUser(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { title, appointment_type, scheduled_at, memo } = body

  const { data, error } = await supabaseAdmin
    .from('appointments')
    .update({
      ...(title !== undefined && { title: title.trim() }),
      ...(appointment_type !== undefined && { appointment_type }),
      ...(scheduled_at !== undefined && { scheduled_at }),
      ...(memo !== undefined && { memo: memo?.trim() || null }),
      updated_at: new Date().toISOString(),
    })
    .eq('id', aptId)
    .eq('user_id', user.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ appointment: data })
}

export async function DELETE(request: Request, { params }: { params: Promise<{ aptId: string }> }) {
  const { aptId } = await params
  const user = await getAuthUser(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { error } = await supabaseAdmin
    .from('appointments')
    .delete()
    .eq('id', aptId)
    .eq('user_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return new NextResponse(null, { status: 204 })
}

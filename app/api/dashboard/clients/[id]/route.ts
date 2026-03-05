import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

async function getAuthFirmId(request: Request): Promise<string | null> {
  const token = request.headers.get('Authorization')?.replace('Bearer ', '')
  if (!token) return null

  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token)
  if (error || !user?.email) return null

  const { data: firm } = await supabaseAdmin
    .from('firms')
    .select('id')
    .eq('lawyer_email', user.email)
    .maybeSingle()

  return firm?.id ?? null
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: clientId } = await params
  const firmId = await getAuthFirmId(request)
  if (!firmId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const allowed: Record<string, unknown> = {}
  if (body.name) allowed.name = body.name
  if (body.phone) allowed.phone = body.phone
  if ('email' in body) allowed.email = body.email || null
  if ('referrer' in body) allowed.referrer = body.referrer || null

  if (Object.keys(allowed).length === 0) {
    return NextResponse.json({ error: '수정할 항목이 없습니다.' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('clients')
    .update(allowed)
    .eq('id', clientId)
    .eq('firm_id', firmId)
    .select('id, name, phone, email, referrer')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ client: data })
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: clientId } = await params
  const firmId = await getAuthFirmId(request)
  if (!firmId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Unlink client from cases before deleting
  await supabaseAdmin.from('cases').update({ client_id: null }).eq('client_id', clientId).eq('firm_id', firmId)

  const { error } = await supabaseAdmin
    .from('clients')
    .delete()
    .eq('id', clientId)
    .eq('firm_id', firmId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: clientId } = await params

  const firmId = await getAuthFirmId(request)
  if (!firmId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Fetch client (firm_id check = security)
  const { data: client, error: clientError } = await supabaseAdmin
    .from('clients')
    .select('id, name, phone, email, referrer, created_at, last_contact_at')
    .eq('id', clientId)
    .eq('firm_id', firmId)
    .maybeSingle()

  if (clientError || !client) {
    return NextResponse.json({ error: 'Client not found' }, { status: 404 })
  }

  // Fetch all cases for this client
  const { data: cases } = await supabaseAdmin
    .from('cases')
    .select('id, session_id, case_type, status, summary, created_at')
    .eq('client_id', clientId)
    .order('created_at', { ascending: false })

  // Fetch recordings linked to this client
  const { data: recordings } = await supabaseAdmin
    .from('recordings')
    .select('id, title, status, duration_seconds, created_at')
    .eq('client_id', clientId)
    .eq('firm_id', firmId)
    .order('created_at', { ascending: false })

  return NextResponse.json({
    client,
    cases: cases ?? [],
    recordings: recordings ?? [],
  })
}

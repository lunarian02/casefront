import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, '')
  if (digits.length === 11) return digits.replace(/(\d{3})(\d{4})(\d{4})/, '$1-$2-$3')
  if (digits.length === 10) return digits.replace(/(\d{3})(\d{3})(\d{4})/, '$1-$2-$3')
  return raw
}

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

export async function POST(request: Request) {
  const firmId = await getAuthFirmId(request)
  if (!firmId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  if (!body.name || !body.phone) {
    return NextResponse.json({ error: '이름과 전화번호는 필수입니다.' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('clients')
    .insert({
      firm_id: firmId,
      name: body.name.trim(),
      phone: normalizePhone(body.phone),
      email: body.email ? body.email.toLowerCase().trim() : null,
    })
    .select('id, name, phone, email, created_at, last_contact_at')
    .single()

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: '이미 등록된 전화번호입니다.' }, { status: 409 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ client: { ...data, case_count: 0 } })
}

export async function GET(request: Request) {
  const firmId = await getAuthFirmId(request)
  if (!firmId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: clients, error } = await supabaseAdmin
    .from('clients')
    .select('id, name, phone, email, created_at, last_contact_at')
    .eq('firm_id', firmId)
    .order('last_contact_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!clients || clients.length === 0) {
    return NextResponse.json({ clients: [] })
  }

  // case count per client
  const { data: summaryRows } = await supabaseAdmin
    .from('case_summaries')
    .select('client_id')
    .eq('firm_id', firmId)
    .not('client_id', 'is', null)

  const caseCountMap: Record<string, number> = {}
  for (const row of summaryRows ?? []) {
    if (row.client_id) {
      caseCountMap[row.client_id] = (caseCountMap[row.client_id] ?? 0) + 1
    }
  }

  const result = clients.map((c) => ({
    ...c,
    case_count: caseCountMap[c.id] ?? 0,
  }))

  return NextResponse.json({ clients: result })
}

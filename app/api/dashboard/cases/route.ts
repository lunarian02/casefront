import { NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase'

function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, '')
  if (digits.length === 11) return digits.replace(/(\d{3})(\d{4})(\d{4})/, '$1-$2-$3')
  if (digits.length === 10) return digits.replace(/(\d{3})(\d{3})(\d{4})/, '$1-$2-$3')
  return raw
}

async function getAuthUser(request: Request) {
  const token = request.headers.get('Authorization')?.replace('Bearer ', '')
  if (!token) return null
  const {
    data: { user },
    error,
  } = await supabaseAdmin.auth.getUser(token)
  if (error || !user) return null
  return user
}

const PAGE_LIMIT = 20

export async function GET(request: Request) {
  const user = await getAuthUser(request)
  if (!user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: firm, error: firmError } = await supabaseAdmin
    .from('firms')
    .select('id')
    .eq('lawyer_email', user.email)
    .maybeSingle()

  if (firmError || !firm) {
    return NextResponse.json({ error: 'Firm not found' }, { status: 404 })
  }

  const url = new URL(request.url)
  const offset = Math.max(0, parseInt(url.searchParams.get('offset') ?? '0', 10))

  const [countResult, casesResult] = await Promise.all([
    supabaseAdmin
      .from('cases')
      .select('id', { count: 'exact', head: true })
      .eq('firm_id', firm.id),
    supabaseAdmin
      .from('cases')
      .select(`
        id, session_id, case_type, status, is_proxy, contact_name, contact_relation, created_at,
        client:clients(id, name, phone, email, referrer)
      `)
      .eq('firm_id', firm.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + PAGE_LIMIT - 1),
  ])

  if (casesResult.error) {
    return NextResponse.json({ error: casesResult.error.message }, { status: 500 })
  }

  return NextResponse.json({ cases: casesResult.data ?? [], total: countResult.count ?? 0 })
}

// POST /api/dashboard/cases — 상담 기록에서 새 사건 생성 (최소 데이터)
export async function POST(request: Request) {
  const user = await getAuthUser(request)
  if (!user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: firm } = await supabaseAdmin
    .from('firms')
    .select('id')
    .eq('lawyer_email', user.email)
    .maybeSingle()
  if (!firm) return NextResponse.json({ error: 'Firm not found' }, { status: 404 })

  const body = await request.json()
  const { client_name, client_phone, case_type } = body as Record<string, string>

  if (!client_name?.trim()) return NextResponse.json({ error: '이름을 입력해 주세요.' }, { status: 400 })
  if (!client_phone?.trim()) return NextResponse.json({ error: '전화번호를 입력해 주세요.' }, { status: 400 })

  const normalizedPhone = normalizePhone(client_phone.trim())

  // Step 1: UPSERT client (phone 기준으로 기존 고객 찾기 or 생성)
  const { data: client, error: clientError } = await supabaseAdmin
    .from('clients')
    .upsert(
      {
        firm_id: firm.id,
        phone: normalizedPhone,
        name: client_name.trim(),
      },
      { onConflict: 'firm_id,phone', ignoreDuplicates: false }
    )
    .select('id')
    .single()

  if (clientError || !client) {
    return NextResponse.json({ error: clientError?.message ?? '고객 생성 실패' }, { status: 500 })
  }

  // Step 2: Create case_summary with client_id
  const sessionId = randomUUID()
  const { data, error } = await supabaseAdmin
    .from('cases')
    .insert({
      firm_id: firm.id,
      session_id: sessionId,
      client_id: client.id,
      case_type: case_type?.trim() || null,
      status: 'new',
      summary: {
        events: [], requirements: [], evidence: [], unconfirmed: [],
        document_request: [], client_request: '', ai_notes: '', summary_text: '',
        conversation_turns: 0, timestamp: new Date().toISOString(),
      },
    })
    .select(`
      id, session_id, case_type, status, created_at,
      client:clients(id, name, phone, email, referrer)
    `)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ case: data })
}

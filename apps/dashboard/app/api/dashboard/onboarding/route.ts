import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

async function getAuthUser(request: Request) {
  const token = request.headers.get('Authorization')?.replace('Bearer ', '')
  if (!token) return null

  const {
    data: { user },
    error,
  } = await supabaseAdmin.auth.getUser(token)
  if (error || !user?.email) return null
  return user
}

// GET: check if onboarding is done (firm exists)
export async function GET(request: Request) {
  const user = await getAuthUser(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: firm } = await supabaseAdmin
    .from('firms')
    .select('id, name, lawyer_name, phone, notify_email')
    .eq('lawyer_email', user.email)
    .maybeSingle()

  return NextResponse.json({ firm: firm ?? null })
}

// POST: create firm + subscription (onboarding)
export async function POST(request: Request) {
  const user = await getAuthUser(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Check if firm already exists
  const { data: existing } = await supabaseAdmin
    .from('firms')
    .select('id')
    .eq('lawyer_email', user.email)
    .maybeSingle()

  if (existing) {
    return NextResponse.json({ error: '이미 사무소가 등록되어 있습니다.' }, { status: 409 })
  }

  const body = await request.json()
  const { name, lawyer_name, phone, notify_email } = body

  if (!name || !lawyer_name || !phone || !notify_email) {
    return NextResponse.json({ error: '모든 필수 항목을 입력해주세요.' }, { status: 400 })
  }

  // Create firm
  const { data: firm, error: firmError } = await supabaseAdmin
    .from('firms')
    .insert({
      name,
      lawyer_name,
      lawyer_email: user.email,
      phone,
      notify_email,
    })
    .select()
    .single()

  if (firmError) return NextResponse.json({ error: firmError.message }, { status: 500 })

  // Create free trial subscription
  const { error: subError } = await supabaseAdmin
    .from('subscriptions')
    .insert({
      firm_id: firm.id,
      plan: 'free_trial',
      status: 'active',
      minutes_used: 0,
      free_trial_used: false,
      base_fee_krw: 19900,
      per_minute_krw: 250,
    })

  if (subError) {
    console.error('Subscription creation failed:', subError.message)
    // Don't fail onboarding if subscription fails — can retry later
  }

  return NextResponse.json({ firm })
}

// PATCH: update firm during/after onboarding
export async function PATCH(request: Request) {
  const user = await getAuthUser(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: firm } = await supabaseAdmin
    .from('firms')
    .select('id')
    .eq('lawyer_email', user.email)
    .maybeSingle()

  if (!firm) return NextResponse.json({ error: 'Firm not found' }, { status: 404 })

  const body = await request.json()
  const allowedCols = ['name', 'lawyer_name', 'phone', 'notify_email']

  const updates: Record<string, unknown> = {}
  for (const key of allowedCols) {
    if (key in body) updates[key] = body[key]
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: '수정할 항목이 없습니다.' }, { status: 400 })
  }

  const { data: updated, error } = await supabaseAdmin
    .from('firms')
    .update(updates)
    .eq('id', firm.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ firm: updated })
}

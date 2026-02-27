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
    .select('id, name, slug, lawyer_name, phone, hours, specialties, greeting, logo_url')
    .eq('lawyer_email', user.email)
    .maybeSingle()

  return NextResponse.json({ firm: firm ?? null })
}

// POST: create firm (onboarding step 1)
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
  const { name, lawyer_name, phone, hours, specialties, greeting } = body

  if (!name || !lawyer_name) {
    return NextResponse.json({ error: '사무소명과 변호사 이름은 필수입니다.' }, { status: 400 })
  }

  // Generate unique slug (8 alphanumeric chars)
  const slug = Math.random().toString(36).slice(2, 10)

  const { data: firm, error } = await supabaseAdmin
    .from('firms')
    .insert({
      name,
      slug,
      lawyer_name,
      lawyer_email: user.email,
      phone: phone ?? null,
      hours: hours ?? null,
      specialties: specialties ?? [],
      greeting: greeting ?? `안녕하세요, ${name}입니다. 어떤 일로 연락 주셨나요?`,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

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
  const allowedCols = ['name', 'lawyer_name', 'phone', 'hours', 'specialties', 'greeting', 'logo_url']

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

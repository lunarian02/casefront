import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

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

  const { data: cases, error } = await supabaseAdmin
    .from('case_summaries')
    .select('id, session_id, client_name, client_phone, client_email, case_type, urgency, urgency_reason, status, is_proxy, contact_name, contact_relation, created_at')
    .eq('firm_id', firm.id)
    .order('created_at', { ascending: false })
    .limit(100)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ cases })
}

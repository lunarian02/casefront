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

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: sessionId } = await params

  const user = await getAuthUser(request)
  if (!user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: firm } = await supabaseAdmin
    .from('firms')
    .select('id')
    .eq('lawyer_email', user.email)
    .maybeSingle()

  if (!firm) {
    return NextResponse.json({ error: 'Firm not found' }, { status: 404 })
  }

  const { data: caseData, error: caseError } = await supabaseAdmin
    .from('case_summaries')
    .select('*')
    .eq('session_id', sessionId)
    .eq('firm_id', firm.id)
    .maybeSingle()

  if (caseError || !caseData) {
    return NextResponse.json({ error: 'Case not found' }, { status: 404 })
  }

  const { data: messages } = await supabaseAdmin
    .from('messages')
    .select('role, content, created_at')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true })

  return NextResponse.json({ case: caseData, messages: messages ?? [] })
}

import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

async function getAuthFirm(request: Request) {
  const token = request.headers.get('Authorization')?.replace('Bearer ', '')
  if (!token) return null
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token)
  if (error || !user?.email) return null
  const { data: firm } = await supabaseAdmin
    .from('firms')
    .select('id')
    .eq('lawyer_email', user.email)
    .maybeSingle()
  return firm ?? null
}

export async function GET(request: Request) {
  const firm = await getAuthFirm(request)
  if (!firm) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabaseAdmin
    .from('recordings')
    .select('id, title, status, duration_seconds, created_at, reports(case_type)')
    .eq('firm_id', firm.id)
    .order('created_at', { ascending: false })
    .limit(200)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Flatten reports join
  const recordings = (data ?? []).map((r: Record<string, unknown>) => {
    const reports = r.reports as { case_type?: string } | { case_type?: string }[] | null
    const caseType = Array.isArray(reports) ? reports[0]?.case_type : reports?.case_type
    return { ...r, case_type: caseType ?? null, reports: undefined }
  })

  return NextResponse.json({ recordings })
}

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

const PAGE_LIMIT = 20

export async function GET(request: Request) {
  const firm = await getAuthFirm(request)
  if (!firm) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const url = new URL(request.url)
  const offset = Math.max(0, parseInt(url.searchParams.get('offset') ?? '0', 10))

  const [countResult, dataResult] = await Promise.all([
    supabaseAdmin
      .from('recordings')
      .select('id', { count: 'exact', head: true })
      .eq('firm_id', firm.id)
      .in('status', ['completed', 'failed']),
    supabaseAdmin
      .from('recordings')
      .select('id, title, status, duration_seconds, created_at, recording_type, reports(case_type), client:clients(id, name, phone)')
      .eq('firm_id', firm.id)
      .in('status', ['completed', 'failed'])
      .order('created_at', { ascending: false })
      .range(offset, offset + PAGE_LIMIT - 1),
  ])

  if (dataResult.error) return NextResponse.json({ error: dataResult.error.message }, { status: 500 })

  // Flatten reports join
  const recordings = (dataResult.data ?? []).map((r: Record<string, unknown>) => {
    const reports = r.reports as { case_type?: string } | { case_type?: string }[] | null
    const caseType = Array.isArray(reports) ? reports[0]?.case_type : reports?.case_type
    return { ...r, case_type: caseType ?? null, reports: undefined }
  })

  return NextResponse.json({ recordings, total: countResult.count ?? 0 })
}

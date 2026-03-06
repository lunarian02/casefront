/**
 * POST /api/dashboard/cases/[id]/consolidated-report
 *   → Fetch all transcripts for linked recordings → Gemini 2.5 Flash → INSERT reports (type: 'consolidated')
 *
 * GET /api/dashboard/cases/[id]/consolidated-report
 *   → Return existing consolidated report for this case
 */
import { NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { supabaseAdmin } from '@/lib/supabase'

const CONSOLIDATED_SYSTEM_PROMPT = `당신은 대한민국 변호사를 위한 AI 사건 분석 어시스턴트입니다.
아래는 동일 사건과 관련된 여러 차례의 상담 분석 결과와 기존 사건 정보입니다.
중복을 제거하고 시간순으로 통합하여 JSON 구조로 정리하세요.
변호사가 수정한 기존 사건 정보의 내용을 우선 유지하세요.

응답 형식 (JSON):
{
  "overview": "통합된 사건 개요 (2~3문장)",
  "facts": "통합된 사실관계 (시간순, 마크다운 가능)",
  "legal_elements": "통합된 요건사실 (법적 요건 분석)",
  "evidence": [
    {"item": "증거명", "status": "확보|미확보|확보 가능", "url": null}
  ]
}

규칙:
- 상담 간 모순되는 내용은 최신 상담 기준
- 변호사가 수정한 내용(existing_detail)은 최대한 보존
- evidence는 중복 제거 후 통합
- 반드시 위 JSON 형식으로만 응답`

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

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: caseId } = await params
  const firm = await getAuthFirm(request)
  if (!firm) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Verify case exists
  const { data: caseRow } = await supabaseAdmin
    .from('cases')
    .select('id')
    .eq('id', caseId)
    .eq('firm_id', firm.id)
    .maybeSingle()

  if (!caseRow) return NextResponse.json({ report: null })

  const { data: report } = await supabaseAdmin
    .from('reports')
    .select('id, content, category, subcategory, llm_model, created_at')
    .eq('case_id', caseId)
    .eq('report_type', 'consolidated')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  return NextResponse.json({ report: report ?? null })
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: caseId } = await params
  const firm = await getAuthFirm(request)
  if (!firm) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Fetch case with existing detail
  const { data: caseRow } = await supabaseAdmin
    .from('cases')
    .select('id, detail, category, subcategory')
    .eq('id', caseId)
    .eq('firm_id', firm.id)
    .maybeSingle()

  if (!caseRow) return NextResponse.json({ error: 'Case not found' }, { status: 404 })

  const existingDetail = (caseRow.detail as Record<string, unknown>) || {}

  // Fetch all linked recordings
  const { data: links, error: linkErr } = await supabaseAdmin
    .from('recording_case_links')
    .select('recording_id')
    .eq('case_id', caseId)
    .eq('user_id', firm.id)

  if (linkErr || !links || links.length < 2) {
    return NextResponse.json({ error: '상담 기록이 2개 이상 연결되어야 합니다.' }, { status: 400 })
  }

  const recordingIds = links.map((l: { recording_id: string }) => l.recording_id)

  // Fetch reports with structured data
  const { data: reports, error: reportsErr } = await supabaseAdmin
    .from('reports')
    .select('id, structured, category, subcategory, created_at')
    .in('recording_id', recordingIds)
    .order('created_at', { ascending: true })

  if (reportsErr || !reports || reports.length === 0) {
    return NextResponse.json({ error: '상담 분석 리포트를 찾을 수 없습니다.' }, { status: 404 })
  }

  // Build prompt with structured data
  const structuredList = reports.map((r, i) => JSON.stringify({ index: i + 1, ...r.structured }, null, 2)).join('\n\n')
  const promptText = `기존 사건 정보 (변호사가 수정한 내용, 최대한 보존):
${JSON.stringify(existingDetail, null, 2)}

상담 분석 결과 (${reports.length}개):
${structuredList}

위 내용을 통합하여 JSON 형식으로 응답하세요.`

  // Call Gemini 2.5 Flash
  const apiKey = process.env.GOOGLE_AI_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'AI API key not configured' }, { status: 500 })

  const genAI = new GoogleGenerativeAI(apiKey)
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    generationConfig: { maxOutputTokens: 8192, temperature: 0.3, responseMimeType: 'application/json' },
    systemInstruction: CONSOLIDATED_SYSTEM_PROMPT,
  })

  const result = await model.generateContent(promptText)
  const responseText = result.response.text()
  if (!responseText) {
    return NextResponse.json({ error: 'AI가 리포트를 생성하지 못했습니다.' }, { status: 502 })
  }

  // Parse JSON
  let consolidatedDetail: Record<string, unknown>
  try {
    consolidatedDetail = JSON.parse(responseText)
  } catch (err) {
    return NextResponse.json({ error: 'AI 응답 파싱 실패' }, { status: 502 })
  }

  // Update cases.detail
  const { error: updateErr } = await supabaseAdmin
    .from('cases')
    .update({ detail: consolidatedDetail })
    .eq('id', caseId)

  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 })

  // Also insert consolidated report for history
  const reportContent = `# 통합 사건 리포트

## 사건 개요
${consolidatedDetail.overview || ''}

## 사실관계
${consolidatedDetail.facts || ''}

## 요건사실
${consolidatedDetail.legal_elements || ''}

## 관련 증거
${Array.isArray(consolidatedDetail.evidence) ? consolidatedDetail.evidence.map((e: { item: string }) => `- ${e.item}`).join('\n') : ''}`

  await supabaseAdmin
    .from('reports')
    .insert({
      case_id: caseId,
      recording_id: null,
      transcript_id: null,
      content: reportContent,
      structured: consolidatedDetail,
      report_type: 'consolidated',
      category: caseRow.category,
      subcategory: caseRow.subcategory,
      llm_model: 'gemini-2.5-flash',
      llm_cost_usd: 0,
    })

  return NextResponse.json({ success: true, detail: consolidatedDetail })
}

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
아래는 동일 사건과 관련된 여러 차례의 상담 녹음 전문(轉文)입니다.
모든 상담 내용을 종합하여 통합 사건 리포트를 작성하세요.

리포트 형식:
1. 사건 개요 (유형, 의뢰인 정보, 상담 횟수)
2. 사실관계 종합 (시간순, 각 상담에서 추가된 정보 통합)
3. 핵심 쟁점 (유리한 점 / 불리한 점)
4. 증거 현황 (확보 / 추가 필요, 변화 추이)
5. 상담별 변호사 조언 요약
6. 다음 단계 (To-Do, 우선순위, 최신 기준)
7. 예상 금액 (언급된 것만)

규칙:
- 상담 간 모순되는 내용은 명확히 표시
- 가장 최근 상담 기준으로 현재 상황 정리
- STT 오류는 문맥으로 보정`

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
    .select('id, content, case_type, llm_model, created_at')
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

  // Verify case exists
  const { data: caseRow } = await supabaseAdmin
    .from('cases')
    .select('id')
    .eq('id', caseId)
    .eq('firm_id', firm.id)
    .maybeSingle()

  if (!caseRow) return NextResponse.json({ error: 'Case not found' }, { status: 404 })

  // Fetch all linked recording IDs
  const { data: links, error: linkErr } = await supabaseAdmin
    .from('recording_case_links')
    .select('recording_id')
    .eq('case_id', caseId)
    .eq('user_id', firm.id)

  if (linkErr || !links || links.length < 2) {
    return NextResponse.json({ error: '상담 기록이 2개 이상 연결되어야 합니다.' }, { status: 400 })
  }

  const recordingIds = links.map((l: { recording_id: string }) => l.recording_id)

  // Fetch transcripts with recording info
  const { data: transcriptRows, error: transErr } = await supabaseAdmin
    .from('transcripts')
    .select('id, recording_id, full_text, recordings(title, created_at)')
    .in('recording_id', recordingIds)
    .order('created_at', { ascending: true })

  if (transErr || !transcriptRows || transcriptRows.length === 0) {
    return NextResponse.json({ error: '상담 전문(轉文)을 찾을 수 없습니다.' }, { status: 404 })
  }

  // Build combined transcript text
  const combinedText = transcriptRows
    .map((t: { recordings: unknown; full_text: string }, i: number) => {
      const rec = t.recordings as { title?: string; created_at?: string } | null
      const title = rec?.title ?? `상담 ${i + 1}`
      return `[${i + 1}번째 상담: ${title}]\n${t.full_text}`
    })
    .join('\n\n---\n\n')

  // Call Gemini 2.5 Flash
  const apiKey = process.env.GOOGLE_AI_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'AI API key not configured' }, { status: 500 })

  const genAI = new GoogleGenerativeAI(apiKey)
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    generationConfig: { maxOutputTokens: 8192, temperature: 0.3 },
    systemInstruction: CONSOLIDATED_SYSTEM_PROMPT,
  })

  const result = await model.generateContent(
    `다음은 동일 사건의 여러 차례 상담 전문입니다 (총 ${transcriptRows.length}회):\n\n${combinedText}`
  )
  const reportContent = result.response.text()
  if (!reportContent) {
    return NextResponse.json({ error: 'AI가 리포트를 생성하지 못했습니다.' }, { status: 502 })
  }

  // Detect case type from content
  const caseType = detectCaseType(reportContent)

  // Insert consolidated report
  const { data: report, error: insertErr } = await supabaseAdmin
    .from('reports')
    .insert({
      case_id: caseId,
      recording_id: null,
      transcript_id: null,
      content: reportContent,
      report_type: 'consolidated',
      case_type: caseType,
      llm_model: 'gemini-2.5-flash',
      llm_cost_usd: 0,
    })
    .select('id, content, case_type, llm_model, created_at')
    .single()

  if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 })
  return NextResponse.json({ report })
}

function detectCaseType(content: string): string | null {
  const patterns: Array<[string, RegExp]> = [
    ['형사-폭행', /폭행|상해|쌍방폭행/],
    ['민사-교통사고', /교통사고|과실비율|대차료|수리비/],
    ['민사-손해배상', /손해배상|위자료|치료비/],
    ['가사-이혼', /이혼|재산분할|양육권|면접교섭/],
    ['형사-성범죄', /성추행|성폭행|강제추행/],
    ['민사-부동산', /임대차|전세|보증금|명도/],
    ['형사-사기', /사기|횡령|배임/],
    ['노동', /부당해고|임금체불|퇴직금/],
    ['상속', /상속|유언|유류분/],
    ['형사-마약', /마약|대마|필로폰/],
  ]
  for (const [type, pattern] of patterns) {
    if (pattern.test(content)) return type
  }
  return null
}

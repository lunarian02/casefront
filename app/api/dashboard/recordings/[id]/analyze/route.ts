import { NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { supabaseAdmin } from '@/lib/supabase'

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY!)

const ANALYSIS_SYSTEM_PROMPT = `당신은 대한민국 변호사를 위한 AI 법률 상담 분석 어시스턴트입니다.

상담 녹음 스크립트를 분석하여 지정된 사건 유형(category, subcategory)에 맞는 법률 리포트를 작성하세요.

응답 형식 (JSON):
{
  "summary": "상담 개요 (2-3문장)",
  "client_info": {
    "name": "의뢰인 이름",
    "contact": "연락처",
    "opponent": "상대방 (해당 시)"
  },
  "facts": "사실관계 (시간순, 마크다운 가능)",
  "category": "제공된 대분류",
  "subcategory": "제공된 소분류",
  "legal_elements": {
    "요건명1": {
      "fulfilled": true,
      "content": "해당 요건 충족 여부 및 상세 설명"
    },
    "요건명2": {
      "fulfilled": false,
      "content": "해당 요건 미충족 이유"
    }
  },
  "evidence": ["증거 항목1", "증거 항목2"],
  "overview": "사건 생성용 개요 (1-2문장)"
}

규칙:
- legal_elements는 제공된 요건 목록을 기준으로 작성
- 각 요건별로 fulfilled (true/false) + content 작성
- evidence는 간단한 문자열 배열
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

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: recordingId } = await params
  const firm = await getAuthFirm(request)
  if (!firm) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { category, subcategory } = body

  if (!category || !subcategory) {
    return NextResponse.json({ error: 'category and subcategory required' }, { status: 400 })
  }

  // 1. Fetch recording
  const { data: recording } = await supabaseAdmin
    .from('recordings')
    .select('id, firm_id')
    .eq('id', recordingId)
    .eq('firm_id', firm.id)
    .maybeSingle()

  if (!recording) {
    return NextResponse.json({ error: 'Recording not found' }, { status: 404 })
  }

  // 2. Fetch transcript
  const { data: transcript } = await supabaseAdmin
    .from('transcripts')
    .select('full_text')
    .eq('recording_id', recordingId)
    .maybeSingle()

  if (!transcript?.full_text) {
    return NextResponse.json({ error: 'Transcript not found' }, { status: 404 })
  }

  // 3. Fetch legal template
  const { data: template } = await supabaseAdmin
    .from('legal_templates')
    .select('elements')
    .eq('category', category)
    .eq('subcategory', subcategory)
    .maybeSingle()

  if (!template) {
    return NextResponse.json({ error: 'Template not found' }, { status: 404 })
  }

  // 4. Build prompt
  const promptText = `사건 유형: ${category} > ${subcategory}

요건사실 목록 (이 항목들을 기준으로 legal_elements 작성):
${template.elements.map((el: string) => `- ${el}`).join('\n')}

상담 스크립트:
${transcript.full_text}

위 상담 내용을 분석하여 JSON 형식으로 응답하세요.`

  // 5. Call Gemini
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    generationConfig: {
      maxOutputTokens: 8192,
      temperature: 0.3,
      responseMimeType: 'application/json',
    },
    systemInstruction: ANALYSIS_SYSTEM_PROMPT,
  })

  const result = await model.generateContent(promptText)
  const responseText = result.response.text()

  if (!responseText) {
    return NextResponse.json({ error: 'AI 분석 실패' }, { status: 502 })
  }

  // 6. Parse JSON
  let structured: Record<string, unknown>
  try {
    structured = JSON.parse(responseText)
  } catch (err) {
    return NextResponse.json({ error: 'AI 응답 파싱 실패' }, { status: 502 })
  }

  // 7. Generate markdown content
  const content = `# ${category} > ${subcategory} 분석

## 상담 개요
${structured.summary || ''}

## 사실관계
${structured.facts || ''}

## 요건사실
${Object.entries((structured.legal_elements as Record<string, { fulfilled: boolean; content: string }>) || {})
  .map(([name, el]) => `- **${name}**: ${el.fulfilled ? '✅ 충족' : '❌ 미충족'} — ${el.content}`)
  .join('\n')}

## 관련 증거
${Array.isArray(structured.evidence) ? structured.evidence.map((e: string) => `- ${e}`).join('\n') : ''}

---
*본 리포트는 AI가 상담 녹음을 분석하여 생성한 참고 자료입니다.*`

  // 8. Insert report
  const { data: report, error: reportErr } = await supabaseAdmin
    .from('reports')
    .insert({
      recording_id: recordingId,
      transcript_id: null,
      content,
      structured,
      report_type: 'legal_consultation',
      category,
      subcategory,
      llm_model: 'gemini-2.5-flash',
      llm_cost_usd: 0.002,
    })
    .select()
    .single()

  if (reportErr) {
    return NextResponse.json({ error: reportErr.message }, { status: 500 })
  }

  return NextResponse.json({ report })
}

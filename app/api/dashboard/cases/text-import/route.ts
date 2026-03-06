import { NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { supabaseAdmin } from '@/lib/supabase'

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY!)

const TEXT_IMPORT_PROMPT = `당신은 법률 사건 정보를 구조화하는 AI입니다.
아래 텍스트(에이닷 통화 요약, 상담 메모, 카톡 대화 등)에서 법률 사건 정보를 추출하여
지정된 JSON 형식으로 반환하세요.

현재 시간: ${new Date().toISOString()}

텍스트에서 추출할 항목:
- 당사자 이름, 전화번호, 이메일
- 사건 대분류 category (형사/민사/가사/부동산/노동/행정 중 하나)
- 사건 소분류 subcategory (폭행/사기/절도/손해배상/교통사고/이혼/상속/임대차/명도/부당해고/임금체불 등)
- 주요 사건 경위 (시간순)
- 요건사실 충족 여부
- 증거 목록
- 소멸시효 분석
- 다음 액션 제안

정보가 불완전해도 최대한 추출하세요. 없는 정보는 null로 표시하세요.

응답 형식은 반드시 아래 JSON만 반환하세요 (설명 없이):
{
  "client_name": "홍길동",
  "client_phone": "010-1234-5678",
  "client_email": null,
  "is_returning": false,
  "category": "민사",
  "subcategory": "손해배상",
  "position": null,
  "events": [
    {
      "date": "2024-01-01",
      "subject": "홍길동",
      "object": "김XX",
      "action": "5,000만 원을 대여",
      "summary": "홍길동은 2024. 1. 1. 김XX에게 5,000만 원을 대여하였다"
    }
  ],
  "requirements": [
    { "element": "금전교부", "status": "confirmed", "detail": "상세 내용" }
  ],
  "evidence": [],
  "unconfirmed": [],
  "document_request": [],
  "client_request": "상담 목적",
  "ai_notes": "변호사 참고 메모",
  "legal_analysis": {
    "statute_of_limitations": null,
    "evidence_strength": "moderate",
    "evidence_analysis": "증거 분석",
    "missing_info": [],
    "next_actions": [],
    "risk_factors": []
  },
  "summary_text": "한 줄 요약",
  "conversation_turns": 0,
  "timestamp": "${new Date().toISOString()}"
}`

async function getAuthFirm(request: Request) {
  const token = request.headers.get('Authorization')?.replace('Bearer ', '')
  if (!token) return null
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token)
  if (error || !user?.email) return null

  const { data: firm } = await supabaseAdmin
    .from('firms')
    .select('id, name')
    .eq('lawyer_email', user.email)
    .maybeSingle()

  return firm ? { user, firm } : null
}

export async function POST(request: Request) {
  const auth = await getAuthFirm(request)
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { text?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: '요청 형식이 올바르지 않습니다.' }, { status: 400 })
  }

  const text = body.text?.trim()
  if (!text) {
    return NextResponse.json({ error: '텍스트를 입력해 주세요.' }, { status: 400 })
  }
  if (text.length > 50000) {
    return NextResponse.json({ error: '텍스트가 너무 깁니다. (최대 50,000자)' }, { status: 400 })
  }

  // Call Gemini to structure the text
  let caseSummary: Record<string, unknown>
  try {
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      generationConfig: {
        maxOutputTokens: 4096,
        temperature: 0.3,
        thinkingConfig: { thinkingBudget: 512 },
      } as Record<string, unknown>,
    })

    const prompt = `${TEXT_IMPORT_PROMPT}\n\n=== 분석할 텍스트 ===\n${text}`
    const result = await model.generateContent(prompt)
    const rawText = result.response.text().trim()

    // Extract JSON (handle markdown code fences)
    const jsonMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)```/)
    const jsonStr = jsonMatch ? jsonMatch[1].trim() : rawText
    caseSummary = JSON.parse(jsonStr)
  } catch (error) {
    console.error('AI text import error:', error)
    return NextResponse.json({ error: 'AI 구조화 중 오류가 발생했습니다. 다시 시도해 주세요.' }, { status: 500 })
  }

  // Upsert client if phone is available
  let clientId: string | null = null
  const clientPhone = (caseSummary.client_phone as string | null)?.replace(/[\s\-()]/g, '') ?? null
  const clientName = (caseSummary.client_name as string | null) ?? null

  if (clientPhone && clientName) {
    const { data: client } = await supabaseAdmin
      .from('clients')
      .upsert(
        {
          firm_id: auth.firm.id,
          name: clientName,
          phone: clientPhone,
          email: (caseSummary.client_email as string | null) ?? null,
          last_contact_at: new Date().toISOString(),
        },
        { onConflict: 'firm_id,phone', ignoreDuplicates: false }
      )
      .select('id')
      .single()

    if (client) {
      clientId = client.id
    }
  }

  // Save case
  const { data: caseRecord, error: caseError } = await supabaseAdmin
    .from('cases')
    .insert({
      firm_id: auth.firm.id,
      client_id: clientId,
      category: (caseSummary.category as string | null) ?? null,
      subcategory: (caseSummary.subcategory as string | null) ?? null,
      status: 'new',
      summary: caseSummary,
    })
    .select('id')
    .single()

  if (caseError || !caseRecord) {
    console.error('Case creation error:', caseError)
    return NextResponse.json({ error: '사건 저장 중 오류가 발생했습니다.' }, { status: 500 })
  }

  return NextResponse.json({ case_id: caseRecord.id })
}

import { NextResponse } from 'next/server'
import { getFirmBySlug, getDefaultFirm } from '@/services/firmManager'
import {
  getOrCreateSession,
  saveMessage,
  getHistory,
  saveCaseSummary,
} from '@/services/sessionManager'
import { generateResponse } from '@/services/aiService'
import { notifyLawyer } from '@/services/notifyService'

export async function POST(request: Request) {
  try {
    const { firmSlug, userId, content } = await request.json()

    if (!userId || !content) {
      return NextResponse.json({ error: '필수 항목이 누락되었습니다.' }, { status: 400 })
    }

    // 1. Identify firm by slug
    let firm = firmSlug ? await getFirmBySlug(firmSlug) : null
    if (!firm) {
      firm = await getDefaultFirm()
    }

    if (!firm) {
      return NextResponse.json({ error: '사무소를 찾을 수 없습니다.' }, { status: 404 })
    }

    // 2. Get or create session (channel: 'web')
    const session = await getOrCreateSession(userId, firm.id, 'web')

    // 3. Save user message
    await saveMessage(session.id, 'user', content)

    // 4. Get conversation history
    const history = await getHistory(session.id)

    // 5. Generate AI response
    const { reply, caseSummary } = await generateResponse(history, firm)

    // 6. Save AI reply
    await saveMessage(session.id, 'assistant', reply)

    // 7. If intake complete, save summary and notify lawyer
    if (caseSummary) {
      await saveCaseSummary(session.id, firm.id, caseSummary)
      notifyLawyer(firm, caseSummary, session.id).catch((err) =>
        console.error('Notify failed:', err)
      )
    }

    return NextResponse.json({
      reply,
      sessionId: session.id,
      completed: !!caseSummary,
      firmName: firm.name,
    })
  } catch (error) {
    console.error('Chat API error:', error)
    return NextResponse.json(
      { error: '일시적인 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.' },
      { status: 500 }
    )
  }
}

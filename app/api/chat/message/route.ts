import { NextResponse } from 'next/server'
import { getFirmBySlug, getDefaultFirm } from '@/services/firmManager'
import {
  getOrCreateSession,
  saveMessage,
  getHistory,
  saveCaseSummary,
} from '@/services/sessionManager'
import { generateResponse } from '@/services/aiService'
import { identifyClient, upsertClientFromSummary } from '@/services/clientService'
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

    // 4. Get conversation history (needed for multi-message identity extraction)
    const history = await getHistory(session.id)

    // 5. Try to identify client from message + history (name/phone/email in separate messages)
    const clientContext = await identifyClient(content, history, firm.id, session)

    // 6. Generate AI response (with client context for returning customer hint)
    const { reply, caseSummary } = await generateResponse(history, firm, clientContext)

    // 7. Save AI reply
    await saveMessage(session.id, 'assistant', reply)

    // 8. If intake complete, save summary and notify lawyer
    if (caseSummary) {
      // Use AI-validated summary for reliable client upsert (more reliable than mid-chat regex)
      const resolvedClientId = await upsertClientFromSummary(session.id, firm.id, caseSummary)
      await saveCaseSummary(session.id, firm.id, caseSummary, resolvedClientId ?? clientContext?.clientId)
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

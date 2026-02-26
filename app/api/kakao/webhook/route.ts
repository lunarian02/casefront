import { NextResponse } from 'next/server'
import { getFirmByKakaoChannel, getDefaultFirm } from '@/services/firmManager'
import {
  getOrCreateSession,
  saveMessage,
  getHistory,
  saveCaseSummary,
} from '@/services/sessionManager'
import { generateResponse } from '@/services/aiService'
import { notifyLawyer } from '@/services/notifyService'

const KAKAO_ERROR_RESPONSE = {
  version: '2.0',
  template: {
    outputs: [
      {
        simpleText: {
          text: '죄송합니다, 일시적인 오류가 발생했습니다. 잠시 후 다시 시도해 주시거나 직접 전화 주시기 바랍니다.',
        },
      },
    ],
  },
}

export async function POST(request: Request) {
  try {
    const body = await request.json()

    // 1. Parse Kakao skill request
    const utterance: string = body?.userRequest?.utterance
    const userId: string = body?.userRequest?.user?.id
    const botId: string = body?.bot?.id

    if (!utterance || !userId) {
      return NextResponse.json(KAKAO_ERROR_RESPONSE, { status: 200 })
    }

    // 2. Identify firm by Kakao bot/channel ID
    let firm = botId ? await getFirmByKakaoChannel(botId) : null
    if (!firm) {
      firm = await getDefaultFirm()
    }

    if (!firm) {
      console.error('No firm found for botId:', botId)
      return NextResponse.json(KAKAO_ERROR_RESPONSE, { status: 200 })
    }

    // 3. Get or create session
    const session = await getOrCreateSession(userId, firm.id)

    // 4. Save user message
    await saveMessage(session.id, 'user', utterance)

    // 5. Get full conversation history
    const history = await getHistory(session.id)

    // 6. Generate AI response
    const { reply, caseSummary } = await generateResponse(history, firm)

    // 7. Save AI reply
    await saveMessage(session.id, 'assistant', reply)

    // 8. If case intake is complete, save summary and notify lawyer
    if (caseSummary) {
      await saveCaseSummary(session.id, firm.id, caseSummary)
      // Notify without blocking response (fire and forget)
      notifyLawyer(firm, caseSummary).catch((err) =>
        console.error('Notify failed:', err)
      )
    }

    // 9. Return Kakao skill response format
    return NextResponse.json({
      version: '2.0',
      template: {
        outputs: [{ simpleText: { text: reply } }],
      },
    })
  } catch (error) {
    console.error('Webhook error:', error)
    return NextResponse.json(KAKAO_ERROR_RESPONSE, { status: 200 })
  }
}

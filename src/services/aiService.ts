import { GoogleGenerativeAI } from '@google/generative-ai'
import { getSystemPrompt, getStageHint } from '@/prompts/systemPrompt'
import type { Message, Firm, CaseSummary } from '@/types'
import type { ClientContext } from '@/services/clientService'

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY!)

const CASE_SUMMARY_SEPARATOR = '---CASE_SUMMARY---'

export async function generateResponse(
  history: Message[],
  firm: Firm,
  clientContext?: ClientContext | null
): Promise<{ reply: string; caseSummary?: CaseSummary }> {
  try {
    const systemPrompt = getSystemPrompt(firm, clientContext) + getStageHint(history.length)

    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      systemInstruction: systemPrompt,
      generationConfig: {
        maxOutputTokens: 4096,
        temperature: 0.7,
        // Limit thinking budget so output tokens are sufficient for case summary JSON
        thinkingConfig: {
          thinkingBudget: 1024,
        },
      } as Record<string, unknown>,
    })

    // Convert history to Gemini chat format
    const chatHistory = history.slice(0, -1).map((msg) => ({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.content }],
    }))

    const chat = model.startChat({
      history: chatHistory,
    })

    const lastMessage = history[history.length - 1]
    const result = await chat.sendMessage(lastMessage?.content ?? '')
    const rawText = result.response.text()

    // Parse CASE_SUMMARY if present
    const separatorIndex = rawText.indexOf(CASE_SUMMARY_SEPARATOR)
    if (separatorIndex !== -1) {
      const reply = rawText.substring(0, separatorIndex).trim()
      const jsonPart = rawText.substring(separatorIndex + CASE_SUMMARY_SEPARATOR.length).trim()

      try {
        // Extract JSON block (handle possible markdown code fences)
        const jsonMatch = jsonPart.match(/```(?:json)?\s*([\s\S]*?)```/)
        const jsonStr = jsonMatch ? jsonMatch[1].trim() : jsonPart
        const caseSummary = JSON.parse(jsonStr) as CaseSummary
        return { reply, caseSummary }
      } catch {
        // JSON parse failed — return reply without summary
        return { reply }
      }
    }

    return { reply: rawText.trim() }
  } catch (error) {
    console.error('AI service error:', error)
    return {
      reply: '죄송합니다, 일시적인 오류가 발생했습니다. 잠시 후 다시 말씀해 주시거나, 직접 전화 주시면 친절히 안내해 드리겠습니다.',
    }
  }
}

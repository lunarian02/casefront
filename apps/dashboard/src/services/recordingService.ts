import { GoogleGenerativeAI } from '@google/generative-ai'
import { GoogleAIFileManager } from '@google/generative-ai/server'
import { writeFileSync, unlinkSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import type { CaseSummary } from '@/types'

const CASE_SUMMARY_SEPARATOR = '---CASE_SUMMARY---'

const TRANSCRIPTION_PROMPT = `당신은 법률사무소의 AI 접수 비서입니다.
아래는 변호사와 고객의 통화 녹음을 전사한 내용입니다.

이 통화 내용을 분석하여 다음 두 가지를 출력하세요:

1. 전사 텍스트: 화자를 구분하여 전사 (변호사: / 고객:)
2. CaseSummary JSON: 웹챗 접수와 동일한 형식

주의사항:
- 통화에서 고객의 이름, 전화번호, 이메일이 언급되면 추출
- 언급되지 않았으면 해당 필드는 null로 남김
- 사건유형, 요건사실 판단은 웹챗과 동일 기준 적용
- events[]는 통화에서 언급된 사실관계를 시간순 정리
- 변호사의 법률 조언 내용은 ai_notes에 포함
- conversation_turns는 고객 발언 횟수

출력 형식:
[전사 텍스트 (화자: 내용 형식)]
---CASE_SUMMARY---
{
  "client_name": "...",
  "client_phone": "...",
  "client_email": null,
  "is_proxy": false,
  "contact_name": null,
  "contact_phone": null,
  "contact_email": null,
  "contact_relation": null,
  "is_returning": false,
  "case_type": "...",
  "case_subtype": "...",
  "case_sub_tag": null,
  "position": null,
  "events": [],
  "requirements": [],
  "evidence": [],
  "unconfirmed": [],
  "document_request": [],
  "client_request": "...",
  "ai_notes": "...",
  "summary_text": "...",
  "conversation_turns": 0,
  "timestamp": "${new Date().toISOString()}"
}`

export type TranscriptionResult = {
  transcript: string
  caseSummary: CaseSummary
}

export async function transcribeAndSummarize(
  audioBuffer: Buffer,
  mimeType: string,
  fileName: string
): Promise<TranscriptionResult> {
  const apiKey = process.env.GOOGLE_AI_API_KEY!
  const genAI = new GoogleGenerativeAI(apiKey)

  let rawText: string

  if (audioBuffer.length <= 20 * 1024 * 1024) {
    // Under 20MB: use inline base64
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash',
      generationConfig: { maxOutputTokens: 8192, temperature: 0.3 },
    })

    const result = await model.generateContent([
      TRANSCRIPTION_PROMPT,
      {
        inlineData: {
          mimeType,
          data: audioBuffer.toString('base64'),
        },
      },
    ])
    rawText = result.response.text()
  } else {
    // Over 20MB: write to temp file, use Google File API
    const tmpPath = join(tmpdir(), `cf_recording_${Date.now()}_${fileName}`)
    writeFileSync(tmpPath, audioBuffer)

    const fileManager = new GoogleAIFileManager(apiKey)
    let uploadResult
    try {
      uploadResult = await fileManager.uploadFile(tmpPath, { mimeType, displayName: fileName })
    } finally {
      try { unlinkSync(tmpPath) } catch { /* ignore */ }
    }

    const model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash',
      generationConfig: { maxOutputTokens: 8192, temperature: 0.3 },
    })

    const result = await model.generateContent([
      TRANSCRIPTION_PROMPT,
      { fileData: { mimeType, fileUri: uploadResult.file.uri } },
    ])
    rawText = result.response.text()

    await fileManager.deleteFile(uploadResult.file.name)
  }

  const separatorIndex = rawText.indexOf(CASE_SUMMARY_SEPARATOR)
  if (separatorIndex === -1) {
    throw new Error('AI response missing CASE_SUMMARY separator')
  }

  const transcript = rawText.substring(0, separatorIndex).trim()
  const jsonPart = rawText.substring(separatorIndex + CASE_SUMMARY_SEPARATOR.length).trim()

  const jsonMatch = jsonPart.match(/```(?:json)?\s*([\s\S]*?)```/)
  const jsonStr = jsonMatch ? jsonMatch[1].trim() : jsonPart
  const caseSummary = JSON.parse(jsonStr) as CaseSummary

  return { transcript, caseSummary }
}

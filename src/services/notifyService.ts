import type { Firm, CaseSummary } from '@/types'

const URGENCY_LABELS: Record<CaseSummary['urgency'], string> = {
  urgent: '긴급',
  normal: '일반',
  low: '여유',
}

function buildNotifyMessage(firm: Firm, summary: CaseSummary, caseId?: string): string {
  const urgencyLabel = URGENCY_LABELS[summary.urgency]
  const urgencyPrefix = summary.urgency === 'urgent' ? `[${urgencyLabel}] ` : ''

  let message = `${urgencyPrefix}${summary.case_type} 건 접수 — ${summary.client_name}님\n`
  message += `연락처: ${summary.client_phone}\n`
  message += `요약: ${summary.summary_text}\n`

  if (summary.urgency === 'urgent' && summary.urgency_reason) {
    message += `긴급 사유: ${summary.urgency_reason}\n`
  }

  if (caseId) {
    message += `\n자세히 보기: https://casefront.app/dashboard/cases/${caseId}`
  }

  return message
}

export async function notifyLawyer(
  firm: Firm,
  summary: CaseSummary,
  caseId?: string
): Promise<void> {
  const message = buildNotifyMessage(firm, summary, caseId)

  // Phase 1: Log notification (actual channels added when API keys are configured)
  console.log(`[Notify] ${firm.name} (${firm.lawyer_name}): ${message}`)

  // Phase 1 - Kakao Alimtalk (when KAKAO_ALIMTALK_KEY is set)
  if (process.env.KAKAO_ALIMTALK_KEY && firm.phone) {
    await sendKakaoAlimtalk(firm.phone, message)
  }
}

async function sendKakaoAlimtalk(phone: string, message: string): Promise<void> {
  // TODO: Implement Kakao Alimtalk API call
  // Reference: https://developers.kakao.com/docs/latest/ko/message/rest-api
  console.log(`[KakaoAlimtalk] → ${phone}: ${message}`)
}

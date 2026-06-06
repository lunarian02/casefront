import { Resend } from 'resend'
import type { Firm, CaseSummary } from '@/types'

// Lazy initialization to avoid build-time error when env var is missing
function getResend() {
  return new Resend(process.env.RESEND_API_KEY!)
}

const URGENCY_LABELS: Record<CaseSummary['urgency'], string> = {
  urgent: '긴급',
  normal: '일반',
  low: '여유',
}

export async function notifyLawyer(
  firm: Firm,
  summary: CaseSummary,
  caseId?: string
): Promise<void> {
  if (!firm.lawyer_email) {
    console.log(`[Notify] No email for firm ${firm.name}, skipping`)
    return
  }

  if (!process.env.RESEND_API_KEY) {
    console.log(`[Notify] No RESEND_API_KEY, skipping email`)
    return
  }

  const urgencyLabel = URGENCY_LABELS[summary.urgency]
  const subject = `[CaseFront] 새 접수 — ${summary.case_type} 건 (${urgencyLabel})`
  const dashboardUrl = caseId
    ? `https://app.casefront.app/dashboard/cases/${caseId}`
    : `https://app.casefront.app/dashboard`

  const urgencyBadge =
    summary.urgency === 'urgent'
      ? `🔴 긴급${summary.urgency_reason ? ` — ${summary.urgency_reason}` : ''}`
      : summary.urgency === 'normal'
        ? '🔵 일반'
        : '⚪ 여유'

  const html = `
<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
  <h2 style="color: #1a1a2e;">📋 새 사건 접수 알림</h2>

  <div style="background: #f8f9fa; border-radius: 8px; padding: 16px; margin: 16px 0;">
    <p><strong>사무소:</strong> ${firm.name}</p>
    <p><strong>고객명:</strong> ${summary.client_name}</p>
    <p><strong>연락처:</strong> ${summary.client_phone}</p>
    <p><strong>사건 유형:</strong> ${summary.case_type}</p>
    <p><strong>긴급도:</strong> ${urgencyBadge}</p>
  </div>

  <div style="background: #fff; border-left: 4px solid #4f46e5; padding: 12px 16px; margin: 16px 0;">
    <strong>사건 요약</strong>
    <p style="color: #374151;">${summary.summary_text}</p>
  </div>

  ${
    summary.document_request?.length > 0
      ? `<div style="margin: 16px 0;">
    <strong>요청 증빙자료</strong>
    <ul style="color: #374151;">
      ${summary.document_request.map((d) => `<li>${d}</li>`).join('')}
    </ul>
  </div>`
      : ''
  }

  <a href="${dashboardUrl}" style="display: inline-block; background: #4f46e5; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; margin-top: 16px;">
    대시보드에서 확인하기 →
  </a>

  <p style="color: #9ca3af; font-size: 12px; margin-top: 24px;">
    CaseFront AI 법률 접수 비서 | <a href="https://casefront.app">casefront.app</a>
  </p>
</div>
`

  await getResend().emails.send({
    from: 'CaseFront <noreply@casefront.app>',
    to: firm.lawyer_email,
    subject,
    html,
  })

  console.log(`[Notify] Email sent to ${firm.lawyer_email}`)
}

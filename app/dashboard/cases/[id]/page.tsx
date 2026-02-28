'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import type { CaseSummary } from '@/types'

type CaseDetail = {
  id: number
  session_id: string
  client_id: string | null
  client_name: string
  client_phone: string
  client_email?: string | null
  is_proxy: boolean | null
  contact_name?: string | null
  contact_phone?: string | null
  contact_email?: string | null
  contact_relation?: string | null
  case_type: string
  urgency: 'urgent' | 'normal' | 'low'
  urgency_reason?: string
  status: 'new' | 'reviewing' | 'done' | null
  parent_case_id: number | null
  summary: CaseSummary
  channel: string | null
  created_at: string
}

type Message = {
  role: 'user' | 'assistant' | 'customer' | 'lawyer'
  content: string
  created_at: string
}

type ClientCase = {
  id: number
  session_id: string
  case_type: string
  created_at: string
}

const STATUS_CONFIG = {
  new:       { label: '신규',  style: 'text-yellow-700 bg-yellow-50 border-yellow-200', next: 'reviewing' as const, nextLabel: '검토 시작' },
  reviewing: { label: '검토중', style: 'text-blue-700 bg-blue-50 border-blue-200',     next: 'done' as const,       nextLabel: '완료 처리' },
  done:      { label: '완료',  style: 'text-green-700 bg-green-50 border-green-200',   next: null,                  nextLabel: null },
}

const URGENCY_CONFIG = {
  urgent: { label: '긴급', style: 'text-red-700 bg-red-50 border-red-200' },
  normal: { label: '일반', style: 'text-blue-700 bg-blue-50 border-blue-200' },
  low:    { label: '여유', style: 'text-slate-600 bg-slate-50 border-slate-200' },
}

export default function CaseDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { session, loading } = useAuth()
  const [caseData, setCaseData] = useState<CaseDetail | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [parentMessages, setParentMessages] = useState<Message[]>([])
  const [clientCases, setClientCases] = useState<ClientCase[]>([])
  const [showChat, setShowChat] = useState(false)
  const [recordingUrl, setRecordingUrl] = useState<string | null>(null)
  const [fetching, setFetching] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [statusUpdating, setStatusUpdating] = useState(false)

  // Edit mode
  const [editMode, setEditMode] = useState(false)
  const [editCaseType, setEditCaseType] = useState('')
  const [editSummaryText, setEditSummaryText] = useState('')
  const [editSaving, setEditSaving] = useState(false)

  // Connect modal
  const [showConnectModal, setShowConnectModal] = useState(false)
  const [connectSaving, setConnectSaving] = useState(false)

  const sessionId = params?.id as string

  useEffect(() => {
    if (!session || !sessionId) return
    fetch(`/api/dashboard/cases/${sessionId}`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
      .then((r) => {
        if (r.status === 404) { setNotFound(true); setFetching(false); return null }
        return r.json()
      })
      .then((data) => {
        if (!data) return
        setCaseData(data.case)
        setMessages(data.messages ?? [])
        setParentMessages(data.parentMessages ?? [])
        setClientCases(data.clientCases ?? [])
        setRecordingUrl(data.recordingUrl ?? null)
        setEditCaseType(data.case?.case_type ?? '')
        setEditSummaryText(data.case?.summary?.summary_text ?? '')
        setFetching(false)
      })
      .catch(() => setFetching(false))
  }, [session, sessionId])

  async function handleStatusChange(nextStatus: 'reviewing' | 'done') {
    if (!session || !sessionId || statusUpdating) return
    setStatusUpdating(true)
    try {
      const res = await fetch(`/api/dashboard/cases/${sessionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ status: nextStatus }),
      })
      if (res.ok) {
        setCaseData((prev) => prev ? { ...prev, status: nextStatus } : prev)
      }
    } finally {
      setStatusUpdating(false)
    }
  }

  async function handleSaveEdit() {
    if (!session || !sessionId || editSaving) return
    setEditSaving(true)
    try {
      const res = await fetch(`/api/dashboard/cases/${sessionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({
          case_type: editCaseType,
          summary_patch: { summary_text: editSummaryText },
        }),
      })
      if (res.ok) {
        const data = await res.json()
        setCaseData((prev) => prev ? {
          ...prev,
          case_type: editCaseType,
          summary: { ...prev.summary, summary_text: editSummaryText },
        } : prev)
        setEditMode(false)
      }
    } finally {
      setEditSaving(false)
    }
  }

  async function handleConnect(parentId: number) {
    if (!session || !sessionId || connectSaving) return
    setConnectSaving(true)
    try {
      const res = await fetch(`/api/dashboard/cases/${sessionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ parent_case_id: parentId }),
      })
      if (res.ok) {
        setCaseData((prev) => prev ? { ...prev, parent_case_id: parentId } : prev)
        setShowConnectModal(false)
      }
    } finally {
      setConnectSaving(false)
    }
  }

  if (loading || fetching) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#1a2b5a', borderTopColor: 'transparent' }} />
      </div>
    )
  }

  if (notFound || !caseData) {
    return (
      <div className="p-6 text-center">
        <p className="text-slate-500">사건을 찾을 수 없습니다.</p>
        <button onClick={() => router.push('/dashboard')} className="mt-3 text-sm hover:underline" style={{ color: '#4a7aef' }}>
          목록으로 돌아가기
        </button>
      </div>
    )
  }

  const urgency = URGENCY_CONFIG[caseData.urgency]
  const status = STATUS_CONFIG[caseData.status ?? 'new']
  const summary = caseData.summary
  const urgencyReason = caseData.urgency_reason ?? summary?.urgency_reason

  return (
    <div className="p-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <span className={`px-2.5 py-1 rounded-lg text-sm font-medium border ${urgency.style}`}>
            {urgency.label}
          </span>
          <h1 className="text-xl font-bold text-slate-900">
            {editMode ? (
              <input
                value={editCaseType}
                onChange={(e) => setEditCaseType(e.target.value)}
                className="border border-blue-300 rounded px-2 py-0.5 text-base font-bold focus:outline-none"
              />
            ) : (
              `${caseData.case_type} 사건`
            )}
          </h1>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Edit / Connect buttons */}
          {!editMode && (
            <>
              <button
                onClick={() => setEditMode(true)}
                className="px-3 py-1.5 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
              >
                ✏️ 수정
              </button>
              {clientCases.length > 0 && (
                <button
                  onClick={() => setShowConnectModal(true)}
                  className="px-3 py-1.5 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  🔗 기존 사건에 연결
                </button>
              )}
            </>
          )}
          {editMode && (
            <>
              <button
                onClick={() => setEditMode(false)}
                className="px-3 py-1.5 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-lg"
              >
                취소
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={editSaving}
                className="px-3 py-1.5 text-sm font-medium text-white rounded-lg disabled:opacity-50"
                style={{ background: '#1a2b5a' }}
              >
                {editSaving ? '저장 중...' : '저장'}
              </button>
            </>
          )}
          {/* Status badge + action */}
          <span className={`px-2.5 py-1 rounded-lg text-sm font-medium border ${status.style}`}>
            {status.label}
          </span>
          {status.next && !editMode && (
            <button
              onClick={() => handleStatusChange(status.next!)}
              disabled={statusUpdating}
              className="px-3 py-1.5 text-sm font-medium text-white rounded-lg disabled:opacity-50 transition-colors"
              style={{ background: '#1a2b5a' }}
            >
              {statusUpdating ? '처리 중...' : status.nextLabel}
            </button>
          )}
        </div>
      </div>

      {/* Parent case linked indicator */}
      {caseData.parent_case_id && (
        <div className="mb-4 px-4 py-2.5 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700 flex items-center gap-2">
          🔗 기존 사건에 연결됨
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left: main info */}
        <div className="lg:col-span-2 space-y-4">
          {/* Client info */}
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                {caseData.is_proxy ? '당사자 정보' : '고객 정보'}
              </h2>
              {caseData.client_id && (
                <button
                  onClick={() => router.push(`/dashboard/clients/${caseData.client_id}`)}
                  className="text-xs font-medium hover:underline flex items-center gap-1"
                  style={{ color: '#4a7aef' }}
                >
                  고객 상세 보기
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              )}
            </div>
            <div className="space-y-2.5">
              <InfoRow label="이름" value={caseData.client_name} />
              <InfoRow label="연락처" value={caseData.client_phone} isPhone />
              {caseData.client_email && <InfoRow label="이메일" value={caseData.client_email} />}
              <InfoRow label="접수일" value={new Date(caseData.created_at).toLocaleString('ko-KR', {
                year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit',
              })} />
            </div>
          </div>

          {/* Proxy contact info */}
          {caseData.is_proxy && caseData.contact_name && (
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">문의자 정보 (대리)</h2>
              <div className="space-y-2.5">
                <InfoRow label="이름" value={`${caseData.contact_name}${caseData.contact_relation ? ` (${caseData.contact_relation})` : ''}`} />
                {caseData.contact_phone && <InfoRow label="연락처" value={caseData.contact_phone} isPhone />}
                {caseData.contact_email && <InfoRow label="이메일" value={caseData.contact_email} />}
              </div>
            </div>
          )}

          {/* Summary */}
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">사건 요약</h2>
            {editMode ? (
              <textarea
                value={editSummaryText}
                onChange={(e) => setEditSummaryText(e.target.value)}
                rows={3}
                className="w-full border border-blue-300 rounded-lg px-3 py-2 text-sm focus:outline-none resize-none"
              />
            ) : (
              <p className="text-slate-700 text-sm leading-relaxed">{summary?.summary_text}</p>
            )}
            {urgencyReason && !editMode && (
              <div className="mt-3 p-3 bg-red-50 border border-red-100 rounded-lg">
                <p className="text-red-700 text-sm"><strong>긴급 사유:</strong> {urgencyReason}</p>
              </div>
            )}
            {/* AI notes */}
            {summary?.ai_notes && !editMode && (
              <div className="mt-3 p-3 bg-slate-50 border border-slate-100 rounded-lg">
                <p className="text-xs font-medium text-slate-400 mb-1">AI 참고 메모</p>
                <p className="text-sm text-slate-600">{summary.ai_notes}</p>
              </div>
            )}
          </div>

          {/* Requirements */}
          {summary?.requirements?.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">요건사실 체크리스트</h2>
              <div className="space-y-2">
                {summary.requirements.map((req, i) => {
                  const cfg = {
                    confirmed: { icon: '✓', bg: '#f0fdf4', border: '#bbf7d0', text: '#15803d', label: '충족' },
                    denied:    { icon: '✗', bg: '#fef2f2', border: '#fecaca', text: '#dc2626', label: '불충족' },
                    unknown:   { icon: '?', bg: '#f8fafc', border: '#e2e8f0', text: '#64748b', label: '미확인' },
                  }[req.status]
                  return (
                    <div key={i} className="flex items-start gap-2.5 p-2.5 rounded-lg border" style={{ background: cfg.bg, borderColor: cfg.border }}>
                      <span className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold mt-0.5" style={{ background: cfg.text, color: '#fff' }}>
                        {cfg.icon}
                      </span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-semibold text-slate-800">{req.element}</span>
                          <span className="text-xs font-medium" style={{ color: cfg.text }}>{cfg.label}</span>
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{req.detail}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Events timeline */}
          {summary?.events?.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">사건 경위</h2>
              <div className="space-y-0">
                {summary.events.map((event, i) => (
                  <div key={i} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div className="w-2 h-2 rounded-full mt-1 flex-shrink-0" style={{ background: '#4a7aef' }} />
                      {i < summary.events.length - 1 && (
                        <div className="w-px flex-1 bg-slate-200 my-1" />
                      )}
                    </div>
                    <div className="pb-4">
                      <p className="text-xs text-slate-400 font-medium">{event.date}</p>
                      <p className="text-sm text-slate-700 mt-0.5">{event.summary}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Unconfirmed items */}
          {summary?.unconfirmed?.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">미확인 사항</h2>
              <ul className="space-y-1.5">
                {summary.unconfirmed.map((item, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-slate-600">
                    <span className="flex-shrink-0 mt-0.5 text-orange-400">?</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Right: documents + chat */}
        <div className="space-y-4">
          {/* Evidence */}
          {summary?.evidence?.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">보유 증거</h2>
              <ul className="space-y-2">
                {summary.evidence.map((e, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
                    <span className="flex-shrink-0 mt-0.5 text-green-500">✓</span>
                    {e}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Document requests */}
          {summary?.document_request?.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">요청 증빙자료</h2>
              <ul className="space-y-2">
                {summary.document_request.map((doc, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
                    <span className="flex-shrink-0 mt-0.5" style={{ color: '#4a7aef' }}>•</span>
                    {doc}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Client request */}
          {summary?.client_request && (
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">고객 요청사항</h2>
              <p className="text-sm text-slate-700">{summary.client_request}</p>
            </div>
          )}

          {/* Recording player (recording channel only) */}
          {caseData.channel === 'recording' && recordingUrl && (
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">🎙 녹음 파일</h2>
              <audio controls className="w-full rounded-lg" src={recordingUrl}>
                브라우저가 오디오 재생을 지원하지 않습니다.
              </audio>
            </div>
          )}

          {/* Transcript or Chat history */}
          {caseData.channel === 'recording' ? (
            <TranscriptView label={`통화 전사 (${messages.length}개)`} messages={messages} />
          ) : (
            <ChatHistory label={`대화 내역 (${messages.length}개)`} messages={messages} />
          )}

          {/* Parent case chat */}
          {parentMessages.length > 0 && (
            <ChatHistory label={`이전 사건 대화 (${parentMessages.length}개)`} messages={parentMessages} />
          )}
        </div>
      </div>

      {/* Connect modal */}
      {showConnectModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-xl">
            <h3 className="text-base font-bold text-slate-900 mb-1">기존 사건에 연결</h3>
            <p className="text-sm text-slate-500 mb-4">같은 고객의 이전 사건을 선택하면 연결됩니다.</p>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {clientCases.map((cc) => (
                <button
                  key={cc.id}
                  onClick={() => handleConnect(cc.id)}
                  disabled={connectSaving}
                  className="w-full text-left px-4 py-3 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors disabled:opacity-50"
                >
                  <span className="text-sm font-medium text-slate-800">{cc.case_type} 사건</span>
                  <span className="ml-2 text-xs text-slate-400">
                    {new Date(cc.created_at).toLocaleDateString('ko-KR', { year: 'numeric', month: 'short', day: 'numeric' })}
                  </span>
                  {caseData.parent_case_id === cc.id && (
                    <span className="ml-2 text-xs text-blue-600">✓ 현재 연결됨</span>
                  )}
                </button>
              ))}
            </div>
            <button
              onClick={() => setShowConnectModal(false)}
              className="mt-4 w-full py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50"
            >
              닫기
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function InfoRow({ label, value, isPhone }: { label: string; value: string; isPhone?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-slate-400 text-sm w-14 flex-shrink-0">{label}</span>
      {isPhone ? (
        <a href={`tel:${value}`} className="text-sm hover:underline" style={{ color: '#4a7aef' }}>{value}</a>
      ) : (
        <span className="text-slate-700 text-sm">{value}</span>
      )}
    </div>
  )
}

function ChatHistory({ label, messages }: { label: string; messages: Message[] }) {
  const [show, setShow] = useState(false)
  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <button
        onClick={() => setShow(!show)}
        className="w-full px-4 py-3 flex items-center justify-between text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
      >
        <span>{label}</span>
        <svg className={`w-4 h-4 text-slate-400 transition-transform ${show ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {show && (
        <div className="border-t border-slate-100 max-h-96 overflow-y-auto p-3 space-y-2 bg-slate-50">
          {messages.map((msg, i) => {
            const isUser = msg.role === 'user'
            return (
              <div key={i} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[85%] px-3 py-2 rounded-xl text-sm ${
                    isUser ? 'text-white rounded-br-sm' : 'bg-white text-slate-800 border border-slate-200 rounded-bl-sm'
                  }`}
                  style={isUser ? { background: '#1a2b5a' } : {}}
                >
                  {msg.content}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function TranscriptView({ label, messages }: { label: string; messages: Message[] }) {
  const [show, setShow] = useState(false)
  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <button
        onClick={() => setShow(!show)}
        className="w-full px-4 py-3 flex items-center justify-between text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
      >
        <span>📝 {label}</span>
        <svg className={`w-4 h-4 text-slate-400 transition-transform ${show ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {show && (
        <div className="border-t border-slate-100 max-h-96 overflow-y-auto p-3 space-y-2 bg-slate-50">
          {messages.map((msg, i) => {
            const isLawyer = msg.role === 'lawyer'
            return (
              <div key={i} className="flex gap-2 items-start">
                <span className={`flex-shrink-0 text-xs font-semibold mt-1 w-12 ${isLawyer ? 'text-slate-400' : 'text-blue-600'}`}>
                  {isLawyer ? '변호사' : '고객'}
                </span>
                <p className="text-sm text-slate-700 leading-relaxed flex-1">{msg.content}</p>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

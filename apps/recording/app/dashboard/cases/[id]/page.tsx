'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import type { CaseSummary } from '@/types'

type CaseDetail = {
  id: string
  session_id: string
  client_name: string
  client_phone: string
  case_type: string
  urgency: 'urgent' | 'normal' | 'low'
  urgency_reason?: string
  summary: CaseSummary
  created_at: string
}

type Message = {
  role: 'user' | 'assistant'
  content: string
  created_at: string
}

const URGENCY_CONFIG = {
  urgent: { label: '긴급', style: 'text-red-700 bg-red-50 border-red-200' },
  normal: { label: '일반', style: 'text-blue-700 bg-blue-50 border-blue-200' },
  low: { label: '여유', style: 'text-slate-600 bg-slate-50 border-slate-200' },
}

export default function CaseDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { session, loading } = useAuth()
  const [caseData, setCaseData] = useState<CaseDetail | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [showChat, setShowChat] = useState(false)
  const [fetching, setFetching] = useState(true)
  const [notFound, setNotFound] = useState(false)

  const sessionId = params?.id as string

  useEffect(() => {
    if (!session || !sessionId) return
    fetch(`/api/dashboard/cases/${sessionId}`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
      .then((r) => {
        if (r.status === 404) {
          setNotFound(true)
          setFetching(false)
          return null
        }
        return r.json()
      })
      .then((data) => {
        if (!data) return
        setCaseData(data.case)
        setMessages(data.messages ?? [])
        setFetching(false)
      })
      .catch(() => setFetching(false))
  }, [session, sessionId])

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
        <button
          onClick={() => router.push('/dashboard')}
          className="mt-3 text-sm hover:underline" style={{ color: '#4a7aef' }}
        >
          목록으로 돌아가기
        </button>
      </div>
    )
  }

  const urgency = URGENCY_CONFIG[caseData.urgency]
  const summary = caseData.summary
  const urgencyReason = caseData.urgency_reason ?? summary?.urgency_reason

  return (
    <div className="p-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
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
        <h1 className="text-xl font-bold text-slate-900">{caseData.case_type} 사건</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left: main info */}
        <div className="lg:col-span-2 space-y-4">
          {/* Client info */}
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
              고객 정보
            </h2>
            <div className="space-y-2.5">
              <div className="flex items-center gap-3">
                <span className="text-slate-400 text-sm w-14 flex-shrink-0">이름</span>
                <span className="text-slate-900 font-medium text-sm">{caseData.client_name}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-slate-400 text-sm w-14 flex-shrink-0">연락처</span>
                <a href={`tel:${caseData.client_phone}`} className="text-sm hover:underline" style={{ color: '#4a7aef' }}>
                  {caseData.client_phone}
                </a>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-slate-400 text-sm w-14 flex-shrink-0">접수일</span>
                <span className="text-slate-600 text-sm">
                  {new Date(caseData.created_at).toLocaleString('ko-KR', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>
            </div>
          </div>

          {/* Summary */}
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
              사건 요약
            </h2>
            <p className="text-slate-700 text-sm leading-relaxed">{summary?.summary_text}</p>
            {urgencyReason && (
              <div className="mt-3 p-3 bg-red-50 border border-red-100 rounded-lg">
                <p className="text-red-700 text-sm">
                  <strong>긴급 사유:</strong> {urgencyReason}
                </p>
              </div>
            )}
          </div>

          {/* Requirements — 요건사실론 */}
          {summary?.requirements?.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
                요건사실 체크리스트
              </h2>
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
              <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">
                사건 경위
              </h2>
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
        </div>

        {/* Right: documents + chat */}
        <div className="space-y-4">
          {/* Document requests */}
          {summary?.document_request?.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
                요청 증빙자료
              </h2>
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

          {/* Chat history */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <button
              onClick={() => setShowChat(!showChat)}
              className="w-full px-4 py-3 flex items-center justify-between text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
            >
              <span>대화 내역 ({messages.length}개)</span>
              <svg
                className={`w-4 h-4 text-slate-400 transition-transform ${showChat ? 'rotate-180' : ''}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {showChat && (
              <div className="border-t border-slate-100 max-h-96 overflow-y-auto p-3 space-y-2 bg-slate-50">
                {messages.map((msg, i) => (
                  <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div
                      className={`max-w-[85%] px-3 py-2 rounded-xl text-sm ${
                        msg.role === 'user'
                          ? 'text-white rounded-br-sm'
                          : 'bg-white text-slate-800 border border-slate-200 rounded-bl-sm'
                      }`}
                      style={msg.role === 'user' ? { background: '#1a2b5a' } : {}}
                    >
                      {msg.content}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

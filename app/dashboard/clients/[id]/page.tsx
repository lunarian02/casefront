'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import type { CaseSummary } from '@/types'

type ClientDetail = {
  id: string
  name: string
  phone: string
  email: string | null
  created_at: string
  last_contact_at: string
}

type CaseRow = {
  id: string
  session_id: string
  case_type: string
  urgency: 'urgent' | 'normal' | 'low'
  urgency_reason?: string
  status: 'new' | 'reviewing' | 'completed' | null
  summary: CaseSummary
  created_at: string
}

type SessionRow = {
  id: string
  created_at: string
  messages: { session_id: string; role: string; content: string; created_at: string }[]
}

const URGENCY_CONFIG = {
  urgent: { label: '긴급', badge: 'bg-red-100 text-red-700' },
  normal: { label: '일반', badge: 'bg-blue-100 text-blue-700' },
  low: { label: '여유', badge: 'bg-slate-100 text-slate-600' },
}

const STATUS_CONFIG = {
  new: { label: '신규', style: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
  reviewing: { label: '검토중', style: 'bg-blue-50 text-blue-700 border-blue-200' },
  completed: { label: '완료', style: 'bg-green-50 text-green-700 border-green-200' },
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

function formatDateTime(dateStr: string) {
  return new Date(dateStr).toLocaleString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function ClientDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { session, loading } = useAuth()
  const [client, setClient] = useState<ClientDetail | null>(null)
  const [cases, setCases] = useState<CaseRow[]>([])
  const [sessions, setSessions] = useState<SessionRow[]>([])
  const [expandedSession, setExpandedSession] = useState<string | null>(null)
  const [fetching, setFetching] = useState(true)
  const [notFound, setNotFound] = useState(false)

  const clientId = params?.id as string

  useEffect(() => {
    if (!session || !clientId) return
    fetch(`/api/dashboard/clients/${clientId}`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
      .then((r) => {
        if (r.status === 404) { setNotFound(true); setFetching(false); return null }
        return r.json()
      })
      .then((data) => {
        if (!data) return
        setClient(data.client)
        setCases(data.cases ?? [])
        setSessions(data.sessions ?? [])
        setFetching(false)
      })
      .catch(() => setFetching(false))
  }, [session, clientId])

  if (loading || fetching) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#1a2b5a', borderTopColor: 'transparent' }} />
      </div>
    )
  }

  if (notFound || !client) {
    return (
      <div className="p-6 text-center">
        <p className="text-slate-500">고객을 찾을 수 없습니다.</p>
        <button onClick={() => router.push('/dashboard/clients')} className="mt-3 text-sm hover:underline" style={{ color: '#4a7aef' }}>
          목록으로 돌아가기
        </button>
      </div>
    )
  }

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
        <h1 className="text-xl font-bold text-slate-900">{client.name}</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left: client info + cases */}
        <div className="lg:col-span-2 space-y-4">
          {/* Basic info */}
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">기본 정보</h2>
            <div className="space-y-2.5">
              <Row label="이름">{client.name}</Row>
              <Row label="전화번호">
                <a href={`tel:${client.phone}`} className="hover:underline" style={{ color: '#4a7aef' }}>
                  {client.phone}
                </a>
              </Row>
              <Row label="이메일">{client.email ?? '-'}</Row>
              <Row label="첫 연락일">{formatDate(client.created_at)}</Row>
              <Row label="최근 연락">{formatDate(client.last_contact_at)}</Row>
            </div>
          </div>

          {/* Cases */}
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
              사건 목록 ({cases.length}건)
            </h2>
            {cases.length === 0 ? (
              <p className="text-sm text-slate-400 py-4 text-center">접수된 사건이 없습니다.</p>
            ) : (
              <div className="space-y-2">
                {cases.map((c) => {
                  const urgency = URGENCY_CONFIG[c.urgency]
                  const status = STATUS_CONFIG[c.status ?? 'new']
                  return (
                    <div
                      key={c.session_id}
                      onClick={() => router.push(`/dashboard/cases/${c.session_id}`)}
                      className="flex items-center justify-between p-3 rounded-lg border border-slate-100 hover:border-slate-200 hover:bg-slate-50 cursor-pointer transition-colors"
                    >
                      <div className="flex items-center gap-2.5">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${urgency.badge}`}>
                          {urgency.label}
                        </span>
                        <span className="text-sm font-medium text-slate-800">{c.case_type}</span>
                      </div>
                      <div className="flex items-center gap-2.5">
                        <span className={`px-2 py-0.5 rounded border text-xs font-medium ${status.style}`}>
                          {status.label}
                        </span>
                        <span className="text-xs text-slate-400">{formatDate(c.created_at)}</span>
                        <svg className="w-4 h-4 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right: conversation history */}
        <div className="space-y-3">
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
              전체 상담 이력 ({sessions.length}회)
            </h2>
            {sessions.length === 0 ? (
              <p className="text-sm text-slate-400 py-2 text-center">상담 이력이 없습니다.</p>
            ) : (
              <div className="space-y-2">
                {sessions.map((s) => (
                  <div key={s.id} className="border border-slate-100 rounded-lg overflow-hidden">
                    <button
                      onClick={() => setExpandedSession(expandedSession === s.id ? null : s.id)}
                      className="w-full flex items-center justify-between px-3 py-2.5 text-sm text-left hover:bg-slate-50 transition-colors"
                    >
                      <div>
                        <p className="font-medium text-slate-700">{formatDateTime(s.created_at)}</p>
                        <p className="text-xs text-slate-400 mt-0.5">{s.messages.length}개 메시지</p>
                      </div>
                      <svg
                        className={`w-4 h-4 text-slate-400 transition-transform flex-shrink-0 ${expandedSession === s.id ? 'rotate-180' : ''}`}
                        fill="none" viewBox="0 0 24 24" stroke="currentColor"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    {expandedSession === s.id && (
                      <div className="border-t border-slate-100 max-h-64 overflow-y-auto p-2.5 space-y-1.5 bg-slate-50">
                        {s.messages.map((msg, i) => (
                          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                            <div
                              className={`max-w-[85%] px-2.5 py-1.5 rounded-lg text-xs ${
                                msg.role === 'user'
                                  ? 'text-white rounded-br-sm'
                                  : 'bg-white text-slate-700 border border-slate-200 rounded-bl-sm'
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
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <span className="text-slate-400 text-sm w-16 flex-shrink-0">{label}</span>
      <span className="text-slate-900 text-sm">{children}</span>
    </div>
  )
}

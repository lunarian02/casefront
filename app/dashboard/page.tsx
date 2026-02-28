'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'

type CaseRow = {
  id: string
  session_id: string
  client_name: string
  client_phone: string
  client_email?: string
  case_type: string
  urgency: 'urgent' | 'normal' | 'low'
  urgency_reason?: string
  status: 'new' | 'reviewing' | 'done' | null
  is_proxy: boolean | null
  contact_name: string | null
  contact_relation: string | null
  channel: string | null
  created_at: string
}

const URGENCY_CONFIG = {
  urgent: { label: '긴급', badge: 'bg-red-100 text-red-700', dot: 'bg-red-500' },
  normal: { label: '일반', badge: 'bg-blue-100 text-blue-700', dot: 'bg-blue-500' },
  low: { label: '여유', badge: 'bg-slate-100 text-slate-600', dot: 'bg-slate-400' },
}

const STATUS_CONFIG = {
  new:       { label: '신규',  badge: 'bg-yellow-100 text-yellow-700' },
  reviewing: { label: '검토중', badge: 'bg-blue-100 text-blue-700' },
  done:      { label: '완료',  badge: 'bg-green-100 text-green-700' },
}

function formatDate(dateStr: string) {
  const diffMs = Date.now() - new Date(dateStr).getTime()
  const diffMin = Math.floor(diffMs / 60000)
  const diffHour = Math.floor(diffMin / 60)
  const diffDay = Math.floor(diffHour / 24)
  if (diffMin < 1) return '방금 전'
  if (diffMin < 60) return `${diffMin}분 전`
  if (diffHour < 24) return `${diffHour}시간 전`
  if (diffDay < 7) return `${diffDay}일 전`
  return new Date(dateStr).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })
}

export default function DashboardPage() {
  const { session, loading } = useAuth()
  const router = useRouter()
  const [cases, setCases] = useState<CaseRow[]>([])
  const [urgencyFilter, setUrgencyFilter] = useState<'all' | 'urgent' | 'normal' | 'low'>('all')
  const [statusFilter, setStatusFilter] = useState<'all' | 'new' | 'reviewing' | 'done'>('all')
  const [fetching, setFetching] = useState(true)

  useEffect(() => {
    if (!session) return
    fetch('/api/dashboard/cases', {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
      .then((r) => r.json())
      .then((data) => {
        setCases(data.cases ?? [])
        setFetching(false)
      })
      .catch(() => setFetching(false))
  }, [session])

  if (loading || fetching) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#1a2b5a', borderTopColor: 'transparent' }} />
      </div>
    )
  }

  const filtered = cases.filter((c) => {
    const urgencyOk = urgencyFilter === 'all' || c.urgency === urgencyFilter
    const statusOk = statusFilter === 'all' || (c.status ?? 'new') === statusFilter
    return urgencyOk && statusOk
  })

  const urgentCount = cases.filter((c) => c.urgency === 'urgent').length
  const newCount = cases.filter((c) => !c.status || c.status === 'new').length

  return (
    <div className="p-4 md:p-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold text-slate-900">사건 목록</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            총 {cases.length}건
            {urgentCount > 0 && (
              <span className="ml-2 text-red-600 font-medium">• 긴급 {urgentCount}건</span>
            )}
            {newCount > 0 && (
              <span className="ml-2 text-yellow-600 font-medium">• 신규 {newCount}건</span>
            )}
          </p>
        </div>
      </div>

      {/* Filters — horizontal scroll on mobile */}
      <div className="overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0 mb-4">
        <div className="flex gap-x-3 gap-y-2 min-w-max md:flex-wrap md:min-w-0">
          {/* Urgency filter */}
          <div className="flex gap-1.5">
            {(['all', 'urgent', 'normal', 'low'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setUrgencyFilter(f)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                  urgencyFilter === f
                    ? 'text-white border border-transparent'
                    : 'bg-white text-slate-600 border border-slate-200 hover:border-slate-300'
                }`}
                style={urgencyFilter === f ? { background: '#1a2b5a' } : {}}
              >
                {f === 'all' ? '전체' : URGENCY_CONFIG[f].label}
                <span className="ml-1.5 opacity-70">
                  {f === 'all' ? cases.length : cases.filter((c) => c.urgency === f).length}
                </span>
              </button>
            ))}
          </div>

          {/* Status filter */}
          <div className="flex gap-1.5">
            {(['all', 'new', 'reviewing', 'done'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setStatusFilter(f)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                  statusFilter === f
                    ? 'text-white border border-transparent'
                    : 'bg-white text-slate-600 border border-slate-200 hover:border-slate-300'
                }`}
                style={statusFilter === f ? { background: '#4a7aef' } : {}}
              >
                {f === 'all' ? '전체상태' : STATUS_CONFIG[f].label}
                <span className="ml-1.5 opacity-70">
                  {f === 'all'
                    ? cases.length
                    : cases.filter((c) => (c.status ?? 'new') === f).length}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Empty state */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <svg className="w-10 h-10 mx-auto mb-3 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          <p className="text-sm">해당하는 사건이 없습니다.</p>
        </div>
      ) : (
        <>
          {/* Mobile: card list */}
          <div className="md:hidden space-y-3 pb-24">
            {filtered.map((c) => {
              const u = URGENCY_CONFIG[c.urgency]
              const s = STATUS_CONFIG[c.status ?? 'new']
              return (
                <div
                  key={c.session_id}
                  onClick={() => router.push(`/dashboard/cases/${c.session_id}`)}
                  className="bg-white rounded-xl p-4 border border-slate-200 active:bg-slate-50"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${u.badge}`}>
                      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${u.dot}`} />
                      {u.label}
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${s.badge}`}>{s.label}</span>
                  </div>
                  <div className="font-semibold text-slate-900 text-base leading-snug mb-0.5">
                    {c.client_name}
                    {c.is_proxy && c.contact_name && (
                      <span className="ml-1.5 text-xs font-normal text-slate-400">(대리: {c.contact_name})</span>
                    )}
                  </div>
                  <div className="text-sm text-slate-600 mb-0.5">
                    {c.case_type}
                  </div>
                  <div className="text-sm text-slate-500 mb-0.5">{c.client_phone}</div>
                  <div className="text-xs text-slate-400">{formatDate(c.created_at)}</div>
                </div>
              )
            })}
          </div>

          {/* Desktop: table */}
          <div className="hidden md:block bg-white rounded-xl border border-slate-200 overflow-hidden">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">긴급도</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">고객명</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">사건유형</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">연락처</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">상태</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">접수</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((c) => {
                  const u = URGENCY_CONFIG[c.urgency]
                  const s = STATUS_CONFIG[c.status ?? 'new']
                  const proxyLabel = c.is_proxy && c.contact_name
                    ? `(대리: ${c.contact_name}${c.contact_relation ? `/${c.contact_relation}` : ''})`
                    : null
                  return (
                    <tr
                      key={c.session_id}
                      onClick={() => router.push(`/dashboard/cases/${c.session_id}`)}
                      className="hover:bg-slate-50 cursor-pointer transition-colors"
                    >
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${u.badge}`}>
                          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${u.dot}`} />
                          {u.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm font-medium text-slate-900">{c.client_name}</span>
                        {proxyLabel && (
                          <span className="ml-1.5 text-xs text-slate-400">{proxyLabel}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600">
                        {c.case_type}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-500">{c.client_phone}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${s.badge}`}>
                          {s.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-500">{formatDate(c.created_at)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* FAB — mobile only */}
      <button
        onClick={() => router.push('/dashboard/upload')}
        className="md:hidden fixed bottom-6 right-6 flex items-center gap-2 px-4 h-12 rounded-full text-white shadow-lg text-sm font-medium"
        style={{ background: '#1a2b5a' }}
      >
        <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <path d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"/>
        </svg>
        녹음 업로드
      </button>
    </div>
  )
}

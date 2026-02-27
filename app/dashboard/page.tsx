'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'

type CaseRow = {
  id: string
  session_id: string
  client_name: string
  client_phone: string
  case_type: string
  urgency: 'urgent' | 'normal' | 'low'
  urgency_reason?: string
  created_at: string
}

const URGENCY_CONFIG = {
  urgent: { label: '긴급', badge: 'bg-red-100 text-red-700', dot: 'bg-red-500' },
  normal: { label: '일반', badge: 'bg-blue-100 text-blue-700', dot: 'bg-blue-500' },
  low: { label: '여유', badge: 'bg-slate-100 text-slate-600', dot: 'bg-slate-400' },
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
  const [filter, setFilter] = useState<'all' | 'urgent' | 'normal' | 'low'>('all')
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

  const filtered = filter === 'all' ? cases : cases.filter((c) => c.urgency === filter)
  const urgentCount = cases.filter((c) => c.urgency === 'urgent').length

  return (
    <div className="p-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-900">사건 목록</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            총 {cases.length}건
            {urgentCount > 0 && (
              <span className="ml-2 text-red-600 font-medium">• 긴급 {urgentCount}건</span>
            )}
          </p>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {(['all', 'urgent', 'normal', 'low'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              filter === f
                ? 'text-white border border-transparent'
                : 'bg-white text-slate-600 border border-slate-200 hover:border-slate-300'
            }`}
            style={filter === f ? { background: '#1a2b5a' } : {}}
          >
            {f === 'all' ? '전체' : URGENCY_CONFIG[f].label}
            {f !== 'all' && (
              <span className="ml-1.5 opacity-70">{cases.filter((c) => c.urgency === f).length}</span>
            )}
            {f === 'all' && <span className="ml-1.5 opacity-70">{cases.length}</span>}
          </button>
        ))}
      </div>

      {/* Cases table */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <svg
            className="w-10 h-10 mx-auto mb-3 text-slate-300"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
            />
          </svg>
          <p className="text-sm">접수된 사건이 없습니다.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">
                  긴급도
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">
                  고객명
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">
                  사건 유형
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider hidden sm:table-cell">
                  연락처
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">
                  접수
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((c) => {
                const u = URGENCY_CONFIG[c.urgency]
                return (
                  <tr
                    key={c.session_id}
                    onClick={() => router.push(`/dashboard/cases/${c.session_id}`)}
                    className="hover:bg-slate-50 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${u.badge}`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${u.dot}`} />
                        {u.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-slate-900">{c.client_name}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">{c.case_type}</td>
                    <td className="px-4 py-3 text-sm text-slate-500 hidden sm:table-cell">
                      {c.client_phone}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-500">{formatDate(c.created_at)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

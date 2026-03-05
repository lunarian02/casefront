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
  status: 'new' | 'reviewing' | 'done' | null
  is_proxy: boolean | null
  contact_name: string | null
  contact_relation: string | null
  channel: string | null
  created_at: string
}

const STATUS_CONFIG = {
  new:       { label: '신규',  color: '#4a7aef' },
  reviewing: { label: '검토중', color: '#D97706' },
  done:      { label: '완료',  color: '#16A34A' },
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

const PAGE_SIZE = 20

export default function DashboardPage() {
  const { session, loading } = useAuth()
  const router = useRouter()
  const [cases, setCases] = useState<CaseRow[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(0)
  const [statusFilter, setStatusFilter] = useState<'all' | 'new' | 'reviewing' | 'done'>('all')
  const [fetching, setFetching] = useState(true)

  const [deleteTarget, setDeleteTarget] = useState<CaseRow | null>(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    if (!session) return
    setFetching(true)
    fetch(`/api/dashboard/cases?offset=${page * PAGE_SIZE}`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
      .then((r) => r.json())
      .then((data) => {
        setCases(data.cases ?? [])
        setTotal(data.total ?? 0)
        setFetching(false)
      })
      .catch(() => setFetching(false))
  }, [session, page])

  async function handleDelete() {
    if (!deleteTarget || !session || deleting) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/dashboard/cases/${deleteTarget.session_id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      if (res.ok) {
        setCases((prev) => prev.filter((c) => c.session_id !== deleteTarget.session_id))
        setDeleteTarget(null)
      }
    } finally {
      setDeleting(false)
    }
  }

  if (loading || fetching) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#1a2b5a', borderTopColor: 'transparent' }} />
      </div>
    )
  }

  const filtered = cases.filter((c) => {
    return statusFilter === 'all' || (c.status ?? 'new') === statusFilter
  })

  const newCount = cases.filter((c) => !c.status || c.status === 'new').length

  return (
    <div className="p-4 md:p-6 max-w-5xl">
      {/* Header */}
      <div className="mb-5">
        <h1 className="text-xl font-bold text-slate-900">사건 목록</h1>
        <p className="text-slate-500 text-sm mt-0.5">
          총 {total}건
          {newCount > 0 && (
            <span className="ml-2 font-medium" style={{ color: '#4a7aef' }}>• 신규 {newCount}건</span>
          )}
        </p>
      </div>

      {/* Status filters */}
      <div className="flex gap-1.5 mb-2 flex-wrap">
        {(['all', 'new', 'reviewing', 'done'] as const).map((f) => (
          <button
            key={f}
            onClick={() => { setStatusFilter(f); setPage(0) }}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
              statusFilter === f ? 'text-white border border-transparent' : 'bg-white text-slate-600 border border-slate-200 hover:border-slate-300'
            }`}
            style={statusFilter === f ? { background: '#4a7aef' } : {}}
          >
            {f === 'all' ? '전체' : STATUS_CONFIG[f].label}
            <span className="ml-1.5 opacity-70">
              {f === 'all' ? total : cases.filter((c) => (c.status ?? 'new') === f).length}
            </span>
          </button>
        ))}
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
              const s = STATUS_CONFIG[c.status ?? 'new']
              const isPast = (c.status ?? 'new') === 'done'
              return (
                <div
                  key={c.session_id}
                  className="bg-white rounded-xl p-4 border border-slate-200 active:bg-slate-50"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium" style={{ color: s.color }}>{s.label}</span>
                    <button
                      onClick={(e) => { e.stopPropagation(); setDeleteTarget(c) }}
                      className="p-1 text-slate-300 hover:text-red-400 transition-colors"
                    >
                      <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/>
                      </svg>
                    </button>
                  </div>
                  <div
                    onClick={() => router.push(`/dashboard/cases/${c.session_id}`)}
                    className="cursor-pointer"
                  >
                    <div className={`font-semibold text-base leading-snug mb-0.5 ${isPast ? 'text-slate-400' : 'text-slate-900'}`}>
                      {c.client_name}
                      {c.is_proxy && c.contact_name && (
                        <span className="ml-1.5 text-xs font-normal text-slate-400">(대리: {c.contact_name})</span>
                      )}
                    </div>
                    <div className="text-sm text-slate-500 mb-0.5">{c.case_type}</div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-slate-400">{formatDate(c.created_at)}</span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Desktop: table */}
          <div className="hidden md:block bg-white rounded-xl border border-slate-200 overflow-hidden">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">고객명</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">사건</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">상태</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">접수일</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((c) => {
                  const s = STATUS_CONFIG[c.status ?? 'new']
                  const isPast = (c.status ?? 'new') === 'done'
                  const proxyLabel = c.is_proxy && c.contact_name
                    ? `(대리: ${c.contact_name}${c.contact_relation ? `/${c.contact_relation}` : ''})`
                    : null
                  return (
                    <tr
                      key={c.session_id}
                      onClick={() => router.push(`/dashboard/cases/${c.session_id}`)}
                      className="hover:bg-slate-50 cursor-pointer transition-colors group"
                    >
                      <td className="px-4 py-3">
                        <span className={`text-sm font-medium ${isPast ? 'text-slate-400' : 'text-slate-900'}`}>{c.client_name}</span>
                        {proxyLabel && <span className="ml-1.5 text-xs text-slate-400">{proxyLabel}</span>}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600 max-w-xs truncate">{c.case_type}</td>
                      <td className="px-4 py-3">
                        <span className="text-sm font-medium" style={{ color: s.color }}>{s.label}</span>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-500">{formatDate(c.created_at)}</td>
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => setDeleteTarget(c)}
                          className="opacity-0 group-hover:opacity-100 p-1.5 text-slate-300 hover:text-red-400 hover:bg-red-50 rounded-lg transition-all"
                          title="사건 삭제"
                        >
                          <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/>
                          </svg>
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {total > PAGE_SIZE && (
            <div className="flex items-center justify-between pt-3">
              <button
                onClick={() => setPage((p) => p - 1)}
                disabled={page === 0}
                className="px-3 py-1.5 text-sm text-slate-600 border border-slate-200 rounded-lg bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                이전
              </button>
              <span className="text-sm text-slate-500">
                {page + 1} / {Math.ceil(total / PAGE_SIZE)} 페이지
              </span>
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={(page + 1) * PAGE_SIZE >= total}
                className="px-3 py-1.5 text-sm text-slate-600 border border-slate-200 rounded-lg bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                다음
              </button>
            </div>
          )}
        </>
      )}

      {/* Delete confirm modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="w-full max-w-sm bg-white rounded-2xl shadow-xl p-6">
            <h2 className="text-base font-semibold text-slate-900 mb-1">사건을 삭제하시겠어요?</h2>
            <p className="text-sm text-slate-500 mb-1">
              <span className="font-medium text-slate-700">{deleteTarget.client_name}</span>님의{' '}
              <span className="font-medium text-slate-700">{deleteTarget.case_type}</span> 사건이 삭제됩니다.
            </p>
            <p className="text-xs text-red-500 mb-6">삭제된 사건은 복구할 수 없습니다.</p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteTarget(null)}
                className="flex-1 h-11 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50"
                disabled={deleting}
              >취소</button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 h-11 rounded-xl text-white text-sm font-medium bg-red-500 hover:bg-red-600 disabled:opacity-50 transition-colors"
              >{deleting ? '삭제 중...' : '삭제'}</button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}

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

  // Text paste modal state
  const [modalOpen, setModalOpen] = useState(false)
  const [pasteText, setPasteText] = useState('')
  const [importing, setImporting] = useState(false)
  const [importError, setImportError] = useState('')

  // Delete confirm state
  const [deleteTarget, setDeleteTarget] = useState<CaseRow | null>(null)
  const [deleting, setDeleting] = useState(false)

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

  async function handleImport() {
    if (!pasteText.trim()) {
      setImportError('텍스트를 입력해 주세요.')
      return
    }
    if (!session) return
    setImporting(true)
    setImportError('')
    try {
      const res = await fetch('/api/dashboard/cases/text-import', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ text: pasteText }),
      })
      const data = await res.json()
      if (!res.ok) {
        setImportError(data.error ?? '구조화 중 오류가 발생했습니다.')
        setImporting(false)
        return
      }
      router.push(`/dashboard/cases/${data.session_id}`)
    } catch {
      setImportError('네트워크 오류가 발생했습니다.')
      setImporting(false)
    }
  }

  function openModal() {
    setPasteText('')
    setImportError('')
    setModalOpen(true)
  }

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
        <button
          onClick={openModal}
          className="hidden md:flex items-center gap-2 px-4 h-9 rounded-lg text-white text-sm font-medium"
          style={{ background: '#1a2b5a' }}
        >
          <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          사건 추가
        </button>
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
                  className="bg-white rounded-xl p-4 border border-slate-200 active:bg-slate-50"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${u.badge}`}>
                      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${u.dot}`} />
                      {u.label}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${s.badge}`}>{s.label}</span>
                      <button
                        onClick={(e) => { e.stopPropagation(); setDeleteTarget(c) }}
                        className="p-1 text-slate-400 hover:text-red-500 transition-colors"
                      >
                        <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/>
                        </svg>
                      </button>
                    </div>
                  </div>
                  <div
                    onClick={() => router.push(`/dashboard/cases/${c.session_id}`)}
                    className="cursor-pointer"
                  >
                    <div className="font-semibold text-slate-900 text-base leading-snug mb-0.5">
                      {c.client_name}
                      {c.is_proxy && c.contact_name && (
                        <span className="ml-1.5 text-xs font-normal text-slate-400">(대리: {c.contact_name})</span>
                      )}
                    </div>
                    <div className="text-sm text-slate-600 mb-0.5">{c.case_type}</div>
                    <div className="text-sm text-slate-500 mb-0.5">{c.client_phone}</div>
                    <div className="text-xs text-slate-400">{formatDate(c.created_at)}</div>
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
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">긴급도</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">고객명</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">사건유형</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">연락처</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">상태</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">접수</th>
                  <th className="px-4 py-3" />
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
                      className="hover:bg-slate-50 cursor-pointer transition-colors group"
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
                      <td className="px-4 py-3 text-sm text-slate-600">{c.case_type}</td>
                      <td className="px-4 py-3 text-sm text-slate-500">{c.client_phone}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${s.badge}`}>
                          {s.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-500">{formatDate(c.created_at)}</td>
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => setDeleteTarget(c)}
                          className="opacity-0 group-hover:opacity-100 p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
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
        </>
      )}

      {/* FAB — mobile only */}
      <button
        onClick={openModal}
        className="md:hidden fixed bottom-6 right-6 flex items-center gap-2 px-4 h-12 rounded-full text-white shadow-lg text-sm font-medium"
        style={{ background: '#1a2b5a' }}
      >
        <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
          <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
        사건 추가
      </button>

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
              >
                취소
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 h-11 rounded-xl text-white text-sm font-medium bg-red-500 hover:bg-red-600 disabled:opacity-50 transition-colors"
              >
                {deleting ? '삭제 중...' : '삭제'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Text paste modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="w-full max-w-lg bg-white rounded-2xl shadow-xl">
            <div className="px-5 pt-5 pb-4 border-b border-slate-100">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold text-slate-900">텍스트로 사건 추가</h2>
                <button
                  onClick={() => setModalOpen(false)}
                  className="w-8 h-8 flex items-center justify-center rounded-full text-slate-400 hover:bg-slate-100"
                >
                  <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
                    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              </div>
              <p className="text-sm text-slate-500 mt-1">
                에이닷 통화 요약, 상담 메모, 카톡 대화 등을 붙여넣으면 AI가 사건을 구조화합니다.
              </p>
            </div>
            <div className="px-5 py-4">
              <textarea
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                placeholder="텍스트를 여기에 붙여넣어 주세요..."
                rows={10}
                className="w-full text-sm text-slate-800 placeholder-slate-400 border border-slate-200 rounded-xl px-3 py-3 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={importing}
              />
              {importError && (
                <p className="mt-2 text-sm text-red-600">{importError}</p>
              )}
            </div>
            <div className="px-5 pb-5 flex gap-3">
              <button
                onClick={() => setModalOpen(false)}
                className="flex-1 h-11 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50"
                disabled={importing}
              >
                취소
              </button>
              <button
                onClick={handleImport}
                disabled={importing || !pasteText.trim()}
                className="flex-1 h-11 rounded-xl text-white text-sm font-medium disabled:opacity-50 transition-opacity"
                style={{ background: '#1a2b5a' }}
              >
                {importing ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 border-2 border-t-transparent rounded-full animate-spin border-white" />
                    구조화 중...
                  </span>
                ) : '구조화 시작'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

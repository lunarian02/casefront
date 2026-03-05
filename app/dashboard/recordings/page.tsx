'use client'
import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { supabaseBrowser } from '@/lib/supabaseClient'

type RecordingRow = {
  id: string
  title: string
  status: string
  duration_seconds: number | null
  created_at: string
  case_type: string | null
}

function caseCategory(caseType: string | null): string {
  const t = caseType ?? ''
  if (/형사|폭행|상해|절도|사기|횡령|배임|음주|살인|강도|성범죄|마약|협박/.test(t)) return '형사'
  if (/가사|이혼|양육|면접교섭|재산분할|혼인/.test(t)) return '가사'
  if (/행정소송|행정처분|행정심판|조세|국세|지방세|행정|허가|면허/.test(t)) return '행정'
  if (/노동|임금|해고|근로|산재|직장/.test(t)) return '노동'
  if (t) return '민사'
  return '기타'
}

function formatDuration(seconds: number | null): string {
  if (!seconds) return '—'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (h > 0) return `${h}시간 ${m}분`
  return `${m}분`
}

function formatDate(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const diffMin = Math.floor(diff / 60000)
  const diffHour = Math.floor(diffMin / 60)
  const diffDay = Math.floor(diffHour / 24)
  if (diffMin < 1) return '방금 전'
  if (diffMin < 60) return `${diffMin}분 전`
  if (diffHour < 24) return `${diffHour}시간 전`
  if (diffDay === 1) return '어제'
  if (diffDay < 7) return `${diffDay}일 전`
  const d = new Date(dateStr)
  return `${d.getMonth() + 1}/${d.getDate()}`
}

function statusLabel(status: string): { text: string; color: string } {
  if (status === 'completed') return { text: '완료', color: '#16A34A' }
  if (status === 'failed') return { text: '오류', color: '#DC2626' }
  return { text: '분석중', color: '#D97706' }
}

const PAGE_SIZE = 20

export default function RecordingsPage() {
  const { session, loading } = useAuth()
  const router = useRouter()
  const [recordings, setRecordings] = useState<RecordingRow[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(0)
  const [fetching, setFetching] = useState(true)
  const [statusFilter, setStatusFilter] = useState<'all' | 'completed' | 'processing'>('all')

  const fetchRecordings = useCallback(() => {
    if (!session) return
    fetch(`/api/dashboard/recordings?offset=${page * PAGE_SIZE}`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
      .then((r) => r.json())
      .then((data) => {
        setRecordings(data.recordings ?? [])
        setTotal(data.total ?? 0)
      })
      .catch(() => {})
      .finally(() => setFetching(false))
  }, [session, page])

  useEffect(() => {
    fetchRecordings()
  }, [fetchRecordings])

  // Realtime: re-fetch on recording status updates
  useEffect(() => {
    if (!session) return
    const channel = supabaseBrowser
      .channel('recordings-list')
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'recordings',
      }, () => {
        fetchRecordings()
      })
      .subscribe()
    return () => { supabaseBrowser.removeChannel(channel) }
  }, [session, fetchRecordings])

  const filtered = recordings.filter((r) => {
    if (statusFilter === 'all') return true
    if (statusFilter === 'completed') return r.status === 'completed'
    return r.status !== 'completed'
  })

  const processingCount = recordings.filter((r) => r.status !== 'completed' && r.status !== 'failed').length

  if (loading || fetching) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#1a2b5a', borderTopColor: 'transparent' }} />
      </div>
    )
  }

  return (
    <div className="p-4 md:p-6 max-w-5xl">
      {/* Header */}
      <div className="mb-5">
        <h1 className="text-xl font-bold text-slate-900">상담 기록</h1>
        <p className="text-slate-500 text-sm mt-0.5">
          총 {total}건
          {processingCount > 0 && (
            <span className="ml-2 font-medium" style={{ color: '#D97706' }}>• 분석중 {processingCount}건</span>
          )}
        </p>
      </div>

      {/* Status filter tabs */}
      <div className="flex gap-1.5 mb-4 flex-wrap">
        {([
          { key: 'all', label: '전체', count: total },
          { key: 'completed', label: '완료', count: recordings.filter((r) => r.status === 'completed').length },
          { key: 'processing', label: '분석중', count: recordings.filter((r) => r.status !== 'completed' && r.status !== 'failed').length },
        ] as const).map((f) => (
          <button
            key={f.key}
            onClick={() => { setStatusFilter(f.key); setPage(0) }}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
              statusFilter === f.key ? 'text-white border border-transparent' : 'bg-white text-slate-600 border border-slate-200 hover:border-slate-300'
            }`}
            style={statusFilter === f.key ? { background: '#4a7aef' } : {}}
          >
            {f.label}
            <span className="ml-1.5 opacity-70">{f.count}</span>
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <svg className="w-12 h-12 mx-auto mb-4 text-slate-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
          </svg>
          <p className="text-sm font-medium text-slate-500 mb-1">상담 기록이 없습니다</p>
          <p className="text-sm">CaseFront 앱에서 상담을 녹음하면 여기에 표시됩니다.</p>
        </div>
      ) : (
        <>
          {/* Mobile: card list */}
          <div className="md:hidden space-y-3 pb-6">
            {filtered.map((r) => {
              const s = statusLabel(r.status)
              return (
                <div
                  key={r.id}
                  onClick={() => router.push(`/dashboard/recordings/${r.id}`)}
                  className="bg-white rounded-xl p-4 border border-slate-200 active:bg-slate-50 cursor-pointer"
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-medium" style={{ color: s.color }}>{s.text}</span>
                    <span className="text-xs text-slate-400">{formatDuration(r.duration_seconds)}</span>
                  </div>
                  <div className="font-semibold text-slate-900 text-base leading-snug mb-0.5">
                    {r.title || '제목 없음'}
                  </div>
                  {r.case_type && (
                    <div className="text-sm text-slate-500 mb-0.5">{r.case_type}</div>
                  )}
                  <div className="flex items-center gap-2 mt-1">
                    {r.case_type && <span className="text-xs text-slate-400">{caseCategory(r.case_type)}</span>}
                    {r.case_type && <span className="text-xs text-slate-300">·</span>}
                    <span className="text-xs text-slate-400">{formatDate(r.created_at)}</span>
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
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">제목</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">사건 요약</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">유형</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">상태</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">녹음시간</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">접수일</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((r) => {
                  const s = statusLabel(r.status)
                  return (
                    <tr
                      key={r.id}
                      onClick={() => router.push(`/dashboard/recordings/${r.id}`)}
                      className="hover:bg-slate-50 cursor-pointer transition-colors"
                    >
                      <td className="px-4 py-3 text-sm font-medium text-slate-900 max-w-[160px] truncate">
                        {r.title || '제목 없음'}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600 max-w-xs truncate">
                        {r.case_type ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-400">
                        {r.case_type ? caseCategory(r.case_type) : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm font-medium" style={{ color: s.color }}>{s.text}</span>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-500">
                        {formatDuration(r.duration_seconds)}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-500">
                        {formatDate(r.created_at)}
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
    </div>
  )
}

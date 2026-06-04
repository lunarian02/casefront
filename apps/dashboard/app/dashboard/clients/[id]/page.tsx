'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { formatDate } from '@/lib/utils'
import type { CaseSummary } from '@/types'

type ClientDetail = {
  id: string
  name: string
  phone: string
  email: string | null
  referrer: string | null
  created_at: string
  last_contact_at: string
}

type CaseRow = {
  id: string
  case_type: string
  status: 'new' | 'reviewing' | 'done' | 'completed' | null
  summary: CaseSummary
  created_at: string
}

type RecordingRow = {
  id: string
  title: string | null
  status: string
  duration_seconds: number | null
  created_at: string
}

const STATUS_CONFIG = {
  new:       { label: '신규',  style: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
  reviewing: { label: '검토중', style: 'bg-blue-50 text-blue-700 border-blue-200' },
  done:      { label: '완료',  style: 'bg-green-50 text-green-700 border-green-200' },
  completed: { label: '완료',  style: 'bg-green-50 text-green-700 border-green-200' },
}

const REC_STATUS: Record<string, { label: string; color: string }> = {
  completed:  { label: '완료',   color: '#16A34A' },
  processing: { label: '분석중', color: '#D97706' },
  uploaded:   { label: '업로드됨', color: '#4a7aef' },
  uploading:  { label: '업로드중', color: '#94a3b8' },
  failed:     { label: '실패',   color: '#DC2626' },
}

function formatDuration(seconds: number | null) {
  if (!seconds) return null
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

export default function ClientDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { session, loading } = useAuth()
  const [client, setClient] = useState<ClientDetail | null>(null)
  const [cases, setCases] = useState<CaseRow[]>([])
  const [recordings, setRecordings] = useState<RecordingRow[]>([])
  const [fetching, setFetching] = useState(true)
  const [notFound, setNotFound] = useState(false)

  // Client info inline edit
  const [editMode, setEditMode] = useState(false)
  const [editName, setEditName] = useState('')
  const [editPhone, setEditPhone] = useState('')
  const [editEmail, setEditEmail] = useState('')
  const [editReferrer, setEditReferrer] = useState('')
  const [editSaving, setEditSaving] = useState(false)

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
        setRecordings(data.recordings ?? [])
        setFetching(false)
      })
      .catch(() => setFetching(false))
  }, [session, clientId])

  function openEdit() {
    if (!client) return
    setEditName(client.name)
    setEditPhone(client.phone)
    setEditEmail(client.email ?? '')
    setEditReferrer(client.referrer ?? '')
    setEditMode(true)
  }

  async function handleSaveEdit() {
    if (!session || !clientId || editSaving) return
    setEditSaving(true)
    try {
      const res = await fetch(`/api/dashboard/clients/${clientId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ name: editName, phone: editPhone, email: editEmail || null, referrer: editReferrer || null }),
      })
      if (res.ok) {
        const data = await res.json()
        setClient((prev) => prev ? { ...prev, ...data.client } : prev)
        setEditMode(false)
      }
    } finally {
      setEditSaving(false)
    }
  }

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

  const inputCls = 'w-full border border-blue-200 rounded-lg px-3 py-2 text-sm text-slate-900 bg-white focus:outline-none focus:border-blue-400'

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
          {/* Basic info — inline edit */}
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">기본 정보</h2>
              {!editMode ? (
                <button
                  onClick={openEdit}
                  className="text-xs font-medium text-slate-400 hover:text-slate-600 transition-colors"
                >
                  수정
                </button>
              ) : null}
            </div>
            {editMode ? (
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <span className="text-slate-400 text-sm w-16 flex-shrink-0">이름</span>
                  <input value={editName} onChange={(e) => setEditName(e.target.value)} className={inputCls} placeholder="이름" />
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-slate-400 text-sm w-16 flex-shrink-0">전화번호</span>
                  <input value={editPhone} onChange={(e) => setEditPhone(e.target.value)} className={inputCls} placeholder="010-0000-0000" />
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-slate-400 text-sm w-16 flex-shrink-0">이메일</span>
                  <input value={editEmail} onChange={(e) => setEditEmail(e.target.value)} className={inputCls} placeholder="email@example.com" />
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-slate-400 text-sm w-16 flex-shrink-0">추천인</span>
                  <input value={editReferrer} onChange={(e) => setEditReferrer(e.target.value)} className={inputCls} placeholder="소개해 주신 분 이름" />
                </div>
                <div className="flex justify-end gap-2 pt-1">
                  <button onClick={() => setEditMode(false)} className="px-3 py-1.5 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50">취소</button>
                  <button
                    onClick={handleSaveEdit}
                    disabled={editSaving}
                    className="px-3 py-1.5 text-sm text-white rounded-lg disabled:opacity-50"
                    style={{ background: '#1a2b5a' }}
                  >{editSaving ? '저장 중...' : '저장'}</button>
                </div>
              </div>
            ) : (
              <div className="space-y-2.5">
                <Row label="이름">{client.name}</Row>
                <Row label="전화번호">
                  <a href={`tel:${client.phone}`} className="hover:underline" style={{ color: '#4a7aef' }}>
                    {client.phone}
                  </a>
                </Row>
                <Row label="이메일">{client.email ?? '-'}</Row>
                <Row label="추천인">{client.referrer ?? '-'}</Row>
                <Row label="첫 연락일">{formatDate(client.created_at)}</Row>
                <Row label="최근 연락">{formatDate(client.last_contact_at)}</Row>
              </div>
            )}
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
                  const status = STATUS_CONFIG[c.status ?? 'new'] ?? STATUS_CONFIG.new
                  return (
                    <div
                      key={c.id}
                      onClick={() => router.push(`/dashboard/cases/${c.id}`)}
                      className="flex items-center justify-between p-3 rounded-lg border border-slate-100 hover:border-slate-200 hover:bg-slate-50 cursor-pointer transition-colors"
                    >
                      <span className="text-sm font-medium text-slate-800">{c.case_type}</span>
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

        {/* Right: recording consultation history */}
        <div className="space-y-3">
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
              상담 기록 ({recordings.length}건)
            </h2>
            {recordings.length === 0 ? (
              <p className="text-sm text-slate-400 py-2 text-center">상담 기록이 없습니다.</p>
            ) : (
              <div className="space-y-2">
                {recordings.map((rec) => {
                  const rs = REC_STATUS[rec.status] ?? { label: rec.status, color: '#94a3b8' }
                  return (
                    <div
                      key={rec.id}
                      onClick={() => router.push(`/dashboard/recordings/${rec.id}`)}
                      className="flex items-center justify-between p-2.5 rounded-lg border border-slate-100 hover:border-slate-200 hover:bg-slate-50 cursor-pointer transition-colors group"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-800 truncate group-hover:text-blue-600 transition-colors">
                          {rec.title || '제목 없음'}
                        </p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-xs font-medium" style={{ color: rs.color }}>{rs.label}</span>
                          {rec.duration_seconds != null && (
                            <span className="text-xs text-slate-400">· {formatDuration(rec.duration_seconds)}</span>
                          )}
                        </div>
                      </div>
                      <svg className="w-4 h-4 text-slate-300 group-hover:text-blue-400 flex-shrink-0 ml-2 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  )
                })}
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

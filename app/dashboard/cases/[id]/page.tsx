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

type EditEvent = { date: string; summary: string }
type EditRequirement = { element: string; status: 'confirmed' | 'denied' | 'unknown'; detail: string }

const STATUS_CONFIG = {
  new:       { label: '신규',  style: 'text-yellow-700 bg-yellow-50 border-yellow-200', next: 'reviewing' as const, nextLabel: '검토 시작' },
  reviewing: { label: '검토중', style: 'text-blue-700 bg-blue-50 border-blue-200',     next: 'done' as const,       nextLabel: '완료 처리' },
  done:      { label: '완료',  style: 'text-green-700 bg-green-50 border-green-200',   next: null,                  nextLabel: null },
}

function formatPhone(raw: string | null | undefined): string {
  if (!raw) return ''
  const digits = raw.replace(/\D/g, '')
  if (digits.length === 11) return digits.replace(/(\d{3})(\d{4})(\d{4})/, '$1-$2-$3')
  if (digits.length === 10) return digits.replace(/(\d{3})(\d{3})(\d{4})/, '$1-$2-$3')
  return raw
}

const REQ_STATUS_CONFIG = {
  confirmed: { icon: '✓', bg: '#f0fdf4', border: '#bbf7d0', text: '#15803d', label: '충족' },
  denied:    { icon: '✗', bg: '#fef2f2', border: '#fecaca', text: '#dc2626', label: '불충족' },
  unknown:   { icon: '?', bg: '#f8fafc', border: '#e2e8f0', text: '#64748b', label: '미확인' },
}

export default function CaseDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { session, loading } = useAuth()
  const [caseData, setCaseData] = useState<CaseDetail | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [parentMessages, setParentMessages] = useState<Message[]>([])
  const [clientCases, setClientCases] = useState<ClientCase[]>([])
  const [recordingUrl, setRecordingUrl] = useState<string | null>(null)
  const [fetching, setFetching] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [statusUpdating, setStatusUpdating] = useState(false)

  // Edit mode
  const [editMode, setEditMode] = useState(false)
  const [editClientName, setEditClientName] = useState('')
  const [editClientPhone, setEditClientPhone] = useState('')
  const [editClientEmail, setEditClientEmail] = useState('')
  const [editCaseType, setEditCaseType] = useState('')
  const [editSummaryText, setEditSummaryText] = useState('')
  const [editEvents, setEditEvents] = useState<EditEvent[]>([])
  const [editRequirements, setEditRequirements] = useState<EditRequirement[]>([])
  const [editSaving, setEditSaving] = useState(false)

  // Connect modal
  const [showConnectModal, setShowConnectModal] = useState(false)
  const [connectSaving, setConnectSaving] = useState(false)

  // Delete confirm
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)

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
        setFetching(false)
      })
      .catch(() => setFetching(false))
  }, [session, sessionId])

  function openEditMode() {
    if (!caseData) return
    setEditClientName(caseData.client_name ?? '')
    setEditClientPhone(caseData.client_phone ?? '')
    setEditClientEmail(caseData.client_email ?? '')
    setEditCaseType(caseData.case_type ?? '')
    setEditSummaryText(caseData.summary?.summary_text ?? '')
    setEditEvents(
      (caseData.summary?.events ?? []).map((e) => ({
        date: e.date ?? '',
        summary: e.summary ?? '',
      }))
    )
    setEditRequirements(
      (caseData.summary?.requirements ?? []).map((r) => ({
        element: r.element ?? '',
        status: (r.status as 'confirmed' | 'denied' | 'unknown') ?? 'unknown',
        detail: r.detail ?? '',
      }))
    )
    setEditMode(true)
  }

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
          client_name: editClientName,
          client_phone: editClientPhone,
          client_email: editClientEmail,
          case_type: editCaseType,
          summary_patch: {
            summary_text: editSummaryText,
            events: editEvents.map((e) => ({
              date: e.date,
              summary: e.summary,
              subject: '', object: '', action: e.summary,
            })),
            requirements: editRequirements,
          },
        }),
      })
      if (res.ok) {
        setCaseData((prev) => prev ? {
          ...prev,
          client_name: editClientName,
          client_phone: editClientPhone,
          client_email: editClientEmail,
          case_type: editCaseType,
          summary: {
            ...prev.summary,
            summary_text: editSummaryText,
            events: editEvents.map((e) => ({ date: e.date, summary: e.summary, subject: '', object: '', action: e.summary })),
            requirements: editRequirements,
          },
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

  async function handleDelete() {
    if (!session || !sessionId || deleting) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/dashboard/cases/${sessionId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      if (res.ok) router.push('/dashboard')
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

  const status = STATUS_CONFIG[caseData.status ?? 'new']
  const summary = caseData.summary

  const inputCls = 'w-full border border-blue-200 rounded-lg px-3 py-2 text-sm text-slate-900 bg-white focus:outline-none focus:border-blue-400'

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
          <h1 className="text-xl font-bold text-slate-900">
            {editMode ? (
              <input
                value={editCaseType}
                onChange={(e) => setEditCaseType(e.target.value)}
                placeholder="사건유형"
                className="border border-blue-200 rounded-lg px-2 py-0.5 text-base font-bold text-slate-900 bg-white focus:outline-none focus:border-blue-400 w-40"
              />
            ) : (
              `${caseData.case_type} 사건`
            )}
          </h1>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {!editMode && (
            <>
              <a
                href={`tel:${caseData.client_phone}`}
                className="px-3 py-1.5 text-sm font-medium text-white rounded-lg flex items-center gap-1.5 hover:opacity-90 transition-opacity"
                style={{ background: '#1a2b5a' }}
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 015.13 12.7a19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/>
                </svg>
                콜백
              </a>
              <button
                onClick={openEditMode}
                className="px-3 py-1.5 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
              >
                수정
              </button>
              {clientCases.length > 0 && (
                <button
                  onClick={() => setShowConnectModal(true)}
                  className="px-3 py-1.5 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  기존 사건에 연결
                </button>
              )}
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 border border-slate-200 rounded-lg transition-colors"
                title="사건 삭제"
              >
                <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/>
                </svg>
              </button>
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
          {!editMode && (
            <>
              <span className={`px-2.5 py-1 rounded-lg text-sm font-medium border ${status.style}`}>
                {status.label}
              </span>
              {status.next && (
                <button
                  onClick={() => handleStatusChange(status.next!)}
                  disabled={statusUpdating}
                  className="px-3 py-1.5 text-sm font-medium text-white rounded-lg disabled:opacity-50 transition-colors"
                  style={{ background: '#1a2b5a' }}
                >
                  {statusUpdating ? '처리 중...' : status.nextLabel}
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Parent case linked indicator */}
      {caseData.parent_case_id && (
        <div className="mb-4 px-4 py-2.5 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700">
          기존 사건에 연결됨
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
              {caseData.client_id && !editMode && (
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
            {editMode ? (
              <div className="space-y-2.5">
                <div className="flex items-center gap-3">
                  <span className="text-slate-400 text-sm w-14 flex-shrink-0">이름</span>
                  <input value={editClientName} onChange={(e) => setEditClientName(e.target.value)} className={inputCls} placeholder="이름" />
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-slate-400 text-sm w-14 flex-shrink-0">연락처</span>
                  <input value={editClientPhone} onChange={(e) => setEditClientPhone(e.target.value)} className={inputCls} placeholder="010-0000-0000" />
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-slate-400 text-sm w-14 flex-shrink-0">이메일</span>
                  <input value={editClientEmail} onChange={(e) => setEditClientEmail(e.target.value)} className={inputCls} placeholder="email@example.com" />
                </div>
              </div>
            ) : (
              <div className="space-y-2.5">
                <InfoRow label="이름" value={caseData.client_name} />
                <InfoRow label="연락처" value={caseData.client_phone} isPhone />
                {caseData.client_email && <InfoRow label="이메일" value={caseData.client_email} isEmail />}
                <InfoRow label="접수일" value={new Date(caseData.created_at).toLocaleString('ko-KR', {
                  year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit',
                })} />
              </div>
            )}
          </div>

          {/* Proxy contact info */}
          {caseData.is_proxy && caseData.contact_name && (
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">문의자 정보 (대리)</h2>
              <div className="space-y-2.5">
                <InfoRow label="이름" value={`${caseData.contact_name}${caseData.contact_relation ? ` (${caseData.contact_relation})` : ''}`} />
                {caseData.contact_phone && <InfoRow label="연락처" value={caseData.contact_phone} isPhone />}
                {caseData.contact_email && <InfoRow label="이메일" value={caseData.contact_email} isEmail />}
              </div>
            </div>
          )}

          {/* Summary */}
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">접수 요약</h2>
            {editMode ? (
              <textarea
                value={editSummaryText}
                onChange={(e) => setEditSummaryText(e.target.value)}
                rows={3}
                className={`${inputCls} resize-none`}
                placeholder="한 줄 요약"
              />
            ) : (
              <>
                <p className="text-slate-700 text-sm leading-relaxed">{summary?.summary_text}</p>
                {summary?.ai_notes && (
                  <div className="mt-3 p-3 bg-slate-50 border border-slate-100 rounded-lg">
                    <p className="text-xs font-medium text-slate-400 mb-1">AI 참고 메모</p>
                    <p className="text-sm text-slate-600">{summary.ai_notes}</p>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Requirements */}
          {(editMode || (summary?.requirements?.length > 0)) && (
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">요건사실 체크리스트</h2>
              {editMode ? (
                <div className="space-y-3">
                  {editRequirements.map((req, i) => (
                    <div key={i} className="border border-slate-200 rounded-lg p-3 space-y-2">
                      <div className="flex items-center gap-2">
                        <input
                          value={req.element}
                          onChange={(e) => setEditRequirements((prev) => prev.map((r, j) => j === i ? { ...r, element: e.target.value } : r))}
                          className={`${inputCls} flex-1`}
                          placeholder="요건사실 (예: 금전교부)"
                        />
                        <select
                          value={req.status}
                          onChange={(e) => setEditRequirements((prev) => prev.map((r, j) => j === i ? { ...r, status: e.target.value as EditRequirement['status'] } : r))}
                          className="border border-blue-200 rounded-lg px-2 py-2 text-sm focus:outline-none focus:border-blue-400 flex-shrink-0"
                        >
                          <option value="confirmed">충족</option>
                          <option value="denied">불충족</option>
                          <option value="unknown">미확인</option>
                        </select>
                        <button
                          onClick={() => setEditRequirements((prev) => prev.filter((_, j) => j !== i))}
                          className="p-1.5 text-slate-300 hover:text-red-400 flex-shrink-0"
                        >
                          <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
                            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                          </svg>
                        </button>
                      </div>
                      <input
                        value={req.detail}
                        onChange={(e) => setEditRequirements((prev) => prev.map((r, j) => j === i ? { ...r, detail: e.target.value } : r))}
                        className={inputCls}
                        placeholder="상세 내용"
                      />
                    </div>
                  ))}
                  <button
                    onClick={() => setEditRequirements((prev) => [...prev, { element: '', status: 'unknown', detail: '' }])}
                    className="w-full py-2 border border-dashed border-slate-300 rounded-lg text-sm text-slate-500 hover:border-blue-300 hover:text-blue-500 transition-colors"
                  >
                    + 요건 추가
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  {(summary?.requirements ?? []).map((req, i) => {
                    const cfg = REQ_STATUS_CONFIG[req.status ?? 'unknown'] ?? REQ_STATUS_CONFIG.unknown
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
              )}
            </div>
          )}

          {/* Legal Analysis */}
          {!editMode && summary?.legal_analysis && (
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">사건 검토 분석</h2>
                <span className="text-xs text-slate-400">참고용 추정</span>
              </div>
              <p className="text-xs text-slate-400 mb-4">※ 본 리포트는 접수 단계의 참고 자료이며, 법률 자문을 대체하지 않습니다.</p>
              <div className="space-y-4">

                {/* Statute of limitations */}
                {summary.legal_analysis.statute_of_limitations && (
                  <div className="p-3 bg-blue-50 border border-blue-100 rounded-lg">
                    <p className="text-xs font-semibold text-blue-700 mb-1">소멸시효 (참고)</p>
                    <p className="text-sm text-blue-800 leading-relaxed">{summary.legal_analysis.statute_of_limitations}</p>
                  </div>
                )}

                {/* Evidence analysis */}
                {summary.legal_analysis.evidence_analysis && (
                  <div>
                    <p className="text-xs font-medium text-slate-500 mb-1">증거 확보 상태</p>
                    <p className="text-sm text-slate-600">{summary.legal_analysis.evidence_analysis}</p>
                  </div>
                )}

                {/* Missing info */}
                {(summary.legal_analysis.missing_info?.length ?? 0) > 0 && (
                  <div>
                    <p className="text-xs font-medium text-slate-500 mb-1.5">추가 확인 필요</p>
                    <ul className="space-y-1">
                      {summary.legal_analysis.missing_info!.map((item, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-slate-600">
                          <span className="flex-shrink-0 mt-0.5 text-amber-500">?</span>
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Next actions */}
                {(summary.legal_analysis.next_actions?.length ?? 0) > 0 && (
                  <div>
                    <p className="text-xs font-medium text-slate-500 mb-1.5">다음 액션 제안</p>
                    <ul className="space-y-1">
                      {summary.legal_analysis.next_actions!.map((action, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
                          <span className="flex-shrink-0 mt-0.5" style={{ color: '#4a7aef' }}>→</span>
                          {action}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Risk factors */}
                {(summary.legal_analysis.risk_factors?.length ?? 0) > 0 && (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                    <p className="text-xs font-semibold text-amber-700 mb-1.5">⚠ 위험 요소</p>
                    <ul className="space-y-1">
                      {summary.legal_analysis.risk_factors!.map((risk, i) => (
                        <li key={i} className="text-sm text-amber-700">{risk}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Events timeline */}
          {(editMode || (summary?.events?.length > 0)) && (
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">사건 경위</h2>
              {editMode ? (
                <div className="space-y-3">
                  {editEvents.map((ev, i) => (
                    <div key={i} className="border border-slate-200 rounded-lg p-3 space-y-2">
                      <div className="flex items-center gap-2">
                        <input
                          type="date"
                          value={ev.date}
                          onChange={(e) => setEditEvents((prev) => prev.map((v, j) => j === i ? { ...v, date: e.target.value } : v))}
                          className={`${inputCls} w-40 flex-shrink-0`}
                        />
                        <button
                          onClick={() => setEditEvents((prev) => prev.filter((_, j) => j !== i))}
                          className="ml-auto p-1.5 text-slate-300 hover:text-red-400 flex-shrink-0"
                        >
                          <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
                            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                          </svg>
                        </button>
                      </div>
                      <textarea
                        value={ev.summary}
                        onChange={(e) => setEditEvents((prev) => prev.map((v, j) => j === i ? { ...v, summary: e.target.value } : v))}
                        rows={2}
                        className={`${inputCls} resize-none`}
                        placeholder="사건 경위 내용"
                      />
                    </div>
                  ))}
                  <button
                    onClick={() => setEditEvents((prev) => [...prev, { date: '', summary: '' }])}
                    className="w-full py-2 border border-dashed border-slate-300 rounded-lg text-sm text-slate-500 hover:border-blue-300 hover:text-blue-500 transition-colors"
                  >
                    + 경위 추가
                  </button>
                </div>
              ) : (
                <div className="space-y-0">
                  {(summary?.events ?? []).map((event, i) => (
                    <div key={i} className="flex gap-3">
                      <div className="flex flex-col items-center">
                        <div className="w-2 h-2 rounded-full mt-1 flex-shrink-0" style={{ background: '#4a7aef' }} />
                        {i < (summary?.events ?? []).length - 1 && (
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
              )}
            </div>
          )}

          {/* Unconfirmed items */}
          {!editMode && summary?.unconfirmed?.length > 0 && (
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
          {summary?.evidence?.length > 0 && !editMode && (
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

          {summary?.document_request?.length > 0 && !editMode && (
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">요청 증빙자료</h2>
              <ul className="space-y-2">
                {summary.document_request.map((doc, i) => {
                  const isObj = typeof doc === 'object' && doc !== null && 'name' in doc
                  const name = isObj ? (doc as { name: string; required: boolean }).name : doc as string
                  const required = isObj ? (doc as { name: string; required: boolean }).required : null
                  return (
                    <li key={i} className="flex items-center gap-2 text-sm text-slate-700">
                      <span className="flex-shrink-0" style={{ color: '#4a7aef' }}>•</span>
                      <span className="flex-1">{name}</span>
                      {required === true && (
                        <span className="flex-shrink-0 px-1.5 py-0.5 text-xs font-semibold rounded bg-red-50 border border-red-200 text-red-600">필수</span>
                      )}
                      {required === false && (
                        <span className="flex-shrink-0 px-1.5 py-0.5 text-xs font-semibold rounded bg-slate-50 border border-slate-200 text-slate-500">권장</span>
                      )}
                    </li>
                  )
                })}
              </ul>
            </div>
          )}

          {summary?.client_request && !editMode && (
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">고객 요청사항</h2>
              <p className="text-sm text-slate-700">{summary.client_request}</p>
            </div>
          )}

          {!editMode && (
            <ChatHistory label={`대화 내역 (${messages.length}개)`} messages={messages} />
          )}

          {!editMode && parentMessages.length > 0 && (
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

      {/* Delete confirm modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl">
            <h3 className="text-base font-semibold text-slate-900 mb-1">사건을 삭제하시겠어요?</h3>
            <p className="text-sm text-slate-500 mb-1">
              <span className="font-medium text-slate-700">{caseData.client_name}</span>님의{' '}
              <span className="font-medium text-slate-700">{caseData.case_type}</span> 사건이 삭제됩니다.
            </p>
            <p className="text-xs text-red-500 mb-6">삭제된 사건은 복구할 수 없습니다.</p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
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
    </div>
  )
}

function InfoRow({ label, value, isPhone, isEmail }: { label: string; value: string | null | undefined; isPhone?: boolean; isEmail?: boolean }) {
  const display = isPhone ? formatPhone(value) : isEmail ? (value ?? '').toLowerCase() : (value ?? '')
  return (
    <div className="flex items-center gap-3">
      <span className="text-slate-400 text-sm w-14 flex-shrink-0">{label}</span>
      {isPhone ? (
        <a href={`tel:${value}`} className="text-sm hover:underline" style={{ color: '#4a7aef' }}>{display}</a>
      ) : (
        <span className="text-slate-700 text-sm">{display}</span>
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

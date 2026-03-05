'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import type { CaseSummary } from '@/types'

type CaseDetail = {
  id: number
  session_id: string
  client_id: string | null
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

type ClientCase = {
  id: number
  session_id: string
  case_type: string
  created_at: string
}

type LiveClient = {
  id: string
  name: string
  phone: string
  email: string | null
  referrer: string | null
}

type LinkedReport = {
  id: string
  case_type: string | null
  content: string
  report_type: string
}

type LinkedRecording = {
  id: string
  title: string
  status: string
  duration_seconds: number | null
  created_at: string
  reports: LinkedReport | LinkedReport[] | null
}

type ConsolidatedReport = {
  id: string
  content: string
  case_type: string | null
  created_at: string
}

type Appointment = {
  id: string
  title: string
  appointment_type: 'consultation' | 'hearing' | 'deadline' | 'other'
  scheduled_at: string
  memo: string | null
  created_at: string
}

type EditEvent = { date: string; summary: string }
type EditRequirement = { element: string; status: 'confirmed' | 'denied' | 'unknown'; detail: string }
type TabKey = 'report' | 'schedule'
type EditingSection = null | 'summary' | 'events' | 'requirements'

const STATUS_CONFIG = {
  new:       { label: '신규',  color: '#4a7aef', next: 'reviewing' as const, nextLabel: '검토 시작' },
  reviewing: { label: '검토중', color: '#D97706', next: 'done' as const,       nextLabel: '완료 처리' },
  done:      { label: '완료',  color: '#16A34A', next: null,                  nextLabel: null },
}

const REQ_STATUS_CONFIG = {
  confirmed: { label: '충족',  color: '#16A34A' },
  denied:    { label: '불충족', color: '#DC2626' },
  unknown:   { label: '미확인', color: '#D97706' },
}

const APPT_TYPE_LABEL: Record<string, string> = {
  consultation: '상담',
  hearing: '기일',
  deadline: '기한',
  other: '기타',
}

function formatPhone(raw: string | null | undefined): string {
  if (!raw) return ''
  const digits = raw.replace(/\D/g, '')
  if (digits.length === 11) return digits.replace(/(\d{3})(\d{4})(\d{4})/, '$1-$2-$3')
  if (digits.length === 10) return digits.replace(/(\d{3})(\d{3})(\d{4})/, '$1-$2-$3')
  return raw
}

function formatScheduledAt(iso: string) {
  const d = new Date(iso)
  return d.toLocaleString('ko-KR', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })
}

export default function CaseDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { session, loading } = useAuth()
  const [caseData, setCaseData] = useState<CaseDetail | null>(null)
  const [liveClient, setLiveClient] = useState<LiveClient | null>(null)
  const [clientCases, setClientCases] = useState<ClientCase[]>([])
  const [linkedRecordings, setLinkedRecordings] = useState<LinkedRecording[]>([])
  const [fetching, setFetching] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [statusUpdating, setStatusUpdating] = useState(false)

  // Tabs
  const [activeTab, setActiveTab] = useState<TabKey>('report')

  // Per-section edit state
  const [editingSection, setEditingSection] = useState<EditingSection>(null)
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

  // Consolidated report
  const [consolidatedReport, setConsolidatedReport] = useState<ConsolidatedReport | null>(null)
  const [consolidating, setConsolidating] = useState(false)
  const [showConsolidatedReport, setShowConsolidatedReport] = useState(false)

  // Appointments
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [aptLoading, setAptLoading] = useState(false)
  const [showAptModal, setShowAptModal] = useState(false)
  const [editingApt, setEditingApt] = useState<Appointment | null>(null)
  const [aptTitle, setAptTitle] = useState('')
  const [aptType, setAptType] = useState<Appointment['appointment_type']>('consultation')
  const [aptDate, setAptDate] = useState('')
  const [aptTime, setAptTime] = useState('')
  const [aptMemo, setAptMemo] = useState('')
  const [aptSaving, setAptSaving] = useState(false)

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
        setLiveClient(data.client ?? null)
        setClientCases(data.clientCases ?? [])
        setFetching(false)
      })
      .catch(() => setFetching(false))

    // Fetch linked recordings separately
    fetch(`/api/dashboard/cases/${sessionId}/recordings`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
      .then((r) => r.json())
      .then((d) => setLinkedRecordings(d.recordings ?? []))
      .catch(() => {})

    // Fetch consolidated report if exists
    fetch(`/api/dashboard/cases/${sessionId}/consolidated-report`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
      .then((r) => r.json())
      .then((d) => { if (d.report) setConsolidatedReport(d.report) })
      .catch(() => {})
  }, [session, sessionId])

  useEffect(() => {
    if (!session || !sessionId || activeTab !== 'schedule') return
    setAptLoading(true)
    fetch(`/api/dashboard/cases/${sessionId}/appointments`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
      .then((r) => r.json())
      .then((data) => setAppointments(data.appointments ?? []))
      .finally(() => setAptLoading(false))
  }, [session, sessionId, activeTab])

  async function saveSection(patch: Record<string, unknown>) {
    if (!session || !sessionId || editSaving) return false
    setEditSaving(true)
    try {
      const res = await fetch(`/api/dashboard/cases/${sessionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify(patch),
      })
      return res.ok
    } finally {
      setEditSaving(false)
    }
  }

  function openSummaryEdit() {
    if (!caseData) return
    setEditCaseType(caseData.case_type ?? '')
    setEditSummaryText(caseData.summary?.summary_text ?? '')
    setEditingSection('summary')
  }

  async function handleSaveSummary() {
    const ok = await saveSection({
      case_type: editCaseType,
      summary_patch: { summary_text: editSummaryText },
    })
    if (ok) {
      setCaseData((prev) => prev ? {
        ...prev,
        case_type: editCaseType,
        summary: { ...prev.summary, summary_text: editSummaryText },
      } : prev)
      setEditingSection(null)
    }
  }

  function openEventsEdit() {
    if (!caseData) return
    setEditEvents((caseData.summary?.events ?? []).map((e) => ({ date: e.date ?? '', summary: e.summary ?? '' })))
    setEditingSection('events')
  }

  async function handleSaveEvents() {
    const mapped = editEvents.map((e) => ({ date: e.date, summary: e.summary, subject: '', object: '', action: e.summary }))
    const ok = await saveSection({ summary_patch: { events: mapped } })
    if (ok) {
      setCaseData((prev) => prev ? {
        ...prev,
        summary: { ...prev.summary, events: mapped },
      } : prev)
      setEditingSection(null)
    }
  }

  function openRequirementsEdit() {
    if (!caseData) return
    setEditRequirements((caseData.summary?.requirements ?? []).map((r) => ({
      element: r.element ?? '',
      status: (r.status as 'confirmed' | 'denied' | 'unknown') ?? 'unknown',
      detail: r.detail ?? '',
    })))
    setEditingSection('requirements')
  }

  async function handleSaveRequirements() {
    const ok = await saveSection({ summary_patch: { requirements: editRequirements } })
    if (ok) {
      setCaseData((prev) => prev ? {
        ...prev,
        summary: { ...prev.summary, requirements: editRequirements },
      } : prev)
      setEditingSection(null)
    }
  }

  async function handleStatusChange(nextStatus: 'new' | 'reviewing' | 'done') {
    if (!session || !sessionId || statusUpdating) return
    setStatusUpdating(true)
    try {
      const res = await fetch(`/api/dashboard/cases/${sessionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ status: nextStatus }),
      })
      if (res.ok) setCaseData((prev) => prev ? { ...prev, status: nextStatus } : prev)
    } finally {
      setStatusUpdating(false)
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
      if (res.ok) { setCaseData((prev) => prev ? { ...prev, parent_case_id: parentId } : prev); setShowConnectModal(false) }
    } finally {
      setConnectSaving(false)
    }
  }

  async function handleGenerateConsolidatedReport() {
    if (!session || !sessionId || consolidating) return
    setConsolidating(true)
    try {
      const res = await fetch(`/api/dashboard/cases/${sessionId}/consolidated-report`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      if (res.ok) {
        const data = await res.json()
        setConsolidatedReport(data.report)
        setShowConsolidatedReport(true)
      }
    } finally {
      setConsolidating(false)
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

  function openAddApt() {
    setEditingApt(null)
    setAptTitle('')
    setAptType('consultation')
    const now = new Date()
    setAptDate(now.toISOString().slice(0, 10))
    setAptTime('10:00')
    setAptMemo('')
    setShowAptModal(true)
  }

  function openEditApt(apt: Appointment) {
    setEditingApt(apt)
    setAptTitle(apt.title)
    setAptType(apt.appointment_type)
    const d = new Date(apt.scheduled_at)
    setAptDate(d.toISOString().slice(0, 10))
    setAptTime(`${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`)
    setAptMemo(apt.memo ?? '')
    setShowAptModal(true)
  }

  async function handleSaveApt() {
    if (!session || !aptTitle.trim() || !aptDate || aptSaving) return
    setAptSaving(true)
    const scheduled_at = new Date(`${aptDate}T${aptTime || '00:00'}`).toISOString()
    try {
      if (editingApt) {
        const res = await fetch(`/api/dashboard/appointments/${editingApt.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
          body: JSON.stringify({ title: aptTitle, appointment_type: aptType, scheduled_at, memo: aptMemo }),
        })
        if (res.ok) {
          const data = await res.json()
          setAppointments((prev) => prev.map((a) => a.id === editingApt.id ? data.appointment : a).sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at)))
          setShowAptModal(false)
        }
      } else {
        const res = await fetch(`/api/dashboard/cases/${sessionId}/appointments`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
          body: JSON.stringify({ title: aptTitle, appointment_type: aptType, scheduled_at, memo: aptMemo }),
        })
        if (res.ok) {
          const data = await res.json()
          setAppointments((prev) => [...prev, data.appointment].sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at)))
          setShowAptModal(false)
        }
      }
    } finally {
      setAptSaving(false)
    }
  }

  async function handleDeleteApt(apt: Appointment) {
    if (!session) return
    await fetch(`/api/dashboard/appointments/${apt.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
    setAppointments((prev) => prev.filter((a) => a.id !== apt.id))
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

  const TABS: { key: TabKey; label: string }[] = [
    { key: 'report', label: '리포트' },
    { key: 'schedule', label: '일정' },
  ]

  return (
    <div className="p-4 md:p-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
            <h1 className="text-xl font-bold text-slate-900">{liveClient?.name ?? '고객 정보 없음'}</h1>
            <p className="text-sm text-slate-500 mt-0.5">{caseData.case_type}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium" style={{ color: status.color }}>{status.label}</span>
          {caseData.status === 'done' ? (
            <select
              onChange={(e) => { if (e.target.value) handleStatusChange(e.target.value as 'new' | 'reviewing') }}
              disabled={statusUpdating}
              value=""
              className="px-3 py-1.5 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-lg disabled:opacity-50 cursor-pointer"
            >
              <option value="" disabled>상태 변경</option>
              <option value="reviewing">검토중으로</option>
              <option value="new">신규로</option>
            </select>
          ) : (
            status.next && (
              <button
                onClick={() => handleStatusChange(status.next!)}
                disabled={statusUpdating}
                className="px-3 py-1.5 text-sm font-medium text-white rounded-lg disabled:opacity-50 transition-colors"
                style={{ background: '#1a2b5a' }}
              >
                {statusUpdating ? '처리 중...' : status.nextLabel}
              </button>
            )
          )}
          {clientCases.length > 0 && (
            <button
              onClick={() => setShowConnectModal(true)}
              className="px-3 py-1.5 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
            >기존 사건에 연결</button>
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
        </div>
      </div>

      {/* Parent case linked */}
      {caseData.parent_case_id && (
        <div className="mb-3 px-4 py-2.5 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700">
          기존 사건에 연결됨
        </div>
      )}

      {/* Tab bar */}
      <div className="flex border-b border-slate-200 mb-4">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              activeTab === tab.key
                ? 'border-current text-current'
                : 'border-transparent text-slate-400 hover:text-slate-600'
            }`}
            style={activeTab === tab.key ? { color: '#1a2b5a', borderColor: '#1a2b5a' } : {}}
          >
            {tab.label}
            {tab.key === 'schedule' && appointments.length > 0 && (
              <span className="ml-1.5 text-xs opacity-60">{appointments.length}</span>
            )}
          </button>
        ))}
      </div>

      {/* ── 리포트 탭 ── */}
      {activeTab === 'report' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Left: main info */}
          <div className="lg:col-span-2 space-y-4">

            {/* Client info — always readonly; edit via client detail page */}
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
                    고객 상세에서 수정
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                )}
              </div>
              <div className="space-y-2.5">
                <InfoRow label="이름" value={liveClient?.name ?? '정보 없음'} />
                <InfoRow label="연락처" value={liveClient?.phone ?? '-'} isPhone />
                {liveClient?.email && (
                  <InfoRow label="이메일" value={liveClient.email} isEmail />
                )}
                {liveClient?.referrer && <InfoRow label="추천인" value={liveClient.referrer} />}
                <InfoRow label="접수일" value={new Date(caseData.created_at).toLocaleString('ko-KR', {
                  year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit',
                })} />
              </div>
            </div>

            {/* Proxy contact */}
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

            {/* Summary — section edit */}
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">접수 요약</h2>
                {editingSection !== 'summary' && (
                  <button
                    onClick={openSummaryEdit}
                    disabled={editingSection !== null}
                    className="text-xs font-medium text-slate-400 hover:text-slate-600 disabled:opacity-40 transition-colors"
                  >
                    수정
                  </button>
                )}
              </div>
              {editingSection === 'summary' ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-400 w-16 flex-shrink-0">사건 유형</span>
                    <input
                      value={editCaseType}
                      onChange={(e) => setEditCaseType(e.target.value)}
                      className={inputCls}
                      placeholder="예: 형사-폭행"
                    />
                  </div>
                  <textarea
                    value={editSummaryText}
                    onChange={(e) => setEditSummaryText(e.target.value)}
                    rows={3}
                    className={`${inputCls} resize-none`}
                    placeholder="접수 요약"
                  />
                  <div className="flex justify-end gap-2">
                    <button onClick={() => setEditingSection(null)} className="px-3 py-1.5 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50">취소</button>
                    <button
                      onClick={handleSaveSummary}
                      disabled={editSaving}
                      className="px-3 py-1.5 text-sm text-white rounded-lg disabled:opacity-50"
                      style={{ background: '#1a2b5a' }}
                    >{editSaving ? '저장 중...' : '저장'}</button>
                  </div>
                </div>
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

            {/* Requirements — section edit */}
            {(editingSection === 'requirements' || (summary?.requirements?.length > 0)) && (
              <div className="bg-white rounded-xl border border-slate-200 p-4">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">요건사실 체크리스트</h2>
                  {editingSection !== 'requirements' && (
                    <button
                      onClick={openRequirementsEdit}
                      disabled={editingSection !== null}
                      className="text-xs font-medium text-slate-400 hover:text-slate-600 disabled:opacity-40 transition-colors"
                    >
                      수정
                    </button>
                  )}
                </div>
                {editingSection === 'requirements' ? (
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
                    >+ 요건 추가</button>
                    <div className="flex justify-end gap-2">
                      <button onClick={() => setEditingSection(null)} className="px-3 py-1.5 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50">취소</button>
                      <button
                        onClick={handleSaveRequirements}
                        disabled={editSaving}
                        className="px-3 py-1.5 text-sm text-white rounded-lg disabled:opacity-50"
                        style={{ background: '#1a2b5a' }}
                      >{editSaving ? '저장 중...' : '저장'}</button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {(summary?.requirements ?? []).map((req, i) => {
                      const cfg = REQ_STATUS_CONFIG[req.status ?? 'unknown'] ?? REQ_STATUS_CONFIG.unknown
                      return (
                        <div key={i} className="flex items-start gap-2.5 py-2 border-b border-slate-100 last:border-0">
                          <span className="flex-shrink-0 text-sm mt-0.5" style={{ color: cfg.color }}>
                            {req.status === 'confirmed' ? '✓' : req.status === 'denied' ? '✗' : '?'}
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-baseline gap-2 flex-wrap">
                              <span className="text-sm font-semibold text-slate-800">{req.element}</span>
                              <span className="text-xs font-medium" style={{ color: cfg.color }}>{cfg.label}</span>
                            </div>
                            {req.detail && <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{req.detail}</p>}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Legal Analysis */}
            {summary?.legal_analysis && (
              <div className="bg-white rounded-xl border border-slate-200 p-4">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">사건 검토 분석</h2>
                  <span className="text-xs text-slate-400">참고용 추정</span>
                </div>
                <p className="text-xs text-slate-400 mb-4">※ 본 리포트는 접수 단계의 참고 자료이며, 법률 자문을 대체하지 않습니다.</p>
                <div className="space-y-4">
                  {summary.legal_analysis.statute_of_limitations && (
                    <div className="p-3 bg-blue-50 border border-blue-100 rounded-lg">
                      <p className="text-xs font-semibold text-blue-700 mb-1">소멸시효 (참고)</p>
                      <p className="text-sm text-blue-800 leading-relaxed">{summary.legal_analysis.statute_of_limitations}</p>
                    </div>
                  )}
                  {summary.legal_analysis.evidence_analysis && (
                    <div>
                      <p className="text-xs font-medium text-slate-500 mb-1">증거 확보 상태</p>
                      <p className="text-sm text-slate-600">{summary.legal_analysis.evidence_analysis}</p>
                    </div>
                  )}
                  {(summary.legal_analysis.missing_info?.length ?? 0) > 0 && (
                    <div>
                      <p className="text-xs font-medium text-slate-500 mb-1.5">추가 확인 필요</p>
                      <ul className="space-y-1">
                        {summary.legal_analysis.missing_info!.map((item, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm text-slate-600">
                            <span className="flex-shrink-0 mt-0.5 text-amber-500">?</span>{item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {(summary.legal_analysis.next_actions?.length ?? 0) > 0 && (
                    <div>
                      <p className="text-xs font-medium text-slate-500 mb-1.5">다음 액션 제안</p>
                      <ul className="space-y-1">
                        {summary.legal_analysis.next_actions!.map((action, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
                            <span className="flex-shrink-0 mt-0.5" style={{ color: '#4a7aef' }}>→</span>{action}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
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

            {/* Events timeline — section edit */}
            {(editingSection === 'events' || (summary?.events?.length > 0)) && (
              <div className="bg-white rounded-xl border border-slate-200 p-4">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">사실관계</h2>
                  {editingSection !== 'events' && (
                    <button
                      onClick={openEventsEdit}
                      disabled={editingSection !== null}
                      className="text-xs font-medium text-slate-400 hover:text-slate-600 disabled:opacity-40 transition-colors"
                    >
                      수정
                    </button>
                  )}
                </div>
                {editingSection === 'events' ? (
                  <div className="space-y-3">
                    {editEvents.map((ev, i) => (
                      <div key={i} className="border border-slate-200 rounded-lg p-3 space-y-2">
                        <div className="flex items-center gap-2">
                          <input type="date" value={ev.date} onChange={(e) => setEditEvents((prev) => prev.map((v, j) => j === i ? { ...v, date: e.target.value } : v))} className={`${inputCls} w-40 flex-shrink-0`} />
                          <button onClick={() => setEditEvents((prev) => prev.filter((_, j) => j !== i))} className="ml-auto p-1.5 text-slate-300 hover:text-red-400 flex-shrink-0">
                            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
                              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                            </svg>
                          </button>
                        </div>
                        <textarea value={ev.summary} onChange={(e) => setEditEvents((prev) => prev.map((v, j) => j === i ? { ...v, summary: e.target.value } : v))} rows={2} className={`${inputCls} resize-none`} placeholder="사실관계 내용" />
                      </div>
                    ))}
                    <button onClick={() => setEditEvents((prev) => [...prev, { date: '', summary: '' }])} className="w-full py-2 border border-dashed border-slate-300 rounded-lg text-sm text-slate-500 hover:border-blue-300 hover:text-blue-500 transition-colors">
                      + 사실관계 추가
                    </button>
                    <div className="flex justify-end gap-2">
                      <button onClick={() => setEditingSection(null)} className="px-3 py-1.5 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50">취소</button>
                      <button
                        onClick={handleSaveEvents}
                        disabled={editSaving}
                        className="px-3 py-1.5 text-sm text-white rounded-lg disabled:opacity-50"
                        style={{ background: '#1a2b5a' }}
                      >{editSaving ? '저장 중...' : '저장'}</button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-0">
                    {(summary?.events ?? []).map((event, i) => (
                      <div key={i} className="flex gap-3">
                        <div className="flex flex-col items-center">
                          <div className="w-2 h-2 rounded-full mt-1 flex-shrink-0" style={{ background: '#4a7aef' }} />
                          {i < (summary?.events ?? []).length - 1 && <div className="w-px flex-1 bg-slate-200 my-1" />}
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

            {/* Unconfirmed */}
            {summary?.unconfirmed?.length > 0 && (
              <div className="bg-white rounded-xl border border-slate-200 p-4">
                <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">미확인 사항</h2>
                <ul className="space-y-1.5">
                  {summary.unconfirmed.map((item, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-slate-600">
                      <span className="flex-shrink-0 mt-0.5 text-orange-400">?</span>{item}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Right column */}
          <div className="space-y-4">
            {summary?.evidence?.length > 0 && (
              <div className="bg-white rounded-xl border border-slate-200 p-4">
                <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">보유 증거</h2>
                <ul className="space-y-2">
                  {summary.evidence.map((e, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
                      <span className="flex-shrink-0 mt-0.5 text-green-500">✓</span>{e}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {summary?.document_request?.length > 0 && (
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
                        {required === true && <span className="flex-shrink-0 text-xs font-medium text-red-500">필수</span>}
                        {required === false && <span className="flex-shrink-0 text-xs text-slate-400">권장</span>}
                      </li>
                    )
                  })}
                </ul>
              </div>
            )}

            {summary?.client_request && (
              <div className="bg-white rounded-xl border border-slate-200 p-4">
                <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">고객 요청사항</h2>
                <p className="text-sm text-slate-700">{summary.client_request}</p>
              </div>
            )}

            {/* Linked consultations */}
            {linkedRecordings.length > 0 && (
              <div className="bg-white rounded-xl border border-slate-200 p-4">
                <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">연결된 상담 기록</h2>
                <ul className="space-y-2">
                  {linkedRecordings.map((rec) => (
                    <li key={rec.id}>
                      <a
                        href={`/dashboard/recordings/${rec.id}`}
                        className="flex items-center justify-between gap-2 p-2 rounded-lg hover:bg-slate-50 transition-colors group"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-slate-800 truncate group-hover:text-blue-600 transition-colors">
                            {rec.title || '제목 없음'}
                          </p>
                          <p className="text-xs text-slate-400 mt-0.5">
                            {rec.status === 'completed' ? (
                              <span style={{ color: '#16A34A' }}>완료</span>
                            ) : (
                              <span style={{ color: '#D97706' }}>분석중</span>
                            )}
                            {rec.duration_seconds != null && (
                              <span className="ml-1.5">
                                · {Math.floor(rec.duration_seconds / 60)}분
                              </span>
                            )}
                          </p>
                        </div>
                        <span className="text-xs font-medium flex-shrink-0 group-hover:text-blue-600 transition-colors" style={{ color: '#4a7aef' }}>
                          상담 상세 보기 →
                        </span>
                      </a>
                    </li>
                  ))}
                </ul>

                {/* Consolidated report section */}
                {linkedRecordings.length >= 2 && (
                  <div className="mt-3 pt-3 border-t border-slate-100">
                    {consolidatedReport ? (
                      <>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-semibold text-slate-500">통합 리포트</span>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => setShowConsolidatedReport((v) => !v)}
                              className="text-xs text-slate-400 hover:text-slate-600"
                            >
                              {showConsolidatedReport ? '접기' : '펼치기'}
                            </button>
                            <button
                              onClick={handleGenerateConsolidatedReport}
                              disabled={consolidating}
                              className="text-xs font-medium hover:underline disabled:opacity-50"
                              style={{ color: '#4a7aef' }}
                            >
                              {consolidating ? '생성 중...' : '재생성'}
                            </button>
                          </div>
                        </div>
                        {showConsolidatedReport && (
                          <div className="prose prose-slate prose-xs max-w-none text-xs leading-relaxed">
                            <pre className="whitespace-pre-wrap font-sans text-slate-700 text-xs leading-relaxed">{consolidatedReport.content}</pre>
                          </div>
                        )}
                      </>
                    ) : (
                      <button
                        onClick={handleGenerateConsolidatedReport}
                        disabled={consolidating}
                        className="w-full py-2.5 border border-dashed border-slate-300 rounded-lg text-sm font-medium text-slate-600 hover:border-blue-300 hover:text-blue-600 transition-colors disabled:opacity-50"
                      >
                        {consolidating ? (
                          <span className="flex items-center justify-center gap-2">
                            <span className="w-3.5 h-3.5 border-2 border-t-transparent rounded-full animate-spin inline-block" style={{ borderColor: '#4a7aef', borderTopColor: 'transparent' }} />
                            통합 리포트 생성 중...
                          </span>
                        ) : (
                          '통합 리포트 생성 →'
                        )}
                      </button>
                    )}
                  </div>
                )}

                {/* Single recording — show its report inline */}
                {linkedRecordings.length === 1 && (() => {
                  const rec = linkedRecordings[0]
                  const rpt = Array.isArray(rec.reports) ? rec.reports[0] : rec.reports
                  if (!rpt) return null
                  return (
                    <div className="mt-3 pt-3 border-t border-slate-100">
                      <a
                        href={`/dashboard/recordings/${rec.id}`}
                        className="flex items-center gap-1 text-xs font-medium hover:underline"
                        style={{ color: '#4a7aef' }}
                      >
                        상담 리포트 보기 →
                      </a>
                    </div>
                  )
                })()}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── 일정 탭 ── */}
      {activeTab === 'schedule' && (
        <div className="max-w-2xl">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-slate-700">
              일정 <span className="font-normal text-slate-400">{appointments.length}개</span>
            </h2>
            <button
              onClick={openAddApt}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-white text-sm font-medium"
              style={{ background: '#1a2b5a' }}
            >
              <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
              일정 추가
            </button>
          </div>

          {aptLoading ? (
            <div className="flex items-center justify-center h-32">
              <div className="w-5 h-5 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#1a2b5a', borderTopColor: 'transparent' }} />
            </div>
          ) : appointments.length === 0 ? (
            <div className="text-center py-16 text-slate-400">
              <svg className="w-10 h-10 mx-auto mb-3 text-slate-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <p className="text-sm">등록된 일정이 없습니다.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {appointments.map((apt) => {
                const isPast = new Date(apt.scheduled_at) < new Date()
                return (
                  <div
                    key={apt.id}
                    className={`bg-white rounded-xl border border-slate-200 p-4 ${isPast ? 'opacity-50' : ''}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline gap-2 flex-wrap mb-1">
                          <span className="text-xs text-slate-400">{APPT_TYPE_LABEL[apt.appointment_type] ?? apt.appointment_type}</span>
                          <span className="text-sm font-semibold text-slate-900">{apt.title}</span>
                        </div>
                        <p className="text-sm text-slate-500">{formatScheduledAt(apt.scheduled_at)}</p>
                        {apt.memo && <p className="text-xs text-slate-400 mt-1">{apt.memo}</p>}
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button onClick={() => openEditApt(apt)} className="p-1.5 text-slate-300 hover:text-slate-500 transition-colors">
                          <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                            <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
                          </svg>
                        </button>
                        <button onClick={() => handleDeleteApt(apt)} className="p-1.5 text-slate-300 hover:text-red-400 transition-colors">
                          <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/>
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ── 일정 추가/수정 모달 ── */}
      {showAptModal && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="w-full max-w-md bg-white rounded-2xl shadow-xl">
            <div className="px-5 pt-5 pb-4 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-base font-semibold text-slate-900">{editingApt ? '일정 수정' : '일정 추가'}</h2>
              <button onClick={() => setShowAptModal(false)} className="w-8 h-8 flex items-center justify-center rounded-full text-slate-400 hover:bg-slate-100">
                <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
            <div className="px-5 py-4 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1.5">유형</label>
                <div className="flex gap-2 flex-wrap">
                  {(['consultation', 'hearing', 'deadline', 'other'] as const).map((t) => (
                    <button
                      key={t}
                      onClick={() => setAptType(t)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                        aptType === t ? 'text-white border-transparent' : 'text-slate-600 border-slate-200 hover:border-slate-300'
                      }`}
                      style={aptType === t ? { background: '#1a2b5a' } : {}}
                    >{APPT_TYPE_LABEL[t]}</button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1.5">제목 *</label>
                <input
                  value={aptTitle}
                  onChange={(e) => setAptTitle(e.target.value)}
                  placeholder="예: 1차 변론기일"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 bg-white focus:outline-none focus:border-blue-400"
                />
              </div>
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="block text-xs font-medium text-slate-500 mb-1.5">날짜 *</label>
                  <input type="date" value={aptDate} onChange={(e) => setAptDate(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 bg-white focus:outline-none focus:border-blue-400" />
                </div>
                <div className="w-28">
                  <label className="block text-xs font-medium text-slate-500 mb-1.5">시간</label>
                  <input type="time" value={aptTime} onChange={(e) => setAptTime(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 bg-white focus:outline-none focus:border-blue-400" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1.5">메모 (선택)</label>
                <textarea
                  value={aptMemo}
                  onChange={(e) => setAptMemo(e.target.value)}
                  rows={2}
                  placeholder="추가 메모..."
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 bg-white focus:outline-none focus:border-blue-400 resize-none"
                />
              </div>
            </div>
            <div className="px-5 pb-5 flex gap-3">
              <button onClick={() => setShowAptModal(false)} className="flex-1 h-11 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50" disabled={aptSaving}>취소</button>
              <button
                onClick={handleSaveApt}
                disabled={aptSaving || !aptTitle.trim() || !aptDate}
                className="flex-1 h-11 rounded-xl text-white text-sm font-medium disabled:opacity-50 transition-opacity"
                style={{ background: '#1a2b5a' }}
              >{aptSaving ? '저장 중...' : '저장'}</button>
            </div>
          </div>
        </div>
      )}

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
                  {caseData.parent_case_id === cc.id && <span className="ml-2 text-xs text-blue-600">✓ 현재 연결됨</span>}
                </button>
              ))}
            </div>
            <button onClick={() => setShowConnectModal(false)} className="mt-4 w-full py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50">닫기</button>
          </div>
        </div>
      )}

      {/* Delete confirm modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl">
            <h3 className="text-base font-semibold text-slate-900 mb-1">사건을 삭제하시겠어요?</h3>
            <p className="text-sm text-slate-500 mb-1">
              <span className="font-medium text-slate-700">{liveClient?.name ?? '고객'}</span>님의{' '}
              <span className="font-medium text-slate-700">{caseData.case_type}</span> 사건이 삭제됩니다.
            </p>
            <p className="text-xs text-red-500 mb-6">삭제된 사건은 복구할 수 없습니다.</p>
            <div className="flex gap-3">
              <button onClick={() => setShowDeleteConfirm(false)} className="flex-1 h-11 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50" disabled={deleting}>취소</button>
              <button onClick={handleDelete} disabled={deleting} className="flex-1 h-11 rounded-xl text-white text-sm font-medium bg-red-500 hover:bg-red-600 disabled:opacity-50 transition-colors">
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

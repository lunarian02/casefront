'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import ReactMarkdown from 'react-markdown'

type CaseDetail = {
  id: number
  client_id: string | null
  case_type: string
  status: 'new' | 'in_progress' | 'done' | null
  summary: string | null
  detail: {
    overview?: string
    facts?: string
    legal_elements?: string
    evidence?: Array<{ item: string; status: string; url: string | null }>
  } | null
  created_at: string
}

type LiveClient = {
  id: string
  name: string
  phone: string
  email: string | null
  referrer: string | null
}

type LinkedRecording = {
  id: string
  title: string
  status: string
  duration_seconds: number | null
  created_at: string
}

type TabKey = 'report' | 'schedule' | 'recordings'
type EditingSection = null | 'overview' | 'facts' | 'legal_elements' | 'evidence'

const STATUS_CONFIG = {
  new:         { label: '신규',   color: '#4a7aef' },
  in_progress: { label: '진행중', color: '#D97706' },
  done:        { label: '완료',   color: '#16A34A' },
}

export default function CaseDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { session, loading } = useAuth()
  const [caseData, setCaseData] = useState<CaseDetail | null>(null)
  const [liveClient, setLiveClient] = useState<LiveClient | null>(null)
  const [linkedRecordings, setLinkedRecordings] = useState<LinkedRecording[]>([])
  const [fetching, setFetching] = useState(true)
  const [notFound, setNotFound] = useState(false)

  const [activeTab, setActiveTab] = useState<TabKey>('report')
  const [editingSection, setEditingSection] = useState<EditingSection>(null)
  const [editText, setEditText] = useState('')
  const [editSaving, setEditSaving] = useState(false)

  // Evidence editing
  const [editEvidence, setEditEvidence] = useState<Array<{ item: string; status: string; url: string | null }>>([])

  const caseId = params?.id as string

  useEffect(() => {
    if (!session || !caseId) return
    fetch(`/api/dashboard/cases/${caseId}`, {
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
        setFetching(false)
      })
      .catch(() => setFetching(false))

    // Fetch linked recordings
    fetch(`/api/dashboard/cases/${caseId}/recordings`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
      .then((r) => r.json())
      .then((d) => setLinkedRecordings(d.recordings ?? []))
      .catch(() => {})
  }, [session, caseId])

  function startEdit(section: EditingSection) {
    if (!caseData?.detail) return
    setEditingSection(section)

    if (section === 'overview') setEditText(caseData.detail.overview || '')
    else if (section === 'facts') setEditText(caseData.detail.facts || '')
    else if (section === 'legal_elements') setEditText(caseData.detail.legal_elements || '')
    else if (section === 'evidence') {
      setEditEvidence(caseData.detail.evidence || [])
    }
  }

  function cancelEdit() {
    setEditingSection(null)
    setEditText('')
    setEditEvidence([])
  }

  async function saveEdit() {
    if (!session || !caseId || !editingSection || editSaving) return
    setEditSaving(true)

    try {
      const patch: Record<string, unknown> = {}
      if (editingSection === 'evidence') {
        patch.detail = { evidence: editEvidence }
      } else {
        patch.detail = { [editingSection]: editText.trim() }
      }

      const res = await fetch(`/api/dashboard/cases/${caseId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify(patch),
      })

      if (res.ok) {
        const data = await res.json()
        setCaseData(data.case)
        setEditingSection(null)
        setEditText('')
        setEditEvidence([])
      }
    } finally {
      setEditSaving(false)
    }
  }

  function addEvidence() {
    setEditEvidence([...editEvidence, { item: '', status: '미확보', url: null }])
  }

  function removeEvidence(index: number) {
    setEditEvidence(editEvidence.filter((_, i) => i !== index))
  }

  function updateEvidence(index: number, field: 'item' | 'status' | 'url', value: string) {
    setEditEvidence(editEvidence.map((e, i) => i === index ? { ...e, [field]: value || null } : e))
  }

  async function generateConsolidatedReport() {
    if (!session || !caseId) return
    if (!confirm('연결된 모든 상담을 통합하여 사건 정보를 업데이트하시겠습니까?')) return

    try {
      const res = await fetch(`/api/dashboard/cases/${caseId}/consolidated-report`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
      })

      if (res.ok) {
        // Reload case data
        window.location.reload()
      }
    } catch (err) {
      alert('통합 리포트 생성 실패')
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

  const status = STATUS_CONFIG[caseData.status || 'new'] || STATUS_CONFIG.new
  const detail = caseData.detail || {}

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
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
        <div className="flex-1">
          <h1 className="text-xl font-bold text-slate-900">{caseData.case_type || '사건'}</h1>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-sm font-medium" style={{ color: status.color }}>{status.label}</span>
            {liveClient && (
              <>
                <span className="text-slate-300">·</span>
                <span className="text-sm text-slate-600">{liveClient.name}</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 border-b border-slate-200">
        {(['report', 'recordings', 'schedule'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${
              activeTab === tab
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {tab === 'report' ? '리포트' : tab === 'recordings' ? '연결된 상담' : '일정'}
          </button>
        ))}
      </div>

      {/* Report Tab */}
      {activeTab === 'report' && (
        <div className="space-y-4">
          {/* Consolidated Report Button */}
          {linkedRecordings.length >= 2 && (
            <button
              onClick={generateConsolidatedReport}
              className="w-full px-4 py-2 text-sm font-medium text-white rounded-lg"
              style={{ background: '#4a7aef' }}
            >
              통합 리포트 생성 (상담 {linkedRecordings.length}건)
            </button>
          )}

          {/* Overview */}
          <Section
            title="사건 개요"
            isEditing={editingSection === 'overview'}
            onEdit={() => startEdit('overview')}
            onCancel={cancelEdit}
            onSave={saveEdit}
            saving={editSaving}
          >
            {editingSection === 'overview' ? (
              <textarea
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                rows={4}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                placeholder="사건 개요를 입력하세요"
              />
            ) : (
              <p className="text-sm text-slate-700 whitespace-pre-wrap">
                {detail.overview || <span className="text-slate-400">아직 내용이 없습니다. 수정 버튼을 눌러 입력하세요.</span>}
              </p>
            )}
          </Section>

          {/* Facts */}
          <Section
            title="사실관계"
            isEditing={editingSection === 'facts'}
            onEdit={() => startEdit('facts')}
            onCancel={cancelEdit}
            onSave={saveEdit}
            saving={editSaving}
          >
            {editingSection === 'facts' ? (
              <textarea
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                rows={6}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                placeholder="사실관계를 시간순으로 입력하세요"
              />
            ) : (
              <div className="text-sm text-slate-700 whitespace-pre-wrap">
                {detail.facts ? (
                  <ReactMarkdown>{detail.facts}</ReactMarkdown>
                ) : (
                  <span className="text-slate-400">아직 내용이 없습니다. 수정 버튼을 눌러 입력하세요.</span>
                )}
              </div>
            )}
          </Section>

          {/* Legal Elements */}
          <Section
            title="요건사실"
            isEditing={editingSection === 'legal_elements'}
            onEdit={() => startEdit('legal_elements')}
            onCancel={cancelEdit}
            onSave={saveEdit}
            saving={editSaving}
          >
            {editingSection === 'legal_elements' ? (
              <textarea
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                rows={6}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                placeholder="법적 요건사항을 입력하세요"
              />
            ) : (
              <div className="text-sm text-slate-700 whitespace-pre-wrap">
                {detail.legal_elements ? (
                  <ReactMarkdown>{detail.legal_elements}</ReactMarkdown>
                ) : (
                  <span className="text-slate-400">아직 내용이 없습니다. 수정 버튼을 눌러 입력하세요.</span>
                )}
              </div>
            )}
          </Section>

          {/* Evidence */}
          <Section
            title="관련 증거"
            isEditing={editingSection === 'evidence'}
            onEdit={() => startEdit('evidence')}
            onCancel={cancelEdit}
            onSave={saveEdit}
            saving={editSaving}
          >
            {editingSection === 'evidence' ? (
              <div className="space-y-3">
                {editEvidence.map((ev, i) => (
                  <div key={i} className="flex gap-2 items-start">
                    <input
                      type="text"
                      value={ev.item}
                      onChange={(e) => updateEvidence(i, 'item', e.target.value)}
                      placeholder="증거 항목"
                      className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <select
                      value={ev.status}
                      onChange={(e) => updateEvidence(i, 'status', e.target.value)}
                      className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="확보">확보</option>
                      <option value="미확보">미확보</option>
                      <option value="확보 가능">확보 가능</option>
                    </select>
                    <input
                      type="text"
                      value={ev.url || ''}
                      onChange={(e) => updateEvidence(i, 'url', e.target.value)}
                      placeholder="링크 (선택)"
                      className="w-40 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                      onClick={() => removeEvidence(i)}
                      className="p-2 text-red-500 hover:bg-red-50 rounded-lg"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
                <button
                  onClick={addEvidence}
                  className="w-full px-3 py-2 border border-dashed border-slate-300 rounded-lg text-sm text-slate-600 hover:border-slate-400 hover:text-slate-800"
                >
                  + 증거 추가
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {(detail.evidence && detail.evidence.length > 0) ? (
                  detail.evidence.map((ev, i) => (
                    <div key={i} className="flex items-center gap-3 text-sm">
                      <span className="text-slate-700">• {ev.item}</span>
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                        ev.status === '확보' ? 'bg-green-50 text-green-700' :
                        ev.status === '확보 가능' ? 'bg-blue-50 text-blue-700' :
                        'bg-slate-100 text-slate-600'
                      }`}>
                        {ev.status}
                      </span>
                      {ev.url && (
                        <a
                          href={ev.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-500 hover:underline"
                        >
                          🔗
                        </a>
                      )}
                    </div>
                  ))
                ) : (
                  <span className="text-sm text-slate-400">아직 내용이 없습니다. 수정 버튼을 눌러 입력하세요.</span>
                )}
              </div>
            )}
          </Section>

          {/* Client Info (read-only) */}
          <Section title="고객 정보" hideEdit>
            {liveClient ? (
              <div className="space-y-2 text-sm">
                <div className="flex gap-3">
                  <span className="text-slate-500 w-16">이름</span>
                  <span className="text-slate-900 font-medium">{liveClient.name}</span>
                </div>
                <div className="flex gap-3">
                  <span className="text-slate-500 w-16">연락처</span>
                  <a href={`tel:${liveClient.phone}`} className="text-blue-600 hover:underline">{liveClient.phone}</a>
                </div>
                {liveClient.email && (
                  <div className="flex gap-3">
                    <span className="text-slate-500 w-16">이메일</span>
                    <a href={`mailto:${liveClient.email}`} className="text-blue-600 hover:underline">{liveClient.email}</a>
                  </div>
                )}
                {liveClient.referrer && (
                  <div className="flex gap-3">
                    <span className="text-slate-500 w-16">추천인</span>
                    <span className="text-slate-700">{liveClient.referrer}</span>
                  </div>
                )}
                <button
                  onClick={() => router.push(`/dashboard/clients/${liveClient.id}`)}
                  className="text-xs text-blue-600 hover:underline"
                >
                  고객 상세에서 수정 →
                </button>
              </div>
            ) : (
              <button
                className="text-sm text-blue-600 hover:underline"
              >
                + 고객 연결
              </button>
            )}
          </Section>
        </div>
      )}

      {/* Recordings Tab */}
      {activeTab === 'recordings' && (
        <div className="space-y-3">
          {linkedRecordings.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-8">연결된 상담이 없습니다.</p>
          ) : (
            linkedRecordings.map((rec) => (
              <div
                key={rec.id}
                onClick={() => router.push(`/dashboard/recordings/${rec.id}`)}
                className="p-4 bg-white border border-slate-200 rounded-lg hover:border-slate-300 cursor-pointer transition-colors"
              >
                <div className="font-medium text-slate-900">{rec.title || '제목 없음'}</div>
                <div className="text-xs text-slate-500 mt-1">
                  {new Date(rec.created_at).toLocaleDateString('ko-KR')}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Schedule Tab */}
      {activeTab === 'schedule' && (
        <div className="text-center py-8 text-slate-400">
          <p className="text-sm">일정 관리 기능은 추후 구현 예정입니다.</p>
        </div>
      )}
    </div>
  )
}

function Section({
  title,
  children,
  isEditing,
  onEdit,
  onCancel,
  onSave,
  saving,
  hideEdit,
}: {
  title: string
  children: React.ReactNode
  isEditing?: boolean
  onEdit?: () => void
  onCancel?: () => void
  onSave?: () => void
  saving?: boolean
  hideEdit?: boolean
}) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{title}</h2>
        {!hideEdit && (
          <div className="flex gap-2">
            {isEditing ? (
              <>
                <button
                  onClick={onCancel}
                  disabled={saving}
                  className="text-xs text-slate-600 hover:text-slate-800 disabled:opacity-50"
                >
                  취소
                </button>
                <button
                  onClick={onSave}
                  disabled={saving}
                  className="text-xs font-medium text-blue-600 hover:text-blue-800 disabled:opacity-50"
                >
                  {saving ? '저장 중...' : '저장'}
                </button>
              </>
            ) : (
              <button
                onClick={onEdit}
                className="text-xs font-medium text-slate-400 hover:text-slate-600"
              >
                수정
              </button>
            )}
          </div>
        )}
      </div>
      {children}
    </div>
  )
}

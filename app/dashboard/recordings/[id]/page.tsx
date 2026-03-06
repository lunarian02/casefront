'use client'
import { useEffect, useState, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import ReactMarkdown from 'react-markdown'

type Recording = {
  id: string
  title: string
  status: string
  duration_seconds: number | null
  created_at: string
  client_id: string | null
  client?: {
    id: string
    name: string
    phone: string
  } | null
}

type LegalElement = {
  fulfilled: boolean
  content: string
}

type Report = {
  id: string
  category: string | null
  subcategory: string | null
  content: string
  structured: {
    summary?: string
    client_info?: {
      name?: string
      contact?: string
      opponent?: string
    }
    facts?: string
    category?: string
    subcategory?: string
    legal_elements?: Record<string, LegalElement>
    evidence?: string[]
    overview?: string
  } | null
  created_at: string
}

type Segment = {
  start: number
  end: number
  text: string
}

type Transcript = {
  id: string
  full_text: string | null
  segments: Segment[] | null
}

type LinkedCase = {
  case_id: number
  category: string | null
  subcategory: string | null
}

type TabKey = 'summary' | 'transcript'

export default function RecordingDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { session, loading } = useAuth()
  const [recording, setRecording] = useState<Recording | null>(null)
  const [reports, setReports] = useState<Report[]>([])
  const [activeReportIndex, setActiveReportIndex] = useState(0)
  const [transcript, setTranscript] = useState<Transcript | null>(null)
  const [linkedCases, setLinkedCases] = useState<LinkedCase[]>([])
  const [signedUrl, setSignedUrl] = useState<string | null>(null)
  const [fetching, setFetching] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [activeTab, setActiveTab] = useState<TabKey>('summary')
  const [creating, setCreating] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const audioRef = useRef<HTMLAudioElement>(null)

  // Case linking modals
  const [showCaseSelector, setShowCaseSelector] = useState(false)
  const [showMergeModal, setShowMergeModal] = useState(false)
  const [availableCases, setAvailableCases] = useState<Array<{ id: number; category: string; subcategory: string | null; client: { name: string } | null }>>([])
  const [selectedCaseId, setSelectedCaseId] = useState<number | null>(null)
  const [mergeDecisions, setMergeDecisions] = useState<{
    overview: 'keep_existing' | 'use_new' | 'merge_both'
    facts: 'keep_existing' | 'use_new' | 'merge_both'
    legal_elements: Record<string, 'keep_existing' | 'use_new' | 'merge_both'>
    evidence: 'keep_existing' | 'use_new' | 'merge_both'
  }>({
    overview: 'use_new',
    facts: 'merge_both',
    legal_elements: {},
    evidence: 'merge_both',
  })

  // Add case type modal
  const [showCaseTypeSelector, setShowCaseTypeSelector] = useState(false)
  const [availableTemplates, setAvailableTemplates] = useState<Array<{ category: string; subcategory: string }>>([])
  const [analyzingNewType, setAnalyzingNewType] = useState(false)

  const recordingId = params?.id as string

  useEffect(() => {
    if (!session || !recordingId) return
    fetch(`/api/dashboard/recordings/${recordingId}`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
      .then((r) => {
        if (r.status === 404) { setNotFound(true); setFetching(false); return null }
        return r.json()
      })
      .then((data) => {
        if (!data) return
        setRecording(data.recording)
        setReports(data.reports ?? [])
        setTranscript(data.transcript)
        setLinkedCases(data.linkedCases ?? [])
        setSignedUrl(data.signedUrl)
        setFetching(false)
      })
      .catch(() => setFetching(false))
  }, [session, recordingId])

  async function createNewCase() {
    if (!session || !recording || reports.length === 0 || creating) return
    const activeReport = reports[activeReportIndex]
    if (!activeReport) return

    setCreating(true)

    try {
      const res = await fetch('/api/dashboard/cases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({
          client_name: recording.client?.name || '고객',
          client_phone: recording.client?.phone || '010-0000-0000',
          category: activeReport.category,
          subcategory: activeReport.subcategory,
          report_id: activeReport.id,
        }),
      })

      if (res.ok) {
        const data = await res.json()
        router.push(`/dashboard/cases/${data.case.id}`)
      }
    } finally {
      setCreating(false)
    }
  }

  async function openCaseSelector() {
    if (!session) return
    const res = await fetch('/api/dashboard/cases', {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
    if (res.ok) {
      const data = await res.json()
      setAvailableCases(data.cases || [])
      setShowCaseSelector(true)
    }
  }

  function selectCase(caseId: number) {
    setSelectedCaseId(caseId)
    setShowCaseSelector(false)
    setShowMergeModal(true)
  }

  async function confirmMerge() {
    if (!session || !selectedCaseId || !activeReport) return

    try {
      const res = await fetch(`/api/dashboard/cases/${selectedCaseId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({
          merge_report_id: activeReport.id,
          merge_decisions: mergeDecisions,
        }),
      })

      if (res.ok) {
        setShowMergeModal(false)
        router.push(`/dashboard/cases/${selectedCaseId}`)
      }
    } catch (err) {
      alert('병합 실패')
    }
  }

  async function openCaseTypeSelector() {
    if (!session) return
    const res = await fetch('/api/dashboard/legal-templates', {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
    if (res.ok) {
      const data = await res.json()
      setAvailableTemplates(data.templates || [])
      setShowCaseTypeSelector(true)
    }
  }

  async function analyzeNewCaseType(category: string, subcategory: string) {
    if (!session || !recordingId || analyzingNewType) return
    setAnalyzingNewType(true)
    setShowCaseTypeSelector(false)

    try {
      const res = await fetch(`/api/dashboard/recordings/${recordingId}/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ category, subcategory }),
      })

      if (res.ok) {
        // Reload page to show new report
        window.location.reload()
      } else {
        alert('분석 실패')
      }
    } catch (err) {
      alert('분석 중 오류 발생')
    } finally {
      setAnalyzingNewType(false)
    }
  }

  if (loading || fetching) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#1a2b5a', borderTopColor: 'transparent' }} />
      </div>
    )
  }

  if (notFound || !recording) {
    return (
      <div className="p-6 text-center">
        <p className="text-slate-500">상담을 찾을 수 없습니다.</p>
        <button onClick={() => router.push('/dashboard/recordings')} className="mt-3 text-sm hover:underline" style={{ color: '#4a7aef' }}>
          목록으로 돌아가기
        </button>
      </div>
    )
  }

  function formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  function handleSeeked(time: number) {
    if (!transcript?.segments) return

    // Find active segment index
    const activeIndex = transcript.segments.findIndex(
      (seg) => time >= seg.start && time < seg.end
    )

    if (activeIndex >= 0) {
      // Scroll to the active segment
      const element = document.getElementById(`segment-${activeIndex}`)
      if (element) {
        element.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
        })
      }
    }
  }

  const activeReport = reports[activeReportIndex]
  const caseType = activeReport ? `${activeReport.category}${activeReport.subcategory ? ' > ' + activeReport.subcategory : ''}` : null

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
          <h1 className="text-xl font-bold text-slate-900">{recording.title || '상담 기록'}</h1>
          <div className="flex items-center gap-2 mt-1">
            {recording.client && (
              <span className="text-sm text-slate-600">{recording.client.name}</span>
            )}
            {caseType && (
              <>
                <span className="text-slate-300">·</span>
                <span className="text-sm text-slate-600">{caseType}</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Report Selector */}
      {reports.length > 0 && (
        <div className="mb-4 flex gap-2 items-center overflow-x-auto pb-2">
          {reports.map((report, idx) => (
            <button
              key={report.id}
              onClick={() => setActiveReportIndex(idx)}
              className={`px-3 py-1.5 text-sm font-medium rounded-lg whitespace-nowrap transition-colors ${
                idx === activeReportIndex
                  ? 'bg-blue-100 text-blue-700 border border-blue-300'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              {report.category}{report.subcategory && ` > ${report.subcategory}`}
            </button>
          ))}
          <button
            onClick={openCaseTypeSelector}
            disabled={analyzingNewType}
            className="px-3 py-1.5 text-sm font-medium text-blue-600 bg-white border border-blue-200 rounded-lg hover:bg-blue-50 whitespace-nowrap transition-colors disabled:opacity-50"
          >
            {analyzingNewType ? '분석 중...' : '+ 유형 추가'}
          </button>
        </div>
      )}

      {/* Action Buttons */}
      {activeReport && linkedCases.length === 0 && (
        <div className="flex gap-3 mb-4">
          <button
            onClick={createNewCase}
            disabled={creating}
            className="flex-1 px-4 py-2 text-sm font-medium text-white rounded-lg disabled:opacity-50"
            style={{ background: '#1a2b5a' }}
          >
            {creating ? '생성 중...' : '새 사건 만들기'}
          </button>
          <button
            onClick={openCaseSelector}
            className="flex-1 px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
          >
            기존 사건에 연결
          </button>
        </div>
      )}

      {/* Linked Cases */}
      {linkedCases.length > 0 && (
        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-900">
            연결된 사건: <span className="font-medium">
              {linkedCases[0].category}{linkedCases[0].subcategory && ` > ${linkedCases[0].subcategory}`}
            </span>
            <button
              onClick={() => router.push(`/dashboard/cases/${linkedCases[0].case_id}`)}
              className="ml-2 text-blue-600 hover:underline"
            >
              사건 상세 →
            </button>
          </p>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 mb-4 border-b border-slate-200">
        <button
          onClick={() => setActiveTab('summary')}
          className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${
            activeTab === 'summary'
              ? 'border-blue-500 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          상담 정리
        </button>
        <button
          onClick={() => setActiveTab('transcript')}
          className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${
            activeTab === 'transcript'
              ? 'border-blue-500 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          스크립트
        </button>
      </div>

      {/* Summary Tab */}
      {activeTab === 'summary' && (
        <div className="space-y-4">
          {activeReport?.structured ? (
            <>
              {/* Summary */}
              {activeReport.structured.summary && (
                <Card title="상담 개요">
                  <p className="text-sm text-slate-700">{activeReport.structured.summary}</p>
                </Card>
              )}

              {/* Client Info */}
              {activeReport.structured.client_info && (
                <Card title="의뢰인 정보">
                  <div className="space-y-2 text-sm">
                    {activeReport.structured.client_info.name && (
                      <div className="flex gap-3">
                        <span className="text-slate-500 w-16">이름</span>
                        <span className="text-slate-900 font-medium">{activeReport.structured.client_info.name}</span>
                      </div>
                    )}
                    {activeReport.structured.client_info.contact && (
                      <div className="flex gap-3">
                        <span className="text-slate-500 w-16">연락처</span>
                        <span className="text-slate-700">{activeReport.structured.client_info.contact}</span>
                      </div>
                    )}
                    {activeReport.structured.client_info.opponent && (
                      <div className="flex gap-3">
                        <span className="text-slate-500 w-16">상대방</span>
                        <span className="text-slate-700">{activeReport.structured.client_info.opponent}</span>
                      </div>
                    )}
                  </div>
                </Card>
              )}

              {/* Facts */}
              {activeReport.structured.facts && (
                <Card title="사실관계">
                  <div className="text-sm text-slate-700 whitespace-pre-wrap">
                    <ReactMarkdown>{activeReport.structured.facts}</ReactMarkdown>
                  </div>
                </Card>
              )}

              {/* Legal Elements Checklist (Read-only) */}
              {activeReport.structured.legal_elements && Object.keys(activeReport.structured.legal_elements).length > 0 && (
                <Card title="요건사실 체크리스트">
                  <div className="space-y-3">
                    {Object.entries(activeReport.structured.legal_elements).map(([elementName, element]) => (
                      <div key={elementName} className="flex gap-3 p-3 bg-slate-50 rounded-lg">
                        <div className="flex-shrink-0 mt-0.5">
                          {element.fulfilled ? (
                            <svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                          ) : (
                            <svg className="w-5 h-5 text-slate-400" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                            </svg>
                          )}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm font-medium text-slate-900">{elementName}</span>
                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                              element.fulfilled ? 'bg-green-50 text-green-700' : 'bg-slate-100 text-slate-600'
                            }`}>
                              {element.fulfilled ? '충족' : '미충족'}
                            </span>
                          </div>
                          {element.content && (
                            <p className="text-sm text-slate-600">{element.content}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              )}

              {/* Evidence (Simple list) */}
              {activeReport.structured.evidence && activeReport.structured.evidence.length > 0 && (
                <Card title="관련 증거">
                  <ul className="space-y-2">
                    {activeReport.structured.evidence.map((item, i) => (
                      <li key={i} className="flex gap-2 text-sm text-slate-700">
                        <span className="text-blue-600">•</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </Card>
              )}
            </>
          ) : (
            <Card title="상담 정리">
              <p className="text-sm text-slate-400">AI 분석이 완료되지 않았거나 리포트가 없습니다.</p>
            </Card>
          )}
        </div>
      )}

      {/* Transcript Tab */}
      {activeTab === 'transcript' && (
        <div className="space-y-4">
          {signedUrl && (
            <div className="bg-white border border-slate-200 rounded-xl p-4 sticky top-0 z-10">
              <audio
                ref={audioRef}
                controls
                className="w-full"
                onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
                onSeeked={(e) => handleSeeked(e.currentTarget.currentTime)}
              >
                <source src={signedUrl} type="audio/mpeg" />
              </audio>
            </div>
          )}

          {transcript?.segments && transcript.segments.length > 0 ? (
            <Card title="스크립트">
              <div className="space-y-2">
                {transcript.segments.map((segment, i) => {
                  const isActive = currentTime >= segment.start && currentTime < segment.end
                  return (
                    <div
                      key={i}
                      id={`segment-${i}`}
                      className={`p-3 rounded-lg transition-colors cursor-pointer ${
                        isActive
                          ? 'bg-blue-50 border-l-4 border-blue-500'
                          : 'hover:bg-slate-50'
                      }`}
                      onClick={() => {
                        if (audioRef.current) {
                          audioRef.current.currentTime = segment.start
                        }
                      }}
                    >
                      <div className="flex items-start gap-3">
                        <span className="text-xs text-slate-400 font-mono mt-0.5 min-w-[60px]">
                          {formatTime(segment.start)}
                        </span>
                        <p className={`text-sm leading-relaxed ${
                          isActive ? 'text-slate-900 font-medium' : 'text-slate-700'
                        }`}>
                          {segment.text}
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </Card>
          ) : transcript?.full_text ? (
            <Card title="전체 스크립트">
              <div className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">
                {transcript.full_text}
              </div>
            </Card>
          ) : (
            <Card title="스크립트">
              <p className="text-sm text-slate-400">스크립트가 생성되지 않았습니다.</p>
            </Card>
          )}
        </div>
      )}

      {/* Case Selector Modal */}
      {showCaseSelector && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-200 flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900">연결할 사건 선택</h2>
              <button
                onClick={() => setShowCaseSelector(false)}
                className="p-1 text-slate-400 hover:text-slate-600"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-6 space-y-3">
              {availableCases.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-8">생성된 사건이 없습니다.</p>
              ) : (
                availableCases.map((caseItem) => (
                  <button
                    key={caseItem.id}
                    onClick={() => selectCase(caseItem.id)}
                    className="w-full p-4 border border-slate-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 text-left transition-colors"
                  >
                    <div className="font-medium text-slate-900">
                      {caseItem.category}{caseItem.subcategory && ` > ${caseItem.subcategory}`}
                    </div>
                    {caseItem.client && (
                      <div className="text-sm text-slate-600 mt-1">{caseItem.client.name}</div>
                    )}
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Case Type Selector Modal */}
      {showCaseTypeSelector && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-3xl w-full max-h-[80vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-900">사건 유형 선택</h2>
                <p className="text-sm text-slate-600 mt-1">추가로 분석할 사건 유형을 선택하세요</p>
              </div>
              <button
                onClick={() => setShowCaseTypeSelector(false)}
                className="p-1 text-slate-400 hover:text-slate-600"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-6">
              {availableTemplates.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-8">사건 유형 템플릿을 불러오는 중...</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {availableTemplates.map((template) => (
                    <button
                      key={`${template.category}-${template.subcategory}`}
                      onClick={() => analyzeNewCaseType(template.category, template.subcategory)}
                      disabled={analyzingNewType}
                      className="p-4 border border-slate-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 text-left transition-colors disabled:opacity-50"
                    >
                      <div className="font-medium text-slate-900">
                        {template.category} <span className="text-slate-400">›</span> {template.subcategory}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Merge Conflict Resolution Modal */}
      {showMergeModal && activeReport && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-3xl w-full max-h-[80vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-200">
              <h2 className="text-lg font-bold text-slate-900">병합 방식 선택</h2>
              <p className="text-sm text-slate-600 mt-1">
                상담 내용을 기존 사건에 어떻게 반영할지 선택하세요
              </p>
            </div>
            <div className="p-6 space-y-4">
              {/* Overview */}
              <MergeSection
                title="사건 개요"
                value={mergeDecisions.overview}
                onChange={(v) => setMergeDecisions({ ...mergeDecisions, overview: v })}
              />

              {/* Facts */}
              <MergeSection
                title="사실관계"
                value={mergeDecisions.facts}
                onChange={(v) => setMergeDecisions({ ...mergeDecisions, facts: v })}
              />

              {/* Evidence */}
              <MergeSection
                title="관련 증거"
                value={mergeDecisions.evidence}
                onChange={(v) => setMergeDecisions({ ...mergeDecisions, evidence: v })}
              />
            </div>
            <div className="p-6 border-t border-slate-200 flex gap-3">
              <button
                onClick={() => setShowMergeModal(false)}
                className="flex-1 px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
              >
                취소
              </button>
              <button
                onClick={confirmMerge}
                className="flex-1 px-4 py-2 text-sm font-medium text-white rounded-lg"
                style={{ background: '#1a2b5a' }}
              >
                병합 실행
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function MergeSection({
  title,
  value,
  onChange,
}: {
  title: string
  value: 'keep_existing' | 'use_new' | 'merge_both'
  onChange: (value: 'keep_existing' | 'use_new' | 'merge_both') => void
}) {
  return (
    <div className="border border-slate-200 rounded-lg p-4">
      <h3 className="text-sm font-semibold text-slate-900 mb-3">{title}</h3>
      <div className="space-y-2">
        {[
          { value: 'keep_existing' as const, label: '기존 유지', desc: '사건의 기존 내용 유지' },
          { value: 'use_new' as const, label: '신규 사용', desc: '상담 내용으로 덮어쓰기' },
          { value: 'merge_both' as const, label: '병합', desc: '기존 + 신규 내용 합치기' },
        ].map((option) => (
          <label
            key={option.value}
            className={`flex items-start gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
              value === option.value
                ? 'border-blue-500 bg-blue-50'
                : 'border-slate-200 hover:border-slate-300'
            }`}
          >
            <input
              type="radio"
              name={title}
              checked={value === option.value}
              onChange={() => onChange(option.value)}
              className="mt-0.5 w-4 h-4 text-blue-600"
            />
            <div className="flex-1">
              <div className="text-sm font-medium text-slate-900">{option.label}</div>
              <div className="text-xs text-slate-600">{option.desc}</div>
            </div>
          </label>
        ))}
      </div>
    </div>
  )
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4">
      <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">{title}</h2>
      {children}
    </div>
  )
}

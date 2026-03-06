'use client'
import { useEffect, useState } from 'react'
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

type Report = {
  id: string
  case_type: string | null
  content: string
  structured: {
    summary?: string
    client_info?: {
      name?: string
      contact?: string
      opponent?: string
    }
    facts?: string
    legal_issues?: string[]
    evidence?: Array<{ item: string; status: string; url: string | null }>
    recommendations?: string[]
    next_steps?: string[]
    overview?: string
    legal_elements?: string
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
  case_type: string | null
}

type TabKey = 'summary' | 'transcript'

export default function RecordingDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { session, loading } = useAuth()
  const [recording, setRecording] = useState<Recording | null>(null)
  const [report, setReport] = useState<Report | null>(null)
  const [transcript, setTranscript] = useState<Transcript | null>(null)
  const [linkedCases, setLinkedCases] = useState<LinkedCase[]>([])
  const [signedUrl, setSignedUrl] = useState<string | null>(null)
  const [fetching, setFetching] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [activeTab, setActiveTab] = useState<TabKey>('summary')
  const [showRawReport, setShowRawReport] = useState(false)
  const [creating, setCreating] = useState(false)

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
        setReport(data.report)
        setTranscript(data.transcript)
        setLinkedCases(data.linkedCases ?? [])
        setSignedUrl(data.signedUrl)
        setFetching(false)
      })
      .catch(() => setFetching(false))
  }, [session, recordingId])

  async function createNewCase() {
    if (!session || !recording || !report || creating) return
    setCreating(true)

    try {
      const res = await fetch('/api/dashboard/cases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({
          client_name: recording.client?.name || '고객',
          client_phone: recording.client?.phone || '010-0000-0000',
          case_type: report.case_type,
          report_id: report.id,
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

  const structured = report?.structured

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
            {report?.case_type && (
              <>
                <span className="text-slate-300">·</span>
                <span className="text-sm text-slate-600">{report.case_type}</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      {report && linkedCases.length === 0 && (
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
            연결된 사건: <span className="font-medium">{linkedCases[0].case_type}</span>
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
          {structured ? (
            <>
              {/* Summary */}
              {structured.summary && (
                <Card title="상담 개요">
                  <p className="text-sm text-slate-700">{structured.summary}</p>
                </Card>
              )}

              {/* Client Info */}
              {structured.client_info && (
                <Card title="의뢰인 정보">
                  <div className="space-y-2 text-sm">
                    {structured.client_info.name && (
                      <div className="flex gap-3">
                        <span className="text-slate-500 w-16">이름</span>
                        <span className="text-slate-900 font-medium">{structured.client_info.name}</span>
                      </div>
                    )}
                    {structured.client_info.contact && (
                      <div className="flex gap-3">
                        <span className="text-slate-500 w-16">연락처</span>
                        <span className="text-slate-700">{structured.client_info.contact}</span>
                      </div>
                    )}
                    {structured.client_info.opponent && (
                      <div className="flex gap-3">
                        <span className="text-slate-500 w-16">상대방</span>
                        <span className="text-slate-700">{structured.client_info.opponent}</span>
                      </div>
                    )}
                  </div>
                </Card>
              )}

              {/* Facts */}
              {structured.facts && (
                <Card title="사실관계">
                  <div className="text-sm text-slate-700 whitespace-pre-wrap">
                    <ReactMarkdown>{structured.facts}</ReactMarkdown>
                  </div>
                </Card>
              )}

              {/* Legal Issues */}
              {structured.legal_issues && structured.legal_issues.length > 0 && (
                <Card title="법적 쟁점">
                  <ul className="space-y-2">
                    {structured.legal_issues.map((issue, i) => (
                      <li key={i} className="flex gap-2 text-sm text-slate-700">
                        <span className="text-blue-600">•</span>
                        <span>{issue}</span>
                      </li>
                    ))}
                  </ul>
                </Card>
              )}

              {/* Evidence */}
              {structured.evidence && structured.evidence.length > 0 && (
                <Card title="관련 증거">
                  <div className="space-y-2">
                    {structured.evidence.map((ev, i) => (
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
                          <a href={ev.url} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">
                            🔗
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                </Card>
              )}

              {/* Recommendations */}
              {structured.recommendations && structured.recommendations.length > 0 && (
                <Card title="변호사 권고사항">
                  <ul className="space-y-2">
                    {structured.recommendations.map((rec, i) => (
                      <li key={i} className="flex gap-2 text-sm text-slate-700">
                        <span className="text-amber-600">•</span>
                        <span>{rec}</span>
                      </li>
                    ))}
                  </ul>
                </Card>
              )}

              {/* Next Steps */}
              {structured.next_steps && structured.next_steps.length > 0 && (
                <Card title="다음 단계">
                  <ol className="space-y-2">
                    {structured.next_steps.map((step, i) => (
                      <li key={i} className="flex gap-2 text-sm text-slate-700">
                        <span className="text-slate-400">{i + 1}.</span>
                        <span>{step}</span>
                      </li>
                    ))}
                  </ol>
                </Card>
              )}

              {/* Raw Report Toggle */}
              <div className="pt-4">
                <button
                  onClick={() => setShowRawReport(!showRawReport)}
                  className="text-sm text-slate-600 hover:text-slate-900 flex items-center gap-2"
                >
                  <svg
                    className={`w-4 h-4 transition-transform ${showRawReport ? 'rotate-90' : ''}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                  원본 AI 리포트 보기
                </button>
                {showRawReport && report?.content && (
                  <div className="mt-4 p-4 bg-slate-50 border border-slate-200 rounded-lg">
                    <div className="prose prose-sm max-w-none">
                      <ReactMarkdown>{report.content}</ReactMarkdown>
                    </div>
                  </div>
                )}
              </div>
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
            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <audio controls className="w-full">
                <source src={signedUrl} type="audio/mpeg" />
              </audio>
            </div>
          )}

          {transcript?.full_text ? (
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

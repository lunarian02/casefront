'use client'
import { useEffect, useRef, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { supabaseBrowser } from '@/lib/supabaseClient'
import ReactMarkdown from 'react-markdown'

// ─── Types ───────────────────────────────────────────────────────────────────

type Recording = {
  id: string
  title: string
  status: string
  duration_seconds: number | null
  created_at: string
  firm_id: string
  client_id: string | null
  recording_type: string
  client?: {
    id: string
    name: string
    phone: string
    email: string | null
  } | null
}

type Report = {
  id: string
  case_type: string | null
  content: string
  created_at: string
}

type Segment = {
  id?: number
  start: number
  end: number
  text: string
}

type Transcript = {
  id: string
  full_text: string | null
  segments: Segment[] | null
}

type Appointment = {
  id: string
  title: string
  appointment_type: 'consultation' | 'hearing' | 'deadline' | 'other'
  scheduled_at: string
  memo: string | null
}

type LinkedCase = {
  id: string
  case_id: number
  case_client_name: string | null
  case_type: string | null
}

type CaseRow = {
  id: number
  client?: {
    id: string
    name: string
    phone: string
    email: string | null
  } | null
  case_type: string
  status: string | null
}

type TabKey = 'report' | 'transcript'

// ─── Constants ────────────────────────────────────────────────────────────────

const APPT_TYPE_LABEL: Record<string, string> = {
  consultation: '상담', hearing: '기일', deadline: '기한', other: '기타',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDuration(seconds: number | null): string {
  if (!seconds) return '—'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  return h > 0 ? `${h}시간 ${m}분` : `${m}분`
}

function formatTime(s: number): string {
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = Math.floor(s % 60)
  if (h > 0) return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
}

function formatScheduledAt(iso: string) {
  return new Date(iso).toLocaleString('ko-KR', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })
}

function statusLabel(status: string): { text: string; color: string } {
  if (status === 'completed') return { text: '완료', color: '#16A34A' }
  if (status === 'failed') return { text: '오류', color: '#DC2626' }
  return { text: '분석중', color: '#D97706' }
}

function consultationType(recordingType: string): string {
  if (recordingType === 'call') return '전화'
  return '대면'
}

// ─── AudioPlayer ──────────────────────────────────────────────────────────────

function AudioPlayer({ src, onTimeUpdate }: { src: string; onTimeUpdate?: (t: number) => void }) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [playbackRate, setPlaybackRate] = useState(1)

  function togglePlay() {
    if (!audioRef.current) return
    if (isPlaying) audioRef.current.pause()
    else audioRef.current.play()
  }

  function handleSeek(e: React.ChangeEvent<HTMLInputElement>) {
    const t = Number(e.target.value)
    if (audioRef.current) audioRef.current.currentTime = t
    setCurrentTime(t)
  }

  function handleRateChange(rate: number) {
    setPlaybackRate(rate)
    if (audioRef.current) audioRef.current.playbackRate = rate
  }

  function seekTo(seconds: number) {
    if (!audioRef.current) return
    audioRef.current.currentTime = seconds
    audioRef.current.play()
  }

  // Expose seekTo via a custom event
  useEffect(() => {
    const el = audioRef.current
    if (!el) return
    const handler = (e: Event) => {
      const { seconds } = (e as CustomEvent).detail
      seekTo(seconds)
    }
    el.addEventListener('seekTo', handler)
    return () => el.removeEventListener('seekTo', handler)
  }, [])

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      <audio
        ref={audioRef}
        src={src}
        onTimeUpdate={(e) => {
          const t = e.currentTarget.currentTime
          setCurrentTime(t)
          onTimeUpdate?.(t)
        }}
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onEnded={() => setIsPlaying(false)}
      />

      {/* Progress bar */}
      <div className="flex items-center gap-3 mb-3">
        <span className="text-xs tabular-nums text-slate-500 w-10 text-right">{formatTime(currentTime)}</span>
        <input
          type="range"
          min={0}
          max={duration || 100}
          value={currentTime}
          step={0.1}
          onChange={handleSeek}
          className="flex-1 h-1.5 accent-blue-500 cursor-pointer"
          style={{ accentColor: '#1a2b5a' }}
        />
        <span className="text-xs tabular-nums text-slate-500 w-10">{formatTime(duration)}</span>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {/* Rewind 10s */}
          <button
            onClick={() => { if (audioRef.current) audioRef.current.currentTime = Math.max(0, currentTime - 10) }}
            className="p-2 text-slate-400 hover:text-slate-700 transition-colors"
            title="10초 뒤로"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.75"/>
              <text x="9" y="15" fontSize="6" fill="currentColor" stroke="none" fontWeight="600">10</text>
            </svg>
          </button>

          {/* Play/Pause */}
          <button
            onClick={togglePlay}
            className="w-10 h-10 rounded-full flex items-center justify-center text-white transition-opacity hover:opacity-90"
            style={{ background: '#1a2b5a' }}
          >
            {isPlaying ? (
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>
              </svg>
            ) : (
              <svg className="w-4 h-4 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                <polygon points="5,3 19,12 5,21"/>
              </svg>
            )}
          </button>

          {/* Forward 10s */}
          <button
            onClick={() => { if (audioRef.current) audioRef.current.currentTime = Math.min(duration, currentTime + 10) }}
            className="p-2 text-slate-400 hover:text-slate-700 transition-colors"
            title="10초 앞으로"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-.49-3.75"/>
              <text x="9" y="15" fontSize="6" fill="currentColor" stroke="none" fontWeight="600">10</text>
            </svg>
          </button>
        </div>

        <div className="flex items-center gap-3">
          {/* Playback speed */}
          <div className="flex items-center gap-1">
            {[1, 1.5, 2].map((rate) => (
              <button
                key={rate}
                onClick={() => handleRateChange(rate)}
                className={`px-2 py-1 rounded text-xs font-medium transition-colors ${playbackRate === rate ? 'text-white' : 'text-slate-500 hover:text-slate-700'}`}
                style={playbackRate === rate ? { background: '#1a2b5a' } : {}}
              >{rate}x</button>
            ))}
          </div>

          {/* Download */}
          <a
            href={src}
            download
            className="p-2 text-slate-400 hover:text-slate-700 transition-colors"
            title="다운로드"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
          </a>
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function RecordingDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { session, loading } = useAuth()
  const recordingId = params?.id as string

  const [recording, setRecording] = useState<Recording | null>(null)
  const [report, setReport] = useState<Report | null>(null)
  const [transcript, setTranscript] = useState<Transcript | null>(null)
  const [signedUrl, setSignedUrl] = useState<string | null>(null)
  const [linkedCases, setLinkedCases] = useState<LinkedCase[]>([])
  const [fetching, setFetching] = useState(true)
  const [notFound, setNotFound] = useState(false)

  const [activeTab, setActiveTab] = useState<TabKey>('report')

  // Transcript tab state
  const [searchQuery, setSearchQuery] = useState('')
  const [currentAudioTime, setCurrentAudioTime] = useState(0)
  const segmentRefs = useRef<Record<number, HTMLDivElement | null>>({})

  // Schedule tab state
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [aptLoading, setAptLoading] = useState(false)
  const [showAptModal, setShowAptModal] = useState(false)
  const [editingApt, setEditingApt] = useState<Appointment | null>(null)
  const [aptTitle, setAptTitle] = useState('')
  const [aptType, setAptType] = useState<Appointment['appointment_type']>('consultation')
  const [aptDate, setAptDate] = useState('')
  const [aptTime, setAptTime] = useState('10:00')
  const [aptMemo, setAptMemo] = useState('')
  const [aptSaving, setAptSaving] = useState(false)

  // Case link modal state
  const [showLinkModal, setShowLinkModal] = useState(false)
  const [cases, setCases] = useState<CaseRow[]>([])
  const [casesLoading, setCasesLoading] = useState(false)
  const [linkSaving, setLinkSaving] = useState(false)
  // New case creation inside link modal
  const [linkModalTab, setLinkModalTab] = useState<'link' | 'create'>('link')
  const [newCaseName, setNewCaseName] = useState('')
  const [newCasePhone, setNewCasePhone] = useState('')
  const [newCaseType, setNewCaseType] = useState('')
  const [createSaving, setCreateSaving] = useState(false)

  // Edit title modal state
  const [showEditModal, setShowEditModal] = useState(false)
  const [editTitle, setEditTitle] = useState('')
  const [editSaving, setEditSaving] = useState(false)

  // Delete confirmation modal state
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleteSaving, setDeleteSaving] = useState(false)

  const fetchDetail = useCallback(() => {
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
        setSignedUrl(data.signedUrl)
        setLinkedCases(data.linkedCases ?? [])
        setFetching(false)
      })
      .catch(() => setFetching(false))
  }, [session, recordingId])

  useEffect(() => { fetchDetail() }, [fetchDetail])

  // Realtime status update
  useEffect(() => {
    if (!session || !recordingId) return
    const channel = supabaseBrowser
      .channel(`recording-${recordingId}`)
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'recordings',
        filter: `id=eq.${recordingId}`,
      }, () => { fetchDetail() })
      .subscribe()
    return () => { supabaseBrowser.removeChannel(channel) }
  }, [session, recordingId, fetchDetail])


  // Scroll to active segment
  useEffect(() => {
    if (!transcript?.segments) return
    const activeIdx = transcript.segments.findIndex(
      (seg) => currentAudioTime >= seg.start && currentAudioTime < seg.end
    )
    if (activeIdx >= 0 && segmentRefs.current[activeIdx]) {
      segmentRefs.current[activeIdx]?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  }, [currentAudioTime, transcript])

  // Appointment handlers
  function openAddApt() {
    setEditingApt(null); setAptTitle(''); setAptType('consultation')
    const now = new Date()
    setAptDate(now.toISOString().slice(0, 10)); setAptTime('10:00'); setAptMemo('')
    setShowAptModal(true)
  }

  function openEditApt(apt: Appointment) {
    setEditingApt(apt); setAptTitle(apt.title); setAptType(apt.appointment_type)
    const d = new Date(apt.scheduled_at)
    setAptDate(d.toISOString().slice(0, 10))
    setAptTime(`${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`)
    setAptMemo(apt.memo ?? ''); setShowAptModal(true)
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
        const res = await fetch(`/api/dashboard/recordings/${recordingId}/appointments`, {
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
    } finally { setAptSaving(false) }
  }

  async function handleDeleteApt(apt: Appointment) {
    if (!session) return
    await fetch(`/api/dashboard/appointments/${apt.id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${session.access_token}` } })
    setAppointments((prev) => prev.filter((a) => a.id !== apt.id))
  }

  // Case link handlers
  async function openLinkModal() {
    if (!session) return
    setLinkModalTab('link')
    setNewCaseName(recording?.client?.name ?? '')
    setNewCasePhone('')
    setNewCaseType('')
    setShowLinkModal(true)
    setCasesLoading(true)
    const res = await fetch('/api/dashboard/cases', { headers: { Authorization: `Bearer ${session.access_token}` } })
    const data = await res.json()
    setCases(data.cases ?? [])
    setCasesLoading(false)
  }

  async function handleCreateNewCase() {
    if (!session || createSaving) return
    setCreateSaving(true)
    try {
      // 1. Create new case
      const res = await fetch('/api/dashboard/cases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ client_name: newCaseName, client_phone: newCasePhone, case_type: newCaseType }),
      })
      if (!res.ok) {
        const err = await res.json()
        alert(err.error ?? '사건 생성 실패')
        return
      }
      const { case: newCase } = await res.json()
      // 2. Link recording to new case
      const linkRes = await fetch(`/api/dashboard/recordings/${recordingId}/links`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ case_id: newCase.id, case_client_name: newCase.client?.name ?? null, case_type: newCase.case_type }),
      })
      if (linkRes.ok) {
        const linkData = await linkRes.json()
        setLinkedCases((prev) => [...prev, linkData.link])
        setShowLinkModal(false)
      }
    } finally {
      setCreateSaving(false)
    }
  }

  async function handleLink(c: CaseRow) {
    if (!session || linkSaving) return
    setLinkSaving(true)
    const res = await fetch(`/api/dashboard/recordings/${recordingId}/links`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ case_id: c.id, case_client_name: c.client?.name ?? null, case_type: c.case_type }),
    })
    if (res.ok) {
      const data = await res.json()
      setLinkedCases((prev) => [...prev, data.link])
    }
    setLinkSaving(false)
    setShowLinkModal(false)
  }

  async function handleUnlink(linkId: string) {
    if (!session) return
    await fetch(`/api/dashboard/recordings/${recordingId}/links?linkId=${linkId}`, {
      method: 'DELETE', headers: { Authorization: `Bearer ${session.access_token}` },
    })
    setLinkedCases((prev) => prev.filter((l) => l.id !== linkId))
  }

  // Edit title handlers
  function openEditModal() {
    setEditTitle(recording?.title ?? '')
    setShowEditModal(true)
  }

  async function handleSaveTitle() {
    if (!session || !recordingId || editSaving || !editTitle.trim()) return
    setEditSaving(true)
    try {
      const res = await fetch(`/api/dashboard/recordings/${recordingId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ title: editTitle.trim() }),
      })
      if (res.ok) {
        const data = await res.json()
        setRecording((prev) => prev ? { ...prev, title: data.recording.title } : null)
        setShowEditModal(false)
      }
    } finally {
      setEditSaving(false)
    }
  }

  // Delete handlers
  async function handleDelete() {
    if (!session || !recordingId || deleteSaving) return
    setDeleteSaving(true)
    try {
      const res = await fetch(`/api/dashboard/recordings/${recordingId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      if (res.ok) {
        router.push('/dashboard/recordings')
      }
    } finally {
      setDeleteSaving(false)
    }
  }

  // Download transcript
  function downloadTranscript() {
    if (!transcript?.full_text) return
    const blob = new Blob([transcript.full_text], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${recording?.title ?? '녹취록'}_${new Date(recording?.created_at ?? Date.now()).toLocaleDateString('ko-KR').replace(/\./g, '').replace(/ /g, '')}.txt`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
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
        <p className="text-slate-500">녹음을 찾을 수 없습니다.</p>
        <button onClick={() => router.push('/dashboard/recordings')} className="mt-3 text-sm hover:underline" style={{ color: '#4a7aef' }}>목록으로 돌아가기</button>
      </div>
    )
  }

  const status = statusLabel(recording.status)
  const segments = transcript?.segments ?? []
  const filteredSegments = searchQuery
    ? segments.filter((s) => s.text.toLowerCase().includes(searchQuery.toLowerCase()))
    : segments

  const TABS: { key: TabKey; label: string }[] = [
    { key: 'report', label: '정리' },
    { key: 'transcript', label: '녹취록' },
  ]

  return (
    <div className="p-4 md:p-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-start justify-between mb-2 flex-wrap gap-2">
        <div className="flex items-start gap-3">
          <button onClick={() => router.back()} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors mt-0.5">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-xl font-bold text-slate-900">{recording.title || '제목 없음'}</h1>
              <button
                onClick={openEditModal}
                className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded transition-colors"
                title="제목 수정"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
              </button>
            </div>
            <div className="flex items-center gap-3 mt-1 flex-wrap">
              <span className="px-2 py-0.5 rounded-md text-xs font-medium bg-slate-100 text-slate-700">
                {consultationType(recording.recording_type)}
              </span>
              <span className="text-sm font-medium" style={{ color: status.color }}>{status.text}</span>
              <span className="text-sm text-slate-400">{formatDuration(recording.duration_seconds)}</span>
              <span className="text-sm text-slate-400">
                {new Date(recording.created_at).toLocaleDateString('ko-KR', { year: 'numeric', month: 'short', day: 'numeric' })}
              </span>
            </div>
          </div>
        </div>
        <button
          onClick={() => setShowDeleteModal(true)}
          className="px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors border border-red-200"
        >
          삭제
        </button>
      </div>

      {/* Client link */}
      {recording.client_id && (
        <div className="mb-2">
          <button
            onClick={() => router.push(`/dashboard/clients/${recording.client_id}`)}
            className="flex items-center gap-1.5 text-sm font-medium hover:underline"
            style={{ color: '#4a7aef' }}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            {recording.client?.name ?? '고객 상세'} →
          </button>
        </div>
      )}

      {/* Linked cases */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        {linkedCases.map((lc) => (
          <div key={lc.id} className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 rounded-lg text-sm">
            <button
              onClick={() => router.push(`/dashboard/cases/${lc.case_id}`)}
              className="font-medium hover:underline"
              style={{ color: '#4a7aef' }}
            >
              {lc.case_client_name ?? '사건'}{lc.case_type ? ` · ${lc.case_type}` : ''} →
            </button>
            <button
              onClick={() => handleUnlink(lc.id)}
              className="text-slate-300 hover:text-red-400 transition-colors ml-1"
              title="연결 해제"
            >
              <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>
        ))}
        <button
          onClick={openLinkModal}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 text-sm text-slate-500 hover:border-slate-300 hover:text-slate-700 transition-colors bg-white"
        >
          <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          사건 연결
        </button>
      </div>

      {/* Tab bar */}
      <div className="flex border-b border-slate-200 mb-4">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              activeTab === tab.key ? 'border-current text-current' : 'border-transparent text-slate-400 hover:text-slate-600'
            }`}
            style={activeTab === tab.key ? { color: '#1a2b5a', borderColor: '#1a2b5a' } : {}}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── 리포트 탭 ── */}
      {activeTab === 'report' && (
        <div>
          {recording.status === 'failed' ? (
            <div className="text-center py-16">
              <svg className="w-12 h-12 mx-auto mb-4 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
              </svg>
              <p className="text-red-600 font-semibold mb-2">처리에 실패했습니다</p>
              <p className="text-sm text-slate-500">다시 업로드해주세요.</p>
            </div>
          ) : report ? (
            <div className="bg-white rounded-xl border border-slate-200 p-6">
              <div className="prose prose-sm max-w-none
                prose-headings:font-bold prose-headings:text-gray-950
                prose-h2:text-base prose-h2:mt-6 prose-h2:mb-2
                prose-h3:text-sm prose-h3:mt-4 prose-h3:mb-1
                prose-p:text-gray-950 prose-p:leading-relaxed
                prose-li:text-gray-950 prose-ul:my-1 prose-ol:my-1
                prose-strong:text-gray-950 prose-strong:font-bold
                [&_*]:text-gray-950
              ">
                <ReactMarkdown>{report.content}</ReactMarkdown>
              </div>
            </div>
          ) : (
            <div className="text-center py-16">
              <p className="text-sm text-slate-400">리포트가 없습니다.</p>
            </div>
          )}
        </div>
      )}

      {/* ── 스크립트 탭 ── */}
      {activeTab === 'transcript' && (
        <div className="space-y-4">
          {/* Audio player */}
          {signedUrl ? (
            <AudioPlayer src={signedUrl} onTimeUpdate={setCurrentAudioTime} />
          ) : (
            <div className="bg-white rounded-xl border border-slate-200 p-4 text-center text-sm text-slate-400">
              오디오 파일을 불러올 수 없습니다.
            </div>
          )}

          {/* Transcript segments */}
          {transcript ? (
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              {/* Notice + search */}
              <div className="px-4 py-3 bg-amber-50 border-b border-amber-100">
                <p className="text-xs text-amber-700">AI 자동 변환 결과입니다. 오류가 있을 수 있으니 원본 녹음을 확인해 주세요.</p>
              </div>
              <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="녹취록 내 검색..."
                  className="flex-1 text-sm border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:border-blue-400"
                />
                <button
                  onClick={downloadTranscript}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-slate-600 hover:text-slate-900 hover:bg-slate-50 rounded-lg transition-colors border border-slate-200"
                  title="녹취록 다운로드"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  다운로드
                </button>
              </div>

              {segments.length === 0 ? (
                <div className="px-4 py-10 text-center text-sm text-slate-400">
                  스크립트가 없습니다.
                </div>
              ) : (
                <div className="max-h-[500px] overflow-y-auto divide-y divide-slate-50">
                  {filteredSegments.map((seg, i) => {
                    const isActive = currentAudioTime >= seg.start && currentAudioTime < seg.end
                    return (
                      <div
                        key={i}
                        ref={(el) => { segmentRefs.current[i] = el }}
                        onClick={() => {
                          if (!signedUrl) return
                          // Dispatch seekTo event to audio element
                          const audioEl = document.querySelector('audio')
                          if (audioEl) {
                            audioEl.currentTime = seg.start
                            audioEl.play()
                          }
                        }}
                        className={`flex gap-3 px-4 py-3 cursor-pointer transition-colors ${
                          isActive ? 'bg-blue-50' : 'hover:bg-slate-50'
                        }`}
                      >
                        <span
                          className="flex-shrink-0 text-xs tabular-nums font-mono pt-0.5 w-16"
                          style={{ color: isActive ? '#4a7aef' : '#94a3b8' }}
                        >
                          [{formatTime(seg.start)}]
                        </span>
                        <p className={`text-sm leading-relaxed flex-1 ${isActive ? 'text-slate-900 font-medium' : 'text-slate-700'}`}>
                          {seg.text}
                        </p>
                      </div>
                    )
                  })}
                  {searchQuery && filteredSegments.length === 0 && (
                    <div className="px-4 py-8 text-center text-sm text-slate-400">검색 결과가 없습니다.</div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-slate-200 p-6 text-center text-sm text-slate-400">
              스크립트가 없습니다.
            </div>
          )}
        </div>
      )}


      {/* ── 사건 연결 모달 ── */}
      {showLinkModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="w-full max-w-md bg-white rounded-2xl shadow-xl">
            <div className="px-5 pt-5 pb-4 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-base font-semibold text-slate-900">사건 연결</h2>
              <button onClick={() => setShowLinkModal(false)} className="w-8 h-8 flex items-center justify-center rounded-full text-slate-400 hover:bg-slate-100">
                <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
            {/* Tabs */}
            <div className="flex border-b border-slate-100">
              {(['link', 'create'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setLinkModalTab(tab)}
                  className={`flex-1 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                    linkModalTab === tab ? 'border-current' : 'border-transparent text-slate-400 hover:text-slate-600'
                  }`}
                  style={linkModalTab === tab ? { color: '#1a2b5a', borderColor: '#1a2b5a' } : {}}
                >
                  {tab === 'link' ? '기존 사건에 연결' : '새 사건 만들기'}
                </button>
              ))}
            </div>

            {linkModalTab === 'link' ? (
              <div className="px-5 py-4 max-h-72 overflow-y-auto">
                {casesLoading ? (
                  <div className="flex items-center justify-center h-24">
                    <div className="w-5 h-5 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#1a2b5a', borderTopColor: 'transparent' }} />
                  </div>
                ) : cases.length === 0 ? (
                  <p className="text-center text-sm text-slate-400 py-8">연결할 수 있는 사건이 없습니다.</p>
                ) : (
                  <div className="space-y-2">
                    {cases.map((c) => {
                      const alreadyLinked = linkedCases.some((l) => l.case_id === c.id)
                      return (
                        <button
                          key={c.id}
                          onClick={() => !alreadyLinked && handleLink(c)}
                          disabled={alreadyLinked || linkSaving}
                          className={`w-full text-left px-4 py-3 rounded-lg border transition-colors ${
                            alreadyLinked ? 'border-blue-200 bg-blue-50 cursor-default' : 'border-slate-200 hover:bg-slate-50 disabled:opacity-50'
                          }`}
                        >
                          <span className="text-sm font-semibold text-gray-950">{c.client?.name ?? '고객 정보 없음'}</span>
                          <span className="ml-2 text-sm font-medium text-slate-900">{c.case_type}</span>
                          {alreadyLinked && <span className="ml-2 text-xs text-blue-600">✓ 연결됨</span>}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            ) : (
              <div className="px-5 py-4 space-y-3">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">이름 *</label>
                  <input
                    value={newCaseName}
                    onChange={(e) => setNewCaseName(e.target.value)}
                    placeholder="고객 이름"
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">전화번호 *</label>
                  <input
                    value={newCasePhone}
                    onChange={(e) => setNewCasePhone(e.target.value)}
                    placeholder="010-0000-0000"
                    type="tel"
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">사건 유형 (선택)</label>
                  <input
                    value={newCaseType}
                    onChange={(e) => setNewCaseType(e.target.value)}
                    placeholder="예: 형사-폭행"
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
                  />
                </div>
              </div>
            )}

            <div className="px-5 pb-5 flex gap-3">
              <button onClick={() => setShowLinkModal(false)} className="flex-1 h-11 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50">닫기</button>
              {linkModalTab === 'create' && (
                <button
                  onClick={handleCreateNewCase}
                  disabled={createSaving || !newCaseName.trim() || !newCasePhone.trim()}
                  className="flex-1 h-11 rounded-xl text-white text-sm font-medium disabled:opacity-50"
                  style={{ background: '#1a2b5a' }}
                >
                  {createSaving ? '생성 중...' : '사건 생성 + 연결'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Edit Title Modal */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black/20 flex items-center justify-center z-50 p-4" onClick={() => setShowEditModal(false)}>
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-semibold text-slate-900">제목 수정</h3>
              <button onClick={() => setShowEditModal(false)} className="p-1 text-slate-400 hover:text-slate-600 rounded-lg transition-colors">
                <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="px-5 py-4 space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">제목</label>
                <input
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  placeholder="상담 제목을 입력하세요"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
                  autoFocus
                />
              </div>
            </div>
            <div className="px-5 pb-5 flex gap-3">
              <button onClick={() => setShowEditModal(false)} className="flex-1 h-11 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50">취소</button>
              <button
                onClick={handleSaveTitle}
                disabled={editSaving || !editTitle.trim()}
                className="flex-1 h-11 rounded-xl text-white text-sm font-medium disabled:opacity-50"
                style={{ background: '#1a2b5a' }}
              >
                {editSaving ? '저장 중...' : '저장'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/20 flex items-center justify-center z-50 p-4" onClick={() => setShowDeleteModal(false)}>
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-semibold text-slate-900">상담 삭제</h3>
              <button onClick={() => setShowDeleteModal(false)} className="p-1 text-slate-400 hover:text-slate-600 rounded-lg transition-colors">
                <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="px-5 py-4">
              <p className="text-sm text-slate-600">
                이 상담을 삭제하시겠습니까?<br />
                <span className="text-red-600 font-medium">녹음 파일, 리포트, 녹취록이 모두 영구 삭제됩니다.</span>
              </p>
            </div>
            <div className="px-5 pb-5 flex gap-3">
              <button onClick={() => setShowDeleteModal(false)} className="flex-1 h-11 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50">취소</button>
              <button
                onClick={handleDelete}
                disabled={deleteSaving}
                className="flex-1 h-11 rounded-xl bg-red-600 text-white text-sm font-medium hover:bg-red-700 disabled:opacity-50"
              >
                {deleteSaving ? '삭제 중...' : '삭제'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

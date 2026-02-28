'use client'
import { useEffect, useRef, useState } from 'react'
import { useAuth } from '@/hooks/useAuth'

// ─── Types ───────────────────────────────────────────────────────────────────

type FirmSettings = {
  name: string
  lawyer_name: string
  phone: string
  hours: string
  specialties: string[]
  greeting: string
  notify_email: string
  notification_email: boolean
  notification_new_case: boolean
  notification_urgent_only: boolean
}

type DayKey = '평일' | '토요일' | '일요일'

// ─── Constants ───────────────────────────────────────────────────────────────

const SPECIALTY_OPTIONS = ['민사', '형사', '가사', '교통사고', '행정', '노동', '부동산', '상속', '기업']
const DAY_OPTIONS: DayKey[] = ['평일', '토요일', '일요일']

const INPUT_CLASS =
  'w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white text-slate-900 placeholder-slate-400 outline-none focus:ring-2 focus:ring-[#4a7aef] focus:border-transparent transition-shadow'

// 30분 단위 시간 옵션 (00:00 ~ 23:30)
const TIME_OPTIONS: { value: string; label: string }[] = Array.from({ length: 48 }, (_, i) => {
  const h = Math.floor(i / 2)
  const m = i % 2 === 0 ? '00' : '30'
  const value = `${String(h).padStart(2, '0')}:${m}`
  const period = h >= 12 ? '오후' : '오전'
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h
  const label = `${period} ${String(h12).padStart(2, '0')}:${m}`
  return { value, label }
})

const ITEM_H = 36 // px — 드롭다운 각 항목 높이

// ─── Helpers ─────────────────────────────────────────────────────────────────

function timeLabel(value: string): string {
  const opt = TIME_OPTIONS.find((o) => o.value === value)
  if (opt) return opt.label
  // 30분 단위 아닌 값이면 근사치로 표시
  const [h, m] = value.split(':').map(Number)
  const period = h >= 12 ? '오후' : '오전'
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h
  return `${period} ${String(h12).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

function snapTime(t: string): string {
  // 30분 단위로 근사
  const opt = TIME_OPTIONS.reduce((best, cur) => {
    const diff = (v: string) => {
      const [h, m] = v.split(':').map(Number)
      const [th, tm] = t.split(':').map(Number)
      return Math.abs(h * 60 + m - (th * 60 + tm))
    }
    return diff(cur.value) < diff(best.value) ? cur : best
  })
  return opt.value
}

function parseHours(s: string) {
  const def = { days: ['평일'] as DayKey[], start: '09:00', end: '18:00' }
  if (!s) return def
  const spaceIdx = s.indexOf(' ')
  if (spaceIdx === -1) return def
  const daysPart = s.slice(0, spaceIdx)
  const timePart = s.slice(spaceIdx + 1)
  const days = daysPart === '매일'
    ? DAY_OPTIONS.slice()
    : daysPart.split('·').filter((d): d is DayKey => DAY_OPTIONS.includes(d as DayKey))
  const dashIdx = timePart.indexOf('-')
  if (dashIdx === -1) return { ...def, days: days.length ? days : def.days }
  return {
    days: days.length ? days : def.days,
    start: snapTime(timePart.slice(0, dashIdx)),
    end: snapTime(timePart.slice(dashIdx + 1)),
  }
}

function formatHours(days: DayKey[], start: string, end: string) {
  const daysStr = days.length === 3 ? '매일' : days.join('·')
  return `${daysStr} ${start}-${end}`
}

// ─── TimeInput (Google Calendar 스타일 드롭다운) ──────────────────────────────

function TimeInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false)
  const listRef = useRef<HTMLDivElement>(null)
  const btnRef = useRef<HTMLButtonElement>(null)

  // 드롭다운 열릴 때 현재 선택 항목으로 스크롤
  useEffect(() => {
    if (!open || !listRef.current) return
    const idx = TIME_OPTIONS.findIndex((o) => o.value === value)
    if (idx >= 0) {
      listRef.current.scrollTop = Math.max(0, idx * ITEM_H - ITEM_H * 2)
    }
  }, [open, value])

  return (
    <div className="relative">
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-sm font-medium text-slate-800 hover:border-slate-300 transition-colors select-none"
      >
        <span className="tabular-nums">{timeLabel(value)}</span>
        <svg className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <>
          {/* 바깥 클릭 시 닫기 */}
          <div className="fixed inset-0 z-10" onMouseDown={() => setOpen(false)} />
          <div
            ref={listRef}
            className="absolute left-0 z-20 mt-1 w-36 bg-white rounded-xl border border-slate-200 shadow-lg overflow-y-auto"
            style={{ maxHeight: ITEM_H * 7 }}
          >
            {TIME_OPTIONS.map((opt) => {
              const selected = opt.value === value
              return (
                <button
                  key={opt.value}
                  type="button"
                  onMouseDown={(e) => { e.preventDefault(); onChange(opt.value); setOpen(false) }}
                  className={`w-full text-left px-3 text-sm transition-colors ${selected ? 'font-semibold text-white' : 'text-slate-700 hover:bg-slate-50'}`}
                  style={{ height: ITEM_H, background: selected ? '#1a2b5a' : undefined }}
                >
                  {opt.label}
                </button>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}

// ─── HoursPicker ─────────────────────────────────────────────────────────────

function HoursPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const parsed = parseHours(value)
  const [days, setDays] = useState<DayKey[]>(parsed.days)
  const [start, setStart] = useState(parsed.start)
  const [end, setEnd] = useState(parsed.end)

  const mounted = useRef(false)
  useEffect(() => {
    if (!mounted.current) { mounted.current = true; return }
    if (days.length > 0) onChange(formatHours(days, start, end))
  }, [days, start, end]) // eslint-disable-line

  function toggleDay(d: DayKey) {
    setDays((prev) =>
      prev.includes(d) ? (prev.length > 1 ? prev.filter((x) => x !== d) : prev) : [...prev, d]
    )
  }

  return (
    <div className="space-y-3">
      {/* Day toggles */}
      <div className="flex gap-1.5">
        {DAY_OPTIONS.map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => toggleDay(d)}
            className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-colors ${
              days.includes(d) ? 'text-white' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
            }`}
            style={days.includes(d) ? { background: '#1a2b5a', borderColor: '#1a2b5a' } : {}}
          >
            {d}
          </button>
        ))}
      </div>

      {/* Time row */}
      <div className="flex items-center gap-2 flex-wrap">
        <div>
          <p className="text-xs text-slate-400 mb-1">시작</p>
          <TimeInput value={start} onChange={setStart} />
        </div>
        <span className="text-slate-300 text-lg font-light mt-4">—</span>
        <div>
          <p className="text-xs text-slate-400 mb-1">종료</p>
          <TimeInput value={end} onChange={setEnd} />
        </div>
      </div>

      {/* Preview */}
      {days.length > 0 && (
        <p className="text-xs text-slate-500">
          영업시간: <span className="font-medium text-slate-700">{formatHours(days, start, end)}</span>
        </p>
      )}
    </div>
  )
}

// ─── SettingsPage ─────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const { session, loading } = useAuth()
  const [form, setForm] = useState<FirmSettings>({
    name: '',
    lawyer_name: '',
    phone: '',
    hours: '평일 09:00-18:00',
    specialties: [],
    greeting: '',
    notify_email: '',
    notification_email: true,
    notification_new_case: true,
    notification_urgent_only: false,
  })
  const [fetching, setFetching] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const [fetchError, setFetchError] = useState('')

  useEffect(() => {
    if (loading) return
    if (!session) { setFetching(false); return }

    fetch('/api/dashboard/settings', {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
      .then(async (r) => {
        if (!r.ok) { const d = await r.json().catch(() => ({})); setFetchError(d.error ?? '불러오기 실패'); return }
        const { firm } = await r.json()
        if (!firm) return
        setForm({
          name: firm.name ?? '',
          lawyer_name: firm.lawyer_name ?? '',
          phone: firm.phone ?? '',
          hours: firm.hours ?? '평일 09:00-18:00',
          specialties: Array.isArray(firm.specialties) ? firm.specialties : [],
          greeting: firm.greeting ?? '',
          notify_email: (firm as { notify_email?: string }).notify_email ?? '',
          notification_email: firm.notification_email ?? true,
          notification_new_case: firm.notification_new_case ?? true,
          notification_urgent_only: firm.notification_urgent_only ?? false,
        })
      })
      .catch(() => setFetchError('네트워크 오류가 발생했습니다.'))
      .finally(() => setFetching(false))
  }, [session, loading])

  async function handleSave() {
    if (!session) return
    if (form.notify_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.notify_email.trim())) {
      setError('알림 이메일 형식이 올바르지 않습니다.')
      return
    }
    setSaving(true); setSaved(false); setError('')
    try {
      const res = await fetch('/api/dashboard/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify(form),
      })
      if (res.ok) { setSaved(true); setTimeout(() => setSaved(false), 3000) }
      else { const d = await res.json().catch(() => ({})); setError(d.error ?? '저장 오류') }
    } catch { setError('네트워크 오류') }
    finally { setSaving(false) }
  }

  function toggleSpecialty(s: string) {
    setForm((p) => ({ ...p, specialties: p.specialties.includes(s) ? p.specialties.filter((x) => x !== s) : [...p.specialties, s] }))
  }

  if (loading || fetching) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#1a2b5a', borderTopColor: 'transparent' }} />
      </div>
    )
  }
  if (fetchError) return <div className="p-6"><p className="text-red-600 text-sm">{fetchError}</p></div>

  return (
    <div className="p-6 max-w-2xl">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-slate-900">사무소 설정</h1>
        <p className="text-slate-500 text-sm mt-0.5">AI 채팅에 표시되는 정보를 관리합니다.</p>
      </div>

      <div className="space-y-6">
        {/* Basic info */}
        <section className="bg-white rounded-xl border border-slate-200 p-5">
          <h2 className="text-sm font-semibold text-slate-700 mb-4">기본 정보</h2>
          <div className="space-y-4">
            <Field label="사무소명">
              <input type="text" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} placeholder="예) 홍길동 법률사무소" className={INPUT_CLASS} />
            </Field>
            <Field label="담당 변호사">
              <input type="text" value={form.lawyer_name} onChange={(e) => setForm((p) => ({ ...p, lawyer_name: e.target.value }))} placeholder="예) 홍길동" className={INPUT_CLASS} />
            </Field>
            <Field label="대표 전화">
              <input type="text" value={form.phone} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} placeholder="예) 02-1234-5678" className={INPUT_CLASS} />
            </Field>
            <Field label="업무시간">
              <HoursPicker value={form.hours} onChange={(v) => setForm((p) => ({ ...p, hours: v }))} />
            </Field>
          </div>
        </section>

        {/* Specialties */}
        <section className="bg-white rounded-xl border border-slate-200 p-5">
          <h2 className="text-sm font-semibold text-slate-700 mb-1">전문분야</h2>
          <p className="text-xs text-slate-400 mb-3">AI가 상담 시 참고합니다.</p>
          <div className="flex flex-wrap gap-2">
            {SPECIALTY_OPTIONS.map((s) => (
              <button key={s} type="button" onClick={() => toggleSpecialty(s)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${form.specialties.includes(s) ? 'text-white' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'}`}
                style={form.specialties.includes(s) ? { background: '#1a2b5a', borderColor: '#1a2b5a' } : {}}>
                {s}
              </button>
            ))}
          </div>
        </section>

        {/* AI greeting */}
        <section className="bg-white rounded-xl border border-slate-200 p-5">
          <h2 className="text-sm font-semibold text-slate-700 mb-1">AI 인사말</h2>
          <p className="text-xs text-slate-400 mb-3">비워두면 기본 인사말을 사용합니다.</p>
          <textarea value={form.greeting} onChange={(e) => setForm((p) => ({ ...p, greeting: e.target.value }))} rows={3}
            placeholder={`예) 안녕하세요, ${form.name || '사무소명'}입니다. 무엇을 도와드릴까요?`}
            className={`${INPUT_CLASS} resize-none`} />
        </section>

        {/* Notifications */}
        <section className="bg-white rounded-xl border border-slate-200 p-5">
          <h2 className="text-sm font-semibold text-slate-700 mb-4">알림 설정</h2>
          <div className="space-y-4">
            <Field label="알림 이메일">
              <input
                type="email"
                value={form.notify_email}
                onChange={(e) => setForm((p) => ({ ...p, notify_email: e.target.value }))}
                placeholder="사건 접수 알림을 받을 이메일 주소"
                className={INPUT_CLASS}
              />
              <p className="text-xs text-slate-400 mt-1">비워두면 가입 이메일로 전송됩니다.</p>
            </Field>
            <Toggle
              checked={form.notification_email}
              onChange={(v) => setForm((p) => ({ ...p, notification_email: v }))}
              label="이메일 알림"
              desc="사건 접수 완료 시 이메일로 알림을 받습니다."
            />
            <Toggle
              checked={form.notification_new_case}
              onChange={(v) => setForm((p) => ({ ...p, notification_new_case: v }))}
              label="새 상담 알림"
              desc="새 대화 세션이 시작되면 알림을 받습니다. (아직 접수 완료 전)"
            />
            <Toggle
              checked={form.notification_urgent_only}
              onChange={(v) => setForm((p) => ({ ...p, notification_urgent_only: v }))}
              label="긴급 건만 알림"
              desc="이메일 알림을 긴급(urgent) 사건만 받습니다. 이메일 알림이 켜진 경우에만 적용됩니다."
              disabled={!form.notification_email}
            />
          </div>
        </section>

        {/* Save */}
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex items-center gap-3">
          <button onClick={handleSave} disabled={saving}
            className="px-5 py-2.5 text-white text-sm font-medium rounded-lg disabled:opacity-50 transition-colors"
            style={{ background: '#1a2b5a' }}>
            {saving ? '저장 중...' : '저장'}
          </button>
          {saved && <span className="text-sm text-green-600 font-medium">저장됐습니다.</span>}
        </div>
      </div>
    </div>
  )
}

// ─── Shared sub-components ────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-500 mb-1.5">{label}</label>
      {children}
    </div>
  )
}

function Toggle({ checked, onChange, label, desc, disabled = false }: {
  checked: boolean
  onChange: (v: boolean) => void
  label: string
  desc: string
  disabled?: boolean
}) {
  return (
    <div className={`flex items-center gap-3 ${disabled ? 'opacity-40' : ''}`}>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => !disabled && onChange(!checked)}
        className="relative flex-shrink-0 w-11 h-6 rounded-full overflow-hidden transition-colors duration-200 focus:outline-none"
        style={{ background: checked ? '#2d4a8a' : '#cbd5e1' }}
      >
        <span
          className="absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200"
          style={{ transform: checked ? 'translateX(22px)' : 'translateX(2px)' }}
        />
      </button>
      <div>
        <p className="text-sm font-medium text-slate-700">{label}</p>
        <p className="text-xs text-slate-400 mt-0.5">{desc}</p>
      </div>
    </div>
  )
}

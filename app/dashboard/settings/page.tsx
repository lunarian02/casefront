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
  notification_email: boolean
  notification_new_case: boolean
  notification_urgent_only: boolean
}

type Period = '오전' | '오후'
type DayKey = '평일' | '토요일' | '일요일'

// ─── Constants ───────────────────────────────────────────────────────────────

const SPECIALTY_OPTIONS = ['민사', '형사', '가사', '교통사고', '행정', '노동', '부동산', '상속', '기업']
const HOURS_12 = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12']
const MINUTES = ['00', '10', '20', '30', '40', '50']
const DAY_OPTIONS: DayKey[] = ['평일', '토요일', '일요일']

const INPUT_CLASS =
  'w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white text-slate-900 placeholder-slate-400 outline-none focus:ring-2 focus:ring-[#4a7aef] focus:border-transparent transition-shadow'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function to24(period: Period, h: string, m: string) {
  let n = parseInt(h)
  if (period === '오전' && n === 12) n = 0
  if (period === '오후' && n !== 12) n += 12
  return `${String(n).padStart(2, '0')}:${m}`
}

function from24(time: string): { period: Period; h: string; m: string } {
  const [hStr, mStr] = (time || '09:00').split(':')
  let n = parseInt(hStr) || 9
  const period: Period = n >= 12 ? '오후' : '오전'
  if (n > 12) n -= 12
  if (n === 0) n = 12
  const rawMin = parseInt(mStr) || 0
  const snapped = MINUTES.reduce((prev, cur) =>
    Math.abs(parseInt(cur) - rawMin) < Math.abs(parseInt(prev) - rawMin) ? cur : prev
  )
  return { period, h: String(n).padStart(2, '0'), m: snapped }
}

function parseHours(s: string) {
  const def = {
    days: ['평일'] as DayKey[],
    startP: '오전' as Period, startH: '09', startM: '00',
    endP: '오후' as Period, endH: '06', endM: '00',
  }
  if (!s) return def
  const spaceIdx = s.indexOf(' ')
  if (spaceIdx === -1) return def
  const daysPart = s.slice(0, spaceIdx)
  const timePart = s.slice(spaceIdx + 1)
  const days = daysPart.split('·').filter((d): d is DayKey => DAY_OPTIONS.includes(d as DayKey))
  const dashIdx = timePart.indexOf('-')
  if (dashIdx === -1) return { ...def, days: days.length ? days : def.days }
  const { period: startP, h: startH, m: startM } = from24(timePart.slice(0, dashIdx))
  const { period: endP, h: endH, m: endM } = from24(timePart.slice(dashIdx + 1))
  return { days: days.length ? days : def.days, startP, startH, startM, endP, endH, endM }
}

function formatHours(days: DayKey[], startP: Period, startH: string, startM: string, endP: Period, endH: string, endM: string) {
  const daysStr = days.length === 3 ? '매일' : days.join('·')
  return `${daysStr} ${to24(startP, startH, startM)}-${to24(endP, endH, endM)}`
}

// ─── DrumPicker ───────────────────────────────────────────────────────────────

const ITEM_H = 44

function DrumPicker({ items, value, onChange }: { items: string[]; value: string; onChange: (v: string) => void }) {
  const idx = Math.max(0, items.indexOf(value))
  const lastY = useRef<number | null>(null)

  function go(delta: number) {
    const next = Math.max(0, Math.min(items.length - 1, idx + delta))
    if (next !== idx) onChange(items[next])
  }

  const slots = [-2, -1, 0, 1, 2].map((d) => {
    const i = idx + d
    return i >= 0 && i < items.length ? items[i] : ''
  })

  return (
    <div
      className="relative select-none"
      style={{ width: 56, height: 5 * ITEM_H }}
      onWheel={(e) => { e.preventDefault(); go(e.deltaY > 0 ? 1 : -1) }}
      onPointerDown={(e) => { lastY.current = e.clientY; (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId) }}
      onPointerMove={(e) => {
        if (lastY.current === null) return
        const diff = lastY.current - e.clientY
        if (Math.abs(diff) >= ITEM_H * 0.5) {
          go(diff > 0 ? 1 : -1)
          lastY.current = e.clientY
        }
      }}
      onPointerUp={() => { lastY.current = null }}
    >
      {/* highlight strip */}
      <div
        className="absolute inset-x-0 rounded-lg pointer-events-none"
        style={{ top: 2 * ITEM_H, height: ITEM_H, background: '#eef2ff', border: '1px solid rgba(74,122,239,0.3)' }}
      />
      {/* fades */}
      <div className="absolute inset-x-0 top-0 pointer-events-none z-10" style={{ height: 2 * ITEM_H, background: 'linear-gradient(to bottom, white 30%, transparent)' }} />
      <div className="absolute inset-x-0 bottom-0 pointer-events-none z-10" style={{ height: 2 * ITEM_H, background: 'linear-gradient(to top, white 30%, transparent)' }} />
      {/* items */}
      {slots.map((label, i) => {
        const dist = Math.abs(i - 2)
        return (
          <div
            key={i}
            className="absolute inset-x-0 flex items-center justify-center font-medium transition-all"
            style={{
              top: i * ITEM_H,
              height: ITEM_H,
              fontSize: dist === 0 ? 18 : dist === 1 ? 14 : 11,
              color: dist === 0 ? '#1a2b5a' : dist === 1 ? '#64748b' : '#cbd5e1',
              opacity: dist === 0 ? 1 : dist === 1 ? 0.7 : 0.35,
            }}
          >
            {label}
          </div>
        )
      })}
      {/* click zones */}
      <button type="button" className="absolute inset-x-0 z-20 cursor-pointer" style={{ top: 0, height: 2 * ITEM_H }} onClick={() => go(-1)} />
      <button type="button" className="absolute inset-x-0 z-20 cursor-pointer" style={{ bottom: 0, height: 2 * ITEM_H }} onClick={() => go(1)} />
    </div>
  )
}

// ─── HoursPicker ─────────────────────────────────────────────────────────────

function HoursPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const parsed = parseHours(value)
  const [days, setDays] = useState<DayKey[]>(parsed.days)
  const [startP, setStartP] = useState<Period>(parsed.startP)
  const [startH, setStartH] = useState(parsed.startH)
  const [startM, setStartM] = useState(parsed.startM)
  const [endP, setEndP] = useState<Period>(parsed.endP)
  const [endH, setEndH] = useState(parsed.endH)
  const [endM, setEndM] = useState(parsed.endM)

  const mounted = useRef(false)
  useEffect(() => {
    if (!mounted.current) { mounted.current = true; return }
    if (days.length > 0) onChange(formatHours(days, startP, startH, startM, endP, endH, endM))
  }, [days, startP, startH, startM, endP, endH, endM]) // eslint-disable-line

  function toggleDay(d: DayKey) {
    setDays((prev) =>
      prev.includes(d) ? (prev.length > 1 ? prev.filter((x) => x !== d) : prev) : [...prev, d]
    )
  }

  function PeriodBtn({ period, set }: { period: Period; set: (p: Period) => void }) {
    return (
      <div className="flex rounded-lg border border-slate-200 overflow-hidden text-xs font-medium">
        {(['오전', '오후'] as Period[]).map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => set(p)}
            className={`px-2.5 py-1 transition-colors ${period === p ? 'text-white' : 'bg-white text-slate-500 hover:bg-slate-50'}`}
            style={period === p ? { background: '#1a2b5a' } : {}}
          >
            {p}
          </button>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Day toggles */}
      <div className="flex gap-2">
        {DAY_OPTIONS.map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => toggleDay(d)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
              days.includes(d) ? 'text-white' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
            }`}
            style={days.includes(d) ? { background: '#1a2b5a', borderColor: '#1a2b5a' } : {}}
          >
            {d}
          </button>
        ))}
      </div>

      {/* Time pickers */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Start */}
        <div className="flex flex-col items-center gap-2">
          <span className="text-xs text-slate-400">시작</span>
          <PeriodBtn period={startP} set={setStartP} />
          <div className="flex gap-1 items-center">
            <DrumPicker items={HOURS_12} value={startH} onChange={setStartH} />
            <span className="text-slate-400 text-lg font-light">:</span>
            <DrumPicker items={MINUTES} value={startM} onChange={setStartM} />
          </div>
        </div>

        <span className="text-slate-300 text-2xl font-light mt-4">—</span>

        {/* End */}
        <div className="flex flex-col items-center gap-2">
          <span className="text-xs text-slate-400">종료</span>
          <PeriodBtn period={endP} set={setEndP} />
          <div className="flex gap-1 items-center">
            <DrumPicker items={HOURS_12} value={endH} onChange={setEndH} />
            <span className="text-slate-400 text-lg font-light">:</span>
            <DrumPicker items={MINUTES} value={endM} onChange={setEndM} />
          </div>
        </div>
      </div>

      {/* Preview */}
      <p className="text-xs text-slate-500">
        영업시간:{' '}
        <span className="font-medium text-slate-700">
          {days.length > 0 ? formatHours(days, startP, startH, startM, endP, endH, endM) : '–'}
        </span>
      </p>
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
    return <div className="flex items-center justify-center h-64"><div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#1a2b5a', borderTopColor: 'transparent' }} /></div>
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
    <div className={`flex items-start gap-3 ${disabled ? 'opacity-40' : ''}`}>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => !disabled && onChange(!checked)}
        className={`relative mt-0.5 w-10 h-6 rounded-full transition-colors flex-shrink-0 focus:outline-none focus:ring-2 focus:ring-[#4a7aef] focus:ring-offset-1 ${checked ? '' : 'bg-slate-200'}`}
        style={checked ? { background: '#1a2b5a' } : {}}
      >
        <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${checked ? 'translate-x-5' : 'translate-x-1'}`} />
      </button>
      <div>
        <p className="text-sm font-medium text-slate-700">{label}</p>
        <p className="text-xs text-slate-400 mt-0.5">{desc}</p>
      </div>
    </div>
  )
}

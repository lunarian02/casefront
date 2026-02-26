'use client'
import { useEffect, useState } from 'react'
import { useAuth } from '@/hooks/useAuth'

type FirmSettings = {
  name: string
  lawyer_name: string
  phone: string
  hours: string
  specialties: string[]
  greeting: string
  notification_email: boolean
}

const SPECIALTY_OPTIONS = ['민사', '형사', '가사', '교통사고', '행정', '노동', '부동산', '상속', '기업']

export default function SettingsPage() {
  const { session, loading } = useAuth()
  const [form, setForm] = useState<FirmSettings>({
    name: '',
    lawyer_name: '',
    phone: '',
    hours: '',
    specialties: [],
    greeting: '',
    notification_email: true,
  })
  const [fetching, setFetching] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!session) return
    fetch('/api/dashboard/settings', {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
      .then((r) => r.json())
      .then(({ firm }) => {
        if (!firm) return
        setForm({
          name: firm.name ?? '',
          lawyer_name: firm.lawyer_name ?? '',
          phone: firm.phone ?? '',
          hours: firm.hours ?? '',
          specialties: Array.isArray(firm.specialties) ? firm.specialties : [],
          greeting: firm.greeting ?? '',
          notification_email: firm.notification_email ?? true,
        })
      })
      .finally(() => setFetching(false))
  }, [session])

  async function handleSave() {
    if (!session) return
    setSaving(true)
    setSaved(false)
    setError('')

    const res = await fetch('/api/dashboard/settings', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify(form),
    })

    setSaving(false)
    if (res.ok) {
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } else {
      const data = await res.json()
      setError(data.error ?? '저장 중 오류가 발생했습니다.')
    }
  }

  function toggleSpecialty(s: string) {
    setForm((prev) => ({
      ...prev,
      specialties: prev.specialties.includes(s)
        ? prev.specialties.filter((x) => x !== s)
        : [...prev.specialties, s],
    }))
  }

  if (loading || fetching) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

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
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                placeholder="예) 김변호사 법률사무소"
                className="input"
              />
            </Field>
            <Field label="담당 변호사">
              <input
                type="text"
                value={form.lawyer_name}
                onChange={(e) => setForm((p) => ({ ...p, lawyer_name: e.target.value }))}
                placeholder="예) 김민준"
                className="input"
              />
            </Field>
            <Field label="대표 전화">
              <input
                type="text"
                value={form.phone}
                onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
                placeholder="예) 02-1234-5678"
                className="input"
              />
            </Field>
            <Field label="업무시간">
              <input
                type="text"
                value={form.hours}
                onChange={(e) => setForm((p) => ({ ...p, hours: e.target.value }))}
                placeholder="예) 평일 09:00-18:00"
                className="input"
              />
            </Field>
          </div>
        </section>

        {/* Specialties */}
        <section className="bg-white rounded-xl border border-slate-200 p-5">
          <h2 className="text-sm font-semibold text-slate-700 mb-1">전문분야</h2>
          <p className="text-xs text-slate-400 mb-3">AI가 상담 시 참고합니다.</p>
          <div className="flex flex-wrap gap-2">
            {SPECIALTY_OPTIONS.map((s) => (
              <button
                key={s}
                onClick={() => toggleSpecialty(s)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                  form.specialties.includes(s)
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </section>

        {/* AI greeting */}
        <section className="bg-white rounded-xl border border-slate-200 p-5">
          <h2 className="text-sm font-semibold text-slate-700 mb-1">AI 인사말</h2>
          <p className="text-xs text-slate-400 mb-3">비워두면 기본 인사말을 사용합니다.</p>
          <textarea
            value={form.greeting}
            onChange={(e) => setForm((p) => ({ ...p, greeting: e.target.value }))}
            rows={3}
            placeholder={`예) 안녕하세요, ${form.name || '사무소명'}입니다. 무엇을 도와드릴까요?`}
            className="input resize-none"
          />
        </section>

        {/* Notifications */}
        <section className="bg-white rounded-xl border border-slate-200 p-5">
          <h2 className="text-sm font-semibold text-slate-700 mb-4">알림 설정</h2>
          <label className="flex items-center gap-3 cursor-pointer">
            <div
              onClick={() => setForm((p) => ({ ...p, notification_email: !p.notification_email }))}
              className={`relative w-10 h-6 rounded-full transition-colors ${
                form.notification_email ? 'bg-indigo-600' : 'bg-slate-200'
              }`}
            >
              <span
                className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                  form.notification_email ? 'translate-x-5' : 'translate-x-1'
                }`}
              />
            </div>
            <span className="text-sm text-slate-700">이메일 알림 (접수 완료 시)</span>
          </label>
        </section>

        {/* Save */}
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex items-center gap-3">
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-5 py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            {saving ? '저장 중...' : '저장'}
          </button>
          {saved && <span className="text-sm text-green-600 font-medium">저장됐습니다.</span>}
        </div>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-500 mb-1.5">{label}</label>
      {children}
    </div>
  )
}

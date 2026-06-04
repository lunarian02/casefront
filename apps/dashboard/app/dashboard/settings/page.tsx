'use client'
import { useEffect, useState } from 'react'
import { useAuth } from '@/hooks/useAuth'

type FirmSettings = {
  name: string
  lawyer_name: string
  phone: string
  email: string
}

const INPUT_CLASS =
  'w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white text-slate-900 placeholder-slate-400 outline-none focus:ring-2 focus:ring-[#4a7aef] focus:border-transparent transition-shadow'

export default function SettingsPage() {
  const { session, loading } = useAuth()
  const [form, setForm] = useState<FirmSettings>({
    name: '',
    lawyer_name: '',
    phone: '',
    email: '',
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
          email: firm.email ?? '',
        })
      })
      .catch(() => setFetchError('네트워크 오류가 발생했습니다.'))
      .finally(() => setFetching(false))
  }, [session, loading])

  async function handleSave() {
    if (!session) return
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      setError('이메일 형식이 올바르지 않습니다.')
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
        <p className="text-slate-500 text-sm mt-0.5">사무소 기본 정보를 관리합니다.</p>
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
                placeholder="예) 홍길동 법률사무소"
                className={INPUT_CLASS}
              />
            </Field>
            <Field label="담당 변호사">
              <input
                type="text"
                value={form.lawyer_name}
                onChange={(e) => setForm((p) => ({ ...p, lawyer_name: e.target.value }))}
                placeholder="예) 홍길동"
                className={INPUT_CLASS}
              />
            </Field>
            <Field label="대표 전화">
              <input
                type="text"
                value={form.phone}
                onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
                placeholder="예) 02-1234-5678"
                className={INPUT_CLASS}
              />
            </Field>
            <Field label="이메일">
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                placeholder="예) info@lawfirm.com"
                className={INPUT_CLASS}
              />
            </Field>
          </div>
        </section>

        {/* Save */}
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex items-center gap-3">
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-5 py-2.5 text-white text-sm font-medium rounded-lg disabled:opacity-50 transition-colors"
            style={{ background: '#1a2b5a' }}
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

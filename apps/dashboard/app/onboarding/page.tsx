'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabaseBrowser } from '@/lib/supabaseClient'

function CaseFrontLogo() {
  return (
    <div className="flex items-center justify-center gap-2.5 mb-2">
      <svg width="28" height="28" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect width="64" height="64" rx="14" fill="#1a2b5a"/>
        <path d="M23 14H17.5C15.57 14 14 15.57 14 17.5V46.5C14 48.43 15.57 50 17.5 50H23" stroke="#e8ecf4" strokeWidth="3.5" strokeLinecap="round"/>
        <path d="M41 14H46.5C48.43 14 50 15.57 50 17.5V46.5C50 48.43 48.43 50 46.5 50H41" stroke="#e8ecf4" strokeWidth="3.5" strokeLinecap="round"/>
        <line x1="24" y1="26" x2="40" y2="26" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round"/>
        <line x1="24" y1="33" x2="36" y2="33" stroke="#8aa4cc" strokeWidth="2" strokeLinecap="round" opacity="0.6"/>
      </svg>
      <span style={{ fontFamily: "Georgia, 'Times New Roman', serif", fontSize: 20, fontWeight: 600, color: '#1a1f36', letterSpacing: '-0.3px' }}>
        CaseFront
      </span>
    </div>
  )
}

export default function OnboardingPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [initializing, setInitializing] = useState(true)
  const [error, setError] = useState('')
  const [complete, setComplete] = useState(false)

  // Form fields
  const [name, setName] = useState('')
  const [lawyerName, setLawyerName] = useState('')
  const [phone, setPhone] = useState('')
  const [notifyEmail, setNotifyEmail] = useState('')

  const [firmId, setFirmId] = useState<string | null>(null)
  const [userEmail, setUserEmail] = useState('')

  // On mount: check if already onboarded
  useEffect(() => {
    async function checkOnboarding() {
      const { data: { session } } = await supabaseBrowser.auth.getSession()
      if (!session) {
        router.push('/login')
        return
      }

      // Pre-fill notify email with login email
      if (session.user.email) {
        setUserEmail(session.user.email)
        setNotifyEmail(session.user.email)
      }

      const res = await fetch('/api/dashboard/onboarding', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      const data = await res.json()

      if (data.firm?.name) {
        // Already onboarded → redirect to dashboard
        router.push('/dashboard')
        return
      }

      if (data.firm) {
        // Firm exists (partial) → pre-fill
        setFirmId(data.firm.id)
        if (data.firm.name) setName(data.firm.name)
        if (data.firm.lawyer_name) setLawyerName(data.firm.lawyer_name)
        if (data.firm.phone) setPhone(data.firm.phone)
        if (data.firm.notify_email) setNotifyEmail(data.firm.notify_email)
      }

      setInitializing(false)
    }
    checkOnboarding()
  }, [router])

  async function getToken() {
    const { data: { session } } = await supabaseBrowser.auth.getSession()
    return session?.access_token ?? null
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const token = await getToken()
    if (!token) { router.push('/login'); return }

    const payload = {
      name,
      lawyer_name: lawyerName,
      phone,
      notify_email: notifyEmail,
    }

    if (firmId) {
      // Firm already exists → PATCH
      const res = await fetch('/api/dashboard/onboarding', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const data = await res.json()
        setError(data.error ?? '오류가 발생했습니다.')
        setLoading(false)
        return
      }
      setComplete(true)
      setLoading(false)
      return
    }

    // POST to create new firm + subscription
    const res = await fetch('/api/dashboard/onboarding', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(payload),
    })

    if (!res.ok) {
      const data = await res.json()

      if (res.status === 409) {
        // Firm created in background → PATCH
        await fetch('/api/dashboard/onboarding', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify(payload),
        })
        setComplete(true)
        setLoading(false)
        return
      }

      setError(data.error ?? '오류가 발생했습니다.')
      setLoading(false)
      return
    }

    setComplete(true)
    setLoading(false)
  }

  if (initializing) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#f3f5fa' }}>
        <div className="w-6 h-6 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: '#1a2b5a', borderTopColor: 'transparent' }} />
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: '#f3f5fa' }}>
      <div className="w-full max-w-lg">
        <div className="text-center mb-6">
          <CaseFrontLogo />
          <p className="text-slate-500 text-sm mt-1">
            {complete ? '' : '사무소 정보를 입력하고 시작하세요'}
          </p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          {!complete ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <h2 className="text-lg font-bold text-slate-900 mb-4">사무소 정보</h2>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  사무소명 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="예: 김철수 법률사무소"
                  required
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:border-transparent"
                  style={{ '--tw-ring-color': '#4a7aef' } as React.CSSProperties}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  변호사 이름 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={lawyerName}
                  onChange={(e) => setLawyerName(e.target.value)}
                  placeholder="예: 김철수"
                  required
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:border-transparent"
                  style={{ '--tw-ring-color': '#4a7aef' } as React.CSSProperties}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  전화번호 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="예: 02-1234-5678"
                  required
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:border-transparent"
                  style={{ '--tw-ring-color': '#4a7aef' } as React.CSSProperties}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  알림 이메일 <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  value={notifyEmail}
                  onChange={(e) => setNotifyEmail(e.target.value)}
                  placeholder="분석 완료 알림을 받을 이메일"
                  required
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:border-transparent"
                  style={{ '--tw-ring-color': '#4a7aef' } as React.CSSProperties}
                />
                {notifyEmail === userEmail && (
                  <p className="text-xs text-slate-400 mt-1">로그인 이메일과 동일합니다</p>
                )}
              </div>

              {error && <p className="text-red-500 text-sm">{error}</p>}

              <button
                type="submit"
                disabled={loading}
                className="w-full text-white py-2.5 rounded-lg text-sm font-medium disabled:opacity-50 mt-2"
                style={{ background: '#1a2b5a' }}
              >
                {loading ? '처리 중...' : '시작하기'}
              </button>
            </form>
          ) : (
            /* Complete */
            <div className="text-center space-y-5">
              <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto" style={{ background: '#f0fdf4' }}>
                <svg className="w-8 h-8 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900">설정이 완료되었습니다!</h2>
                <p className="text-sm text-slate-500 mt-1">무료 체험으로 상담 1건 (최대 30분)을 분석할 수 있습니다.</p>
              </div>

              <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 text-left space-y-2">
                <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">무료 체험 안내</p>
                <ul className="text-sm text-slate-600 space-y-1">
                  <li>• 상담 녹음 1건 무료 분석 (최대 30분)</li>
                  <li>• AI가 스크립트 + 사건 리포트를 자동 생성</li>
                  <li>• 신용카드 등록 없이 바로 시작</li>
                </ul>
              </div>

              <button
                onClick={() => router.push('/dashboard')}
                className="w-full text-white py-2.5 rounded-lg text-sm font-medium"
                style={{ background: '#1a2b5a' }}
              >
                대시보드로 이동 →
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

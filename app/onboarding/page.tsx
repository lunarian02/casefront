'use client'
import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabaseBrowser } from '@/lib/supabaseClient'

const SPECIALTIES = ['민사', '형사', '가사', '교통사고', '부동산', '상속', '이혼', '노동', '도산', '성범죄', '행정', '기타']

const STEPS = ['사무소 기본정보', '전문분야', '로고/사진', 'AI 인사말', '완료']

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
  const [step, setStep] = useState(1)
  const [firmId, setFirmId] = useState<string | null>(null)
  const [firmSlug, setFirmSlug] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [initializing, setInitializing] = useState(true)
  const [error, setError] = useState('')

  // Step 1
  const [name, setName] = useState('')
  const [lawyerName, setLawyerName] = useState('')
  const [phone, setPhone] = useState('')
  const [hours, setHours] = useState('평일 09:00-18:00')

  // Step 2
  const [specialties, setSpecialties] = useState<string[]>([])

  // Step 3
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Step 4
  const [greeting, setGreeting] = useState('')

  // Step 5
  const [copied, setCopied] = useState(false)

  // On mount: check if already onboarded
  useEffect(() => {
    async function checkOnboarding() {
      const { data: { session } } = await supabaseBrowser.auth.getSession()
      if (!session) {
        router.push('/login')
        return
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
        // Firm exists (partial, e.g. from Google OAuth flow) → pre-fill
        setFirmId(data.firm.id)
        setFirmSlug(data.firm.slug)
        if (data.firm.name) setName(data.firm.name)
        if (data.firm.lawyer_name) setLawyerName(data.firm.lawyer_name)
        if (data.firm.specialties?.length) setSpecialties(data.firm.specialties)
        if (data.firm.greeting) setGreeting(data.firm.greeting)
      }

      setInitializing(false)
    }
    checkOnboarding()
  }, [router])

  async function getToken() {
    const { data: { session } } = await supabaseBrowser.auth.getSession()
    return session?.access_token ?? null
  }

  async function handleStep1(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const token = await getToken()
    if (!token) { router.push('/login'); return }

    const defaultGreeting = `안녕하세요, ${name}입니다. 어떤 일로 연락 주셨나요?`

    if (firmId) {
      // Firm already exists → PATCH
      const res = await fetch('/api/dashboard/onboarding', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name, lawyer_name: lawyerName, phone, hours }),
      })
      if (!res.ok) {
        const data = await res.json()
        setError(data.error ?? '오류가 발생했습니다.')
        setLoading(false)
        return
      }
      if (!greeting) setGreeting(defaultGreeting)
      setStep(2)
      setLoading(false)
      return
    }

    // POST to create new firm
    const res = await fetch('/api/dashboard/onboarding', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ name, lawyer_name: lawyerName, phone, hours }),
    })

    if (!res.ok) {
      const data = await res.json()

      if (res.status === 409) {
        // Firm created in background → PATCH with the entered data
        await fetch('/api/dashboard/onboarding', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ name, lawyer_name: lawyerName, phone, hours }),
        })
        const checkRes = await fetch('/api/dashboard/onboarding', {
          headers: { Authorization: `Bearer ${token}` },
        })
        const checkData = await checkRes.json()
        if (checkData.firm) {
          setFirmId(checkData.firm.id)
          setFirmSlug(checkData.firm.slug)
          if (!greeting) setGreeting(defaultGreeting)
          setStep(2)
          setLoading(false)
          return
        }
      }

      setError(data.error ?? '오류가 발생했습니다.')
      setLoading(false)
      return
    }

    const data = await res.json()
    setFirmId(data.firm.id)
    setFirmSlug(data.firm.slug)
    if (!greeting) setGreeting(defaultGreeting)
    setStep(2)
    setLoading(false)
  }

  async function handleStep2() {
    if (specialties.length === 0) {
      setError('전문분야를 최소 1개 이상 선택해주세요.')
      return
    }
    setLoading(true)
    setError('')
    const token = await getToken()
    if (!token) { router.push('/login'); return }

    await fetch('/api/dashboard/onboarding', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ specialties }),
    })

    setStep(3)
    setLoading(false)
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setLogoFile(file)
    const reader = new FileReader()
    reader.onload = (ev) => setLogoPreview(ev.target?.result as string)
    reader.readAsDataURL(file)
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (!file || !file.type.startsWith('image/')) return
    setLogoFile(file)
    const reader = new FileReader()
    reader.onload = (ev) => setLogoPreview(ev.target?.result as string)
    reader.readAsDataURL(file)
  }

  async function handleStep3() {
    setLoading(true)
    setError('')

    if (logoFile) {
      const token = await getToken()
      if (!token) { router.push('/login'); return }

      const formData = new FormData()
      formData.append('file', logoFile)

      const res = await fetch('/api/dashboard/onboarding/logo', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      })

      if (!res.ok) {
        const data = await res.json()
        setError(data.error ?? '업로드 실패')
        setLoading(false)
        return
      }
    }

    setStep(4)
    setLoading(false)
  }

  async function handleStep4() {
    setLoading(true)
    setError('')
    const token = await getToken()
    if (!token) { router.push('/login'); return }

    await fetch('/api/dashboard/onboarding', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ greeting }),
    })

    setStep(5)
    setLoading(false)
  }

  function handleCopyLink() {
    navigator.clipboard.writeText(chatLink)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const chatLink = firmSlug ? `https://chat.casefront.app/${firmSlug}` : ''
  const defaultGreeting = `안녕하세요, ${name || '사무소'}입니다. 어떤 일로 연락 주셨나요?`

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
          <p className="text-slate-500 text-sm mt-1">사무소 설정을 완료하고 시작하세요</p>
        </div>

        {/* Progress */}
        <div className="flex items-center justify-between mb-6 px-2">
          {STEPS.map((label, i) => {
            const num = i + 1
            const done = step > num
            const active = step === num
            return (
              <div key={num} className="flex flex-col items-center flex-1">
                <div className="flex items-center w-full">
                  {i > 0 && (
                    <div className="flex-1 h-px" style={{ background: done || active ? '#1a2b5a' : '#e2e8f0' }} />
                  )}
                  <div
                    className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                    style={{
                      background: done ? '#1a2b5a' : active ? '#4a7aef' : '#e2e8f0',
                      color: done || active ? '#fff' : '#94a3b8',
                    }}
                  >
                    {done ? '✓' : num}
                  </div>
                  {i < STEPS.length - 1 && (
                    <div className="flex-1 h-px" style={{ background: done ? '#1a2b5a' : '#e2e8f0' }} />
                  )}
                </div>
                <span className="text-xs mt-1 text-center hidden sm:block" style={{ color: active ? '#1a2b5a' : '#94a3b8' }}>
                  {label}
                </span>
              </div>
            )
          })}
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          {/* Step 1 */}
          {step === 1 && (
            <form onSubmit={handleStep1} className="space-y-4">
              <h2 className="text-lg font-bold text-slate-900 mb-4">사무소 기본정보</h2>
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
                <label className="block text-sm font-medium text-slate-700 mb-1.5">전화번호</label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="예: 02-1234-5678"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:border-transparent"
                  style={{ '--tw-ring-color': '#4a7aef' } as React.CSSProperties}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">영업시간</label>
                <input
                  type="text"
                  value={hours}
                  onChange={(e) => setHours(e.target.value)}
                  placeholder="예: 평일 09:00-18:00"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:border-transparent"
                  style={{ '--tw-ring-color': '#4a7aef' } as React.CSSProperties}
                />
              </div>
              {error && <p className="text-red-500 text-sm">{error}</p>}
              <button
                type="submit"
                disabled={loading}
                className="w-full text-white py-2.5 rounded-lg text-sm font-medium disabled:opacity-50 mt-2"
                style={{ background: '#1a2b5a' }}
              >
                {loading ? '처리 중...' : '다음 →'}
              </button>
            </form>
          )}

          {/* Step 2 */}
          {step === 2 && (
            <div className="space-y-4">
              <h2 className="text-lg font-bold text-slate-900 mb-4">전문분야 선택</h2>
              <p className="text-sm text-slate-500">해당하는 전문분야를 모두 선택해주세요. (최소 1개)</p>
              <div className="grid grid-cols-3 gap-2">
                {SPECIALTIES.map((s) => {
                  const checked = specialties.includes(s)
                  return (
                    <button
                      key={s}
                      onClick={() =>
                        setSpecialties((prev) =>
                          checked ? prev.filter((x) => x !== s) : [...prev, s]
                        )
                      }
                      className="px-3 py-2 rounded-lg text-sm font-medium border transition-colors"
                      style={
                        checked
                          ? { background: '#1a2b5a', color: '#fff', borderColor: '#1a2b5a' }
                          : { background: '#fff', color: '#475569', borderColor: '#e2e8f0' }
                      }
                    >
                      {s}
                    </button>
                  )
                })}
              </div>
              {error && <p className="text-red-500 text-sm">{error}</p>}
              <div className="flex gap-3 mt-4">
                <button
                  onClick={() => setStep(1)}
                  className="flex-1 py-2.5 rounded-lg text-sm font-medium border border-slate-200 text-slate-600"
                >
                  ← 이전
                </button>
                <button
                  onClick={handleStep2}
                  disabled={loading}
                  className="flex-1 text-white py-2.5 rounded-lg text-sm font-medium disabled:opacity-50"
                  style={{ background: '#1a2b5a' }}
                >
                  {loading ? '처리 중...' : '다음 →'}
                </button>
              </div>
            </div>
          )}

          {/* Step 3 */}
          {step === 3 && (
            <div className="space-y-4">
              <h2 className="text-lg font-bold text-slate-900 mb-1">로고/사진 업로드</h2>
              <p className="text-sm text-slate-500">
                고객이 채팅 접속 시 상단에 표시됩니다. 고객에게 신뢰감을 줄 수 있어요.
              </p>

              {/* Drop zone */}
              <div
                className="border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors"
                style={{ borderColor: dragOver ? '#4a7aef' : '#e2e8f0', background: dragOver ? '#f0f5ff' : '#fff' }}
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
              >
                {logoPreview ? (
                  <div className="flex flex-col items-center gap-3">
                    <img src={logoPreview} alt="미리보기" className="w-24 h-24 object-cover rounded-xl" />
                    <p className="text-sm text-slate-500">클릭하거나 드래그하여 변경</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2 text-slate-400">
                    <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                        d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <p className="text-sm font-medium">클릭하거나 드래그하여 파일 선택</p>
                    <p className="text-xs">JPG, PNG (권장: 500×500px)</p>
                  </div>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileChange}
              />

              {/* Chat header preview */}
              {logoPreview && (
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <p className="text-xs font-medium text-slate-400 px-4 pt-3 pb-2 uppercase tracking-wider">채팅 상단 미리보기</p>
                  <div className="px-4 pb-4">
                    <div className="rounded-xl border border-slate-200 overflow-hidden">
                      <div className="flex items-center gap-3 px-4 py-3" style={{ background: '#0f1629' }}>
                        <img src={logoPreview} alt="logo" className="w-9 h-9 rounded-lg object-cover flex-shrink-0" />
                        <div>
                          <p className="text-sm font-semibold text-white leading-tight">{name || '사무소명'}</p>
                          <p className="text-xs" style={{ color: '#8aa4cc' }}>AI 법률 상담</p>
                        </div>
                      </div>
                      <div className="px-4 py-3 bg-slate-50">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg flex-shrink-0" style={{ background: '#1a2b5a' }} />
                          <div className="bg-white rounded-xl rounded-tl-sm px-3 py-1.5 text-xs text-slate-600 border border-slate-200">
                            안녕하세요 👋 무엇을 도와드릴까요?
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <p className="text-xs text-slate-400 text-center">선택사항 — 미등록 시 CaseFront 기본 아이콘 사용</p>
              {error && <p className="text-red-500 text-sm">{error}</p>}
              <div className="flex gap-3">
                <button
                  onClick={() => setStep(2)}
                  className="flex-1 py-2.5 rounded-lg text-sm font-medium border border-slate-200 text-slate-600"
                >
                  ← 이전
                </button>
                <button
                  onClick={() => setStep(4)}
                  className="flex-1 py-2.5 rounded-lg text-sm font-medium border border-slate-200 text-slate-600"
                >
                  건너뛰기
                </button>
                <button
                  onClick={handleStep3}
                  disabled={loading || !logoFile}
                  className="flex-1 text-white py-2.5 rounded-lg text-sm font-medium disabled:opacity-50"
                  style={{ background: '#1a2b5a' }}
                >
                  {loading ? '업로드 중...' : '다음 →'}
                </button>
              </div>
            </div>
          )}

          {/* Step 4 */}
          {step === 4 && (
            <div className="space-y-4">
              <h2 className="text-lg font-bold text-slate-900 mb-1">AI 인사말 설정</h2>
              <p className="text-sm text-slate-500">고객이 채팅을 시작할 때 처음 보게 될 인사말입니다.</p>
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-sm font-medium text-slate-700">인사말</label>
                  <button
                    type="button"
                    onClick={() => setGreeting(defaultGreeting)}
                    className="text-xs px-2 py-1 rounded border border-slate-200 text-slate-500 hover:bg-slate-50 transition-colors"
                  >
                    기본값 사용
                  </button>
                </div>
                <textarea
                  value={greeting}
                  onChange={(e) => setGreeting(e.target.value)}
                  rows={3}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:border-transparent resize-none"
                  style={{ '--tw-ring-color': '#4a7aef' } as React.CSSProperties}
                />
              </div>
              {/* Preview */}
              <div className="border border-slate-200 rounded-xl p-4 bg-slate-50">
                <p className="text-xs font-medium text-slate-400 mb-3 uppercase tracking-wider">미리보기</p>
                <div className="flex items-start gap-2.5">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: '#1a2b5a' }}>
                    <svg width="16" height="18" viewBox="0 0 44 48" fill="none">
                      <path d="M13 4H7C5.34 4 4 5.34 4 7V41C4 42.66 5.34 44 7 44H13" stroke="white" strokeWidth="3" strokeLinecap="round"/>
                      <path d="M31 4H37C38.66 4 40 5.34 40 7V41C40 42.66 38.66 44 37 44H31" stroke="white" strokeWidth="3" strokeLinecap="round"/>
                      <line x1="14" y1="17" x2="30" y2="17" stroke="white" strokeWidth="2" strokeLinecap="round"/>
                    </svg>
                  </div>
                  <div className="bg-white rounded-xl rounded-tl-sm px-3 py-2 text-sm text-slate-800 border border-slate-200 max-w-xs">
                    {greeting || '인사말을 입력해주세요.'}
                  </div>
                </div>
              </div>
              {error && <p className="text-red-500 text-sm">{error}</p>}
              <div className="flex gap-3">
                <button
                  onClick={() => setStep(3)}
                  className="flex-1 py-2.5 rounded-lg text-sm font-medium border border-slate-200 text-slate-600"
                >
                  ← 이전
                </button>
                <button
                  onClick={handleStep4}
                  disabled={loading}
                  className="flex-1 text-white py-2.5 rounded-lg text-sm font-medium disabled:opacity-50"
                  style={{ background: '#1a2b5a' }}
                >
                  {loading ? '저장 중...' : '완료'}
                </button>
              </div>
            </div>
          )}

          {/* Step 5 — Complete */}
          {step === 5 && (
            <div className="text-center space-y-5">
              <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto" style={{ background: '#f0fdf4' }}>
                <svg className="w-8 h-8 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900">설정이 완료되었습니다!</h2>
                <p className="text-sm text-slate-500 mt-1">이제 고객이 아래 링크로 상담을 시작할 수 있어요.</p>
              </div>

              <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                <p className="text-xs font-medium text-slate-400 mb-2 uppercase tracking-wider">채팅 링크</p>
                <p className="text-sm font-mono text-slate-700 break-all">{chatLink}</p>
                <button
                  onClick={handleCopyLink}
                  className="mt-3 text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors"
                  style={
                    copied
                      ? { background: '#1a2b5a', color: '#fff', borderColor: '#1a2b5a' }
                      : { background: '#fff', color: '#475569', borderColor: '#e2e8f0' }
                  }
                >
                  {copied ? '✓ 복사됨' : '링크 복사'}
                </button>
              </div>

              <p className="text-sm text-slate-500">
                이 링크를 홈페이지나 명함에 넣으시면 고객이 바로 접수를 시작할 수 있어요.
              </p>

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

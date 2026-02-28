'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabaseBrowser } from '@/lib/supabaseClient'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [forgotMode, setForgotMode] = useState(false)
  const [resetSent, setResetSent] = useState(false)

  // Redirect if already logged in
  useEffect(() => {
    supabaseBrowser.auth.getSession().then(({ data: { session } }) => {
      if (session) router.push('/dashboard')
    })
  }, [router])

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { data, error } = await supabaseBrowser.auth.signInWithPassword({ email, password })

    if (error) {
      setError('이메일 또는 비밀번호가 올바르지 않습니다.')
      setLoading(false)
      return
    }

    const token = data.session?.access_token
    if (token) {
      const res = await fetch('/api/dashboard/onboarding', {
        headers: { Authorization: `Bearer ${token}` },
      })
      const result = await res.json()
      if (!result.firm?.name) {
        router.push('/onboarding')
        return
      }
    }

    router.push('/dashboard')
  }

  async function handleGoogleLogin() {
    await supabaseBrowser.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    })
  }

  async function handleForgotPassword(e: React.FormEvent) {
    e.preventDefault()
    if (!email) {
      setError('이메일을 입력해주세요.')
      return
    }
    setLoading(true)
    setError('')

    const { error } = await supabaseBrowser.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback`,
    })

    if (error) {
      setError('비밀번호 재설정 이메일 발송에 실패했습니다. 다시 시도해주세요.')
      setLoading(false)
      return
    }

    setResetSent(true)
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: '#f3f5fa' }}>
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2.5 mb-3">
            <svg width="32" height="32" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect width="64" height="64" rx="14" fill="#1a2b5a"/>
              <path d="M23 14H17.5C15.57 14 14 15.57 14 17.5V46.5C14 48.43 15.57 50 17.5 50H23" stroke="#e8ecf4" strokeWidth="3.5" strokeLinecap="round"/>
              <path d="M41 14H46.5C48.43 14 50 15.57 50 17.5V46.5C50 48.43 48.43 50 46.5 50H41" stroke="#e8ecf4" strokeWidth="3.5" strokeLinecap="round"/>
              <line x1="24" y1="26" x2="40" y2="26" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round"/>
              <line x1="24" y1="33" x2="36" y2="33" stroke="#8aa4cc" strokeWidth="2" strokeLinecap="round" opacity="0.6"/>
              <line x1="24" y1="40" x2="38" y2="40" stroke="#8aa4cc" strokeWidth="2" strokeLinecap="round" opacity="0.35"/>
            </svg>
            <span style={{ fontFamily: "Georgia, 'Times New Roman', serif", fontSize: 22, fontWeight: 600, color: '#1a1f36', letterSpacing: '-0.3px' }}>
              CaseFront
            </span>
          </div>
          <p className="text-slate-500 text-sm">변호사 대시보드</p>
        </div>

        {/* Forgot password mode */}
        {forgotMode ? (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-4">
            {resetSent ? (
              <div className="text-center space-y-3 py-2">
                <div className="w-10 h-10 rounded-full flex items-center justify-center mx-auto" style={{ background: '#eff6ff' }}>
                  <svg className="w-5 h-5" style={{ color: '#3b82f6' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                <p className="text-sm font-medium text-slate-700">이메일을 확인해주세요</p>
                <p className="text-xs text-slate-500">비밀번호 재설정 링크를 발송했습니다.</p>
                <button
                  onClick={() => { setForgotMode(false); setResetSent(false) }}
                  className="text-sm font-medium"
                  style={{ color: '#4a7aef' }}
                >
                  로그인으로 돌아가기
                </button>
              </div>
            ) : (
              <form onSubmit={handleForgotPassword} className="space-y-4">
                <div>
                  <h3 className="text-base font-bold text-slate-900 mb-1">비밀번호 재설정</h3>
                  <p className="text-xs text-slate-500">가입하신 이메일로 재설정 링크를 보내드립니다.</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">이메일</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:border-transparent"
                    style={{ '--tw-ring-color': '#4a7aef' } as React.CSSProperties}
                    placeholder="lawyer@example.com"
                    required
                  />
                </div>
                {error && <p className="text-red-500 text-sm">{error}</p>}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full text-white py-2.5 rounded-lg text-sm font-medium disabled:opacity-50"
                  style={{ background: '#1a2b5a' }}
                >
                  {loading ? '발송 중...' : '재설정 링크 발송'}
                </button>
                <button
                  type="button"
                  onClick={() => { setForgotMode(false); setError('') }}
                  className="w-full text-sm text-slate-500 hover:text-slate-700"
                >
                  ← 로그인으로 돌아가기
                </button>
              </form>
            )}
          </div>
        ) : (
          /* Login mode */
          <form
            onSubmit={handleLogin}
            className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-4"
          >
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">이메일</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:border-transparent transition-shadow"
                style={{ '--tw-ring-color': '#4a7aef' } as React.CSSProperties}
                placeholder="lawyer@example.com"
                required
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-sm font-medium text-slate-700">비밀번호</label>
                <button
                  type="button"
                  onClick={() => { setForgotMode(true); setError('') }}
                  className="text-xs"
                  style={{ color: '#4a7aef' }}
                >
                  비밀번호를 잊으셨나요?
                </button>
              </div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:border-transparent transition-shadow"
                style={{ '--tw-ring-color': '#4a7aef' } as React.CSSProperties}
                placeholder="••••••••"
                required
              />
            </div>

            {error && <p className="text-red-500 text-sm">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full text-white py-2.5 rounded-lg text-sm font-medium disabled:opacity-50 transition-colors"
              style={{ background: '#1a2b5a' }}
            >
              {loading ? '로그인 중...' : '로그인'}
            </button>

            <div className="relative py-1">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-200" />
              </div>
              <div className="relative flex justify-center">
                <span className="bg-white px-3 text-xs text-slate-400">또는</span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleGoogleLogin}
              className="w-full flex items-center justify-center gap-2.5 py-2.5 rounded-lg text-sm font-medium border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors"
            >
              <svg width="18" height="18" viewBox="0 0 48 48">
                <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"/>
                <path fill="#FF3D00" d="m6.306 14.691 6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"/>
                <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0 1 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"/>
                <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 0 1-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"/>
              </svg>
              Google로 로그인
            </button>

            <p className="text-center text-sm text-slate-500">
              계정이 없으신가요?{' '}
              <Link href="/signup" className="font-medium" style={{ color: '#4a7aef' }}>
                가입하기
              </Link>
            </p>
          </form>
        )}
      </div>
    </div>
  )
}

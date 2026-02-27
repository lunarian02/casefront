'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabaseBrowser } from '@/lib/supabaseClient'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

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

    // Check if onboarding is done (firm exists)
    const token = data.session?.access_token
    if (token) {
      const res = await fetch('/api/dashboard/onboarding', {
        headers: { Authorization: `Bearer ${token}` },
      })
      const result = await res.json()
      if (!result.firm) {
        router.push('/onboarding')
        return
      }
    }

    router.push('/dashboard')
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: '#f3f5fa' }}>
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          {/* CaseFront logo */}
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
            <label className="block text-sm font-medium text-slate-700 mb-1.5">비밀번호</label>
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
            style={{ background: loading ? '#1a2b5a99' : '#1a2b5a' }}
          >
            {loading ? '로그인 중...' : '로그인'}
          </button>
        </form>
      </div>
    </div>
  )
}

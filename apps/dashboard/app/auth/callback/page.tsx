'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabaseBrowser } from '@/lib/supabaseClient'

export default function AuthCallbackPage() {
  const router = useRouter()
  const [message, setMessage] = useState('로그인 처리 중...')

  useEffect(() => {
    async function handlePostAuth(accessToken: string) {
      const res = await fetch('/api/dashboard/onboarding', {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      const data = await res.json()

      if (!data.firm?.name) {
        router.push('/onboarding')
      } else {
        router.push('/dashboard')
      }
    }

    // Supabase auto-processes code/token_hash in URL with detectSessionInUrl (default)
    // Check if session is already established
    supabaseBrowser.auth.getSession().then(async ({ data: { session } }) => {
      if (session) {
        await handlePostAuth(session.access_token)
        return
      }

      // Not yet — listen for auth state change (Supabase is still processing)
      const { data: { subscription } } = supabaseBrowser.auth.onAuthStateChange(
        async (event, session) => {
          if (event === 'SIGNED_IN' && session) {
            subscription.unsubscribe()
            await handlePostAuth(session.access_token)
          } else if (event === 'PASSWORD_RECOVERY' && session) {
            subscription.unsubscribe()
            router.push('/auth/reset-password')
          }
        }
      )

      // Timeout fallback
      const timer = setTimeout(() => {
        subscription.unsubscribe()
        setMessage('오류가 발생했습니다. 다시 시도해주세요.')
        setTimeout(() => router.push('/login'), 2000)
      }, 10000)

      return () => {
        clearTimeout(timer)
        subscription.unsubscribe()
      }
    })
  }, [router])

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-3" style={{ background: '#f3f5fa' }}>
      <div
        className="w-6 h-6 rounded-full border-2 border-t-transparent animate-spin"
        style={{ borderColor: '#1a2b5a', borderTopColor: 'transparent' }}
      />
      <p className="text-sm text-slate-500">{message}</p>
    </div>
  )
}

'use client'
import { useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/hooks/useAuth'
import { supabaseBrowser } from '@/lib/supabaseClient'

function SidebarIcon() {
  return (
    <svg width="24" height="28" viewBox="0 0 44 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M13 4H7C5.34 4 4 5.34 4 7V41C4 42.66 5.34 44 7 44H13" stroke="white" strokeWidth="3" strokeLinecap="round"/>
      <path d="M31 4H37C38.66 4 40 5.34 40 7V41C40 42.66 38.66 44 37 44H31" stroke="white" strokeWidth="3" strokeLinecap="round"/>
      <line x1="14" y1="17" x2="30" y2="17" stroke="white" strokeWidth="2" strokeLinecap="round"/>
      <line x1="14" y1="24" x2="26" y2="24" stroke="rgba(138,164,204,0.7)" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  )
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, session, loading } = useAuth()
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    if (loading) return
    if (!user) {
      router.push('/login')
      return
    }
    // Check if onboarding is done
    const token = session?.access_token
    if (!token) return
    fetch('/api/dashboard/onboarding', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data) => {
        if (!data.firm) router.push('/onboarding')
      })
      .catch(() => {})
  }, [user, session, loading, router])

  async function handleLogout() {
    await supabaseBrowser.auth.signOut()
    router.push('/login')
  }

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#f3f5fa' }}>
        <div className="w-6 h-6 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: '#1a2b5a', borderTopColor: 'transparent' }} />
      </div>
    )
  }

  const navItems = [
    {
      href: '/dashboard',
      label: '사건 목록',
      exact: true,
      icon: (
        <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
      ),
    },
    {
      href: '/dashboard/clients',
      label: '고객 목록',
      exact: false,
      icon: (
        <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
    },
    {
      href: '/dashboard/settings',
      label: '사무소 설정',
      exact: false,
      icon: (
        <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
    },
  ]

  return (
    <div className="flex h-screen" style={{ background: '#f3f5fa' }}>
      {/* Sidebar */}
      <aside className="w-56 flex flex-col shrink-0" style={{ background: '#0f1629' }}>
        {/* Brand */}
        <div className="flex items-center gap-2.5 px-5 py-5" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
          <SidebarIcon />
          <div>
            <div className="text-white font-semibold text-sm leading-tight">CaseFront</div>
            <div className="text-xs leading-tight" style={{ color: '#4a6fa5' }}>변호사 대시보드</div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-3 space-y-0.5">
          {navItems.map((item) => {
            const isActive = item.exact ? pathname === item.href : pathname.startsWith(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors"
                style={
                  isActive
                    ? { background: '#1a2b5a', color: '#ffffff' }
                    : { color: '#8aa4cc' }
                }
                onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.color = '#ffffff' }}
                onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.color = '#8aa4cc' }}
              >
                {item.icon}
                {item.label}
              </Link>
            )
          })}
        </nav>

        {/* Footer */}
        <div className="px-4 py-4" style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
          <p className="text-xs truncate" style={{ color: '#4a6fa5' }}>{user.email}</p>
          <button
            onClick={handleLogout}
            className="mt-1.5 text-xs transition-colors"
            style={{ color: '#4a6fa5' }}
            onMouseEnter={(e) => (e.currentTarget.style.color = '#8aa4cc')}
            onMouseLeave={(e) => (e.currentTarget.style.color = '#4a6fa5')}
          >
            로그아웃
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  )
}

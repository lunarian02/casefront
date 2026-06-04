'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams } from 'next/navigation'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

function AvatarCircle({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg" className="shrink-0">
      <circle cx="60" cy="60" r="60" fill="#1a2b5a"/>
      <path d="M42 32H34C31.24 32 29 34.24 29 37V83C29 85.76 31.24 88 34 88H42" stroke="#e8ecf4" strokeWidth="4.5" strokeLinecap="round"/>
      <path d="M78 32H86C88.76 32 91 34.24 91 37V83C91 85.76 88.76 88 86 88H78" stroke="#e8ecf4" strokeWidth="4.5" strokeLinecap="round"/>
      <circle cx="46" cy="52" r="4" fill="#ffffff"/>
      <circle cx="74" cy="52" r="4" fill="#ffffff"/>
      <path d="M46 68C50 74 70 74 74 68" stroke="#8aa4cc" strokeWidth="3" strokeLinecap="round" fill="none"/>
    </svg>
  )
}

function BracketIcon() {
  return (
    <svg width="22" height="26" viewBox="0 0 44 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M13 4H7C5.34 4 4 5.34 4 7V41C4 42.66 5.34 44 7 44H13" stroke="white" strokeWidth="3.5" strokeLinecap="round"/>
      <path d="M31 4H37C38.66 4 40 5.34 40 7V41C40 42.66 38.66 44 37 44H31" stroke="white" strokeWidth="3.5" strokeLinecap="round"/>
      <line x1="14" y1="17" x2="30" y2="17" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
      <line x1="14" y1="24" x2="26" y2="24" stroke="rgba(138,164,204,0.7)" strokeWidth="2" strokeLinecap="round"/>
      <line x1="14" y1="31" x2="28" y2="31" stroke="rgba(138,164,204,0.4)" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  )
}

export default function ChatPage() {
  const params = useParams()
  const slug = params.slug as string

  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [completed, setCompleted] = useState(false)
  const [firmName, setFirmName] = useState('')
  const [userId] = useState(() => {
    if (typeof window === 'undefined') return crypto.randomUUID()
    const stored = sessionStorage.getItem('cf_user_id')
    if (stored) return stored
    const id = crypto.randomUUID()
    sessionStorage.setItem('cf_user_id', id)
    return id
  })

  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    async function init() {
      setLoading(true)
      try {
        const res = await fetch('/api/chat/message', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ firmSlug: slug, userId, content: '__init__' }),
        })
        const data = await res.json()
        if (data.reply) {
          setMessages([{ role: 'assistant', content: data.reply }])
          setFirmName(data.firmName || 'CaseFront')
        }
      } catch {
        setMessages([{ role: 'assistant', content: '안녕하세요! AI 법률 접수 비서입니다. 어떤 법률 문제로 오셨나요?' }])
      } finally {
        setLoading(false)
      }
    }
    init()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  async function send(text: string) {
    if (!text.trim() || loading || completed) return

    setInput('')
    setMessages((prev) => [...prev, { role: 'user', content: text }])
    setLoading(true)

    try {
      const res = await fetch('/api/chat/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ firmSlug: slug, userId, content: text }),
      })
      const data = await res.json()

      if (data.error) {
        setMessages((prev) => [...prev, { role: 'assistant', content: data.error }])
      } else {
        setMessages((prev) => [...prev, { role: 'assistant', content: data.reply }])
        if (data.completed) setCompleted(true)
      }
    } catch {
      setMessages((prev) => [...prev, { role: 'assistant', content: '오류가 발생했습니다. 잠시 후 다시 시도해 주세요.' }])
    } finally {
      setLoading(false)
      inputRef.current?.focus()
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send(input)
    }
  }

  return (
    <div className="flex flex-col h-dvh" style={{ background: '#f3f5fa' }}>
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 shadow-sm" style={{ background: '#1a2b5a' }}>
        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'rgba(255,255,255,0.1)' }}>
          <BracketIcon />
        </div>
        <div className="min-w-0">
          <div className="font-semibold text-sm text-white truncate">{firmName || 'AI 접수 비서'}</div>
          <div className="text-xs" style={{ color: '#8aa4cc' }}>케이스프론트 · 법률 상담 접수</div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-3">
        {messages.map((msg, i) => (
          <div key={i} className={`flex items-end gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {msg.role === 'assistant' && <AvatarCircle size={32} />}
            <div
              className="max-w-[75%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap shadow-sm"
              style={
                msg.role === 'user'
                  ? { background: '#1a2b5a', color: '#ffffff', borderBottomRightRadius: 4 }
                  : { background: '#ffffff', color: '#1a1f36', borderBottomLeftRadius: 4 }
              }
            >
              {msg.content}
            </div>
          </div>
        ))}

        {/* Typing indicator */}
        {loading && (
          <div className="flex items-end gap-2 justify-start">
            <AvatarCircle size={32} />
            <div className="bg-white rounded-2xl px-4 py-3 shadow-sm" style={{ borderBottomLeftRadius: 4 }}>
              <div className="flex gap-1 items-center h-4">
                <span className="w-1.5 h-1.5 rounded-full animate-bounce [animation-delay:0ms]" style={{ background: '#8aa4cc' }} />
                <span className="w-1.5 h-1.5 rounded-full animate-bounce [animation-delay:150ms]" style={{ background: '#8aa4cc' }} />
                <span className="w-1.5 h-1.5 rounded-full animate-bounce [animation-delay:300ms]" style={{ background: '#8aa4cc' }} />
              </div>
            </div>
          </div>
        )}

        {/* Completion card */}
        {completed && (
          <div className="mx-2 mt-4 bg-white rounded-2xl p-5 shadow-sm text-center" style={{ border: '1px solid #e4e8f1' }}>
            <div className="w-12 h-12 rounded-full mx-auto mb-3 flex items-center justify-center" style={{ background: 'rgba(74,122,239,0.08)' }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#4a7aef" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20,6 9,17 4,12"/>
              </svg>
            </div>
            <div className="font-semibold text-sm" style={{ color: '#1a1f36' }}>접수가 완료되었습니다</div>
            <div className="text-xs mt-1" style={{ color: '#8b93ab' }}>변호사님께 전달되었습니다. 곧 연락 드리겠습니다.</div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="bg-white px-3 py-2.5 flex gap-2 items-center" style={{ borderTop: '1px solid #e4e8f1' }}>
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={completed ? '상담이 완료되었습니다' : '메시지를 입력하세요...'}
          disabled={completed || loading}
          className="flex-1 rounded-full px-4 py-2.5 text-sm outline-none disabled:opacity-50 transition-all"
          style={{ background: '#f3f5fa', color: '#1a1f36', border: '1px solid transparent' }}
          onFocus={(e) => (e.currentTarget.style.borderColor = '#4a7aef')}
          onBlur={(e) => (e.currentTarget.style.borderColor = 'transparent')}
        />
        <button
          onClick={() => send(input)}
          disabled={!input.trim() || loading || completed}
          className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 transition-opacity disabled:opacity-30"
          style={{ background: '#1a2b5a' }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
            <path d="M22 2L11 13" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M22 2L15 22L11 13L2 9L22 2Z" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>
    </div>
  )
}

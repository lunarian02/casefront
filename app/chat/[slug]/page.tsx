'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams } from 'next/navigation'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

const CASE_TYPE_OPTIONS = ['민사', '형사', '가사', '교통사고', '행정', '기타']

export default function ChatPage() {
  const params = useParams()
  const slug = params.slug as string

  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [completed, setCompleted] = useState(false)
  const [firmName, setFirmName] = useState('')
  const [showOptions, setShowOptions] = useState(false)
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
          setShowOptions(true)
        }
      } catch {
        setMessages([{
          role: 'assistant',
          content: '안녕하세요! AI 법률 접수 비서입니다. 어떤 법률 문제로 오셨나요?',
        }])
        setShowOptions(true)
      } finally {
        setLoading(false)
      }
    }
    init()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading, showOptions])

  async function send(text: string) {
    if (!text.trim() || loading || completed) return

    setShowOptions(false)
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
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: '오류가 발생했습니다. 잠시 후 다시 시도해 주세요.' },
      ])
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
    <div className="flex flex-col h-dvh bg-[#b2c7d9]">
      {/* Header */}
      <div className="bg-[#3c1e1e] text-white px-4 py-3 flex items-center gap-3 shadow-md">
        <div className="w-9 h-9 rounded-full bg-[#fee500] flex items-center justify-center text-[#3c1e1e] font-bold text-sm">
          AI
        </div>
        <div>
          <div className="font-semibold text-sm">{firmName || 'AI 접수 비서'}</div>
          <div className="text-xs text-gray-300">케이스프론트 · 법률 상담 접수</div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-2">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {msg.role === 'assistant' && (
              <div className="w-8 h-8 rounded-full bg-[#fee500] flex items-center justify-center text-[#3c1e1e] font-bold text-xs mr-2 mt-1 shrink-0">
                AI
              </div>
            )}
            <div
              className={`max-w-[75%] px-3 py-2 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap shadow-sm ${
                msg.role === 'user'
                  ? 'bg-[#fee500] text-[#1a1a1a] rounded-tr-sm'
                  : 'bg-white text-gray-800 rounded-tl-sm'
              }`}
            >
              {msg.content}
            </div>
          </div>
        ))}

        {/* Quick reply options — 첫 인사 후 표시 */}
        {showOptions && !loading && (
          <div className="flex justify-start pl-10">
            <div className="flex flex-wrap gap-2 max-w-[85%]">
              {CASE_TYPE_OPTIONS.map((opt) => (
                <button
                  key={opt}
                  onClick={() => send(opt)}
                  className="px-4 py-2 bg-white text-[#3c1e1e] text-sm font-medium rounded-full border-2 border-[#fee500] shadow-sm hover:bg-[#fee500] transition-colors active:scale-95"
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Typing indicator */}
        {loading && (
          <div className="flex justify-start">
            <div className="w-8 h-8 rounded-full bg-[#fee500] flex items-center justify-center text-[#3c1e1e] font-bold text-xs mr-2 mt-1 shrink-0">
              AI
            </div>
            <div className="bg-white rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm">
              <div className="flex gap-1 items-center h-4">
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:0ms]" />
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:150ms]" />
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:300ms]" />
              </div>
            </div>
          </div>
        )}

        {/* Completion card */}
        {completed && (
          <div className="mx-2 mt-4 bg-white rounded-2xl p-4 shadow text-center border border-green-100">
            <div className="text-2xl mb-2">✅</div>
            <div className="font-semibold text-gray-800">접수가 완료되었습니다</div>
            <div className="text-sm text-gray-500 mt-1">
              변호사님께 전달되었습니다. 곧 연락 드리겠습니다.
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="bg-white border-t border-gray-200 px-3 py-2 flex gap-2 items-center">
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={completed ? '상담이 완료되었습니다' : '메시지를 입력하세요...'}
          disabled={completed || loading}
          className="flex-1 bg-gray-100 rounded-full px-4 py-2 text-sm outline-none disabled:opacity-50 focus:ring-2 focus:ring-[#fee500]"
        />
        <button
          onClick={() => send(input)}
          disabled={!input.trim() || loading || completed}
          className="w-9 h-9 rounded-full bg-[#fee500] flex items-center justify-center disabled:opacity-40 transition-opacity shrink-0"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path d="M22 2L11 13" stroke="#1a1a1a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M22 2L15 22L11 13L2 9L22 2Z" stroke="#1a1a1a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>
    </div>
  )
}

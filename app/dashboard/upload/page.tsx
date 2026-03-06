'use client'
import { useState, useRef, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'

type ClientSuggestion = {
  id: string
  name: string
  phone: string
}

export default function UploadPage() {
  const { session } = useAuth()
  const router = useRouter()
  const [file, setFile] = useState<File | null>(null)
  const [clientName, setClientName] = useState('')
  const [memo, setMemo] = useState('')
  const [uploading, setUploading] = useState(false)
  const [dragActive, setDragActive] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [suggestions, setSuggestions] = useState<ClientSuggestion[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const ALLOWED_TYPES = ['audio/mpeg', 'audio/mp3', 'audio/mp4', 'audio/m4a', 'audio/wav', 'audio/ogg', 'audio/x-m4a']
  const ALLOWED_EXTENSIONS = ['.mp3', '.m4a', '.wav', '.ogg']
  const MAX_SIZE = 500 * 1024 * 1024 // 500MB

  // Fetch client suggestions
  useEffect(() => {
    if (!session || !clientName.trim() || clientName.length < 2) {
      setSuggestions([])
      return
    }
    const timer = setTimeout(() => {
      fetch(`/api/dashboard/clients/search?q=${encodeURIComponent(clientName)}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
        .then((r) => r.json())
        .then((data) => {
          setSuggestions(data.clients ?? [])
        })
        .catch(() => setSuggestions([]))
    }, 300)
    return () => clearTimeout(timer)
  }, [session, clientName])

  const validateFile = (f: File): string | null => {
    const ext = f.name.toLowerCase().match(/\.[^.]+$/)?.[0]
    if (!ext || !ALLOWED_EXTENSIONS.includes(ext)) {
      return `지원되지 않는 파일 형식입니다. (${ALLOWED_EXTENSIONS.join(', ')})`
    }
    if (f.size > MAX_SIZE) {
      return '파일 크기가 500MB를 초과합니다.'
    }
    return null
  }

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    setError(null)
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const f = e.dataTransfer.files[0]
      const err = validateFile(f)
      if (err) {
        setError(err)
        return
      }
      setFile(f)
    }
  }, [])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null)
    if (e.target.files && e.target.files[0]) {
      const f = e.target.files[0]
      const err = validateFile(f)
      if (err) {
        setError(err)
        e.target.value = ''
        return
      }
      setFile(f)
    }
  }

  const handleUpload = async () => {
    if (!file || !clientName.trim() || !session || uploading) return
    setUploading(true)
    setError(null)

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('client_name', clientName.trim())
      if (memo.trim()) {
        formData.append('memo', memo.trim())
      }

      const res = await fetch('/api/dashboard/upload', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: formData,
      })

      const data = await res.json()
      if (!res.ok) {
        setError(data.error || '업로드 실패')
        return
      }

      // Success: redirect to recordings list
      router.push('/dashboard/recordings')
    } catch (err) {
      setError('업로드 중 오류가 발생했습니다.')
    } finally {
      setUploading(false)
    }
  }

  const selectSuggestion = (s: ClientSuggestion) => {
    setClientName(s.name)
    setShowSuggestions(false)
    setSuggestions([])
  }

  const fileSizeMB = file ? (file.size / (1024 * 1024)).toFixed(1) : '0'

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-slate-900">녹음 업로드</h1>
        <p className="text-slate-500 text-sm mt-0.5">상담 녹음 파일을 업로드하여 AI 분석을 시작하세요</p>
      </div>

      <div className="space-y-5">
        {/* File Drop Zone */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">녹음 파일</label>
          <div
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`
              relative border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all
              ${dragActive ? 'border-blue-400 bg-blue-50' : 'border-slate-300 bg-white hover:border-slate-400 hover:bg-slate-50'}
            `}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept={ALLOWED_EXTENSIONS.join(',')}
              onChange={handleFileChange}
              className="hidden"
            />
            <svg className="w-10 h-10 mx-auto mb-3 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            {file ? (
              <div>
                <p className="text-sm font-medium text-slate-900">{file.name}</p>
                <p className="text-xs text-slate-500 mt-1">{fileSizeMB} MB</p>
                <button
                  onClick={(e) => { e.stopPropagation(); setFile(null) }}
                  className="mt-2 text-xs text-red-500 hover:text-red-700"
                >
                  파일 제거
                </button>
              </div>
            ) : (
              <div>
                <p className="text-sm font-medium text-slate-700">클릭하거나 파일을 드래그하세요</p>
                <p className="text-xs text-slate-500 mt-1">mp3, m4a, wav, ogg (최대 500MB)</p>
              </div>
            )}
          </div>
        </div>

        {/* Client Name */}
        <div className="relative">
          <label className="block text-sm font-medium text-slate-700 mb-2">
            의뢰인 이름 <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={clientName}
            onChange={(e) => {
              setClientName(e.target.value)
              setShowSuggestions(true)
            }}
            onFocus={() => setShowSuggestions(true)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
            className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="예: 김철수"
          />
          {showSuggestions && suggestions.length > 0 && (
            <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
              {suggestions.map((s) => (
                <button
                  key={s.id}
                  onClick={() => selectSuggestion(s)}
                  className="w-full text-left px-4 py-2.5 hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-b-0"
                >
                  <div className="font-medium text-slate-900">{s.name}</div>
                  <div className="text-xs text-slate-500">{s.phone}</div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Memo */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">메모 (선택)</label>
          <textarea
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            rows={3}
            className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
            placeholder="예: 초기 상담, 전화 문의"
          />
        </div>

        {/* Error */}
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 pt-2">
          <button
            onClick={() => router.back()}
            disabled={uploading}
            className="flex-1 px-4 py-2.5 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50"
          >
            취소
          </button>
          <button
            onClick={handleUpload}
            disabled={!file || !clientName.trim() || uploading}
            className="flex-1 px-4 py-2.5 rounded-lg text-sm font-medium text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ background: '#1a2b5a' }}
          >
            {uploading ? '업로드 중...' : '업로드'}
          </button>
        </div>
      </div>
    </div>
  )
}

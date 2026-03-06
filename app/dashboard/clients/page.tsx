'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import Pagination from '@/components/Pagination'
import { formatDate } from '@/lib/utils'

type ClientRow = {
  id: string
  name: string
  phone: string
  email: string | null
  referrer: string | null
  created_at: string
  last_contact_at: string
  last_consultation_date: string | null
  case_count: number
}

type ClientFormState = {
  name: string
  phone: string
  email: string
  referrer: string
}

function formatPhone(raw: string | null | undefined): string {
  if (!raw) return ''
  const digits = raw.replace(/\D/g, '')
  if (digits.length === 11) return digits.replace(/(\d{3})(\d{4})(\d{4})/, '$1-$2-$3')
  if (digits.length === 10) return digits.replace(/(\d{3})(\d{3})(\d{4})/, '$1-$2-$3')
  return raw
}

const PAGE_SIZE = 20

export default function ClientsPage() {
  const { session, loading } = useAuth()
  const router = useRouter()
  const [clients, setClients] = useState<ClientRow[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(0)
  const [fetching, setFetching] = useState(true)
  const [search, setSearch] = useState('')

  // Modal state
  const [showModal, setShowModal] = useState(false)
  const [modalMode, setModalMode] = useState<'add' | 'edit'>('add')
  const [editingClient, setEditingClient] = useState<ClientRow | null>(null)
  const [form, setForm] = useState<ClientFormState>({ name: '', phone: '', email: '', referrer: '' })
  const [formError, setFormError] = useState('')
  const [formSaving, setFormSaving] = useState(false)

  // Delete confirm state
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState('')

  useEffect(() => {
    if (!session) return
    setFetching(true)
    fetch(`/api/dashboard/clients?offset=${page * PAGE_SIZE}`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
      .then((r) => r.json())
      .then((data) => {
        setClients(data.clients ?? [])
        setTotal(data.total ?? 0)
        setFetching(false)
      })
      .catch(() => setFetching(false))
  }, [session, page])

  function openAddModal() {
    setModalMode('add')
    setEditingClient(null)
    setForm({ name: '', phone: '', email: '', referrer: '' })
    setFormError('')
    setShowModal(true)
  }

  function openEditModal(e: React.MouseEvent, c: ClientRow) {
    e.stopPropagation()
    setModalMode('edit')
    setEditingClient(c)
    setForm({ name: c.name, phone: c.phone, email: c.email ?? '', referrer: c.referrer ?? '' })
    setFormError('')
    setShowModal(true)
  }

  async function handleSave() {
    if (!session) return

    const phoneTrimmed = form.phone.trim()
    const emailTrimmed = form.email.trim()

    if (!form.name.trim() || !phoneTrimmed) {
      setFormError('이름과 전화번호를 입력해주세요.')
      return
    }
    if (!/^01[016789]-?\d{3,4}-?\d{4}$/.test(phoneTrimmed)) {
      setFormError('올바른 전화번호 형식이 아닙니다. (예: 010-1234-5678)')
      return
    }
    if (emailTrimmed && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTrimmed)) {
      setFormError('올바른 이메일 형식이 아닙니다.')
      return
    }

    setFormSaving(true)
    setFormError('')

    try {
      const payload = {
        name: form.name.trim(),
        phone: form.phone.trim(),
        email: form.email.trim() ? form.email.trim().toLowerCase() : null,
        referrer: form.referrer.trim() || null,
      }
      if (modalMode === 'add') {
        const res = await fetch('/api/dashboard/clients', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
          body: JSON.stringify(payload),
        })
        const data = await res.json()
        if (!res.ok) { setFormError(data.error ?? '저장에 실패했습니다.'); return }
        setClients((prev) => [data.client, ...prev])
      } else if (editingClient) {
        const res = await fetch(`/api/dashboard/clients/${editingClient.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
          body: JSON.stringify(payload),
        })
        const data = await res.json()
        if (!res.ok) { setFormError(data.error ?? '수정에 실패했습니다.'); return }
        setClients((prev) => prev.map((c) => c.id === editingClient.id ? { ...c, ...data.client } : c))
      }
      setShowModal(false)
    } finally {
      setFormSaving(false)
    }
  }

  async function handleDelete(e: React.MouseEvent, clientId: string) {
    e.stopPropagation()
    setDeletingId(clientId)
    setDeleteError('')
  }

  async function confirmDelete() {
    if (!session || !deletingId) return
    try {
      const res = await fetch(`/api/dashboard/clients/${deletingId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      if (res.ok) {
        setClients((prev) => prev.filter((c) => c.id !== deletingId))
        setDeletingId(null)
      } else {
        const data = await res.json()
        setDeleteError(data.error ?? '삭제에 실패했습니다.')
      }
    } catch {
      setDeleteError('삭제에 실패했습니다.')
    }
  }

  if (loading || fetching) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#1a2b5a', borderTopColor: 'transparent' }} />
      </div>
    )
  }

  const filtered = search.trim()
    ? clients.filter(
        (c) =>
          c.name.includes(search) ||
          c.phone.replace(/-/g, '').includes(search.replace(/-/g, ''))
      )
    : clients

  return (
    <div className="p-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-900">고객 목록</h1>
          <p className="text-slate-500 text-sm mt-0.5">총 {total}명</p>
        </div>
        <button
          onClick={openAddModal}
          className="px-3 py-1.5 text-sm font-medium text-white rounded-lg flex items-center gap-1.5"
          style={{ background: '#1a2b5a' }}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          고객 추가
        </button>
      </div>

      {/* Search */}
      <div className="mb-4">
        <div className="relative max-w-sm">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="이름 또는 전화번호로 검색"
            className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg bg-white text-slate-900 placeholder-slate-400 outline-none focus:ring-2 focus:ring-[#4a7aef] focus:border-transparent"
          />
        </div>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <svg className="w-10 h-10 mx-auto mb-3 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <p className="text-sm">
            {search ? '검색 결과가 없습니다.' : '등록된 고객이 없습니다.'}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">이름</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">전화번호</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider hidden sm:table-cell">이메일</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider hidden md:table-cell">추천인</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">사건</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">최근 상담일</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((c) => (
                <tr
                  key={c.id}
                  onClick={() => router.push(`/dashboard/clients/${c.id}`)}
                  className="hover:bg-slate-50 cursor-pointer transition-colors"
                >
                  <td className="px-4 py-3 text-sm font-medium text-slate-900">{c.name}</td>
                  <td className="px-4 py-3 text-sm text-slate-600">
                    <a
                      href={`tel:${c.phone}`}
                      onClick={(e) => e.stopPropagation()}
                      className="hover:underline"
                      style={{ color: '#4a7aef' }}
                    >
                      {formatPhone(c.phone)}
                    </a>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-500 hidden sm:table-cell">
                    {c.email ?? '-'}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-500 hidden md:table-cell">
                    {c.referrer ?? '-'}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-700">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600">
                      {c.case_count}건
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-500">
                    {c.last_consultation_date ? formatDate(c.last_consultation_date) : '-'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 justify-end" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={(e) => openEditModal(e, c)}
                        className="px-2 py-1 text-xs text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded transition-colors"
                      >
                        수정
                      </button>
                      <button
                        onClick={(e) => handleDelete(e, c.id)}
                        className="px-2 py-1 text-xs text-red-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                      >
                        삭제
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      <Pagination
        currentPage={page}
        totalItems={total}
        pageSize={PAGE_SIZE}
        onPageChange={setPage}
      />

      {/* Add / Edit modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-sm shadow-xl">
            <h3 className="text-base font-bold text-slate-900 mb-4">
              {modalMode === 'add' ? '고객 추가' : '고객 정보 수정'}
            </h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">이름 *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="홍길동"
                  className="w-full px-3 py-2 text-sm text-slate-900 border border-slate-200 rounded-lg bg-white outline-none focus:ring-2 focus:ring-[#4a7aef] focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">전화번호 *</label>
                <input
                  type="text"
                  value={form.phone}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                  placeholder="010-0000-0000"
                  className="w-full px-3 py-2 text-sm text-slate-900 border border-slate-200 rounded-lg bg-white outline-none focus:ring-2 focus:ring-[#4a7aef] focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">이메일 (선택)</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  placeholder="example@email.com"
                  className="w-full px-3 py-2 text-sm text-slate-900 border border-slate-200 rounded-lg bg-white outline-none focus:ring-2 focus:ring-[#4a7aef] focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">추천인 (선택)</label>
                <input
                  type="text"
                  value={form.referrer}
                  onChange={(e) => setForm((f) => ({ ...f, referrer: e.target.value }))}
                  placeholder="예: 김변호사, 이사무장"
                  className="w-full px-3 py-2 text-sm text-slate-900 border border-slate-200 rounded-lg bg-white outline-none focus:ring-2 focus:ring-[#4a7aef] focus:border-transparent"
                />
              </div>
              {formError && <p className="text-xs text-red-500">{formError}</p>}
            </div>
            <div className="flex gap-2 mt-5">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50"
              >
                취소
              </button>
              <button
                onClick={handleSave}
                disabled={formSaving}
                className="flex-1 py-2 text-sm font-medium text-white rounded-lg disabled:opacity-50"
                style={{ background: '#1a2b5a' }}
              >
                {formSaving ? '저장 중...' : '저장'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm modal */}
      {deletingId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-sm shadow-xl">
            <h3 className="text-base font-bold text-slate-900 mb-2">고객 삭제</h3>
            <p className="text-sm text-slate-500 mb-4">
              {clients.find((c) => c.id === deletingId)?.name} 고객을 삭제하시겠습니까?
            </p>
            {deleteError && <p className="text-xs text-red-500 mb-3">{deleteError}</p>}
            <div className="flex gap-2">
              <button
                onClick={() => { setDeletingId(null); setDeleteError('') }}
                className="flex-1 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50"
              >
                취소
              </button>
              <button
                onClick={confirmDelete}
                className="flex-1 py-2 text-sm font-medium text-white bg-red-500 hover:bg-red-600 rounded-lg transition-colors"
              >
                삭제
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

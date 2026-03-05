import { vi } from 'vitest'

/**
 * Supabase 체인 쿼리 빌더를 흉내 내는 mock 객체를 생성합니다.
 * .select().eq().maybeSingle() 등 체이닝 패턴 전체를 지원합니다.
 *
 * resolveData  — then() / maybeSingle() / single() 이 resolve할 data 값
 * resolveError — then() / maybeSingle() / single() 이 resolve할 error 값
 */
export function createQueryChain(
  resolveData: unknown = null,
  resolveError: unknown = null,
) {
  const chain: Record<string, unknown> = {}

  const methods = [
    'select', 'insert', 'update', 'delete', 'upsert',
    'eq', 'neq', 'not', 'in', 'order', 'limit', 'range', 'filter',
  ]
  for (const m of methods) {
    chain[m] = vi.fn().mockReturnValue(chain)
  }

  // 터미널 메서드: Promise resolve
  chain['maybeSingle'] = vi.fn().mockResolvedValue({ data: resolveData, error: resolveError })
  chain['single']      = vi.fn().mockResolvedValue({ data: resolveData, error: resolveError })

  // chain 자체를 await 가능하게 (예: await supabaseAdmin.from('x').select().eq(...))
  chain['then'] = (
    onfulfilled: (v: { data: unknown; error: unknown }) => unknown,
    onrejected?: (e: unknown) => unknown,
  ) =>
    Promise.resolve({ data: resolveData, error: resolveError }).then(
      onfulfilled,
      onrejected,
    )

  return chain
}

/**
 * supabaseAdmin 전체를 mock합니다.
 * from() 호출을 순서대로 다른 체인으로 교체하려면
 * mockReturnValueOnce 를 이용하세요.
 */
export function createSupabaseMock(
  resolveData: unknown = null,
  resolveError: unknown = null,
) {
  const _chain = createQueryChain(resolveData, resolveError)

  const auth = {
    getUser: vi.fn().mockResolvedValue({
      data: { user: { id: 'user-123', email: 'test@casefront.com' } },
      error: null,
    }),
  }

  const from = vi.fn().mockReturnValue(_chain)

  return { from, auth, _chain }
}

// ──────────────────────────────────────────────
// 테스트용 픽스처 팩토리
// ──────────────────────────────────────────────

export function mockFirm(overrides: Record<string, unknown> = {}) {
  return {
    id: 'firm-abc',
    name: '테스트 법률사무소',
    lawyer_name: '홍길동',
    lawyer_email: 'test@casefront.com',
    phone: '02-1234-5678',
    ...overrides,
  }
}

export function mockRecording(overrides: Record<string, unknown> = {}) {
  return {
    id: 'rec-001',
    firm_id: 'firm-abc',
    user_id: 'user-123',
    title: '교통사고 상담',
    status: 'completed',
    duration_seconds: 1820,
    created_at: new Date().toISOString(),
    ...overrides,
  }
}

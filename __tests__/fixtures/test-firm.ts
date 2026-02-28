import type { Firm } from '@/types'

export const testFirm: Firm = {
  id: 'test-firm-id-0000-0000-000000000001',
  name: '테스트 법률사무소',
  slug: 'test-law',
  lawyer_name: '김변호사',
  lawyer_email: 'test@example.com',
  notify_email: null,
  phone: '02-1234-5678',
  hours: '평일 09:00-18:00',
  specialties: ['민사', '형사'],
  greeting: '안녕하세요, 테스트 법률사무소입니다.',
  logo_url: null,
  notification_new_case: true,
  notification_urgent_only: false,
  created_at: '2026-01-01T00:00:00Z',
}

export interface Firm {
  id: string
  name: string
  lawyer_name: string
  kakao_channel_id: string | null
  kakao_search_id: string | null
  phone: string | null
  email: string | null
  hours: string | null
  specialties: string[] | string
  status: string | null
  created_at: string
  // 알림 설정
  notification_kakao: boolean
  notification_email: boolean
  lawyer_kakao_id: string | null
}

export interface Session {
  id: string
  kakao_user_id: string
  firm_id: string
  status: 'active' | 'completed' | 'expired'
  case_type: string | null
  channel: string  // 'kakao' | 'phone' | etc.
  created_at: string
  updated_at: string
  completed_at: string | null
}

export interface Message {
  id?: number
  session_id: string
  role: 'user' | 'assistant'
  content: string
  created_at?: string
}

export interface CaseEvent {
  date: string
  subject: string
  object: string
  action: string
  summary: string
}

export interface CaseSummary {
  client_name: string
  client_phone: string
  case_type: '민사' | '형사' | '가사' | '교통' | '행정' | '기타'
  events: CaseEvent[]
  document_request: string[]
  urgency: 'urgent' | 'normal' | 'low'
  urgency_reason: string
  summary_text: string
}

export interface Firm {
  id: string
  name: string
  slug: string | null
  lawyer_name: string
  lawyer_email: string | null
  kakao_channel_id: string | null
  kakao_search_id: string | null
  phone: string | null
  email: string | null
  hours: string | null
  specialties: string[] | string
  greeting: string | null
  status: string | null
  created_at: string
  notification_kakao: boolean
  notification_email: boolean
  lawyer_kakao_id: string | null
}

export interface Client {
  id: string
  firm_id: string
  name: string
  phone: string
  created_at: string
  last_contact_at: string
}

export interface Session {
  id: string
  kakao_user_id: string
  firm_id: string
  client_id: string | null
  status: 'active' | 'completed' | 'expired'
  case_type: string | null
  channel: string
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
  is_returning: boolean
  case_type: '민사' | '형사' | '가사' | '교통' | '행정' | '기타'
  events: CaseEvent[]
  document_request: string[]
  urgency: 'urgent' | 'normal' | 'low'
  urgency_reason: string
  summary_text: string
}

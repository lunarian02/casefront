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
  object: string | null
  action: string
  summary: string
}

export interface CaseRequirement {
  element: string
  status: 'confirmed' | 'denied' | 'unknown'
  detail: string
}

export interface CaseSummary {
  client_name: string
  client_phone: string
  is_returning: boolean

  // Case classification
  case_type: '민사' | '형사' | '가사' | '도산' | '노동' | '기타'
  case_subtype: '대여금' | '부동산' | '사기' | '폭행·상해' | '통매음·명예훼손' | '스토킹' | '이혼' | '상속' | '손해배상' | '성범죄' | '파산·회생' | '해고·임금체불' | '기타'
  case_sub_tag: string | null
  position: string | null  // 피해자 | 피의자 | 원고 | 피고 | 기타

  // Structured facts
  events: CaseEvent[]
  requirements: CaseRequirement[]
  evidence: string[]
  unconfirmed: string[]

  // Documents and notes
  document_request: string[]
  client_request: string
  ai_notes: string

  // Urgency
  urgency: 'urgent' | 'normal' | 'low'
  urgency_reason: string

  // Summary
  summary_text: string
  conversation_turns: number
  timestamp: string
}

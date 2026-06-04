export interface Firm {
  id: string
  name: string
  slug: string | null
  lawyer_name: string
  lawyer_email: string | null
  logo_url: string | null
  phone: string | null
  hours: string | null
  specialties: string[] | string
  greeting: string | null
  created_at: string
  notification_email: boolean
  notification_new_case: boolean
  notification_urgent_only: boolean
  notify_email: string | null
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

export interface DocumentRequestItem {
  name: string
  required: boolean
}

export interface LegalAnalysis {
  statute_of_limitations?: string
  evidence_strength?: 'strong' | 'moderate' | 'weak'
  evidence_analysis?: string
  missing_info?: string[]
  next_actions?: string[]
  risk_factors?: string[]
}

export interface CaseEvent {
  date: string
  subject: string
  object: string | null
  action: string
  summary: string
}

export interface CaseRequirement {
  element: string                          // 요건사실 명칭 (예: "금전교부")
  status: 'confirmed' | 'denied' | 'unknown'  // 충족 여부
  detail: string                           // 구체적 내용
}

export interface CaseSummary {
  client_name: string
  client_phone: string
  client_email: string | null
  is_proxy: boolean
  contact_name: string | null
  contact_phone: string | null
  contact_email: string | null
  contact_relation: string | null
  is_returning: boolean

  case_type: string                  // 민사/형사/가사/도산/노동
  case_subtype: string               // 12개 유형 중 하나
  case_sub_tag: string | null        // 하위 태그 (손해배상: 교통사고/의료사고 등)
  position: string | null            // 피해자/피의자/원고/피고

  events: CaseEvent[]
  requirements: CaseRequirement[]
  evidence: string[]
  unconfirmed: string[]
  document_request: (string | DocumentRequestItem)[]
  client_request: string
  ai_notes: string

  summary_text: string
  conversation_turns: number
  timestamp: string
  legal_analysis?: LegalAnalysis
}

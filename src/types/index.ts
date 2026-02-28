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
  email: string | null
  created_at: string
  last_contact_at: string
}

export interface Session {
  id: string
  firm_id: string
  client_id: string | null
  status: 'active' | 'completed'
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
  element: string
  status: 'confirmed' | 'denied' | 'unknown'
  detail: string
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

  case_type: string
  case_subtype: string
  case_sub_tag: string | null
  position: string | null

  events: CaseEvent[]
  requirements: CaseRequirement[]
  evidence: string[]
  unconfirmed: string[]
  document_request: (string | DocumentRequestItem)[]
  client_request: string
  ai_notes: string

  urgency: 'urgent' | 'normal' | 'low'
  urgency_reason: string
  summary_text: string
  conversation_turns: number
  timestamp: string
  legal_analysis?: LegalAnalysis
}

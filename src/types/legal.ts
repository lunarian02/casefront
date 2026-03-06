/**
 * Legal types for CaseFront
 * - Category/subcategory structure
 * - Legal elements (requirements) checklist
 */

// ============================================================
// Categories
// ============================================================

export type LegalCategory =
  | '형사'
  | '민사'
  | '가사'
  | '부동산'
  | '노동'
  | '행정'

// ============================================================
// Legal Elements (Requirements)
// ============================================================

/**
 * Single legal element with fulfillment status
 */
export type LegalElement = {
  fulfilled: boolean
  content: string
}

/**
 * Legal elements checklist (requirements for a case)
 * Key: element name (e.g., "폭행 행위", "고의")
 * Value: fulfillment status + content
 */
export type LegalElements = {
  [elementName: string]: LegalElement
}

// ============================================================
// Legal Templates (from DB)
// ============================================================

export type LegalTemplate = {
  id: string
  category: string
  subcategory: string
  elements: string[]  // Array of element names
  applicable_laws: string[] | null
  created_at: string
}

// ============================================================
// Report Structured (AI analysis result)
// ============================================================

export type ReportStructured = {
  summary: string
  client_info: {
    name?: string
    contact?: string
    opponent?: string
  }
  facts: string
  category: string
  subcategory: string
  legal_elements: LegalElements
  evidence: string[]  // Simple string array (text only, read-only)
  overview: string  // For case creation
}

// ============================================================
// Case Detail (lawyer-managed document)
// ============================================================

export type CaseEvidence = {
  item: string
  status: '확보' | '미확보' | '확보 가능'
  url: string | null
}

export type CaseDetail = {
  overview: string
  facts: string
  legal_elements: LegalElements
  evidence: CaseEvidence[]
}

// ============================================================
// API Types
// ============================================================

/**
 * Merge decisions for consultation integration
 */
export type MergeDecision = 'keep_existing' | 'use_new' | 'merge_both'

export type MergeConflictDecisions = {
  overview: MergeDecision
  facts: MergeDecision
  legal_elements: {
    [elementName: string]: MergeDecision
  }
  evidence: Array<{
    item: string
    action: 'keep' | 'update_status' | 'add' | 'remove'
    new_status?: '확보' | '미확보' | '확보 가능'
  }>
}

/**
 * Helper function to format category + subcategory
 */
export function formatCaseType(category: string, subcategory: string | null): string {
  if (!subcategory) return category
  return `${category} > ${subcategory}`
}

/**
 * Helper function to parse old case_type format
 */
export function parseCaseType(caseType: string): { category: string; subcategory: string | null } {
  const parts = caseType.split('-')
  return {
    category: parts[0] || '',
    subcategory: parts[1] || null,
  }
}

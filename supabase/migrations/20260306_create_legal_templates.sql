-- Create legal_templates table
CREATE TABLE IF NOT EXISTS legal_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT NOT NULL,
  subcategory TEXT NOT NULL,
  elements TEXT[] NOT NULL,
  applicable_laws TEXT[],
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(category, subcategory)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_legal_templates_category ON legal_templates(category);

-- Insert 20 legal templates

-- 형사 (7개)
INSERT INTO legal_templates (category, subcategory, elements, applicable_laws) VALUES
  ('형사', '폭행',
   ARRAY['폭행 행위', '고의', '위법성조각사유', '책임능력', '피해 정도', '반의사불벌'],
   ARRAY['형법 제260조', '형법 제21조', '형법 제257조']),

  ('형사', '사기',
   ARRAY['기망행위', '착오', '처분행위', '재산상 손해', '고의'],
   ARRAY['형법 제347조']),

  ('형사', '절도',
   ARRAY['타인의 재물', '절취 행위', '불법영득의사', '점유 침해'],
   ARRAY['형법 제329조']),

  ('형사', '횡령',
   ARRAY['타인의 재물 보관', '횡령 행위', '불법영득의사', '신임관계'],
   ARRAY['형법 제355조']),

  ('형사', '성범죄',
   ARRAY['추행·간음 행위', '폭행·협박', '피해자 진술', '동의 여부', '증거'],
   ARRAY['형법 제297조', '형법 제298조', '성폭력처벌법']),

  ('형사', '마약',
   ARRAY['마약류 소지·투약', '인식', '증거 확보', '소변검사 결과'],
   ARRAY['마약류관리법']),

  ('형사', '음주운전',
   ARRAY['음주 상태 운전', '혈중알콜농도', '측정 결과', '사고 발생 여부'],
   ARRAY['도로교통법 제44조', '도로교통법 제148조의2']);

-- 민사 (4개)
INSERT INTO legal_templates (category, subcategory, elements, applicable_laws) VALUES
  ('민사', '손해배상',
   ARRAY['불법행위', '고의·과실', '손해 발생', '인과관계'],
   ARRAY['민법 제750조']),

  ('민사', '교통사고',
   ARRAY['사고 경위', '과실 비율', '손해 항목', '보험 처리', '합의 여부'],
   ARRAY['민법 제750조', '자동차손해배상보장법']),

  ('민사', '의료과실',
   ARRAY['의료 행위', '과실', '손해', '인과관계', '설명의무 위반'],
   ARRAY['민법 제750조', '의료법']),

  ('민사', '계약위반',
   ARRAY['계약 체결', '채무 불이행', '손해 발생', '귀책사유'],
   ARRAY['민법 제390조']);

-- 가사 (3개)
INSERT INTO legal_templates (category, subcategory, elements, applicable_laws) VALUES
  ('가사', '이혼',
   ARRAY['혼인 파탄 사유', '자녀 유무', '양육권', '재산분할', '위자료'],
   ARRAY['민법 제840조', '민법 제843조']),

  ('가사', '상속',
   ARRAY['피상속인 사망', '상속인 범위', '상속 재산', '유언 유무', '유류분'],
   ARRAY['민법 제1000조', '민법 제1112조']),

  ('가사', '양육권',
   ARRAY['자녀 최선의 이익', '양육 환경', '양육비', '면접교섭권'],
   ARRAY['민법 제837조', '민법 제909조']);

-- 부동산 (3개)
INSERT INTO legal_templates (category, subcategory, elements, applicable_laws) VALUES
  ('부동산', '임대차',
   ARRAY['임대차계약', '보증금 반환 청구권', '대항력', '우선변제권', '계약 종료'],
   ARRAY['주택임대차보호법 제3조', '상가건물임대차보호법']),

  ('부동산', '명도',
   ARRAY['점유 권원', '명도 청구권', '차임 연체', '계약 해지'],
   ARRAY['민법 제640조', '민사집행법']),

  ('부동산', '매매',
   ARRAY['매매계약', '소유권 이전', '하자 유무', '계약금·중도금·잔금'],
   ARRAY['민법 제563조', '민법 제580조']);

-- 노동 (2개)
INSERT INTO legal_templates (category, subcategory, elements, applicable_laws) VALUES
  ('노동', '부당해고',
   ARRAY['해고 사유', '정당성', '절차 준수', '해고예고', '구제 방법'],
   ARRAY['근로기준법 제23조', '근로기준법 제26조']),

  ('노동', '임금체불',
   ARRAY['근로 제공', '임금 지급 의무', '미지급 임금 내역', '퇴직금'],
   ARRAY['근로기준법 제36조', '근로기준법 제43조']);

-- 행정 (1개)
INSERT INTO legal_templates (category, subcategory, elements, applicable_laws) VALUES
  ('행정', '행정소송',
   ARRAY['처분의 존재', '위법성', '원고적격', '제소기간', '취소 사유'],
   ARRAY['행정소송법 제4조', '행정소송법 제20조']);

-- Add comment
COMMENT ON TABLE legal_templates IS '사건 유형별 요건사실 템플릿';
COMMENT ON COLUMN legal_templates.category IS '대분류: 형사, 민사, 가사, 부동산, 노동, 행정';
COMMENT ON COLUMN legal_templates.subcategory IS '소분류: 폭행, 사기, 이혼 등';
COMMENT ON COLUMN legal_templates.elements IS '요건사실 항목 배열';
COMMENT ON COLUMN legal_templates.applicable_laws IS '관련 법조문';

-- Update existing reports with structured data
-- Update existing cases with detail data

DO $$
DECLARE
  rec_1_id UUID;
  rec_2_id UUID;
  rec_5_id UUID;
  rec_7_id UUID;
  rec_12_id UUID;
  case_kim_id UUID;
  case_lee_id UUID;
  case_choi_id UUID;
  case_han_id UUID;
  case_song_id UUID;
BEGIN
  -- Get recording IDs by title
  SELECT id INTO rec_1_id FROM recordings WHERE title = '김철수 초기 상담' LIMIT 1;
  SELECT id INTO rec_2_id FROM recordings WHERE title = '이영희 재산분할 상담' LIMIT 1;
  SELECT id INTO rec_5_id FROM recordings WHERE title = '최영수 사기 피해 상담' LIMIT 1;
  SELECT id INTO rec_7_id FROM recordings WHERE title = '한지우 의료과실 상담' LIMIT 1;
  SELECT id INTO rec_12_id FROM recordings WHERE title = '송민지 부당해고 상담' LIMIT 1;

  -- Get case IDs by case_type and client name
  SELECT c.id INTO case_kim_id FROM cases c JOIN clients cl ON c.client_id = cl.id
  WHERE cl.name = '김철수' AND c.case_type = '형사-폭행' LIMIT 1;

  SELECT c.id INTO case_lee_id FROM cases c JOIN clients cl ON c.client_id = cl.id
  WHERE cl.name = '이영희' AND c.case_type = '가사-이혼' LIMIT 1;

  SELECT c.id INTO case_choi_id FROM cases c JOIN clients cl ON c.client_id = cl.id
  WHERE cl.name = '최영수' AND c.case_type = '형사-사기' LIMIT 1;

  SELECT c.id INTO case_han_id FROM cases c JOIN clients cl ON c.client_id = cl.id
  WHERE cl.name = '한지우' AND c.case_type = '민사-의료과실' LIMIT 1;

  SELECT c.id INTO case_song_id FROM cases c JOIN clients cl ON c.client_id = cl.id
  WHERE cl.name = '송민지' AND c.case_type = '노동-부당해고' LIMIT 1;

  -- Update report 1: 김철수 (형사-폭행)
  IF rec_1_id IS NOT NULL THEN
    UPDATE reports SET structured = '{
      "summary": "술자리 시비로 인한 폭행 고소 건. 상대방 2주 진단. 합의 검토 필요.",
      "client_info": {
        "name": "김철수",
        "contact": "010-1111-2222",
        "opponent": "옆 테이블 손님 (신원 미상)"
      },
      "facts": "2026년 초 회식 후 술자리에서 시비 발생. 상대방이 먼저 어깨를 밀었고, 의뢰인이 반사적으로 밀침. 상대방이 의자에 걸려 넘어지면서 팔꿈치 부상. 상대방이 2주 진단서를 발급하고 폭행 혐의로 고소.",
      "legal_issues": [
        "폭행죄 구성요건 — 고의성 여부 쟁점",
        "정당방위(형법 제21조) 주장 가능성 — 상대방 선제 신체접촉",
        "상호폭행 감경 가능성"
      ],
      "evidence": [
        {"item": "가게 CCTV 영상", "status": "미확보", "url": null},
        {"item": "동료 목격자 진술 3명", "status": "확보 가능", "url": null},
        {"item": "상대방 진단서 (2주)", "status": "확보", "url": null}
      ],
      "recommendations": [
        "경찰 조사 전 변호인 선임 필수",
        "CCTV 확보 우선 — 사실관계 입증 핵심",
        "합의금 300~500만원 범위 검토",
        "정당방위 주장 준비"
      ],
      "next_steps": [
        "경찰 출석 일정 확인",
        "CCTV 보존 요청서 발송",
        "합의 의사 타진",
        "목격자 진술서 확보"
      ],
      "case_type": "형사-폭행",
      "overview": "회식 후 술자리 시비로 상대방이 넘어져 팔꿈치 부상. 2주 진단서 발급 후 폭행 혐의 고소.",
      "legal_elements": "폭행죄(형법 제260조) 구성요건 검토. 고의성 여부 쟁점 — 반사적 행위로 고의 부인 가능. 정당방위(형법 제21조) 주장 가능성 — 상대방의 선제 신체접촉 존재. 상호폭행 감경 가능성."
    }'::jsonb
    WHERE recording_id = rec_1_id;
  END IF;

  -- Update report 2: 이영희 (가사-이혼)
  IF rec_2_id IS NOT NULL THEN
    UPDATE reports SET structured = '{
      "summary": "혼인 12년, 자녀 2명. 재산분할 및 양육권 분쟁. 양육비 산정 협의 중.",
      "client_info": {
        "name": "이영희",
        "contact": "010-3333-4444",
        "opponent": "배우자 (12년 혼인)"
      },
      "facts": "혼인 12년. 자녀 2명(초등학교 5학년, 3학년). 재산: 아파트 1채(시가 5억, 대출 2억), 예금 5천만원. 배우자 외도 의심. 양육권은 의뢰인이 희망하며 배우자도 양육 의사 있음.",
      "legal_issues": [
        "재산분할 비율 — 아파트 취득 기여도 및 대출 부담",
        "자녀 양육권 — 양측 모두 양육 의사",
        "양육비 산정 — 배우자 소득 및 표준 양육비 기준",
        "면접교섭권 — 비양육 부모의 자녀 만남 일정"
      ],
      "evidence": [
        {"item": "아파트 등기부등본", "status": "확보", "url": null},
        {"item": "대출 계약서 및 상환 내역", "status": "확보", "url": null},
        {"item": "예금 잔고 증명", "status": "확보 필요", "url": null},
        {"item": "배우자 소득 증빙", "status": "미확보", "url": null}
      ],
      "recommendations": [
        "재산 목록 작성 및 증빙자료 수집 우선",
        "조정 신청 먼저 시도 — 소송보다 비용·시간 절감",
        "양육권은 자녀 의견 청취 가능 연령 고려",
        "양육비는 표준양육비 산정표 기준으로 협상"
      ],
      "next_steps": [
        "재산 증빙자료 수집 (등기부등본, 예금, 대출)",
        "배우자 소득 확인 (원천징수영수증 등)",
        "가사조정 신청서 작성",
        "자녀 의견 청취 (필요 시)"
      ],
      "case_type": "가사-이혼",
      "overview": "혼인 12년, 자녀 2명. 아파트 재산분할 및 양육권 분쟁. 양육비 산정 협의 중.",
      "legal_elements": "재산분할청구권(민법 제839조의2) — 혼인 중 취득 재산 기여도 분석. 양육권 및 친권(민법 제909조) — 자녀 복리 우선 원칙. 양육비(민법 제837조) — 표준양육비 산정표 기준."
    }'::jsonb
    WHERE recording_id = rec_2_id;
  END IF;

  -- Update report 5: 최영수 (형사-사기)
  IF rec_5_id IS NOT NULL THEN
    UPDATE reports SET structured = '{
      "summary": "부동산 투자 명목 5천만 원 사기. 연락 두절. 각서 및 송금 내역 보유. 피해자 3명 추정.",
      "client_info": {
        "name": "최영수",
        "contact": "010-9999-0000",
        "opponent": "투자 권유자 김모(40대)"
      },
      "facts": "지인 소개로 부동산 투자 권유 받음. 2025년 12월 5천만 원 송금. 간단한 각서만 작성. 이후 연락 두절. 주변에 동일한 피해자 3명 확인.",
      "legal_issues": [
        "사기죄(형법 제347조) 성립 요건 — 기망·착오·재산 교부",
        "공동 고소 가능성 — 다른 피해자 3명",
        "민사상 손해배상청구",
        "재산 가압류 — 범인 재산 확보"
      ],
      "evidence": [
        {"item": "투자 각서", "status": "확보", "url": null},
        {"item": "송금 내역 (5천만 원)", "status": "확보", "url": null},
        {"item": "카카오톡 대화 내역", "status": "확보", "url": null},
        {"item": "범인 신원 정보", "status": "확보 가능", "url": null}
      ],
      "recommendations": [
        "즉시 형사 고소 진행 — 시일 지체 시 증거 인멸 위험",
        "각서 및 송금 내역 제출 — 기망 및 교부 사실 입증",
        "재산 가압류 신청 검토 — 범인 재산 확보",
        "다른 피해자와 공동 고소 검토 — 입증 강화"
      ],
      "next_steps": [
        "고소장 작성 및 제출",
        "범인 신원 및 재산 조회",
        "다른 피해자 연락처 확보",
        "재산 가압류 신청"
      ],
      "case_type": "형사-사기",
      "overview": "부동산 투자 사기 5천만원. 피해자 3명 추정. 고소장 준비 중.",
      "legal_elements": "사기죄(형법 제347조) 구성요건 — 기망 행위(부동산 투자 명목), 착오 유발, 재산 교부(5천만 원). 공범 가능성 검토. 민사상 손해배상청구권."
    }'::jsonb
    WHERE recording_id = rec_5_id;
  END IF;

  -- Update report 7: 한지우 (민사-의료과실)
  IF rec_7_id IS NOT NULL THEN
    UPDATE reports SET structured = '{
      "summary": "무릎 관절 수술 후 상태 악화. 의료과실 및 설명의무 위반 의심. 의무기록 확보 중.",
      "client_info": {
        "name": "한지우",
        "contact": "010-2345-6789",
        "opponent": "A병원 정형외과 의사"
      },
      "facts": "2025년 11월 무릎 관절 수술. 수술 후 통증 지속 및 보행 곤란. 타 병원 소견: 수술 잘못 가능성. 합병증 가능성에 대한 사전 설명 없었음.",
      "legal_issues": [
        "의료과실 입증 — 의사의 주의의무 위반",
        "설명의무 위반 — 합병증 가능성 미고지",
        "손해배상 범위 — 치료비, 위자료, 일실수입"
      ],
      "evidence": [
        {"item": "의무기록 사본", "status": "확보 중", "url": null},
        {"item": "타 병원 소견서", "status": "확보", "url": null},
        {"item": "수술 동의서", "status": "확보", "url": null},
        {"item": "치료비 영수증", "status": "확보", "url": null}
      ],
      "recommendations": [
        "의무기록 사본 확보 우선 — 열람 및 복사 청구",
        "의료감정 신청 준비 — 과실 여부 전문가 판단",
        "설명의무 위반 주장 병행 — 동의서 내용 검토",
        "손해배상액 산정 — 치료비, 위자료, 향후 치료비"
      ],
      "next_steps": [
        "의무기록 열람 및 복사 청구",
        "의료감정 신청서 작성",
        "치료비 영수증 정리",
        "손해배상 소송 준비"
      ],
      "case_type": "민사-의료과실",
      "overview": "무릎 관절 수술 후 상태 악화. 의료과실 및 설명의무 위반. 의무기록 확보 중.",
      "legal_elements": "의료과실(민법 제750조) — 의사의 주의의무 위반 입증. 설명의무 위반 — 합병증 가능성 미고지. 손해배상 범위 산정."
    }'::jsonb
    WHERE recording_id = rec_7_id;
  END IF;

  -- Update report 12: 송민지 (노동-부당해고)
  IF rec_12_id IS NOT NULL THEN
    UPDATE reports SET structured = '{
      "summary": "계약직 2년 정규직 전환 거부 및 부당해고. 노동위원회 구제 신청 예정.",
      "client_info": {
        "name": "송민지",
        "contact": "010-6789-0123",
        "opponent": "B기업 인사팀"
      },
      "facts": "2023년 12월 계약직 입사. 2년 근무 후 정규직 전환 기대했으나 거부당함. 2026년 1월 해고 통보. 근로계약서상 전환 가능성 명시.",
      "legal_issues": [
        "부당해고 여부 — 정당한 사유 없는 해고",
        "정규직 전환 기대권 침해",
        "노동위원회 구제 신청"
      ],
      "evidence": [
        {"item": "근로계약서", "status": "확보", "url": null},
        {"item": "해고 통보서", "status": "확보", "url": null},
        {"item": "근무 평가 기록", "status": "확보 가능", "url": null},
        {"item": "급여 명세서", "status": "확보", "url": null}
      ],
      "recommendations": [
        "노동위원회 부당해고 구제 신청 우선",
        "근로계약서 및 평가 기록 제출",
        "정규직 전환 기대권 침해 주장",
        "해고 무효 확인 및 복직 요구"
      ],
      "next_steps": [
        "노동위원회 구제 신청서 작성",
        "근로계약서 및 증빙자료 제출",
        "사용자 답변서 확인",
        "심문 기일 준비"
      ],
      "case_type": "노동-부당해고",
      "overview": "계약직 2년 정규직 전환 거부 및 부당해고. 노동위원회 구제 신청 예정.",
      "legal_elements": "부당해고(근로기준법 제23조) — 정당한 사유 없는 해고 금지. 정규직 전환 기대권 — 근로계약서상 명시. 노동위원회 구제 절차."
    }'::jsonb
    WHERE recording_id = rec_12_id;
  END IF;

  -- Update case 1: 김철수 (형사-폭행)
  IF case_kim_id IS NOT NULL THEN
    UPDATE cases SET detail = '{
      "overview": "회식 후 술자리 시비로 상대방이 넘어져 팔꿈치 부상. 2주 진단서 발급 후 폭행 혐의 고소. 합의 진행 중 (상대방 500만원 요구, 300만원 제안).",
      "facts": "2026년 초 회사 동료와 회식 후 음주. 옆 테이블 손님이 시끄럽다고 항의하며 시비 시작. 상대방이 먼저 어깨를 밀었고, 의뢰인이 반사적으로 밀침. 상대방이 의자에 걸려 넘어지면서 팔꿈치 부상. 상대방 2주 진단서 발급 후 폭행 혐의로 고소.",
      "legal_elements": "폭행죄(형법 제260조) 구성요건 검토. 고의성 여부 쟁점 — 반사적 행위로 고의 부인 가능. 정당방위(형법 제21조) 주장 가능성 — 상대방의 선제 신체접촉 존재. 상호폭행 감경 가능성.",
      "evidence": [
        {"item": "가게 CCTV 영상", "status": "확보", "url": null},
        {"item": "동료 목격자 진술 3명", "status": "확보 가능", "url": null},
        {"item": "상대방 진단서 (2주)", "status": "확보", "url": null},
        {"item": "합의 제안 내역", "status": "확보", "url": null}
      ]
    }'::jsonb
    WHERE id = case_kim_id;
  END IF;

  -- Update case 2: 이영희 (가사-이혼)
  IF case_lee_id IS NOT NULL THEN
    UPDATE cases SET detail = '{
      "overview": "혼인 12년, 자녀 2명. 아파트 재산분할 및 양육권 분쟁. 양육비 산정 협의 중.",
      "facts": "혼인 12년. 자녀 2명(초등학교 5학년, 3학년). 재산: 아파트 1채(시가 5억, 대출 2억), 예금 5천만원. 배우자 외도 의심. 양육권은 의뢰인이 희망하며 배우자도 양육 의사 있음. 양육비는 표준양육비 기준으로 협상 중.",
      "legal_elements": "재산분할청구권(민법 제839조의2) — 혼인 중 취득 재산 기여도 분석. 양육권 및 친권(민법 제909조) — 자녀 복리 우선 원칙. 양육비(민법 제837조) — 표준양육비 산정표 기준.",
      "evidence": [
        {"item": "아파트 등기부등본", "status": "확보", "url": null},
        {"item": "대출 계약서 및 상환 내역", "status": "확보", "url": null},
        {"item": "예금 잔고 증명", "status": "확보", "url": null},
        {"item": "배우자 소득 증빙", "status": "미확보", "url": null}
      ]
    }'::jsonb
    WHERE id = case_lee_id;
  END IF;

  -- Update case 3: 최영수 (형사-사기)
  IF case_choi_id IS NOT NULL THEN
    UPDATE cases SET detail = '{
      "overview": "부동산 투자 사기 5천만원. 피해자 3명 추정. 고소장 제출 완료.",
      "facts": "지인 소개로 부동산 투자 권유 받음. 2025년 12월 5천만 원 송금. 간단한 각서만 작성. 이후 연락 두절. 주변에 동일한 피해자 3명 확인. 고소장 제출.",
      "legal_elements": "사기죄(형법 제347조) 구성요건 — 기망 행위(부동산 투자 명목), 착오 유발, 재산 교부(5천만 원). 공범 가능성 검토. 민사상 손해배상청구권.",
      "evidence": [
        {"item": "투자 각서", "status": "확보", "url": null},
        {"item": "송금 내역 (5천만 원)", "status": "확보", "url": null},
        {"item": "카카오톡 대화 내역", "status": "확보", "url": null},
        {"item": "고소장 접수증", "status": "확보", "url": null}
      ]
    }'::jsonb
    WHERE id = case_choi_id;
  END IF;

  -- Update case 4: 한지우 (민사-의료과실)
  IF case_han_id IS NOT NULL THEN
    UPDATE cases SET detail = '{
      "overview": "무릎 관절 수술 후 상태 악화. 의료과실 및 설명의무 위반. 의무기록 확보 중.",
      "facts": "2025년 11월 무릎 관절 수술. 수술 후 통증 지속 및 보행 곤란. 타 병원 소견: 수술 잘못 가능성. 합병증 가능성에 대한 사전 설명 없었음. 의무기록 열람 청구 진행 중.",
      "legal_elements": "의료과실(민법 제750조) — 의사의 주의의무 위반 입증. 설명의무 위반 — 합병증 가능성 미고지. 손해배상 범위 산정(치료비, 위자료, 향후 치료비).",
      "evidence": [
        {"item": "의무기록 사본", "status": "확보 중", "url": null},
        {"item": "타 병원 소견서", "status": "확보", "url": null},
        {"item": "수술 동의서", "status": "확보", "url": null},
        {"item": "치료비 영수증", "status": "확보", "url": null}
      ]
    }'::jsonb
    WHERE id = case_han_id;
  END IF;

  -- Update case 5: 송민지 (노동-부당해고)
  IF case_song_id IS NOT NULL THEN
    UPDATE cases SET detail = '{
      "overview": "계약직 2년 정규직 전환 거부 및 부당해고. 노동위원회 구제 신청 예정.",
      "facts": "2023년 12월 계약직 입사. 2년 근무 후 정규직 전환 기대했으나 거부당함. 2026년 1월 해고 통보. 근로계약서상 전환 가능성 명시. 노동위원회 구제 신청서 작성 중.",
      "legal_elements": "부당해고(근로기준법 제23조) — 정당한 사유 없는 해고 금지. 정규직 전환 기대권 — 근로계약서상 명시. 노동위원회 구제 절차.",
      "evidence": [
        {"item": "근로계약서", "status": "확보", "url": null},
        {"item": "해고 통보서", "status": "확보", "url": null},
        {"item": "근무 평가 기록", "status": "확보 가능", "url": null},
        {"item": "급여 명세서", "status": "확보", "url": null}
      ]
    }'::jsonb
    WHERE id = case_song_id;
  END IF;

  RAISE NOTICE '✅ Seed data updated with structured and detail';
END $$;

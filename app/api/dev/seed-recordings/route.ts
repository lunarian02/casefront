import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

// POST /api/dev/seed-recordings — create sample recordings for the current firm
// Requires Authorization header (uses logged-in user's firm)

const SAMPLE_RECORDINGS = [
  {
    title: '이상호 — 폭행 피해 상담',
    client_name: '이상호',
    duration_seconds: 1860, // 31분
    category: '형사',
    subcategory: '폭행',
    daysAgo: 1,
    transcript: `변호사: 안녕하세요. 어떤 일로 오셨나요?
이상호: 네, 지난주에 직장 동료한테 맞았어요. 그냥 넘어가기가 싫어서요.
변호사: 언제, 어디서 발생했나요?
이상호: 3월 28일 저녁 8시쯤이요. 회식 자리였는데, 갑자기 주먹으로 얼굴을 때렸어요.
변호사: 목격자가 있었나요?
이상호: 네, 같이 있던 동료 3명이 다 봤어요. 그리고 식당 CCTV도 있을 거예요.
변호사: 진단서는 받으셨나요?
이상호: 다음날 병원 가서 2주 진단 받았어요. 진단서는 있어요.
변호사: 상대방은 지금 어떤 상황인가요?
이상호: 사과도 없고, 오히려 자기가 먼저 맞았다고 주장하고 있어요.
변호사: 알겠습니다. 형사 고소와 손해배상 청구를 같이 진행하는 게 좋을 것 같습니다.`,
    report: `# 사건 리포트 — 형사 폭행

## 사건 개요
2026. 3. 28. 20:00경 회식 자리에서 직장 동료가 의뢰인 이상호의 얼굴을 주먹으로 1회 가격. 피의자는 자신이 먼저 맞았다고 주장 중.

## 의뢰인 정보
- **이름:** 이상호
- **상담 일시:** 2026. 4. 4.
- **상담 시간:** 31분

## 사실관계 타임라인
| 일시 | 내용 |
|------|------|
| 2026. 3. 28. 20:00 | 회식 자리에서 직장 동료가 의뢰인 얼굴 가격 |
| 2026. 3. 29. | 병원 내원, 2주 진단 |
| 2026. 4. 4. | 변호사 상담 |

## 요건사실 체크리스트 (폭행죄)
| 요건 | 판단 | 비고 |
|------|------|------|
| 폭행 행위 | ✅ 충족 | 주먹으로 얼굴 1회 가격 |
| 고의성 | ✅ 충족 | 의도적 공격 |
| 신체 접촉 | ✅ 충족 | 직접 가격 |
| 피해자 의사 반함 | ✅ 충족 | —  |

## 증거 현황
- ✅ **확보** 진단서 (2주 진단)
- ✅ **확보** 목격자 3명 (동료)
- ✅ **확보** 식당 CCTV (보존 요청 필요)
- ❌ **미확보** 피의자 진술서

## 핵심 쟁점
1. 피의자가 "먼저 맞았다" 주장 → 정당방위 항변 가능성
2. CCTV 조기 보존 조치 필요 (통상 30일 내 덮어씌워짐)

## 다음 단계
1. CCTV 영상 보존 요청 (식당 측)
2. 목격자 연락처 확보
3. 형사 고소장 제출
4. 손해배상 청구 검토 (치료비, 위자료)

---
*본 리포트는 AI가 상담 녹음을 분석하여 생성한 참고 자료입니다. 법률 자문을 대체하지 않습니다.*`,
  },
  {
    title: '박민정 — 전세보증금 반환 상담',
    client_name: '박민정',
    duration_seconds: 2340, // 39분
    category: '부동산',
    subcategory: '임대차',
    daysAgo: 3,
    transcript: `변호사: 안녕하세요, 어떤 일로 오셨나요?
박민정: 전세 계약이 끝났는데 집주인이 보증금을 안 돌려주고 있어요.
변호사: 보증금이 얼마이고, 계약 만료일이 언제인가요?
박민정: 2억 5천이에요. 계약 만료가 3월 15일이었는데, 지금까지 안 돌려줘요.
변호사: 집주인이 어떤 이유를 대고 있나요?
박민정: 새 세입자를 못 구했다고, 조금만 기다려달라고 해요. 근데 이미 3주가 지났어요.
변호사: 등기부등본 확인해보셨나요? 혹시 근저당이 있나요?
박민정: 집 살 때 대출이 있는 건 알았는데, 최근에 확인해보니까 근저당이 1억 8천이에요.
변호사: 집 시세가 얼마 정도 되나요?
박민정: 3억 2천 정도 됩니다.
변호사: 임차권등기명령 신청을 바로 해야 할 것 같습니다. 이사를 가더라도 대항력을 유지할 수 있어요.`,
    report: `# 사건 리포트 — 민사 전세보증금 반환

## 사건 개요
전세 계약 만료(2026. 3. 15.) 후 3주 이상 임대인이 보증금 2억 5천만원 반환 거부. 임대인은 신규 임차인 미확보를 이유로 지연 중. 근저당 1억 8천 설정으로 담보 위험 있음.

## 의뢰인 정보
- **이름:** 박민정
- **상담 일시:** 2026. 4. 2.
- **상담 시간:** 39분

## 사실관계 타임라인
| 일시 | 내용 |
|------|------|
| 2024. 3. 15. | 전세 계약 체결 (보증금 2억 5천) |
| 2026. 3. 15. | 계약 만료, 반환 요청 |
| 2026. 4. 4. (현재) | 임대인 반환 거부 중 (신규 임차인 미확보 주장) |

## 요건사실 체크리스트 (보증금 반환)
| 요건 | 판단 | 비고 |
|------|------|------|
| 임대차 계약 | ✅ 확인 | 전세계약서 존재 |
| 보증금 지급 | ✅ 확인 | 2억 5천만원 |
| 계약 기간 만료 | ✅ 확인 | 2026. 3. 15. 만료 |
| 임대인 반환 거부 | ✅ 확인 | 3주 이상 지연 |

## 위험도 분석
- 집 시세: 3억 2천
- 근저당: 1억 8천
- 보증금: 2억 5천
- **합계: 4억 3천 (시세 초과)** → ⚠️ 담보가치 부족, 경매 시 미회수 가능성 있음

## 다음 단계
1. **임차권등기명령 즉시 신청** (이사 후 대항력 유지)
2. 내용증명 발송 (반환 최고)
3. 보증금 반환 소송 / 지급명령 신청
4. 주택도시보증공사(HUG) 전세보증보험 가입 여부 확인

---
*본 리포트는 AI가 상담 녹음을 분석하여 생성한 참고 자료입니다. 법률 자문을 대체하지 않습니다.*`,
  },
  {
    title: '최지수 — 이혼 및 양육권 상담',
    client_name: '최지수',
    duration_seconds: 2820, // 47분
    category: '가사',
    subcategory: '이혼',
    daysAgo: 7,
    transcript: `변호사: 안녕하세요. 오늘 어떤 문제로 오셨나요?
최지수: 이혼을 하고 싶어요. 남편이 2년 전부터 외도를 해왔고, 최근에 증거를 찾았어요.
변호사: 혼인 기간이 얼마나 되셨나요?
최지수: 10년 됐어요. 아이는 8살짜리 딸이 하나 있어요.
변호사: 외도 증거는 어떤 게 있나요?
최지수: 카카오톡 대화 캡처, 신용카드 내역, 그리고 탐정한테 맡겨서 사진도 찍었어요.
변호사: 현재 남편과 같이 살고 계신가요?
최지수: 아니요, 한 달 전부터 제가 아이 데리고 친정에 와 있어요.
변호사: 재산은 어떻게 되어 있나요?
최지수: 아파트가 하나 있는데 남편 명의예요. 5억 정도 되고, 대출이 2억 있어요. 그리고 남편 퇴직금이랑 예금도 있는데 정확한 금액은 몰라요.
변호사: 양육권은 어떻게 생각하고 계세요?
최지수: 제가 양육권을 가져야 한다고 생각해요. 남편은 지금 외도 상대방이랑 만나고 있어요.
변호사: 충분한 사유가 됩니다. 유책 배우자이고 현재도 외도 중이니 양육권 확보 가능성이 높습니다.`,
    report: `# 사건 리포트 — 가사 이혼 (재판상 이혼)

## 사건 개요
혼인 10년, 자녀 1명(8세). 배우자의 2년간 지속적 외도 확인. 증거 다수 확보. 의뢰인은 친정에서 자녀와 거주 중. 재판상 이혼 + 양육권 + 재산분할 청구 검토.

## 의뢰인 정보
- **이름:** 최지수
- **상담 일시:** 2026. 3. 28.
- **상담 시간:** 47분

## 사실관계 타임라인
| 일시 | 내용 |
|------|------|
| 2016. (추정) | 혼인 신고 |
| 2024. 초 | 배우자 외도 시작 (추정) |
| 2026. 3. 초 | 의뢰인 외도 증거 확보 |
| 2026. 3. (한달 전) | 의뢰인, 자녀 데리고 친정 거주 시작 |
| 2026. 3. 28. | 변호사 상담 |

## 요건사실 체크리스트 (재판상 이혼 — 민법 840조 1호)
| 요건 | 판단 | 비고 |
|------|------|------|
| 배우자의 부정행위 | ✅ 충족 | 카톡, 카드내역, 탐정 사진 확보 |
| 2년 이상 지속 | ✅ 충족 | 2년간 외도 |
| 혼인 파탄 | ✅ 충족 | 별거 중 |
| 유책성 | ✅ 충족 | 배우자 유책 |

## 재산 현황 (파악된 것)
| 항목 | 금액 | 비고 |
|------|------|------|
| 아파트 (배우자 명의) | 5억 | 대출 2억 → 실질 3억 |
| 배우자 퇴직금 | 미확인 | 재산명시 신청 필요 |
| 예금 등 | 미확인 | 금융정보 조회 필요 |

## 양육권 전망
의뢰인 유리: 현재 주양육자, 배우자 유책, 외도 현재 진행 중. 양육권 확보 가능성 높음.

## 증거 목록
- ✅ 카카오톡 대화 캡처
- ✅ 신용카드 사용내역
- ✅ 탐정 촬영 사진

## 다음 단계
1. 이혼 소장 작성 및 제출
2. 재산명시 신청 (상대방 재산 파악)
3. 양육비 가처분 신청 검토
4. 아동 심리 상담 기록 확보 (양육권 유리)

---
*본 리포트는 AI가 상담 녹음을 분석하여 생성한 참고 자료입니다. 법률 자문을 대체하지 않습니다.*`,
  },
]

async function getAuthFirm(request: Request) {
  const token = request.headers.get('Authorization')?.replace('Bearer ', '')
  if (!token) return null
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token)
  if (error || !user?.email) return null
  const { data: firm } = await supabaseAdmin
    .from('firms')
    .select('id')
    .eq('lawyer_email', user.email)
    .maybeSingle()
  return firm ? { firm, user } : null
}

export async function POST(request: Request) {
  const auth = await getAuthFirm(request)
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { firm, user } = auth
  const results: string[] = []

  for (const sample of SAMPLE_RECORDINGS) {
    const createdAt = new Date(Date.now() - sample.daysAgo * 24 * 60 * 60 * 1000).toISOString()
    const fakeId = crypto.randomUUID()
    const filePath = `${firm.id}/${fakeId}.m4a`

    // 1. Insert recording
    const { data: recording, error: rErr } = await supabaseAdmin
      .from('recordings')
      .insert({
        firm_id: firm.id,
        user_id: user.id,
        client_name: sample.client_name,
        title: sample.title,
        source: 'web',
        file_path: filePath,
        file_size_bytes: sample.duration_seconds * 16000, // rough estimate
        duration_seconds: sample.duration_seconds,
        recording_type: 'uploaded',
        status: 'completed',
        created_at: createdAt,
        updated_at: createdAt,
      })
      .select('id')
      .single()

    if (rErr || !recording) {
      results.push(`❌ ${sample.client_name}: ${rErr?.message}`)
      continue
    }

    // 2. Insert transcript with generated segments
    const lines = sample.transcript.split('\n').filter(l => l.trim())
    const avgSecondsPerLine = sample.duration_seconds / lines.length
    const segments = lines.map((line, i) => ({
      start: i * avgSecondsPerLine,
      end: (i + 1) * avgSecondsPerLine,
      text: line.trim(),
    }))

    const { data: transcript, error: tErr } = await supabaseAdmin
      .from('transcripts')
      .insert({
        recording_id: recording.id,
        full_text: sample.transcript,
        segments,
        language: 'ko',
        stt_model: 'whisper-1',
        stt_cost_usd: (sample.duration_seconds / 60) * 0.006,
        created_at: new Date(new Date(createdAt).getTime() + 5 * 60 * 1000).toISOString(),
      })
      .select('id')
      .single()

    if (tErr || !transcript) {
      results.push(`⚠️ ${sample.client_name}: transcript 실패 — ${tErr?.message}`)
      continue
    }

    // 3. Insert report
    const { error: rpErr } = await supabaseAdmin
      .from('reports')
      .insert({
        recording_id: recording.id,
        transcript_id: transcript.id,
        content: sample.report,
        report_type: 'legal_consultation',
        category: sample.category,
        subcategory: sample.subcategory,
        llm_model: 'gemini-2.5-flash',
        llm_cost_usd: 0.002,
        created_at: new Date(new Date(createdAt).getTime() + 8 * 60 * 1000).toISOString(),
      })

    if (rpErr) {
      results.push(`⚠️ ${sample.client_name}: report 실패 — ${rpErr.message}`)
    } else {
      results.push(`✅ ${sample.client_name} — ${sample.category} > ${sample.subcategory} (${Math.floor(sample.duration_seconds / 60)}분)`)
    }
  }

  return NextResponse.json({ results })
}

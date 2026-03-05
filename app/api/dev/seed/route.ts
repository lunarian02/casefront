import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

// Dev-only seed endpoint — NOT for production
// POST /api/dev/seed

const FIRM_ID = '83b887a3-0d83-490c-9781-9e6af3ab9165' // test@example.com firm

const MOCK_CASES = [
  {
    client_name: '이민우',
    client_phone: '010-3821-4490',
    client_email: 'minwoo.lee@gmail.com',
    case_type: '민사',
    summary_text: '대여금 3,500만원 미변제 — 차용증 있음, 상대방 잠적',
    events: [
      { date: '2022-03-15', subject: '이민우', object: '채무자 김XX', action: '3,500만원 대여', summary: '이민우는 2022. 3. 15. 김XX에게 3,500만원을 대여하였다' },
      { date: '2023-03-15', subject: '이민우', object: '김XX', action: '변제 독촉', summary: '이민우는 2023. 3. 15. 김XX에게 변제를 독촉하였으나 김XX은 응하지 않았다' },
    ],
    requirements: [
      { element: '금전교부', status: 'confirmed', detail: '3,500만원 계좌이체 (2022.3.15)' },
      { element: '반환약정', status: 'confirmed', detail: '차용증 작성, 변제기 2023.3.15' },
      { element: '변제기 도래', status: 'confirmed', detail: '변제기 경과, 상대방 연락 두절' },
    ],
    document_request: ['차용증 사본', '계좌이체 내역', '독촉 문자 기록'],
    messages: [
      { role: 'assistant', content: '안녕하세요, 테스트 법률사무소 AI 접수 도우미입니다. 어떤 일로 연락 주셨나요?' },
      { role: 'user', content: '지인한테 돈을 빌려줬는데 안 갚고 있어요.' },
      { role: 'assistant', content: '많이 답답하시겠어요. 변호사님께 잘 전달드릴게요. 먼저 성함을 알려주시겠어요?' },
      { role: 'user', content: '이민우입니다. 연락처는 010-3821-4490이고 이메일은 minwoo.lee@gmail.com이에요.' },
      { role: 'assistant', content: '감사합니다, 이민우님. 얼마를 빌려주셨나요? 언제, 어떻게 전달하셨는지 알려주시겠어요?' },
      { role: 'user', content: '2022년 3월에 3500만원 계좌이체로 빌려줬어요. 차용증도 썼고요.' },
      { role: 'assistant', content: '차용증이 있으시군요. 상대방이 갚기로 한 날짜가 언제였나요?' },
      { role: 'user', content: '작년 3월까지 갚기로 했는데 지금 연락도 안 되고 있어요.' },
    ],
    daysAgo: 1,
  },
  {
    client_name: '박지훈',
    client_phone: '010-5562-8833',
    client_email: 'jihoon.park@naver.com',
    case_type: '형사',
    summary_text: '중고거래 사기 — 300만원 피해, 경찰 미신고 상태',
    events: [
      { date: '2026-01-20', subject: '박지훈', object: '사기꾼 이XX', action: '중고 명품가방 대금 300만원 송금', summary: '박지훈은 2026. 1. 20. 이XX의 허위 판매글을 믿고 300만원을 송금하였다' },
      { date: '2026-01-21', subject: '이XX', object: null, action: '연락 두절 및 잠적', summary: '이XX는 입금 확인 후 연락을 끊고 잠적하였다' },
    ],
    requirements: [
      { element: '기망행위', status: 'confirmed', detail: '허위 판매글 게시 (명품가방 보유 주장)' },
      { element: '착오', status: 'confirmed', detail: '피해자가 이를 믿고 송금' },
      { element: '처분행위', status: 'confirmed', detail: '300만원 계좌이체' },
      { element: '재산상 손해', status: 'confirmed', detail: '300만원 전액 미회수' },
    ],
    document_request: ['송금 내역', '판매 게시글 캡처', '대화 기록 캡처'],
    messages: [
      { role: 'assistant', content: '안녕하세요, 테스트 법률사무소 AI 접수 도우미입니다. 어떤 일로 연락 주셨나요?' },
      { role: 'user', content: '중고거래 사기를 당했어요. 돈만 받고 잠적해버렸어요.' },
      { role: 'assistant', content: '많이 당황스러우셨겠어요. 성함과 연락처를 알려주시겠어요?' },
      { role: 'user', content: '박지훈이요. 010-5562-8833, jihoon.park@naver.com입니다.' },
      { role: 'assistant', content: '얼마를 피해 보셨나요?' },
      { role: 'user', content: '명품 가방 산다고 300만원 보냈는데 잠수탔어요.' },
    ],
    daysAgo: 2,
  },
  {
    client_name: '김수연',
    client_phone: '010-9914-2277',
    client_email: 'suyeon.kim@kakao.com',
    case_type: '가사',
    summary_text: '이혼 소송 — 혼인 7년, 자녀 1명, 재산분할 협의 결렬',
    events: [
      { date: '2019-05-10', subject: '김수연', object: '배우자', action: '혼인신고', summary: '김수연은 2019. 5. 10. 배우자와 혼인신고를 하였다' },
      { date: '2026-01-05', subject: '김수연', object: '배우자', action: '이혼 합의 결렬', summary: '김수연은 2026. 1. 5. 배우자와 재산분할 이견으로 협의이혼이 결렬되었다' },
    ],
    requirements: [
      { element: '혼인 파탄 사유', status: 'confirmed', detail: '재산분할 이견으로 협의 결렬' },
      { element: '자녀 유무', status: 'confirmed', detail: '자녀 1명 (7세)' },
      { element: '재산 현황', status: 'unknown', detail: '구체적 재산 목록 미확인' },
      { element: '배우자 동의', status: 'denied', detail: '배우자 협의이혼 불응' },
    ],
    document_request: ['혼인관계증명서', '재산 목록 서류', '자녀 관련 서류'],
    messages: [
      { role: 'assistant', content: '안녕하세요, 테스트 법률사무소 AI 접수 도우미입니다. 어떤 일로 연락 주셨나요?' },
      { role: 'user', content: '이혼을 하고 싶은데 남편이랑 재산 문제로 계속 싸우고 있어요.' },
      { role: 'assistant', content: '힘드셨겠어요. 변호사님께 전달드릴게요. 성함과 연락처를 알려주시겠어요?' },
      { role: 'user', content: '김수연이에요. 010-9914-2277, suyeon.kim@kakao.com입니다.' },
      { role: 'assistant', content: '결혼하신 지 얼마나 되셨나요? 자녀는 있으신가요?' },
      { role: 'user', content: '7년 됐고 아이 하나 있어요. 7살이요.' },
    ],
    daysAgo: 4,
  },
  {
    client_name: '최성훈',
    client_phone: '010-7743-1156',
    client_email: 'seonghun.choi@gmail.com',
    case_type: '교통사고',
    summary_text: '교통사고 손해배상 — 과실비율 30:70 이의, 후유증 치료 중',
    events: [
      { date: '2025-12-08', subject: '피의자 차량', object: '최성훈', action: '신호 위반 추돌', summary: '2025. 12. 8. 피의자 차량이 신호를 위반하여 최성훈 차량을 추돌하였다' },
      { date: '2026-01-15', subject: '보험사', object: '최성훈', action: '과실비율 30:70 통보', summary: '보험사는 2026. 1. 15. 과실비율 30:70을 통보하였으나 최성훈은 이에 이의를 제기하였다' },
    ],
    requirements: [
      { element: '사고 경위', status: 'confirmed', detail: '상대방 신호 위반 추돌 (2025.12.8)' },
      { element: '과실 비율', status: 'unknown', detail: '보험사 30:70 통보, 이의 제기 중' },
      { element: '신체 손해', status: 'confirmed', detail: '후유증 치료 중 (진단서 있음)' },
      { element: '재산 손해', status: 'unknown', detail: '차량 수리비 미확인' },
    ],
    document_request: ['사고 사진', '블랙박스 영상', '진단서', '보험사 과실비율 통보서'],
    messages: [
      { role: 'assistant', content: '안녕하세요, 테스트 법률사무소 AI 접수 도우미입니다. 어떤 일로 연락 주셨나요?' },
      { role: 'user', content: '교통사고 났는데 보험사에서 제 과실이 30%라고 해서요.' },
      { role: 'assistant', content: '불합리하게 느껴지시겠어요. 성함과 연락처 알려주시겠어요?' },
      { role: 'user', content: '최성훈입니다. 010-7743-1156, seonghun.choi@gmail.com이에요.' },
      { role: 'assistant', content: '사고가 언제 발생했나요? 상대방 차량의 과실이 어떻게 되는 상황이었나요?' },
      { role: 'user', content: '작년 12월에 신호 위반한 차가 제 차를 들이받았는데 제 과실이 30%라고 하네요.' },
    ],
    daysAgo: 7,
  },
  {
    client_name: '이지아',
    client_phone: '010-2298-6641',
    client_email: 'jia.lee@daum.net',
    case_type: '민사',
    summary_text: '전세보증금 반환 분쟁 — 계약 만료 후 집주인 반환 거부',
    events: [
      { date: '2024-02-01', subject: '이지아', object: '임대인', action: '전세계약 체결 (보증금 2억)', summary: '이지아는 2024. 2. 1. 임대인과 보증금 2억원의 전세계약을 체결하였다' },
      { date: '2026-01-31', subject: '이지아', object: '임대인', action: '계약 만료 후 보증금 반환 요청', summary: '이지아는 계약 만료일에 보증금 반환을 요청하였으나 임대인이 거부하였다' },
    ],
    requirements: [
      { element: '임대차계약', status: 'confirmed', detail: '전세계약 체결 (2024.2.1, 보증금 2억)' },
      { element: '보증금 지급', status: 'confirmed', detail: '2억원 지급 완료' },
      { element: '계약 종료', status: 'confirmed', detail: '2026.1.31 만료' },
      { element: '반환 거부', status: 'confirmed', detail: '집주인이 새 세입자 구할 때까지 유예 주장' },
    ],
    document_request: ['전세계약서', '등기부등본', '전입세대열람원', '내용증명 사본'],
    messages: [
      { role: 'assistant', content: '안녕하세요, 테스트 법률사무소 AI 접수 도우미입니다. 어떤 일로 연락 주셨나요?' },
      { role: 'user', content: '전세 계약이 끝났는데 집주인이 보증금을 안 돌려줘요.' },
      { role: 'assistant', content: '많이 불안하시겠어요. 성함과 연락처를 알려주시겠어요?' },
      { role: 'user', content: '이지아입니다. 010-2298-6641, jia.lee@daum.net이에요.' },
      { role: 'assistant', content: '보증금이 얼마인가요? 계약 만료는 언제였나요?' },
      { role: 'user', content: '2억이에요. 이번 달 말에 만료됐는데 집주인이 새 세입자 구하면 준다고만 해요.' },
    ],
    daysAgo: 14,
  },
]

export async function POST() {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not available in production' }, { status: 403 })
  }

  // Cleanup existing mock data before re-seeding
  await supabaseAdmin.from('case_summaries').delete().like('kakao_user_id', 'mock_%')
  const mockSessions = await supabaseAdmin.from('sessions').select('id').like('kakao_user_id', 'mock_%')
  if (mockSessions.data?.length) {
    const ids = mockSessions.data.map((s) => s.id)
    await supabaseAdmin.from('messages').delete().in('session_id', ids)
    await supabaseAdmin.from('sessions').delete().like('kakao_user_id', 'mock_%')
  }

  const results: string[] = []

  for (const mock of MOCK_CASES) {
    const createdAt = new Date(Date.now() - mock.daysAgo * 24 * 60 * 60 * 1000).toISOString()

    // 1. Create session
    const { data: session, error: sErr } = await supabaseAdmin
      .from('sessions')
      .insert({
        kakao_user_id: `mock_${mock.client_phone}`,
        firm_id: FIRM_ID,
        status: 'completed',
        channel: 'web',
        created_at: createdAt,
        updated_at: createdAt,
        completed_at: createdAt,
      })
      .select('id')
      .single()

    if (sErr || !session) {
      results.push(`❌ Session failed for ${mock.client_name}: ${sErr?.message}`)
      continue
    }

    // 2. Insert messages
    const messages = mock.messages.map((m, i) => ({
      session_id: session.id,
      role: m.role,
      content: m.content,
      created_at: new Date(new Date(createdAt).getTime() + i * 30000).toISOString(),
    }))
    await supabaseAdmin.from('messages').insert(messages)

    // 3. Insert case_summary
    const summary = {
      client_name: mock.client_name,
      client_phone: mock.client_phone,
      client_email: mock.client_email,
      is_returning: false,
      case_type: mock.case_type,
      events: mock.events,
      requirements: mock.requirements,
      document_request: mock.document_request,
      summary_text: mock.summary_text,
    }

    const { error: cErr } = await supabaseAdmin.from('case_summaries').insert({
      session_id: session.id,
      firm_id: FIRM_ID,
      kakao_user_id: `mock_${mock.client_phone}`,
      client_name: mock.client_name,
      client_phone: mock.client_phone,
      case_type: mock.case_type,
      summary: summary,
      created_at: createdAt,
    })

    if (cErr) {
      results.push(`❌ Case failed for ${mock.client_name}: ${cErr.message}`)
    } else {
      results.push(`✅ ${mock.client_name} — ${mock.case_type}`)
    }
  }

  return NextResponse.json({ results })
}

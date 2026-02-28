'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

type Tab = 'galaxy' | 'iphone'

const FAQ = [
  {
    q: '갤럭시에서 녹음 파일을 못 찾겠어요.',
    a: '내 파일 앱 → 내장 저장공간 → Recordings → Call 폴더를 확인해주세요. 에이닷(A.) 전화 사용 시 TPhoneCallRecords 폴더에 저장될 수 있습니다.',
  },
  {
    q: '아이폰에서 상대방 몰래 녹음할 수 있나요?',
    a: 'iOS 기본 기능으로는 불가합니다. 녹음 시작 시 자동으로 상대방에게 고지됩니다. 참고로 한국에서는 본인 통화 녹음은 상대방 동의 없이도 합법입니다.',
  },
  {
    q: '업로드 중 끊겼어요.',
    a: '다시 업로드해주세요. 같은 파일을 중복 업로드해도 시스템이 처리합니다.',
  },
  {
    q: 'PC에서도 업로드할 수 있나요?',
    a: '네. 대시보드 녹음 업로드 메뉴에서 드래그앤드롭으로 업로드 가능합니다.',
  },
]

function StepBadge({ n }: { n: number }) {
  return (
    <div
      className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5"
      style={{ background: '#1a2b5a', color: '#fff' }}
    >
      {n}
    </div>
  )
}

function InfoBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-3 rounded-xl px-4 py-3 text-sm" style={{ background: '#f0f4ff', color: '#1a2b5a' }}>
      {children}
    </div>
  )
}

function TipBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-3 rounded-xl px-4 py-3 text-sm" style={{ background: '#f0fff4', color: '#166534' }}>
      {children}
    </div>
  )
}

export default function RecordingGuidePage() {
  const router = useRouter()
  const [tab, setTab] = useState<Tab>('galaxy')
  const [openFaq, setOpenFaq] = useState<number | null>(null)

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="flex items-center gap-2 mb-6">
        <button
          onClick={() => router.back()}
          className="text-sm text-slate-500 hover:text-slate-700"
        >
          ← 뒤로
        </button>
      </div>

      <h1 className="text-xl font-bold mb-1" style={{ color: '#1a2b5a' }}>통화 녹음 업로드 가이드</h1>
      <p className="text-sm text-slate-500 mb-6">통화를 녹음하고 업로드하면 AI가 법률 요약을 만들어 드립니다.</p>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        {(['galaxy', 'iphone'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className="flex-1 py-2.5 rounded-xl text-sm font-medium transition-colors"
            style={
              tab === t
                ? { background: '#1a2b5a', color: '#fff' }
                : { background: '#f3f5fa', color: '#64748b' }
            }
          >
            {t === 'galaxy' ? '📱 갤럭시 (Samsung)' : '🍎 아이폰 (iPhone)'}
          </button>
        ))}
      </div>

      {/* Galaxy */}
      {tab === 'galaxy' && (
        <div className="space-y-6">
          {/* Step 1 */}
          <div className="bg-white rounded-2xl p-5 shadow-sm" style={{ border: '1px solid #e4e8f1' }}>
            <div className="flex gap-3 mb-3">
              <StepBadge n={1} />
              <div>
                <div className="font-semibold text-slate-900">통화 녹음 설정 (최초 1회)</div>
                <div className="text-xs text-slate-400 mt-0.5">처음 한 번만 설정하면 이후 자동 녹음</div>
              </div>
            </div>
            <ol className="text-sm text-slate-600 space-y-1.5 ml-10">
              <li>1. 전화 앱 → 우측 상단 <span className="font-medium">⋮</span> → 설정</li>
              <li>2. <span className="font-medium">통화 녹음</span> → 자동 통화녹음 켜기</li>
              <li>3. "모든 통화" 또는 "특정 번호만" 선택</li>
            </ol>
            <InfoBox>
              ⚠️ <span className="font-medium">에이닷(A.) 전화</span> 사용 시: 에이닷 앱 내에서도 자동 녹음 설정 가능. 녹음 파일이 <code>TPhoneCallRecords</code> 폴더에 저장될 수 있습니다.
            </InfoBox>
          </div>

          {/* Step 2 */}
          <div className="bg-white rounded-2xl p-5 shadow-sm" style={{ border: '1px solid #e4e8f1' }}>
            <div className="flex gap-3 mb-3">
              <StepBadge n={2} />
              <div>
                <div className="font-semibold text-slate-900">녹음 파일 확인</div>
              </div>
            </div>
            <div className="text-sm text-slate-600 space-y-2 ml-10">
              <div>
                <span className="font-medium text-slate-700">방법 A.</span> 전화 앱 → 최근기록 → 통화 선택 → <span className="font-medium">ⓘ</span> → 마이크 아이콘
              </div>
              <div>
                <span className="font-medium text-slate-700">방법 B.</span> 내 파일 앱 → 내장 저장공간 → <code>Recordings</code> → <code>Call</code>
              </div>
            </div>
          </div>

          {/* Step 3 */}
          <div className="bg-white rounded-2xl p-5 shadow-sm" style={{ border: '1px solid #e4e8f1' }}>
            <div className="flex gap-3 mb-3">
              <StepBadge n={3} />
              <div>
                <div className="font-semibold text-slate-900">CaseFront에 업로드</div>
              </div>
            </div>
            <div className="text-sm text-slate-600 space-y-2 ml-10">
              <div>
                <span className="font-medium text-slate-700">방법 A (공유).</span> 녹음 파일 길게 누르기 → 공유 → 브라우저 선택 → CaseFront 업로드 페이지
              </div>
              <div>
                <span className="font-medium text-slate-700">방법 B (직접).</span> 대시보드 → 녹음 업로드 → 파일 선택
              </div>
            </div>
            <TipBox>
              💡 <span className="font-medium">꿀팁</span>: 대시보드를 홈화면에 추가하면 앱처럼 바로 접속됩니다. 브라우저 메뉴 → "홈 화면에 추가"
            </TipBox>
          </div>
        </div>
      )}

      {/* iPhone */}
      {tab === 'iphone' && (
        <div className="space-y-6">
          {/* Step 1 */}
          <div className="bg-white rounded-2xl p-5 shadow-sm" style={{ border: '1px solid #e4e8f1' }}>
            <div className="flex gap-3 mb-3">
              <StepBadge n={1} />
              <div>
                <div className="font-semibold text-slate-900">통화 녹음 활성화</div>
                <div className="text-xs text-slate-400 mt-0.5">iOS 18.1 이상 / 아이폰 XS 이상 필요</div>
              </div>
            </div>
            <ol className="text-sm text-slate-600 space-y-1.5 ml-10">
              <li>1. 설정 → 전화 → <span className="font-medium">통화 녹음</span> → 활성화</li>
              <li>2. 통화 중 좌측 상단 녹음 아이콘을 눌러 녹음 시작</li>
            </ol>
            <InfoBox>
              ⚠️ 상대방에게 <span className="font-medium">"이 통화가 녹음됩니다"</span> 자동 고지됩니다 (애플 정책). 갤럭시와 달리 <span className="font-medium">자동 녹음 불가</span> — 매 통화마다 수동으로 녹음 버튼을 눌러야 합니다.
            </InfoBox>
          </div>

          {/* Step 2 */}
          <div className="bg-white rounded-2xl p-5 shadow-sm" style={{ border: '1px solid #e4e8f1' }}>
            <div className="flex gap-3 mb-3">
              <StepBadge n={2} />
              <div>
                <div className="font-semibold text-slate-900">녹음 파일 확인</div>
              </div>
            </div>
            <div className="text-sm text-slate-600 ml-10 space-y-1">
              <div><span className="font-medium">메모 앱</span> → <span className="font-medium">통화 녹음</span> 폴더</div>
              <div className="text-slate-400">날짜/상대방 기준으로 정렬되어 있으며, 텍스트 전사(자동 변환)도 함께 저장됩니다.</div>
            </div>
          </div>

          {/* Step 3 */}
          <div className="bg-white rounded-2xl p-5 shadow-sm" style={{ border: '1px solid #e4e8f1' }}>
            <div className="flex gap-3 mb-3">
              <StepBadge n={3} />
              <div>
                <div className="font-semibold text-slate-900">CaseFront에 업로드</div>
              </div>
            </div>
            <div className="text-sm text-slate-600 space-y-2 ml-10">
              <div>
                <span className="font-medium text-slate-700">최초 1회.</span> Safari에서 <code>my.casefront.app</code> 접속 → 공유(□↑) → "홈 화면에 추가"
              </div>
              <div>
                <span className="font-medium text-slate-700">이후 업로드.</span> 메모 앱 → 통화 녹음 파일 → 공유 → 홈화면의 CaseFront 앱 선택
              </div>
            </div>
            <TipBox>
              💡 홈화면에 추가하면 앱처럼 보이고, 녹음 파일 공유 시 앱 목록에 <span className="font-medium">CaseFront</span>가 표시됩니다.
            </TipBox>
          </div>
        </div>
      )}

      {/* Supported formats */}
      <div className="mt-6 px-4 py-3 rounded-xl text-sm" style={{ background: '#f8f9fe', border: '1px solid #e4e8f1' }}>
        <span className="font-medium text-slate-600">지원 형식:</span>
        <span className="text-slate-500 ml-2">mp3, m4a, wav, ogg, webm · 최대 100MB (약 60분)</span>
      </div>

      {/* FAQ */}
      <div className="mt-8">
        <h2 className="text-base font-bold text-slate-800 mb-3">자주 묻는 질문</h2>
        <div className="space-y-2">
          {FAQ.map((item, i) => (
            <div
              key={i}
              className="bg-white rounded-xl overflow-hidden"
              style={{ border: '1px solid #e4e8f1' }}
            >
              <button
                className="w-full flex items-center justify-between px-4 py-3.5 text-left text-sm font-medium text-slate-800"
                onClick={() => setOpenFaq(openFaq === i ? null : i)}
              >
                <span>{item.q}</span>
                <svg
                  className={`w-4 h-4 shrink-0 ml-2 transition-transform text-slate-400 ${openFaq === i ? 'rotate-180' : ''}`}
                  fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7"/>
                </svg>
              </button>
              {openFaq === i && (
                <div className="px-4 pb-4 text-sm text-slate-600 leading-relaxed">
                  {item.a}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

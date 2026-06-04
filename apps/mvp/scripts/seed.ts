import { createClient } from '@supabase/supabase-js'
import { randomUUID } from 'crypto'

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

const TEST_EMAIL = 'test@example.com'
const TEST_PASSWORD = 'test1234'

async function seed() {
  console.log('Seeding test firm...')

  // 1. Create firm
  const { data: firm, error: firmError } = await supabaseAdmin
    .from('firms')
    .upsert(
      {
        id: randomUUID(),
        name: '테스트 법률사무소',
        slug: 'test-law',
        lawyer_name: '김변호사',
        lawyer_email: TEST_EMAIL,
        phone: '02-1234-5678',
        hours: '평일 09:00-18:00',
        specialties: ['민사', '형사', '가사', '교통사고'],
        notification_email: true,
      },
      { onConflict: 'slug' }
    )
    .select()
    .single()

  if (firmError) {
    console.error('Firm seed failed:', firmError)
    process.exit(1)
  }

  console.log('Test firm seeded:', firm.name, '(slug:', firm.slug + ')')

  // 2. Create auth user for the lawyer
  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email: TEST_EMAIL,
    password: TEST_PASSWORD,
    email_confirm: true,
  })

  if (authError) {
    if (authError.message.includes('already been registered')) {
      console.log('Auth user already exists:', TEST_EMAIL)
    } else {
      console.error('Auth user creation failed:', authError.message)
    }
  } else {
    console.log('Auth user created:', authData.user.email)
  }

  console.log('\n--- 테스트 정보 ---')
  console.log('채팅 URL:     http://localhost:3000/chat/test-law')
  console.log('대시보드 URL: http://localhost:3000/dashboard')
  console.log('로그인 이메일:', TEST_EMAIL)
  console.log('로그인 비밀번호:', TEST_PASSWORD)
}

seed()

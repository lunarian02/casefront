import { createClient } from '@supabase/supabase-js'
import { randomUUID } from 'crypto'

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

async function seed() {
  console.log('Seeding test firm...')

  const { data, error } = await supabaseAdmin
    .from('firms')
    .upsert(
      {
        id: randomUUID(),
        name: '테스트 법률사무소',
        slug: 'test-law',
        lawyer_name: '김변호사',
        lawyer_email: 'test@example.com',
        phone: '02-1234-5678',
        hours: '평일 09:00-18:00',
        specialties: ['민사', '형사', '가사', '교통사고'],
        greeting: '안녕하세요, 테스트 법률사무소입니다.',
        notification_email: true,
      },
      { onConflict: 'slug' }
    )
    .select()
    .single()

  if (error) {
    console.error('Seed failed:', error)
    process.exit(1)
  }

  console.log('Test firm seeded:', data)
  console.log('\nTest chat URL: http://localhost:3000/chat/test-law')
}

seed()

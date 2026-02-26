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
        lawyer_name: '김변호사',
        kakao_channel_id: '케이스프론트테스트',
        phone: '02-1234-5678',
        hours: '평일 09:00-18:00',
        specialties: ['민사', '형사', '가사', '교통사고'],
      },
      { onConflict: 'kakao_channel_id' }
    )
    .select()
    .single()

  if (error) {
    console.error('Seed failed:', error)
    process.exit(1)
  }

  console.log('Test firm seeded:', data)
}

seed()

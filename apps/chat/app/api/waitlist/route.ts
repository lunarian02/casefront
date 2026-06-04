import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(request: Request) {
  try {
    const { email, name, firm_name } = await request.json()

    if (!email) {
      return NextResponse.json({ error: '이메일을 입력해주세요.' }, { status: 400 })
    }

    const { error } = await supabaseAdmin.from('waitlist').insert({
      email,
      name: name ?? null,
      firm_name: firm_name ?? null,
    })

    if (error) {
      if (error.code === '23505') {
        // Unique constraint violation — duplicate email
        return NextResponse.json(
          { error: '이미 등록된 이메일입니다.' },
          { status: 409 }
        )
      }
      throw error
    }

    return NextResponse.json({ message: '대기자 명단에 등록되었습니다.' }, { status: 201 })
  } catch (error) {
    console.error('Waitlist error:', error)
    return NextResponse.json({ error: '등록 중 오류가 발생했습니다.' }, { status: 500 })
  }
}

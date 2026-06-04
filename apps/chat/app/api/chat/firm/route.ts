import { NextResponse } from 'next/server'
import { getFirmBySlug, getDefaultFirm } from '@/services/firmManager'

export async function GET(request: Request) {
  const url = new URL(request.url)
  const slug = url.searchParams.get('slug')

  const firm = slug ? await getFirmBySlug(slug) : await getDefaultFirm()
  if (!firm) return NextResponse.json({ firmName: 'AI 접수 비서' })

  return NextResponse.json({ firmName: firm.name })
}

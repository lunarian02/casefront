export default function Home() {
  return (
    <main style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', fontFamily: 'sans-serif', color: '#1a2b5a' }}>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 700 }}>CaseFront 채팅</h1>
      <p style={{ marginTop: '1rem', color: '#666' }}>올바른 채팅 링크를 통해 접속해주세요.</p>
      <p style={{ marginTop: '0.5rem', fontSize: '0.9rem', color: '#999' }}>예: /chat/your-firm-code</p>
    </main>
  )
}

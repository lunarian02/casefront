export type Channel = 'web' | 'kakao' | 'phone'

export interface IncomingMessage {
  channel: Channel
  userId: string    // web: browser-generated UUID, kakao: kakao_user_id
  firmId: string
  content: string
  timestamp: Date
}

export interface OutgoingMessage {
  channel: Channel
  content: string
}

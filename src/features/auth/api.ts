import { publicApi } from '@/lib/api-client'

export type LoginResponse = {
  token: string
  auth_data: string
  is_admin: boolean
}

/** POST /api/v2/passport/auth/login */
export async function login(email: string, password: string) {
  const res = await publicApi.post('/passport/auth/login', { email, password })
  return res.data as LoginResponse
}

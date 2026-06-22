import { create } from 'zustand'
import { getCookie, setCookie, removeCookie } from '@/lib/cookies'

const ACCESS_TOKEN = 'xboard_admin_token'
const USER_KEY = 'xboard_admin_user'

export interface AuthUser {
  email: string
  is_admin: boolean
  /** raw login token (data.token); auth_data is stored as accessToken */
  token?: string
}

interface AuthState {
  auth: {
    user: AuthUser | null
    setUser: (user: AuthUser | null) => void
    accessToken: string
    setAccessToken: (accessToken: string) => void
    resetAccessToken: () => void
    reset: () => void
  }
}

function readUser(): AuthUser | null {
  const raw = getCookie(USER_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as AuthUser
  } catch {
    return null
  }
}

export const useAuthStore = create<AuthState>()((set) => {
  const cookieState = getCookie(ACCESS_TOKEN)
  const initToken = cookieState ? JSON.parse(cookieState) : ''
  return {
    auth: {
      user: readUser(),
      setUser: (user) =>
        set((state) => {
          if (user) setCookie(USER_KEY, JSON.stringify(user))
          else removeCookie(USER_KEY)
          return { ...state, auth: { ...state.auth, user } }
        }),
      accessToken: initToken,
      setAccessToken: (accessToken) =>
        set((state) => {
          setCookie(ACCESS_TOKEN, JSON.stringify(accessToken))
          return { ...state, auth: { ...state.auth, accessToken } }
        }),
      resetAccessToken: () =>
        set((state) => {
          removeCookie(ACCESS_TOKEN)
          return { ...state, auth: { ...state.auth, accessToken: '' } }
        }),
      reset: () =>
        set((state) => {
          removeCookie(ACCESS_TOKEN)
          removeCookie(USER_KEY)
          return {
            ...state,
            auth: { ...state.auth, user: null, accessToken: '' },
          }
        }),
    },
  }
})

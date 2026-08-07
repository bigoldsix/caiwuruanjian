import { create } from 'zustand'
import { authApi } from '../api'

interface User {
  id: number
  name: string
  email: string
  department_id: number | null
  department_name: string | null
  role: string
  is_active: boolean
  must_change_password: boolean
}

interface AuthState {
  token: string | null
  refreshToken: string | null
  user: User | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  fetchUser: () => Promise<void>
  logout: () => void
}

export const useAuthStore = create<AuthState>((set, get) => ({
  token: localStorage.getItem('token'),
  refreshToken: localStorage.getItem('refreshToken'),
  user: null,
  loading: false,

  login: async (email, password) => {
    const res = await authApi.login(email, password)
    const { access_token, refresh_token } = res.data
    localStorage.setItem('token', access_token)
    localStorage.setItem('refreshToken', refresh_token)
    set({ token: access_token, refreshToken: refresh_token })
  },

  fetchUser: async () => {
    set({ loading: true })
    try {
      const res = await authApi.me()
      set({ user: res.data, loading: false })
    } catch {
      get().logout()
    }
  },

  logout: () => {
    localStorage.removeItem('token')
    localStorage.removeItem('refreshToken')
    set({ token: null, refreshToken: null, user: null })
  },
}))

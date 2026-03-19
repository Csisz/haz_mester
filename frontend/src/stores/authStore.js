import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import api from '../utils/api'

const setAuthHeader = (token) => {
  if (token) {
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`
  } else {
    delete api.defaults.headers.common['Authorization']
  }
}

export const useAuthStore = create(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isAuthenticated: false,

      login: async (username, password) => {
        const res = await api.post('/auth/login', { username, password })
        const { access_token, user } = res.data
        setAuthHeader(access_token)
        set({ user, token: access_token, isAuthenticated: true })
        return user
      },

      logout: () => {
        setAuthHeader(null)
        set({ user: null, token: null, isAuthenticated: false })
      },

      refreshUser: async () => {
        const token = get().token
        if (token) setAuthHeader(token)
        try {
          const res = await api.get('/auth/me')
          set({ user: res.data })
        } catch {
          get().logout()
        }
      },

      changePassword: async (current_password, new_password) => {
        const token = get().token
        if (token) setAuthHeader(token)
        await api.post('/auth/change-password', { current_password, new_password })
        set(state => ({ user: { ...state.user, must_change_password: false } }))
      },
    }),
    {
      name: 'epitesz-auth',
      onRehydrateStorage: () => (state) => {
        if (state?.token) {
          setAuthHeader(state.token)
        }
      }
    }
  )
)

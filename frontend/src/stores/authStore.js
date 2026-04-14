import { create } from 'zustand'
import api from '../utils/api'

const TOKEN_KEY = 'epitesz_token'
const USER_KEY = 'epitesz_user'

// Read token from localStorage on startup
const savedToken = localStorage.getItem(TOKEN_KEY)
const savedUser = (() => { try { return JSON.parse(localStorage.getItem(USER_KEY)) } catch { return null } })()
if (savedToken) {
  api.defaults.headers.common['Authorization'] = `Bearer ${savedToken}`
}

export const useAuthStore = create((set, get) => ({
  user: savedUser,
  token: savedToken,
  isAuthenticated: !!savedToken,

  login: async (username, password) => {
    const res = await api.post('/auth/login', { username, password })
    const { access_token, user } = res.data
    // Save to localStorage directly
    localStorage.setItem(TOKEN_KEY, access_token)
    localStorage.setItem(USER_KEY, JSON.stringify(user))
    // Set axios header
    api.defaults.headers.common['Authorization'] = `Bearer ${access_token}`
    set({ user, token: access_token, isAuthenticated: true })
    return user
  },

  logout: () => {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(USER_KEY)
    delete api.defaults.headers.common['Authorization']
    set({ user: null, token: null, isAuthenticated: false })
  },

  refreshUser: async () => {
    const token = localStorage.getItem(TOKEN_KEY)
    if (!token) { get().logout(); return }
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`
    try {
      const res = await api.get('/auth/me')
      localStorage.setItem(USER_KEY, JSON.stringify(res.data))
      set({ user: res.data })
    } catch {
      get().logout()
    }
  },

  changePassword: async (current_password, new_password) => {
    const token = localStorage.getItem(TOKEN_KEY)
    if (token) api.defaults.headers.common['Authorization'] = `Bearer ${token}`
    await api.post('/auth/change-password', { current_password, new_password })
    set(state => ({ user: { ...state.user, must_change_password: false } }))
  },
}))

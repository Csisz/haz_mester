import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  timeout: 30000,
})

// Always inject token from localStorage before every request
api.interceptors.request.use((config) => {
  try {
    const stored = localStorage.getItem('epitesz-auth')
    if (stored) {
      const token = JSON.parse(stored)?.state?.token
      if (token) {
        config.headers['Authorization'] = `Bearer ${token}`
      }
    }
  } catch (e) {}
  
  // Remove trailing slash to prevent 307 redirects that drop Authorization header
  if (config.url && config.url.endsWith('/') && config.url.length > 1) {
    config.url = config.url.slice(0, -1)
  }
  
  return config
})

api.interceptors.response.use(
  res => res,
  err => {
    if (err.response?.status === 401) {
      const path = window.location.pathname
      if (path !== '/login' && path !== '/change-password') {
        localStorage.removeItem('epitesz-auth')
        window.location.href = '/login'
      }
    }
    return Promise.reject(err)
  }
)

export default api

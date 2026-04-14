import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  timeout: 120000, // 120 seconds - AI endpoints need more time
})

// Always inject token from localStorage before every request
api.interceptors.request.use((config) => {
  try {
    const stored = localStorage.getItem('epitesz_token')
    if (stored) {
      config.headers['Authorization'] = `Bearer ${stored}`
    }
  } catch (e) {}
  
  // Remove trailing slash to prevent 307 redirects
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
        localStorage.removeItem('epitesz_token')
        localStorage.removeItem('epitesz_user')
        window.location.href = '/login'
      }
    }
    return Promise.reject(err)
  }
)

export default api

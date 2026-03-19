import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../stores/authStore'
import { Building2, Lock, AlertCircle, CheckCircle, Eye, EyeOff } from 'lucide-react'
import api from '../utils/api'

export default function ChangePasswordPage() {
  const [current, setCurrent] = useState('')
  const [newPwd, setNewPwd] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPwd, setShowPwd] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { changePassword, user, logout, token } = useAuthStore()
  const navigate = useNavigate()

  // Ensure auth header is set when this page loads
  useEffect(() => {
    if (token) {
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`
    }
  }, [token])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (newPwd !== confirm) { setError('Az új jelszavak nem egyeznek'); return }
    if (newPwd.length < 8) { setError('A jelszónak legalább 8 karakter hosszúnak kell lennie'); return }
    setLoading(true)
    try {
      await changePassword(current, newPwd)
      navigate('/')
    } catch (err) {
      setError(err.response?.data?.detail || 'Hiba történt')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-emerald-600 rounded-2xl mb-4">
            <Building2 size={32} className="text-white" />
          </div>
          <h1 className="font-display text-2xl font-bold text-white">Jelszóváltoztatás</h1>
          <p className="text-slate-400 text-sm mt-1">Üdvözlünk, <strong>{user?.full_name}</strong>!</p>
          <p className="text-slate-500 text-xs mt-1">Az első bejelentkezéshez jelszóváltoztatás szükséges</p>
        </div>

        <div className="card p-6">
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-900/30 border border-red-800 rounded-lg text-red-300 text-sm mb-4">
              <AlertCircle size={16} />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">Jelenlegi jelszó</label>
              <div className="relative">
                <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input type={showPwd ? 'text' : 'password'} value={current} onChange={e => setCurrent(e.target.value)}
                  className="input pl-9" placeholder="Generált jelszó" required />
              </div>
            </div>
            <div>
              <label className="label">Új jelszó</label>
              <div className="relative">
                <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input type={showPwd ? 'text' : 'password'} value={newPwd} onChange={e => setNewPwd(e.target.value)}
                  className="input pl-9 pr-10" placeholder="Min. 8 karakter" required />
                <button type="button" onClick={() => setShowPwd(!showPwd)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
                  {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            <div>
              <label className="label">Új jelszó megerősítése</label>
              <div className="relative">
                <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input type={showPwd ? 'text' : 'password'} value={confirm} onChange={e => setConfirm(e.target.value)}
                  className="input pl-9" placeholder="Jelszó ismétlése" required />
                {confirm && newPwd && (
                  <div className={`absolute right-3 top-1/2 -translate-y-1/2 ${confirm === newPwd ? 'text-emerald-400' : 'text-red-400'}`}>
                    {confirm === newPwd ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
                  </div>
                )}
              </div>
            </div>
            <button type="submit" disabled={loading}
              className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white py-2.5 rounded-lg font-medium transition-colors flex items-center justify-center gap-2">
              {loading
                ? <><div className="w-4 h-4 border-2 border-emerald-300 border-t-transparent rounded-full animate-spin" />Mentés...</>
                : 'Jelszó mentése'}
            </button>
          </form>
          <button onClick={() => { logout(); navigate('/login') }}
            className="w-full text-slate-500 hover:text-slate-300 text-sm mt-3 py-1 transition-colors">
            Kijelentkezés
          </button>
        </div>
      </div>
    </div>
  )
}

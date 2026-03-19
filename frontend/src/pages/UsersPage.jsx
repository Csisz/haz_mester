import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../utils/api'
import { useAuthStore } from '../stores/authStore'
import { Users, Plus, KeyRound, UserX, Shield, User, AlertCircle, Copy, Check } from 'lucide-react'

export default function UsersPage() {
  const { user: currentUser } = useAuthStore()
  const qc = useQueryClient()
  const [showNew, setShowNew] = useState(false)
  const [newUser, setNewUser] = useState({ username: '', full_name: '', email: '', role: 'standard' })
  const [generatedPwd, setGeneratedPwd] = useState(null)
  const [copied, setCopied] = useState(false)

  const { data: users = [] } = useQuery({
    queryKey: ['all-users'],
    queryFn: () => api.get('/users').then(r => r.data)
  })

  const createUser = useMutation({
    mutationFn: (data) => api.post('/users', data),
    onSuccess: (res) => {
      qc.invalidateQueries(['all-users'])
      setGeneratedPwd({ username: res.data.username, password: res.data.generated_password })
      setShowNew(false)
      setNewUser({ username: '', full_name: '', email: '', role: 'standard' })
    }
  })

  const resetPassword = useMutation({
    mutationFn: (userId) => api.post(`/users/${userId}/reset-password`),
    onSuccess: (res) => setGeneratedPwd({ username: '(felhasználó)', password: res.data.generated_password })
  })

  const toggleActive = useMutation({
    mutationFn: ({ userId, is_active }) => api.put(`/users/${userId}`, { is_active }),
    onSuccess: () => qc.invalidateQueries(['all-users'])
  })

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (currentUser?.role !== 'admin') {
    return (
      <div className="p-6 flex items-center justify-center">
        <div className="text-center">
          <Shield size={48} className="text-slate-600 mx-auto mb-3" />
          <p className="text-slate-400">Admin jogosultság szükséges</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-white">Felhasználók</h1>
          <p className="text-slate-400 text-sm mt-0.5">{users.length} aktív felhasználó</p>
        </div>
        <button onClick={() => setShowNew(true)} className="btn-primary"><Plus size={16} /> Új felhasználó</button>
      </div>

      {/* Generated password notification */}
      {generatedPwd && (
        <div className="card p-4 border-emerald-600/40 bg-emerald-900/10">
          <div className="flex items-start gap-3">
            <AlertCircle size={16} className="text-emerald-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-emerald-300 mb-2">Generált jelszó — mentsd el most!</p>
              <div className="flex items-center gap-2 bg-slate-800 rounded-lg p-2">
                <code className="text-emerald-300 text-sm flex-1">{generatedPwd.username} : {generatedPwd.password}</code>
                <button onClick={() => copyToClipboard(`${generatedPwd.username}:${generatedPwd.password}`)}
                  className="text-slate-400 hover:text-white transition-colors">
                  {copied ? <Check size={16} className="text-emerald-400" /> : <Copy size={16} />}
                </button>
              </div>
            </div>
            <button onClick={() => setGeneratedPwd(null)} className="text-slate-500 hover:text-white">✕</button>
          </div>
        </div>
      )}

      {/* New user form */}
      {showNew && (
        <div className="card p-5 border-emerald-600/30">
          <h3 className="font-medium text-white mb-4 text-sm">Új felhasználó</h3>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Felhasználónév *</label>
              <input className="input" value={newUser.username} onChange={e => setNewUser(p => ({...p, username: e.target.value}))} placeholder="pl. janos" />
            </div>
            <div>
              <label className="label">Teljes név *</label>
              <input className="input" value={newUser.full_name} onChange={e => setNewUser(p => ({...p, full_name: e.target.value}))} placeholder="pl. Kovács János" />
            </div>
            <div>
              <label className="label">Email</label>
              <input type="email" className="input" value={newUser.email} onChange={e => setNewUser(p => ({...p, email: e.target.value}))} placeholder="janos@example.com" />
            </div>
            <div>
              <label className="label">Szerepkör</label>
              <select className="input" value={newUser.role} onChange={e => setNewUser(p => ({...p, role: e.target.value}))}>
                <option value="standard">Felhasználó</option>
                <option value="admin">Adminisztrátor</option>
              </select>
            </div>
          </div>
          <div className="flex gap-2 justify-end mt-4">
            <button onClick={() => setShowNew(false)} className="btn-secondary">Mégsem</button>
            <button onClick={() => createUser.mutate(newUser)} disabled={!newUser.username || !newUser.full_name || createUser.isPending} className="btn-primary">
              {createUser.isPending ? 'Létrehozás...' : 'Felhasználó létrehozása'}
            </button>
          </div>
        </div>
      )}

      {/* User list */}
      <div className="card divide-y divide-slate-800">
        {users.map(u => (
          <div key={u.id} className="flex items-center gap-4 p-4">
            <div className="w-10 h-10 rounded-full bg-emerald-700 flex items-center justify-center text-white font-bold flex-shrink-0">
              {u.full_name?.[0] || u.username?.[0]}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="font-medium text-white">{u.full_name || u.username}</p>
                {u.role === 'admin' && (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs bg-amber-900/50 text-amber-300">
                    <Shield size={10} /> Admin
                  </span>
                )}
              </div>
              <p className="text-sm text-slate-500">@{u.username}{u.email ? ` · ${u.email}` : ''}</p>
            </div>
            {u.id !== currentUser?.id && (
              <div className="flex gap-2 flex-shrink-0">
                <button onClick={() => resetPassword.mutate(u.id)} className="btn-secondary text-xs">
                  <KeyRound size={13} /> Jelszó reset
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../utils/api'
import { formatCurrency, formatDate } from '../utils/helpers'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis } from 'recharts'
import { Plus, TrendingUp, TrendingDown, DollarSign, Trash2 } from 'lucide-react'
import { useAuthStore } from '../stores/authStore'

const CATEGORIES = { material: 'Anyag', labor: 'Munka', design: 'Tervezés', permit: 'Engedély', other: 'Egyéb' }
const TYPES = { expense: 'Kiadás', income: 'Bevétel', estimate: 'Becslés' }
const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6']

export default function FinancePage() {
  const { user } = useAuthStore()
  const qc = useQueryClient()
  const [showNew, setShowNew] = useState(false)
  const [form, setForm] = useState({ type: 'expense', category: 'material', description: '', amount: '', vendor: '', invoice_number: '' })

  const { data: projects = [] } = useQuery({ queryKey: ['projects'], queryFn: () => api.get('/projects').then(r => r.data) })
  const mainProject = projects[0]

  const { data: entries = [] } = useQuery({
    queryKey: ['finance', mainProject?.id],
    queryFn: () => api.get(`/finance/project/${mainProject.id}`).then(r => r.data),
    enabled: !!mainProject?.id
  })

  const { data: summary } = useQuery({
    queryKey: ['finance-summary', mainProject?.id],
    queryFn: () => api.get(`/finance/project/${mainProject.id}/summary`).then(r => r.data),
    enabled: !!mainProject?.id
  })

  const createEntry = useMutation({
    mutationFn: (data) => api.post('/finance', { ...data, project_id: mainProject.id, amount: parseFloat(data.amount) }),
    onSuccess: () => { qc.invalidateQueries(['finance', mainProject?.id]); qc.invalidateQueries(['finance-summary', mainProject?.id]); setShowNew(false); setForm({ type: 'expense', category: 'material', description: '', amount: '', vendor: '', invoice_number: '' }) }
  })

  const deleteEntry = useMutation({
    mutationFn: (id) => api.delete(`/finance/${id}`),
    onSuccess: () => { qc.invalidateQueries(['finance', mainProject?.id]); qc.invalidateQueries(['finance-summary', mainProject?.id]) }
  })

  const catData = summary ? Object.entries(summary.by_category || {}).map(([k, v]) => ({
    name: CATEGORIES[k] || k, value: v
  })) : []

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-white">Pénzügyek</h1>
          <p className="text-slate-400 text-sm mt-0.5">Projekt: {mainProject?.name || '...'}</p>
        </div>
        <button onClick={() => setShowNew(true)} className="btn-primary"><Plus size={16} /> Bejegyzés</button>
      </div>

      {/* Summary cards */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="card p-4">
            <div className="flex items-center gap-2 mb-2">
              <TrendingDown size={16} className="text-red-400" />
              <span className="text-xs text-slate-400">Kiadások</span>
            </div>
            <p className="text-xl font-bold text-white">{formatCurrency(summary.total_expenses)}</p>
          </div>
          <div className="card p-4">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp size={16} className="text-emerald-400" />
              <span className="text-xs text-slate-400">Bevételek</span>
            </div>
            <p className="text-xl font-bold text-emerald-400">{formatCurrency(summary.total_income)}</p>
          </div>
          <div className="card p-4">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign size={16} className="text-amber-400" />
              <span className="text-xs text-slate-400">Tervezett</span>
            </div>
            <p className="text-xl font-bold text-white">{formatCurrency(summary.total_estimated)}</p>
          </div>
          <div className="card p-4">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign size={16} className={summary.balance >= 0 ? 'text-emerald-400' : 'text-red-400'} />
              <span className="text-xs text-slate-400">Egyenleg</span>
            </div>
            <p className={`text-xl font-bold ${summary.balance >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {formatCurrency(summary.balance)}
            </p>
          </div>
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Chart */}
        {catData.length > 0 && (
          <div className="card p-5">
            <h2 className="font-medium text-white text-sm mb-4">Kiadások kategóriánként</h2>
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie data={catData} cx="50%" cy="50%" outerRadius={70} dataKey="value" label={({name, percent}) => `${name} ${(percent*100).toFixed(0)}%`} labelLine={false} fontSize={10}>
                  {catData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 12 }}
                  formatter={v => formatCurrency(v)} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* New entry form */}
        {showNew && (
          <div className="lg:col-span-2 card p-5 border-emerald-600/30">
            <h3 className="font-medium text-white mb-4 text-sm">Új pénzügyi bejegyzés</h3>
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="label">Típus</label>
                <select className="input" value={form.type} onChange={e => setForm(p => ({...p, type: e.target.value}))}>
                  {Object.entries(TYPES).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Kategória</label>
                <select className="input" value={form.category} onChange={e => setForm(p => ({...p, category: e.target.value}))}>
                  {Object.entries(CATEGORIES).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="label">Leírás *</label>
                <input className="input" value={form.description} onChange={e => setForm(p => ({...p, description: e.target.value}))} placeholder="pl. Bitumenes lemez anyagköltség" />
              </div>
              <div>
                <label className="label">Összeg (HUF) *</label>
                <input type="number" className="input" value={form.amount} onChange={e => setForm(p => ({...p, amount: e.target.value}))} placeholder="0" />
              </div>
              <div>
                <label className="label">Szállító / Partner</label>
                <input className="input" value={form.vendor} onChange={e => setForm(p => ({...p, vendor: e.target.value}))} placeholder="Cég neve" />
              </div>
              <div>
                <label className="label">Számla száma</label>
                <input className="input" value={form.invoice_number} onChange={e => setForm(p => ({...p, invoice_number: e.target.value}))} placeholder="2024/001" />
              </div>
            </div>
            <div className="flex gap-2 justify-end mt-4">
              <button onClick={() => setShowNew(false)} className="btn-secondary">Mégsem</button>
              <button onClick={() => createEntry.mutate(form)} disabled={!form.description || !form.amount || createEntry.isPending} className="btn-primary">
                {createEntry.isPending ? 'Mentés...' : 'Mentés'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Entries table */}
      <div className="card overflow-hidden">
        <div className="p-4 border-b border-slate-800">
          <h2 className="font-medium text-white text-sm">Bejegyzések ({entries.length})</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800">
                <th className="text-left p-3 text-xs text-slate-500 font-medium">Leírás</th>
                <th className="text-left p-3 text-xs text-slate-500 font-medium">Típus</th>
                <th className="text-left p-3 text-xs text-slate-500 font-medium">Kategória</th>
                <th className="text-right p-3 text-xs text-slate-500 font-medium">Összeg</th>
                <th className="text-left p-3 text-xs text-slate-500 font-medium">Szállító</th>
                <th className="text-left p-3 text-xs text-slate-500 font-medium">Dátum</th>
                <th className="p-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {entries.length === 0 ? (
                <tr><td colSpan={7} className="p-8 text-center text-slate-500">Nincsenek bejegyzések</td></tr>
              ) : entries.map(e => (
                <tr key={e.id} className="hover:bg-slate-800/30 transition-colors">
                  <td className="p-3 text-slate-200 max-w-xs">
                    <p className="truncate">{e.description}</p>
                    {e.invoice_number && <p className="text-xs text-slate-500">{e.invoice_number}</p>}
                  </td>
                  <td className="p-3">
                    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${
                      e.type === 'expense' ? 'bg-red-900/50 text-red-300' :
                      e.type === 'income' ? 'bg-emerald-900/50 text-emerald-300' :
                      'bg-slate-700 text-slate-300'
                    }`}>{TYPES[e.type]}</span>
                  </td>
                  <td className="p-3 text-slate-400 text-xs">{CATEGORIES[e.category]}</td>
                  <td className={`p-3 text-right font-semibold ${e.type === 'income' ? 'text-emerald-400' : 'text-white'}`}>
                    {e.type === 'income' ? '+' : '-'}{formatCurrency(e.amount)}
                  </td>
                  <td className="p-3 text-slate-400 text-xs">{e.vendor || '—'}</td>
                  <td className="p-3 text-slate-500 text-xs">{formatDate(e.date)}</td>
                  <td className="p-3">
                    {(user?.role === 'admin' || e.created_by?.id === user?.id) && (
                      <button onClick={() => { if (confirm('Törlöd?')) deleteEntry.mutate(e.id) }} className="text-slate-600 hover:text-red-400 transition-colors">
                        <Trash2 size={14} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

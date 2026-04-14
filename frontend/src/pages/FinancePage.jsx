import React, { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../utils/api'
import { formatCurrency, formatDate } from '../utils/helpers'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Legend } from 'recharts'
import { Plus, TrendingUp, TrendingDown, DollarSign, Trash2, Download, Filter, X, FileSpreadsheet, BarChart2, Pencil, Check } from 'lucide-react'
import { useAuthStore } from '../stores/authStore'

const CATEGORIES = { material: 'Anyag', labor: 'Munka', design: 'Tervezés', permit: 'Engedély', other: 'Egyéb' }
const TYPES = { expense: 'Kiadás', income: 'Bevétel', estimate: 'Becslés' }
const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#f43f5e']

const EMPTY_FILTERS = { search: '', type: '', category: '', vendor: '', paidBy: '', dateFrom: '', dateTo: '', amountMin: '', amountMax: '' }

function exportToCSV(entries) {
  const headers = ['Leírás', 'Típus', 'Kategória', 'Összeg (HUF)', 'Szállító / Partner', 'Számlaszám', 'Dátum']
  const rows = entries.map(e => [
    `"${(e.description || '').replace(/"/g, '""')}"`,
    TYPES[e.type] || e.type,
    CATEGORIES[e.category] || e.category,
    e.amount,
    `"${(e.vendor || '').replace(/"/g, '""')}"`,
    `"${(e.invoice_number || '').replace(/"/g, '""')}"`,
    e.date ? e.date.split('T')[0] : ''
  ])
  const bom = '\uFEFF'
  const csv = bom + [headers.join(';'), ...rows.map(r => r.join(';'))].join('\r\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `penzugyi_bejegyzesek_${new Date().toISOString().split('T')[0]}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

function applyFilters(entries, filters) {
  return entries.filter(e => {
    if (filters.search && !`${e.description} ${e.vendor} ${e.invoice_number}`.toLowerCase().includes(filters.search.toLowerCase())) return false
    if (filters.type && e.type !== filters.type) return false
    if (filters.category && e.category !== filters.category) return false
    if (filters.vendor && !(e.vendor || '').toLowerCase().includes(filters.vendor.toLowerCase())) return false
    if (filters.paidBy && !(e.paid_by_name || '').toLowerCase().includes(filters.paidBy.toLowerCase())) return false
    if (filters.dateFrom && e.date && e.date.split('T')[0] < filters.dateFrom) return false
    if (filters.dateTo && e.date && e.date.split('T')[0] > filters.dateTo) return false
    if (filters.amountMin && e.amount < parseFloat(filters.amountMin)) return false
    if (filters.amountMax && e.amount > parseFloat(filters.amountMax)) return false
    return true
  })
}

export default function FinancePage() {
  const { user } = useAuthStore()
  const qc = useQueryClient()
  const [tab, setTab] = useState('entries') // 'entries' | 'report'
  const [showNew, setShowNew] = useState(false)
  const [showFilters, setShowFilters] = useState(false)
  const [filters, setFilters] = useState(EMPTY_FILTERS)
  const [form, setForm] = useState({ type: 'expense', category: 'material', description: '', amount: '', vendor: '', invoice_number: '' })
  const [editId, setEditId] = useState(null)
  const [editForm, setEditForm] = useState({})

  const { data: projects = [] } = useQuery({ queryKey: ['projects'], queryFn: () => api.get('/projects').then(r => r.data) })
  const { data: users = [] } = useQuery({ queryKey: ['users'], queryFn: () => api.get('/users').then(r => r.data) })
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
    onSuccess: () => {
      qc.invalidateQueries(['finance', mainProject?.id])
      qc.invalidateQueries(['finance-summary', mainProject?.id])
      setShowNew(false)
      setForm({ type: 'expense', category: 'material', description: '', amount: '', vendor: '', invoice_number: '' })
    }
  })

  const deleteEntry = useMutation({
    mutationFn: (id) => api.delete(`/finance/${id}`),
    onSuccess: () => {
      qc.invalidateQueries(['finance', mainProject?.id])
      qc.invalidateQueries(['finance-summary', mainProject?.id])
    }
  })

  const updateEntry = useMutation({
    mutationFn: ({ id, data }) => api.put(`/finance/${id}`, { ...data, amount: parseFloat(data.amount) }),
    onSuccess: () => {
      qc.invalidateQueries(['finance', mainProject?.id])
      qc.invalidateQueries(['finance-summary', mainProject?.id])
      setEditId(null)
      setEditForm({})
    }
  })

  const startEdit = (e) => {
    setEditId(e.id)
    setEditForm({
      type: e.type,
      category: e.category,
      description: e.description,
      amount: e.amount,
      vendor: e.vendor || '',
      invoice_number: e.invoice_number || '',
      date: e.date ? e.date.split('T')[0] : ''
    })
  }

  const filteredEntries = useMemo(() => applyFilters(entries, filters), [entries, filters])
  const activeFilterCount = Object.values(filters).filter(Boolean).length

  const catData = summary ? Object.entries(summary.by_category || {}).map(([k, v]) => ({ name: CATEGORIES[k] || k, value: v })) : []

  // Report calculations
  const reportData = useMemo(() => {
    const expenses = entries.filter(e => e.type === 'expense')
    const incomes = entries.filter(e => e.type === 'income')

    // By vendor (top spends)
    const byVendor = {}
    expenses.forEach(e => {
      const key = e.vendor || '(ismeretlen)'
      byVendor[key] = (byVendor[key] || 0) + e.amount
    })
    const vendorList = Object.entries(byVendor).map(([name, total]) => ({ name, total })).sort((a, b) => b.total - a.total)

    // By category
    const byCat = {}
    expenses.forEach(e => {
      const key = CATEGORIES[e.category] || e.category
      byCat[key] = (byCat[key] || 0) + e.amount
    })
    const catList = Object.entries(byCat).map(([name, total]) => ({ name, total })).sort((a, b) => b.total - a.total)

    // Monthly breakdown (last 12 months)
    const monthly = {}
    entries.forEach(e => {
      if (!e.date) return
      const month = e.date.substring(0, 7) // YYYY-MM
      if (!monthly[month]) monthly[month] = { month, expense: 0, income: 0, estimate: 0 }
      monthly[month][e.type] = (monthly[month][e.type] || 0) + e.amount
    })
    const monthlyList = Object.values(monthly).sort((a, b) => a.month.localeCompare(b.month))

    // Top income sources
    const byIncomeSource = {}
    incomes.forEach(e => {
      const key = e.vendor || e.description || '(ismeretlen)'
      byIncomeSource[key] = (byIncomeSource[key] || 0) + e.amount
    })
    const incomeSourceList = Object.entries(byIncomeSource).map(([name, total]) => ({ name, total })).sort((a, b) => b.total - a.total)

    return { vendorList, catList, monthlyList, incomeSourceList }
  }, [entries])

  const setFilter = (key, val) => setFilters(f => ({ ...f, [key]: val }))
  const clearFilters = () => setFilters(EMPTY_FILTERS)

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
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
                <Pie data={catData} cx="50%" cy="50%" outerRadius={70} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false} fontSize={10}>
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
                <select className="input" value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value }))}>
                  {Object.entries(TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Kategória</label>
                <select className="input" value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))}>
                  {Object.entries(CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="label">Leírás *</label>
                <input className="input" value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} placeholder="pl. Bitumenes lemez anyagköltség" />
              </div>
              <div>
                <label className="label">Összeg (HUF) *</label>
                <input type="number" className="input" value={form.amount} onChange={e => setForm(p => ({ ...p, amount: e.target.value }))} placeholder="0" />
              </div>
              <div>
                <label className="label">Szállító / Partner</label>
                <input className="input" value={form.vendor} onChange={e => setForm(p => ({ ...p, vendor: e.target.value }))} placeholder="Cég neve" />
              </div>
              <div>
                <label className="label">Számla száma</label>
                <input className="input" value={form.invoice_number} onChange={e => setForm(p => ({ ...p, invoice_number: e.target.value }))} placeholder="2024/001" />
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

      {/* Tabs */}
      <div className="flex gap-1 border-b border-slate-800">
        <button onClick={() => setTab('entries')} className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${tab === 'entries' ? 'border-emerald-500 text-emerald-400' : 'border-transparent text-slate-400 hover:text-slate-200'}`}>
          <Filter size={14} /> Bejegyzések
        </button>
        <button onClick={() => setTab('report')} className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${tab === 'report' ? 'border-emerald-500 text-emerald-400' : 'border-transparent text-slate-400 hover:text-slate-200'}`}>
          <BarChart2 size={14} /> Riport
        </button>
      </div>

      {/* ── ENTRIES TAB ── */}
      {tab === 'entries' && (
        <div className="space-y-4">
          {/* Filter bar */}
          <div className="card p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowFilters(f => !f)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${showFilters ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-600/30' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}
                >
                  <Filter size={13} /> Szűrők {activeFilterCount > 0 && <span className="bg-emerald-500 text-white rounded-full w-4 h-4 flex items-center justify-center text-[10px]">{activeFilterCount}</span>}
                </button>
                {activeFilterCount > 0 && (
                  <button onClick={clearFilters} className="flex items-center gap-1 px-2 py-1.5 text-xs text-slate-400 hover:text-red-400 transition-colors">
                    <X size={12} /> Törlés
                  </button>
                )}
              </div>
              <button
                onClick={() => exportToCSV(filteredEntries)}
                disabled={filteredEntries.length === 0}
                className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed text-slate-300 hover:text-white rounded-lg text-xs font-medium transition-colors"
              >
                <FileSpreadsheet size={13} /> Excel export ({filteredEntries.length})
              </button>
            </div>

            {/* Quick search always visible */}
            <input
              className="input text-sm"
              placeholder="Keresés leírásban, szállítóban, számlaszámban..."
              value={filters.search}
              onChange={e => setFilter('search', e.target.value)}
            />

            {/* Extended filters */}
            {showFilters && (
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
                <div>
                  <label className="label">Típus</label>
                  <select className="input text-sm" value={filters.type} onChange={e => setFilter('type', e.target.value)}>
                    <option value="">Összes típus</option>
                    {Object.entries(TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Kategória</label>
                  <select className="input text-sm" value={filters.category} onChange={e => setFilter('category', e.target.value)}>
                    <option value="">Összes kategória</option>
                    {Object.entries(CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Szállító / Partner</label>
                  <input className="input text-sm" placeholder="Cég neve..." value={filters.vendor} onChange={e => setFilter('vendor', e.target.value)} />
                </div>
                <div>
                  <label className="label">Ki fizette?</label>
                  <select className="input text-sm" value={filters.paidBy} onChange={e => setFilter('paidBy', e.target.value)}>
                    <option value="">Mindenki</option>
                    {users.map(u => <option key={u.id} value={u.full_name}>{u.full_name}</option>)}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="label">Dátumtól</label>
                    <input type="date" className="input text-sm" value={filters.dateFrom} onChange={e => setFilter('dateFrom', e.target.value)} />
                  </div>
                  <div>
                    <label className="label">Dátumig</label>
                    <input type="date" className="input text-sm" value={filters.dateTo} onChange={e => setFilter('dateTo', e.target.value)} />
                  </div>
                </div>
                <div>
                  <label className="label">Min. összeg (HUF)</label>
                  <input type="number" className="input text-sm" placeholder="0" value={filters.amountMin} onChange={e => setFilter('amountMin', e.target.value)} />
                </div>
                <div>
                  <label className="label">Max. összeg (HUF)</label>
                  <input type="number" className="input text-sm" placeholder="∞" value={filters.amountMax} onChange={e => setFilter('amountMax', e.target.value)} />
                </div>
              </div>
            )}
          </div>

          {/* Entries table */}
          <div className="card overflow-hidden">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <h2 className="font-medium text-white text-sm">
                Bejegyzések
                <span className="ml-2 text-slate-400 font-normal">
                  {filteredEntries.length !== entries.length ? `${filteredEntries.length} / ${entries.length}` : entries.length}
                </span>
              </h2>
              {filteredEntries.length > 0 && (
                <span className="text-xs text-slate-500">
                  Szűrt összeg: <span className="text-white font-medium">{formatCurrency(filteredEntries.reduce((s, e) => s + (e.type === 'income' ? e.amount : -e.amount), 0))}</span>
                </span>
              )}
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
                  {filteredEntries.length === 0 ? (
                    <tr><td colSpan={7} className="p-8 text-center text-slate-500">
                      {activeFilterCount > 0 ? 'Nincs találat a szűrőkre' : 'Nincsenek bejegyzések'}
                    </td></tr>
                  ) : filteredEntries.map(e => {
                    const canEdit = user?.role === 'admin' || e.created_by?.id === user?.id
                    if (editId === e.id) {
                      return (
                        <tr key={e.id} className="bg-slate-800/50">
                          <td className="p-2" colSpan={7}>
                            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2">
                              <div className="lg:col-span-2">
                                <label className="label">Leírás</label>
                                <input className="input text-sm" value={editForm.description} onChange={ev => setEditForm(p => ({ ...p, description: ev.target.value }))} />
                              </div>
                              <div>
                                <label className="label">Típus</label>
                                <select className="input text-sm" value={editForm.type} onChange={ev => setEditForm(p => ({ ...p, type: ev.target.value }))}>
                                  {Object.entries(TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                                </select>
                              </div>
                              <div>
                                <label className="label">Kategória</label>
                                <select className="input text-sm" value={editForm.category} onChange={ev => setEditForm(p => ({ ...p, category: ev.target.value }))}>
                                  {Object.entries(CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                                </select>
                              </div>
                              <div>
                                <label className="label">Összeg (HUF)</label>
                                <input type="number" className="input text-sm" value={editForm.amount} onChange={ev => setEditForm(p => ({ ...p, amount: ev.target.value }))} />
                              </div>
                              <div>
                                <label className="label">Szállító</label>
                                <input className="input text-sm" value={editForm.vendor} onChange={ev => setEditForm(p => ({ ...p, vendor: ev.target.value }))} />
                              </div>
                              <div>
                                <label className="label">Számla száma</label>
                                <input className="input text-sm" value={editForm.invoice_number} onChange={ev => setEditForm(p => ({ ...p, invoice_number: ev.target.value }))} />
                              </div>
                              <div>
                                <label className="label">Dátum</label>
                                <input type="date" className="input text-sm" value={editForm.date} onChange={ev => setEditForm(p => ({ ...p, date: ev.target.value }))} />
                              </div>
                            </div>
                            <div className="flex gap-2 justify-end mt-3">
                              <button onClick={() => { setEditId(null); setEditForm({}) }} className="btn-secondary text-xs py-1.5 px-3">Mégsem</button>
                              <button
                                onClick={() => updateEntry.mutate({ id: e.id, data: editForm })}
                                disabled={!editForm.description || !editForm.amount || updateEntry.isPending}
                                className="btn-primary text-xs py-1.5 px-3"
                              >
                                <Check size={13} /> {updateEntry.isPending ? 'Mentés...' : 'Mentés'}
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    }
                    return (
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
                          {canEdit && (
                            <div className="flex items-center gap-2">
                              <button onClick={() => startEdit(e)} className="text-slate-600 hover:text-emerald-400 transition-colors">
                                <Pencil size={14} />
                              </button>
                              <button onClick={() => { if (confirm('Törlöd?')) deleteEntry.mutate(e.id) }} className="text-slate-600 hover:text-red-400 transition-colors">
                                <Trash2 size={14} />
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── REPORT TAB ── */}
      {tab === 'report' && (
        <div className="space-y-6">
          {/* Monthly bar chart */}
          {reportData.monthlyList.length > 0 && (
            <div className="card p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-medium text-white text-sm">Havi bontás</h2>
                <button onClick={() => exportToCSV(entries)} className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg text-xs font-medium transition-colors">
                  <Download size={13} /> Teljes export
                </button>
              </div>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={reportData.monthlyList} margin={{ top: 0, right: 0, left: 10, bottom: 0 }}>
                  <XAxis dataKey="month" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `${(v/1000).toFixed(0)}e`} />
                  <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 12 }} formatter={v => formatCurrency(v)} />
                  <Legend wrapperStyle={{ fontSize: 12, color: '#94a3b8' }} />
                  <Bar dataKey="expense" name="Kiadás" fill="#ef4444" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="income" name="Bevétel" fill="#10b981" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="estimate" name="Tervezett" fill="#f59e0b" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          <div className="grid lg:grid-cols-2 gap-6">
            {/* Top vendors (kiadás) */}
            <div className="card p-5">
              <h2 className="font-medium text-white text-sm mb-4">Szállítók / kifizetések (kiadás)</h2>
              {reportData.vendorList.length === 0 ? (
                <p className="text-slate-500 text-sm">Nincs adat</p>
              ) : (
                <div className="space-y-2">
                  {reportData.vendorList.map((v, i) => {
                    const totalExpenses = reportData.vendorList.reduce((s, x) => s + x.total, 0)
                    const pct = totalExpenses > 0 ? (v.total / totalExpenses) * 100 : 0
                    return (
                      <div key={i}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm text-slate-300 truncate max-w-[60%]">{v.name}</span>
                          <div className="text-right">
                            <span className="text-sm font-medium text-white">{formatCurrency(v.total)}</span>
                            <span className="text-xs text-slate-500 ml-1.5">{pct.toFixed(1)}%</span>
                          </div>
                        </div>
                        <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                          <div className="h-full bg-red-500 rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Income sources */}
            <div className="card p-5">
              <h2 className="font-medium text-white text-sm mb-4">Bevételi források / befizetők</h2>
              {reportData.incomeSourceList.length === 0 ? (
                <p className="text-slate-500 text-sm">Nincs adat</p>
              ) : (
                <div className="space-y-2">
                  {reportData.incomeSourceList.map((v, i) => {
                    const totalIncome = reportData.incomeSourceList.reduce((s, x) => s + x.total, 0)
                    const pct = totalIncome > 0 ? (v.total / totalIncome) * 100 : 0
                    return (
                      <div key={i}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm text-slate-300 truncate max-w-[60%]">{v.name}</span>
                          <div className="text-right">
                            <span className="text-sm font-medium text-emerald-400">{formatCurrency(v.total)}</span>
                            <span className="text-xs text-slate-500 ml-1.5">{pct.toFixed(1)}%</span>
                          </div>
                        </div>
                        <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                          <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* By category */}
            <div className="card p-5">
              <h2 className="font-medium text-white text-sm mb-4">Kiadások kategóriánként</h2>
              {reportData.catList.length === 0 ? (
                <p className="text-slate-500 text-sm">Nincs adat</p>
              ) : (
                <div className="space-y-2">
                  {reportData.catList.map((v, i) => {
                    const total = reportData.catList.reduce((s, x) => s + x.total, 0)
                    const pct = total > 0 ? (v.total / total) * 100 : 0
                    return (
                      <div key={i}>
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <div className="w-2.5 h-2.5 rounded-sm" style={{ background: COLORS[i % COLORS.length] }} />
                            <span className="text-sm text-slate-300">{v.name}</span>
                          </div>
                          <div className="text-right">
                            <span className="text-sm font-medium text-white">{formatCurrency(v.total)}</span>
                            <span className="text-xs text-slate-500 ml-1.5">{pct.toFixed(1)}%</span>
                          </div>
                        </div>
                        <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${pct}%`, background: COLORS[i % COLORS.length] }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Payment summary table */}
            <div className="card p-5">
              <h2 className="font-medium text-white text-sm mb-4">Összesítő</h2>
              <table className="w-full text-sm">
                <tbody className="divide-y divide-slate-800/50">
                  <tr>
                    <td className="py-2 text-slate-400">Összes kiadás</td>
                    <td className="py-2 text-right font-semibold text-white">{formatCurrency(summary?.total_expenses ?? 0)}</td>
                  </tr>
                  <tr>
                    <td className="py-2 text-slate-400">Összes bevétel</td>
                    <td className="py-2 text-right font-semibold text-emerald-400">{formatCurrency(summary?.total_income ?? 0)}</td>
                  </tr>
                  <tr>
                    <td className="py-2 text-slate-400">Tervezett költ.</td>
                    <td className="py-2 text-right font-semibold text-amber-400">{formatCurrency(summary?.total_estimated ?? 0)}</td>
                  </tr>
                  <tr className="border-t border-slate-700">
                    <td className="py-2 text-slate-300 font-medium">Egyenleg</td>
                    <td className={`py-2 text-right font-bold text-lg ${(summary?.balance ?? 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {formatCurrency(summary?.balance ?? 0)}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2 text-slate-400">Bejegyzések száma</td>
                    <td className="py-2 text-right text-slate-300">{entries.length} db</td>
                  </tr>
                  <tr>
                    <td className="py-2 text-slate-400">Szállítók száma</td>
                    <td className="py-2 text-right text-slate-300">{reportData.vendorList.length} db</td>
                  </tr>
                  <tr>
                    <td className="py-2 text-slate-400">Bevételi források</td>
                    <td className="py-2 text-right text-slate-300">{reportData.incomeSourceList.length} db</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

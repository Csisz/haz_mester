import React, { useState, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../utils/api'
import { formatCurrency } from '../utils/helpers'
import {
  Camera, Scan, CheckCircle, AlertCircle, Loader, FileImage, X,
  PenLine, Receipt, Plus, ScanLine
} from 'lucide-react'
import { useDropzone } from 'react-dropzone'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4']
const CATEGORIES = { material: 'Anyag', labor: 'Munkadíj', design: 'Tervezés', permit: 'Engedély', other: 'Egyéb' }

export default function InvoiceScanPage() {
  const [tab, setTab] = useState('scan') // 'scan' | 'manual'
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState(null)
  const [paidBy, setPaidBy] = useState('')
  const [scanning, setScanning] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')

  // Manual entry form
  const [manual, setManual] = useState({
    description: '', amount: '', vendor: '', category: 'material',
    invoice_number: '', paid_by_user_id: ''
  })
  const [manualSuccess, setManualSuccess] = useState(false)

  const qc = useQueryClient()
  const { data: projects = [] } = useQuery({ queryKey: ['projects'], queryFn: () => api.get('/projects').then(r => r.data) })
  const { data: users = [] } = useQuery({ queryKey: ['users'], queryFn: () => api.get('/users').then(r => r.data) })
  const mainProject = projects[0]

  const { data: summary } = useQuery({
    queryKey: ['payment-summary', mainProject?.id],
    queryFn: () => api.get(`/invoice/summary/${mainProject.id}`).then(r => r.data),
    enabled: !!mainProject?.id
  })

  const onDrop = useCallback((accepted) => {
    const f = accepted[0]
    if (!f) return
    setFile(f); setResult(null); setError('')
    if (f.type.startsWith('image/')) {
      const reader = new FileReader()
      reader.onload = e => setPreview(e.target.result)
      reader.readAsDataURL(f)
    } else setPreview(null)
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop, accept: { 'image/*': [], 'application/pdf': ['.pdf'] }, maxFiles: 1
  })

  const handleScan = async () => {
    if (!file || !paidBy || !mainProject) return
    setScanning(true); setError(''); setResult(null)
    try {
      const form = new FormData()
      form.append('file', file)
      form.append('project_id', mainProject.id)
      form.append('paid_by_user_id', paidBy)
      const res = await api.post('/invoice/scan', form, { headers: { 'Content-Type': 'multipart/form-data' } })
      setResult(res.data)
      qc.invalidateQueries(['payment-summary', mainProject?.id])
      qc.invalidateQueries(['finance', mainProject?.id])
    } catch (err) {
      setError(err.response?.data?.detail || 'Hiba a feldolgozás során')
    } finally { setScanning(false) }
  }

  const handleManualSubmit = async (e) => {
    e.preventDefault()
    if (!manual.description || !manual.amount || !manual.paid_by_user_id || !mainProject) return
    try {
      await api.post('/finance', {
        project_id: mainProject.id,
        type: 'expense',
        category: manual.category,
        description: manual.description,
        amount: parseFloat(manual.amount),
        vendor: manual.vendor || undefined,
        invoice_number: manual.invoice_number || undefined,
        paid_by: manual.paid_by_user_id || undefined,
      })
      setManualSuccess(true)
      setManual({ description: '', amount: '', vendor: '', category: 'material', invoice_number: '', paid_by_user_id: '' })
      qc.invalidateQueries(['payment-summary', mainProject?.id])
      qc.invalidateQueries(['finance', mainProject?.id])
      setTimeout(() => setManualSuccess(false), 3000)
    } catch (err) {
      setError(err.response?.data?.detail || 'Hiba')
    }
  }

  const pieData = summary?.by_person?.map(p => ({ name: p.name.split(' ').slice(-1)[0], value: p.total })) || []

  const UserSelector = ({ value, onChange }) => (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
      {users.map(u => (
        <button key={u.id} type="button" onClick={() => onChange(u.id)}
          className={`flex items-center gap-2 p-2.5 rounded-lg border text-sm font-medium transition-all ${
            value === u.id ? 'border-emerald-500 bg-emerald-500/20 text-emerald-300'
              : 'border-slate-700 bg-slate-800/50 text-slate-300 hover:border-slate-600'}`}>
          <div className="w-6 h-6 rounded-full bg-emerald-700 flex items-center justify-center text-xs text-white font-bold flex-shrink-0">
            {u.full_name?.[0]}
          </div>
          <span className="truncate">{u.full_name?.split(' ').slice(-1)[0]}</span>
          {value === u.id && <CheckCircle size={13} className="ml-auto flex-shrink-0" />}
        </button>
      ))}
    </div>
  )

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-white">Számla & Kiadás rögzítés</h1>
        <p className="text-slate-400 text-sm mt-0.5">Fotózd le a számlát vagy vidd be kézzel</p>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="space-y-4">
          {/* Tab switcher */}
          <div className="flex bg-slate-800 rounded-xl p-1 gap-1">
            <button onClick={() => { setTab('scan'); setError('') }}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all ${
                tab === 'scan' ? 'bg-slate-700 text-white shadow' : 'text-slate-400 hover:text-slate-200'}`}>
              <ScanLine size={16} /> Számla beolvasás
            </button>
            <button onClick={() => { setTab('manual'); setError('') }}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all ${
                tab === 'manual' ? 'bg-slate-700 text-white shadow' : 'text-slate-400 hover:text-slate-200'}`}>
              <PenLine size={16} /> Kézi bevitel
            </button>
          </div>

          {/* SCAN TAB */}
          {tab === 'scan' && (
            <>
              <div {...getRootProps()}
                className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${
                  isDragActive ? 'border-emerald-500 bg-emerald-500/10' : 'border-slate-700 hover:border-slate-500 bg-slate-900'}`}>
                <input {...getInputProps()} />
                {preview ? (
                  <div className="relative">
                    <img src={preview} alt="preview" className="max-h-56 mx-auto rounded-lg object-contain" />
                    <button onClick={e => { e.stopPropagation(); setFile(null); setPreview(null); setResult(null) }}
                      className="absolute top-2 right-2 bg-slate-800 rounded-full p-1 text-slate-400 hover:text-white">
                      <X size={16} />
                    </button>
                  </div>
                ) : file ? (
                  <div className="flex flex-col items-center gap-2">
                    <FileImage size={40} className="text-emerald-400" />
                    <p className="text-white font-medium text-sm">{file.name}</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-3 py-4">
                    <div className="w-14 h-14 rounded-2xl bg-emerald-600/20 border border-emerald-600/30 flex items-center justify-center">
                      <Camera size={24} className="text-emerald-400" />
                    </div>
                    <div>
                      <p className="text-white font-medium text-sm">Húzd ide a számlát vagy kattints</p>
                      <p className="text-slate-500 text-xs mt-1">JPG, PNG, PDF • max 20MB</p>
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="label">Ki fizette? *</label>
                <UserSelector value={paidBy} onChange={setPaidBy} />
              </div>

              <button onClick={handleScan} disabled={!file || !paidBy || scanning}
                className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 disabled:text-slate-500 text-white py-3 rounded-xl font-semibold transition-colors flex items-center justify-center gap-2">
                {scanning ? <><Loader size={18} className="animate-spin" /> AI feldolgozás...</> : <><Scan size={18} /> Számla beolvasása</>}
              </button>

              {error && <div className="flex items-center gap-2 p-3 bg-red-900/30 border border-red-800 rounded-lg text-red-300 text-sm"><AlertCircle size={16} />{error}</div>}

              {result && (
                <div className="card p-4 border-emerald-600/40 bg-emerald-900/10">
                  <div className="flex items-center gap-2 mb-3"><CheckCircle size={18} className="text-emerald-400" /><span className="font-semibold text-emerald-300">Sikeresen rögzítve!</span></div>
                  <div className="space-y-1.5 text-sm">
                    {[['Összeg', formatCurrency(result.extracted?.amount)],
                      ['Szállító', result.extracted?.vendor],
                      ['Leírás', result.extracted?.description],
                      ['Fizette', result.paid_by?.full_name],
                      ['Számlaszám', result.extracted?.invoice_number],
                      ['AI bizonyosság', result.extracted?.confidence === 'high' ? 'Magas' : result.extracted?.confidence === 'medium' ? 'Közepes' : 'Alacsony'],
                    ].filter(([,v]) => v).map(([k,v]) => (
                      <div key={k} className="flex justify-between">
                        <span className="text-slate-400">{k}:</span>
                        <span className={`font-medium ${k === 'Fizette' ? 'text-emerald-400' : k === 'AI bizonyosság' ? (result.extracted?.confidence === 'high' ? 'text-emerald-400' : 'text-amber-400') : 'text-white'}`}>{v}</span>
                      </div>
                    ))}
                    {result.extracted?.items?.length > 0 && (
                      <div className="mt-2 pt-2 border-t border-slate-700">
                        <p className="text-slate-400 text-xs mb-1">Tételek:</p>
                        {result.extracted.items.map((item, i) => (
                          <div key={i} className="flex justify-between text-xs">
                            <span className="text-slate-300">{item.name}</span>
                            <span className="text-white">{formatCurrency(item.total)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <button onClick={() => { setFile(null); setPreview(null); setResult(null); setPaidBy('') }}
                    className="mt-3 w-full btn-secondary text-xs justify-center">Új számla beolvasása</button>
                </div>
              )}
            </>
          )}

          {/* MANUAL TAB */}
          {tab === 'manual' && (
            <form onSubmit={handleManualSubmit} className="space-y-3">
              <div>
                <label className="label">Leírás *</label>
                <input className="input" required value={manual.description}
                  onChange={e => setManual(p => ({...p, description: e.target.value}))}
                  placeholder="pl. Esztrich munkadíj, Cementes zsákok, stb." />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Összeg (Ft) *</label>
                  <input type="number" className="input" required value={manual.amount}
                    onChange={e => setManual(p => ({...p, amount: e.target.value}))}
                    placeholder="0" />
                </div>
                <div>
                  <label className="label">Kategória</label>
                  <select className="input" value={manual.category}
                    onChange={e => setManual(p => ({...p, category: e.target.value}))}>
                    {Object.entries(CATEGORIES).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="label">Szállító / Partner</label>
                <input className="input" value={manual.vendor}
                  onChange={e => setManual(p => ({...p, vendor: e.target.value}))}
                  placeholder="pl. Praktiker, OBI, Kovács Bt." />
              </div>
              <div>
                <label className="label">Számla / bizonylat száma</label>
                <input className="input" value={manual.invoice_number}
                  onChange={e => setManual(p => ({...p, invoice_number: e.target.value}))}
                  placeholder="pl. 2024/001 (opcionális)" />
              </div>
              <div>
                <label className="label">Ki fizette? *</label>
                <UserSelector value={manual.paid_by_user_id} onChange={v => setManual(p => ({...p, paid_by_user_id: v}))} />
              </div>

              {error && <div className="flex items-center gap-2 p-3 bg-red-900/30 border border-red-800 rounded-lg text-red-300 text-sm"><AlertCircle size={16} />{error}</div>}
              {manualSuccess && (
                <div className="flex items-center gap-2 p-3 bg-emerald-900/30 border border-emerald-800 rounded-lg text-emerald-300 text-sm">
                  <CheckCircle size={16} /> Kiadás sikeresen rögzítve!
                </div>
              )}

              <button type="submit" disabled={!manual.description || !manual.amount || !manual.paid_by_user_id}
                className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 disabled:text-slate-500 text-white py-3 rounded-xl font-semibold transition-colors flex items-center justify-center gap-2">
                <Plus size={18} /> Kiadás rögzítése
              </button>
            </form>
          )}
        </div>

        {/* Summary */}
        <div className="space-y-4">
          <div className="card p-5">
            <h2 className="font-medium text-white text-sm mb-4">Ki mennyit fizetett?</h2>
            {summary?.by_person?.length > 0 ? (
              <>
                <ResponsiveContainer width="100%" height={170}>
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" outerRadius={65} dataKey="value"
                      label={({ name, percent }) => `${name} ${(percent*100).toFixed(0)}%`}
                      labelLine={false} fontSize={11}>
                      {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={v => formatCurrency(v)}
                      contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-2 mt-2">
                  {summary.by_person.map((person, i) => (
                    <div key={person.user_id} className="flex items-center gap-3">
                      <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: COLORS[i % COLORS.length] }} />
                      <div className="flex-1">
                        <div className="flex justify-between">
                          <span className="text-sm text-white font-medium">{person.name}</span>
                          <span className="text-sm font-bold text-white">{formatCurrency(person.total)}</span>
                        </div>
                        <div className="w-full bg-slate-800 rounded-full h-1 mt-1">
                          <div className="h-1 rounded-full" style={{ width: `${(person.total/summary.total)*100}%`, background: COLORS[i % COLORS.length] }} />
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">{person.entries.length} tétel • {((person.total/summary.total)*100).toFixed(1)}%</p>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-3 pt-3 border-t border-slate-800 flex justify-between">
                  <span className="text-slate-400 text-sm">Összesen:</span>
                  <span className="font-bold text-white">{formatCurrency(summary.total)}</span>
                </div>
              </>
            ) : (
              <div className="text-center py-8 text-slate-500">
                <Receipt size={32} className="mx-auto mb-2 opacity-30" />
                <p className="text-sm">Még nincs rögzített kiadás</p>
              </div>
            )}
          </div>

          {summary?.by_person?.map((person, i) => (
            <div key={person.user_id} className="card p-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-2 h-2 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                <span className="font-medium text-white text-sm">{person.name}</span>
                <span className="ml-auto text-emerald-400 font-bold text-sm">{formatCurrency(person.total)}</span>
              </div>
              <div className="space-y-1">
                {person.entries.slice(0, 4).map(e => (
                  <div key={e.id} className="flex items-center justify-between text-xs py-0.5">
                    <span className="text-slate-400 truncate max-w-[65%]">{e.description}</span>
                    <span className="text-slate-300 font-medium">{formatCurrency(e.amount)}</span>
                  </div>
                ))}
                {person.entries.length > 4 && <p className="text-xs text-slate-600">+ {person.entries.length - 4} további</p>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

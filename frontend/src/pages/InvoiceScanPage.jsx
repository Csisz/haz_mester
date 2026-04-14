import React, { useState, useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import api from '../utils/api'
import { formatCurrency } from '../utils/helpers'
import {
  Camera, Scan, CheckCircle, AlertCircle, Loader, FileImage, X,
  PenLine, Receipt, Plus, ScanLine, FileSpreadsheet, AlertTriangle,
  ChevronDown, ChevronUp, Save, SkipForward, RefreshCw
} from 'lucide-react'
import { useDropzone } from 'react-dropzone'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4']
const CATEGORIES = { material: 'Anyag', labor: 'Munkadíj', design: 'Tervezés', permit: 'Engedély', other: 'Egyéb' }
const TYPES = { expense: 'Kiadás', income: 'Bevétel', estimate: 'Becslés' }

// ── shared sub-component ──────────────────────────────────────────────────────
function UserSelector({ value, onChange, users }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
      {users.map(u => (
        <button key={u.id} type="button" onClick={() => onChange(u.id)}
          className={`flex items-center gap-2 p-2.5 rounded-lg border text-sm font-medium transition-all ${
            value === u.id
              ? 'border-emerald-500 bg-emerald-500/20 text-emerald-300'
              : 'border-slate-700 bg-slate-800/50 text-slate-300 hover:border-slate-600'
          }`}>
          <div className="w-6 h-6 rounded-full bg-emerald-700 flex items-center justify-center text-xs text-white font-bold flex-shrink-0">
            {u.full_name?.[0]}
          </div>
          <span className="truncate">{u.full_name?.split(' ').slice(-1)[0]}</span>
          {value === u.id && <CheckCircle size={13} className="ml-auto flex-shrink-0" />}
        </button>
      ))}
    </div>
  )
}

// ── conflict resolution badge + action selector ───────────────────────────────
function ConflictResolver({ row, index, onChange }) {
  const [expanded, setExpanded] = useState(true)
  const dup = row.duplicate
  const unresolved = row.action === null || row.action === undefined

  return (
    <div className={`mt-2 rounded-lg border text-xs overflow-hidden ${unresolved ? 'border-red-500/60 bg-red-900/10' : 'border-amber-600/40 bg-amber-900/10'}`}>
      <button
        type="button"
        onClick={() => setExpanded(v => !v)}
        className={`flex items-center gap-2 w-full px-3 py-2 transition-colors ${unresolved ? 'text-red-400 hover:bg-red-900/20' : 'text-amber-400 hover:bg-amber-900/20'}`}
      >
        <AlertTriangle size={13} />
        <span className="font-medium">
          {unresolved ? '⚠ Döntés szükséges — ' : 'Egyezés: '}
          {dup.vendor || dup.description}
        </span>
        <span className="ml-auto opacity-70">{formatCurrency(dup.amount)} · {dup.date}</span>
        {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
      </button>

      {expanded && (
        <div className="px-3 pb-3 space-y-2">
          {/* side-by-side comparison */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="bg-slate-800/60 rounded p-2">
              <p className="text-slate-500 mb-1 font-medium">Meglévő bejegyzés</p>
              <p className="text-slate-300 truncate">{dup.description}</p>
              <p className="text-white font-semibold">{formatCurrency(dup.amount)}</p>
              {dup.vendor && <p className="text-slate-400">{dup.vendor}</p>}
              {dup.date && <p className="text-slate-500">{dup.date}</p>}
            </div>
            <div className="bg-slate-800/60 rounded p-2">
              <p className="text-slate-500 mb-1 font-medium">Importált sor</p>
              <p className="text-slate-300 truncate">{row.description}</p>
              <p className="text-white font-semibold">{formatCurrency(row.amount)}</p>
              {row.vendor && <p className="text-slate-400">{row.vendor}</p>}
              {row.date && <p className="text-slate-500">{row.date}</p>}
            </div>
          </div>

          {/* action buttons */}
          <p className="text-slate-400 font-medium">Mit tegyek ezzel a tétellel?</p>
          <div className="flex gap-1.5 flex-wrap">
            {[
              { action: 'save',    label: 'Mindkettő mentése',   icon: <Save size={11} />,        cls: 'bg-slate-700 text-slate-200 hover:bg-slate-600' },
              { action: 'skip',    label: 'Kihagyás (marad régi)', icon: <SkipForward size={11} />, cls: 'bg-slate-700 text-slate-200 hover:bg-slate-600' },
              { action: 'replace', label: 'Csere (régi törlése)', icon: <RefreshCw size={11} />,   cls: 'bg-amber-700/60 text-amber-200 hover:bg-amber-700' },
            ].map(({ action, label, icon, cls }) => (
              <button
                key={action}
                type="button"
                onClick={() => onChange(index, 'action', action)}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ring-2 ring-transparent ${cls} ${row.action === action ? 'ring-emerald-500' : ''}`}
              >
                {icon}{label}
                {row.action === action && <CheckCircle size={11} className="text-emerald-400" />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── editable row in the review table ─────────────────────────────────────────
function ReviewRow({ row, index, onChange, users }) {
  const handlePaidBy = (e) => {
    const uid = e.target.value ? parseInt(e.target.value) : null
    const user = users.find(u => u.id === uid)
    onChange(index, '_paidBy', uid)
    onChange(index, '_paidByName', user?.full_name || '')
  }

  return (
    <div className={`p-3 rounded-lg border transition-colors ${
      row.action === 'skip'
        ? 'border-slate-700 bg-slate-900/40 opacity-50'
        : row.duplicate
          ? 'border-amber-700/40 bg-amber-900/5'
          : 'border-slate-700/60 bg-slate-800/30'
    }`}>
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2">
        <div className="lg:col-span-2">
          <label className="label">Leírás</label>
          <input className="input text-sm" value={row.description}
            onChange={e => onChange(index, 'description', e.target.value)} />
        </div>
        <div>
          <label className="label">Típus</label>
          <select className="input text-sm" value={row.type || 'expense'}
            onChange={e => onChange(index, 'type', e.target.value)}>
            {Object.entries(TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Kategória</label>
          <select className="input text-sm" value={row.category || 'other'}
            onChange={e => onChange(index, 'category', e.target.value)}>
            {Object.entries(CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Összeg (HUF)</label>
          <input type="number" className="input text-sm" value={row.amount}
            onChange={e => onChange(index, 'amount', parseFloat(e.target.value) || 0)} />
        </div>
        <div>
          <label className="label">Szállító</label>
          <input className="input text-sm" value={row.vendor || ''}
            onChange={e => onChange(index, 'vendor', e.target.value)} />
        </div>
        <div>
          <label className="label">Számlaszám</label>
          <input className="input text-sm" value={row.invoice_number || ''}
            onChange={e => onChange(index, 'invoice_number', e.target.value)} />
        </div>
        <div>
          <label className="label">Dátum</label>
          <input type="date" className="input text-sm" value={row.date || ''}
            onChange={e => onChange(index, 'date', e.target.value)} />
        </div>
        <div>
          <label className="label">Ki fizette?</label>
          <select className="input text-sm" value={row._paidBy || ''} onChange={handlePaidBy}>
            <option value="">— ismeretlen —</option>
            {users.map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}
          </select>
        </div>
      </div>

      {row.duplicate && (
        <ConflictResolver row={row} index={index} onChange={onChange} />
      )}
    </div>
  )
}

// ── main page ─────────────────────────────────────────────────────────────────
export default function InvoiceScanPage() {
  const [tab, setTab] = useState('scan') // 'scan' | 'excel' | 'manual'
  const qc = useQueryClient()

  // scan tab
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState(null)
  const [paidBy, setPaidBy] = useState('')
  const [scanning, setScanning] = useState(false)
  const [scanResult, setScanResult] = useState(null)
  const [scanError, setScanError] = useState('')

  // excel tab
  const [excelFile, setExcelFile] = useState(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [reviewRows, setReviewRows] = useState(null) // null = not yet analyzed
  const [excelError, setExcelError] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveResult, setSaveResult] = useState(null)

  // manual tab
  const [manual, setManual] = useState({ description: '', amount: '', vendor: '', category: 'material', invoice_number: '', paid_by_user_id: '' })
  const [manualSuccess, setManualSuccess] = useState(false)
  const [manualError, setManualError] = useState('')

  const { data: projects = [] } = useQuery({ queryKey: ['projects'], queryFn: () => api.get('/projects').then(r => r.data) })
  const { data: users = [] } = useQuery({ queryKey: ['users'], queryFn: () => api.get('/users').then(r => r.data) })
  const mainProject = projects[0]

  const { data: summary } = useQuery({
    queryKey: ['payment-summary', mainProject?.id],
    queryFn: () => api.get(`/invoice/summary/${mainProject.id}`).then(r => r.data),
    enabled: !!mainProject?.id,
  })

  // ── scan dropzone ────────────────────────────────────────────────────────
  const onDropScan = useCallback((accepted) => {
    const f = accepted[0]
    if (!f) return
    setFile(f); setScanResult(null); setScanError('')
    if (f.type.startsWith('image/')) {
      const reader = new FileReader()
      reader.onload = e => setPreview(e.target.result)
      reader.readAsDataURL(f)
    } else setPreview(null)
  }, [])

  const { getRootProps: getScanRootProps, getInputProps: getScanInputProps, isDragActive: isScanDrag } = useDropzone({
    onDrop: onDropScan,
    accept: { 'image/*': [], 'application/pdf': ['.pdf'] },
    maxFiles: 1,
  })

  // ── excel dropzone ───────────────────────────────────────────────────────
  const onDropExcel = useCallback((accepted) => {
    const f = accepted[0]
    if (!f) return
    setExcelFile(f); setReviewRows(null); setExcelError(''); setSaveResult(null)
  }, [])

  const { getRootProps: getExcelRootProps, getInputProps: getExcelInputProps, isDragActive: isExcelDrag } = useDropzone({
    onDrop: onDropExcel,
    accept: {
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'text/csv': ['.csv'],
      'application/csv': ['.csv'],
    },
    maxFiles: 1,
  })

  // ── scan handler ─────────────────────────────────────────────────────────
  const handleScan = async () => {
    if (!file || !paidBy || !mainProject) return
    setScanning(true); setScanError(''); setScanResult(null)
    try {
      const form = new FormData()
      form.append('file', file)
      form.append('project_id', mainProject.id)
      form.append('paid_by_user_id', paidBy)
      const res = await api.post('/invoice/scan', form, { headers: { 'Content-Type': 'multipart/form-data' } })
      setScanResult(res.data)
      qc.invalidateQueries(['payment-summary', mainProject?.id])
      qc.invalidateQueries(['finance', mainProject?.id])
    } catch (err) {
      setScanError(err.response?.data?.detail || 'Hiba a feldolgozás során')
    } finally { setScanning(false) }
  }

  // ── excel analyze handler ────────────────────────────────────────────────
  const handleAnalyzeExcel = async () => {
    if (!excelFile || !mainProject) return
    setAnalyzing(true); setExcelError(''); setReviewRows(null); setSaveResult(null)
    try {
      const form = new FormData()
      form.append('file', excelFile)
      form.append('project_id', mainProject.id)
      const res = await api.post('/invoice/analyze-excel', form, { headers: { 'Content-Type': 'multipart/form-data' } })
      setReviewRows(res.data.rows.map(row => ({ ...row, _paidBy: null, _paidByName: '' })))
    } catch (err) {
      setExcelError(err.response?.data?.detail || 'Hiba az elemzés során')
    } finally { setAnalyzing(false) }
  }

  // ── row field change ─────────────────────────────────────────────────────
  const handleRowChange = (index, field, value) => {
    setReviewRows(rows => rows.map((r, i) => i === index ? { ...r, [field]: value } : r))
  }

  // ── save entries handler ─────────────────────────────────────────────────
  const handleSaveEntries = async () => {
    if (!reviewRows || !mainProject) return
    setSaving(true)
    try {
      const entries = reviewRows.map(row => ({
        action: row.action || 'save',
        duplicate_id: row.duplicate?.id || null,
        project_id: mainProject.id,
        type: row.type || 'expense',
        category: row.category || 'other',
        description: row.description,
        amount: row.amount,
        vendor: row.vendor || null,
        invoice_number: row.invoice_number || null,
        date: row.date || null,
        paid_by: row._paidBy || null,
        paid_by_name: row._paidByName || null,
      }))
      const res = await api.post('/invoice/save-entries', { entries })
      setSaveResult(res.data)
      qc.invalidateQueries(['payment-summary', mainProject?.id])
      qc.invalidateQueries(['finance', mainProject?.id])
    } catch (err) {
      setExcelError(err.response?.data?.detail || 'Hiba a mentés során')
    } finally { setSaving(false) }
  }

  // ── manual submit ────────────────────────────────────────────────────────
  const handleManualSubmit = async (e) => {
    e.preventDefault()
    if (!manual.description || !manual.amount || !manual.paid_by_user_id || !mainProject) return
    setManualError('')
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
      setManualError(err.response?.data?.detail || 'Hiba')
    }
  }

  const pieData = summary?.by_person?.map(p => ({ name: p.name.split(' ').slice(-1)[0], value: p.total })) || []

  const dupCount = reviewRows?.filter(r => r.duplicate).length || 0
  const unresolvedCount = reviewRows?.filter(r => r.duplicate && (r.action === null || r.action === undefined)).length || 0
  const skipCount = reviewRows?.filter(r => r.action === 'skip').length || 0
  const saveCount = reviewRows?.filter(r => r.action === 'save').length || 0
  const replaceCount = reviewRows?.filter(r => r.action === 'replace').length || 0

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-white">Számla & Kiadás rögzítés</h1>
        <p className="text-slate-400 text-sm mt-0.5">Fotózd le a számlát, tölts fel Excel-t, vagy vidd be kézzel</p>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="space-y-4">

          {/* ── Tab switcher ── */}
          <div className="flex bg-slate-800 rounded-xl p-1 gap-1">
            {[
              { key: 'scan',   icon: <ScanLine size={15} />,       label: 'Számla scan' },
              { key: 'excel',  icon: <FileSpreadsheet size={15} />, label: 'Excel import' },
              { key: 'manual', icon: <PenLine size={15} />,         label: 'Kézi bevitel' },
            ].map(({ key, icon, label }) => (
              <button key={key}
                onClick={() => { setTab(key); setScanError(''); setExcelError(''); setManualError('') }}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  tab === key ? 'bg-slate-700 text-white shadow' : 'text-slate-400 hover:text-slate-200'
                }`}>
                {icon}{label}
              </button>
            ))}
          </div>

          {/* ════════════════════════════════════════════════
              SCAN TAB
          ════════════════════════════════════════════════ */}
          {tab === 'scan' && (
            <>
              <div {...getScanRootProps()}
                className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${
                  isScanDrag ? 'border-emerald-500 bg-emerald-500/10' : 'border-slate-700 hover:border-slate-500 bg-slate-900'
                }`}>
                <input {...getScanInputProps()} />
                {preview ? (
                  <div className="relative">
                    <img src={preview} alt="preview" className="max-h-56 mx-auto rounded-lg object-contain" />
                    <button onClick={e => { e.stopPropagation(); setFile(null); setPreview(null); setScanResult(null) }}
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
                      <p className="text-slate-500 text-xs mt-1">JPG, PNG, PDF · max 20MB</p>
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="label">Ki fizette? *</label>
                <UserSelector value={paidBy} onChange={setPaidBy} users={users} />
              </div>

              <button onClick={handleScan} disabled={!file || !paidBy || scanning}
                className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 disabled:text-slate-500 text-white py-3 rounded-xl font-semibold transition-colors flex items-center justify-center gap-2">
                {scanning ? <><Loader size={18} className="animate-spin" /> AI feldolgozás...</> : <><Scan size={18} /> Számla beolvasása</>}
              </button>

              {scanError && <div className="flex items-center gap-2 p-3 bg-red-900/30 border border-red-800 rounded-lg text-red-300 text-sm"><AlertCircle size={16} />{scanError}</div>}

              {scanResult && (
                <div className="card p-4 border-emerald-600/40 bg-emerald-900/10">
                  <div className="flex items-center gap-2 mb-3"><CheckCircle size={18} className="text-emerald-400" /><span className="font-semibold text-emerald-300">Sikeresen rögzítve!</span></div>
                  <div className="space-y-1.5 text-sm">
                    {[
                      ['Összeg', formatCurrency(scanResult.extracted?.amount)],
                      ['Szállító', scanResult.extracted?.vendor],
                      ['Leírás', scanResult.extracted?.description],
                      ['Fizette', scanResult.paid_by?.full_name],
                      ['Számlaszám', scanResult.extracted?.invoice_number],
                      ['AI bizonyosság', scanResult.extracted?.confidence === 'high' ? 'Magas' : scanResult.extracted?.confidence === 'medium' ? 'Közepes' : 'Alacsony'],
                    ].filter(([, v]) => v).map(([k, v]) => (
                      <div key={k} className="flex justify-between">
                        <span className="text-slate-400">{k}:</span>
                        <span className={`font-medium ${k === 'Fizette' ? 'text-emerald-400' : k === 'AI bizonyosság' ? (scanResult.extracted?.confidence === 'high' ? 'text-emerald-400' : 'text-amber-400') : 'text-white'}`}>{v}</span>
                      </div>
                    ))}
                    {scanResult.extracted?.items?.length > 0 && (
                      <div className="mt-2 pt-2 border-t border-slate-700">
                        <p className="text-slate-400 text-xs mb-1">Tételek:</p>
                        {scanResult.extracted.items.map((item, i) => (
                          <div key={i} className="flex justify-between text-xs">
                            <span className="text-slate-300">{item.name}</span>
                            <span className="text-white">{formatCurrency(item.total)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <button onClick={() => { setFile(null); setPreview(null); setScanResult(null); setPaidBy('') }}
                    className="mt-3 w-full btn-secondary text-xs justify-center">Új számla beolvasása</button>
                </div>
              )}
            </>
          )}

          {/* ════════════════════════════════════════════════
              EXCEL TAB
          ════════════════════════════════════════════════ */}
          {tab === 'excel' && (
            <>
              {/* Step 1 — upload + paid by */}
              {!reviewRows && !saveResult && (
                <>
                  <div {...getExcelRootProps()}
                    className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${
                      isExcelDrag ? 'border-emerald-500 bg-emerald-500/10' : 'border-slate-700 hover:border-slate-500 bg-slate-900'
                    }`}>
                    <input {...getExcelInputProps()} />
                    {excelFile ? (
                      <div className="flex flex-col items-center gap-2">
                        <FileSpreadsheet size={40} className="text-emerald-400" />
                        <p className="text-white font-medium text-sm">{excelFile.name}</p>
                        <p className="text-slate-500 text-xs">{(excelFile.size / 1024).toFixed(1)} KB</p>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-3 py-4">
                        <div className="w-14 h-14 rounded-2xl bg-emerald-600/20 border border-emerald-600/30 flex items-center justify-center">
                          <FileSpreadsheet size={24} className="text-emerald-400" />
                        </div>
                        <div>
                          <p className="text-white font-medium text-sm">Húzd ide az Excel fájlt vagy kattints</p>
                          <p className="text-slate-500 text-xs mt-1">.xlsx · .csv · max 20MB</p>
                        </div>
                      </div>
                    )}
                  </div>

                  <button onClick={handleAnalyzeExcel} disabled={!excelFile || analyzing}
                    className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 disabled:text-slate-500 text-white py-3 rounded-xl font-semibold transition-colors flex items-center justify-center gap-2">
                    {analyzing
                      ? <><Loader size={18} className="animate-spin" /> AI elemzés folyamatban...</>
                      : <><Scan size={18} /> AI elemzés indítása</>}
                  </button>
                </>
              )}

              {excelError && (
                <div className="flex items-center gap-2 p-3 bg-red-900/30 border border-red-800 rounded-lg text-red-300 text-sm">
                  <AlertCircle size={16} />{excelError}
                </div>
              )}

              {/* Step 2 — review extracted rows */}
              {reviewRows && !saveResult && (
                <div className="space-y-4">
                  {/* summary bar */}
                  <div className={`card p-3 flex flex-wrap gap-3 text-xs ${unresolvedCount > 0 ? 'border-red-500/40' : ''}`}>
                    <span className="text-slate-400">{reviewRows.length} sor kinyerve</span>
                    {unresolvedCount > 0 && (
                      <span className="text-red-400 flex items-center gap-1 font-medium">
                        <AlertTriangle size={11} />{unresolvedCount} döntetlen egyezés — válassz minden pirosnál!
                      </span>
                    )}
                    {dupCount > 0 && unresolvedCount === 0 && (
                      <span className="text-emerald-400 flex items-center gap-1"><CheckCircle size={11} />{dupCount} egyezés kezelve</span>
                    )}
                    <span className="text-slate-400 ml-auto">{saveCount} új · {replaceCount} csere · {skipCount} kihagyva</span>
                  </div>

                  {/* rows */}
                  <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
                    {reviewRows.map((row, i) => (
                      <ReviewRow key={i} row={row} index={i} onChange={handleRowChange} users={users} />
                    ))}
                  </div>

                  {/* action buttons */}
                  <div className="flex gap-2 sticky bottom-0 bg-slate-950/90 backdrop-blur py-2">
                    <button
                      onClick={() => { setReviewRows(null); setExcelFile(null); setSaveResult(null) }}
                      className="btn-secondary text-sm flex-1">
                      <X size={15} /> Vissza
                    </button>
                    <button
                      onClick={handleSaveEntries}
                      disabled={saving || unresolvedCount > 0 || reviewRows.every(r => r.action === 'skip')}
                      title={unresolvedCount > 0 ? `${unresolvedCount} egyezésnél még döntés szükséges` : ''}
                      className="btn-primary text-sm flex-[2] justify-center disabled:opacity-50">
                      {saving
                        ? <><Loader size={15} className="animate-spin" /> Mentés...</>
                        : unresolvedCount > 0
                          ? <><AlertTriangle size={15} /> {unresolvedCount} döntetlen egyezés</>
                          : <><Save size={15} /> Mentés ({saveCount + replaceCount} tétel)</>}
                    </button>
                  </div>
                </div>
              )}

              {/* Step 3 — save result */}
              {saveResult && (
                <div className="card p-4 border-emerald-600/40 bg-emerald-900/10 space-y-3">
                  <div className="flex items-center gap-2"><CheckCircle size={18} className="text-emerald-400" /><span className="font-semibold text-emerald-300">Importálás kész!</span></div>
                  <div className="text-sm space-y-1">
                    <div className="flex justify-between"><span className="text-slate-400">Új bejegyzés:</span><span className="text-white font-medium">{saveResult.saved} db</span></div>
                    {saveResult.replaced > 0 && <div className="flex justify-between"><span className="text-slate-400">Felülírva:</span><span className="text-white font-medium">{saveResult.replaced} db</span></div>}
                    {saveResult.skipped > 0 && <div className="flex justify-between"><span className="text-slate-400">Kihagyva:</span><span className="text-slate-500">{saveResult.skipped} db</span></div>}
                  </div>
                  <button
                    onClick={() => { setReviewRows(null); setExcelFile(null); setSaveResult(null) }}
                    className="w-full btn-secondary text-xs justify-center">
                    Új Excel importálása
                  </button>
                </div>
              )}
            </>
          )}

          {/* ════════════════════════════════════════════════
              MANUAL TAB
          ════════════════════════════════════════════════ */}
          {tab === 'manual' && (
            <form onSubmit={handleManualSubmit} className="space-y-3">
              <div>
                <label className="label">Leírás *</label>
                <input className="input" required value={manual.description}
                  onChange={e => setManual(p => ({ ...p, description: e.target.value }))}
                  placeholder="pl. Esztrich munkadíj, Cementes zsákok, stb." />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Összeg (Ft) *</label>
                  <input type="number" className="input" required value={manual.amount}
                    onChange={e => setManual(p => ({ ...p, amount: e.target.value }))}
                    placeholder="0" />
                </div>
                <div>
                  <label className="label">Kategória</label>
                  <select className="input" value={manual.category}
                    onChange={e => setManual(p => ({ ...p, category: e.target.value }))}>
                    {Object.entries(CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="label">Szállító / Partner</label>
                <input className="input" value={manual.vendor}
                  onChange={e => setManual(p => ({ ...p, vendor: e.target.value }))}
                  placeholder="pl. Praktiker, OBI, Kovács Bt." />
              </div>
              <div>
                <label className="label">Számla / bizonylat száma</label>
                <input className="input" value={manual.invoice_number}
                  onChange={e => setManual(p => ({ ...p, invoice_number: e.target.value }))}
                  placeholder="pl. 2024/001 (opcionális)" />
              </div>
              <div>
                <label className="label">Ki fizette? *</label>
                <UserSelector value={manual.paid_by_user_id} onChange={v => setManual(p => ({ ...p, paid_by_user_id: v }))} users={users} />
              </div>

              {manualError && <div className="flex items-center gap-2 p-3 bg-red-900/30 border border-red-800 rounded-lg text-red-300 text-sm"><AlertCircle size={16} />{manualError}</div>}
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

        {/* ── Summary panel ── */}
        <div className="space-y-4">
          <div className="card p-5">
            <h2 className="font-medium text-white text-sm mb-4">Ki mennyit fizetett?</h2>
            {summary?.by_person?.length > 0 ? (
              <>
                <ResponsiveContainer width="100%" height={170}>
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" outerRadius={65} dataKey="value"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
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
                          <div className="h-1 rounded-full" style={{ width: `${(person.total / summary.total) * 100}%`, background: COLORS[i % COLORS.length] }} />
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">{person.entries.length} tétel · {((person.total / summary.total) * 100).toFixed(1)}%</p>
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

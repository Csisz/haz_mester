import React, { useState, useRef } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../utils/api'
import { formatCurrency, formatDate, formatRelative, STATUS_LABELS, STATUS_COLORS, PRIORITY_LABELS, CATEGORY_LABELS } from '../utils/helpers'
import { ChevronRight, Bot, Send, Paperclip, Trash2, ImageIcon, FileText, Sparkles, CheckCircle, AlertCircle, Zap, X, Edit2, Save } from 'lucide-react'
import { useAuthStore } from '../stores/authStore'

export default function TaskDetailPage() {
  const { id } = useParams()
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const fileRef = useRef()
  const [comment, setComment] = useState('')
  const [analyzing, setAnalyzing] = useState(false)
  const [aiQuestion, setAiQuestion] = useState('')
  const [aiAnswer, setAiAnswer] = useState(null)
  const [aiLoading, setAiLoading] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editData, setEditData] = useState({})
  const [uploadProgress, setUploadProgress] = useState(false)

  const { data: task, isLoading } = useQuery({
    queryKey: ['task', id],
    queryFn: () => api.get(`/tasks/${id}`).then(r => r.data)
  })

  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: () => api.get('/users').then(r => r.data)
  })

  const updateTask = useMutation({
    mutationFn: (data) => api.put(`/tasks/${id}`, data),
    onSuccess: () => { qc.invalidateQueries(['task', id]); setEditing(false) }
  })

  const deleteTask = useMutation({
    mutationFn: () => api.delete(`/tasks/${id}`),
    onSuccess: () => navigate(-1)
  })

  const addComment = useMutation({
    mutationFn: (content) => api.post('/comments', { task_id: parseInt(id), content }),
    onSuccess: () => { qc.invalidateQueries(['task', id]); setComment('') }
  })

  const deleteComment = useMutation({
    mutationFn: (cid) => api.delete(`/comments/${cid}`),
    onSuccess: () => qc.invalidateQueries(['task', id])
  })

  const deleteAttachment = useMutation({
    mutationFn: (aid) => api.delete(`/attachments/${aid}`),
    onSuccess: () => qc.invalidateQueries(['task', id])
  })

  const handleFileUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    setUploadProgress(true)
    const form = new FormData()
    form.append('file', file)
    form.append('task_id', id)
    try {
      await api.post('/attachments/upload', form, { headers: { 'Content-Type': 'multipart/form-data' } })
      qc.invalidateQueries(['task', id])
    } catch (err) {
      alert('Feltöltési hiba: ' + (err.response?.data?.detail || err.message))
    } finally {
      setUploadProgress(false)
      e.target.value = ''
    }
  }

  const handleAnalyzeTask = async () => {
    setAnalyzing(true)
    try {
      await api.post('/ai/analyze-task', { task_id: parseInt(id) })
      qc.invalidateQueries(['task', id])
    } catch (err) {
      alert('AI elemzési hiba: ' + (err.response?.data?.detail || err.message))
    } finally {
      setAnalyzing(false)
    }
  }

  const handleAnalyzeImage = async (attachmentId) => {
    setAnalyzing(true)
    try {
      await api.post('/ai/analyze-image', { attachment_id: attachmentId })
      qc.invalidateQueries(['task', id])
    } catch (err) {
      alert('Képelemzési hiba: ' + (err.response?.data?.detail || err.message))
    } finally {
      setAnalyzing(false)
    }
  }

  const handleAskAI = async (e) => {
    e.preventDefault()
    if (!aiQuestion.trim()) return
    setAiLoading(true)
    try {
      const res = await api.post('/ai/ask', { question: aiQuestion, task_id: parseInt(id) })
      setAiAnswer(res.data.answer)
    } catch (err) {
      alert('AI hiba: ' + (err.response?.data?.detail || err.message))
    } finally {
      setAiLoading(false)
    }
  }

  const startEdit = () => {
    setEditData({
      title: task.title,
      description: task.description || '',
      status: task.status,
      priority: task.priority,
      category: task.category || '',
      estimated_cost: task.estimated_cost || 0,
      actual_cost: task.actual_cost || 0,
      assigned_to: task.assigned_to?.id || null,
    })
    setEditing(true)
  }

  if (isLoading) return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="space-y-4">
        <div className="h-8 bg-slate-800 rounded animate-pulse w-2/3" />
        <div className="h-32 bg-slate-800 rounded animate-pulse" />
      </div>
    </div>
  )

  if (!task) return <div className="p-6 text-slate-400">Feladat nem található</div>

  const ai = task.ai_suggestions

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-5">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs text-slate-500">
        <Link to="/projects" className="hover:text-slate-300">Projektek</Link>
        <ChevronRight size={12} />
        <Link to={`/projects/${task.project_id}`} className="hover:text-slate-300">Projekt</Link>
        <ChevronRight size={12} />
        <span className="text-slate-300 truncate">{task.title}</span>
      </div>

      {/* Header */}
      <div className="card p-5">
        {editing ? (
          <div className="space-y-3">
            <input className="input text-lg font-semibold" value={editData.title} onChange={e => setEditData(p => ({...p, title: e.target.value}))} />
            <textarea className="input resize-none" rows={4} value={editData.description} onChange={e => setEditData(p => ({...p, description: e.target.value}))} placeholder="Leírás..." />
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div>
                <label className="label">Státusz</label>
                <select className="input" value={editData.status} onChange={e => setEditData(p => ({...p, status: e.target.value}))}>
                  {Object.entries(STATUS_LABELS).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Prioritás</label>
                <select className="input" value={editData.priority} onChange={e => setEditData(p => ({...p, priority: e.target.value}))}>
                  {Object.entries(PRIORITY_LABELS).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Kategória</label>
                <select className="input" value={editData.category} onChange={e => setEditData(p => ({...p, category: e.target.value}))}>
                  <option value="">Válassz...</option>
                  {Object.entries(CATEGORY_LABELS).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Becsült költség (HUF)</label>
                <input type="number" className="input" value={editData.estimated_cost} onChange={e => setEditData(p => ({...p, estimated_cost: parseFloat(e.target.value) || 0}))} />
              </div>
              <div>
                <label className="label">Tényleges költség (HUF)</label>
                <input type="number" className="input" value={editData.actual_cost} onChange={e => setEditData(p => ({...p, actual_cost: parseFloat(e.target.value) || 0}))} />
              </div>
              <div>
                <label className="label">Felelős</label>
                <select className="input" value={editData.assigned_to || ''} onChange={e => setEditData(p => ({...p, assigned_to: e.target.value ? parseInt(e.target.value) : null}))}>
                  <option value="">Nincs</option>
                  {users.map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}
                </select>
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setEditing(false)} className="btn-secondary"><X size={14} /> Mégsem</button>
              <button onClick={() => updateTask.mutate(editData)} disabled={updateTask.isPending} className="btn-primary">
                <Save size={14} /> {updateTask.isPending ? 'Mentés...' : 'Mentés'}
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1">
                <div className="flex items-center gap-2 flex-wrap mb-2">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ${STATUS_COLORS[task.status]}`}>
                    {STATUS_LABELS[task.status]}
                  </span>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ${
                    task.priority === 'critical' ? 'bg-red-900/50 text-red-300' :
                    task.priority === 'high' ? 'bg-orange-900/50 text-orange-300' :
                    'bg-slate-700 text-slate-300'
                  }`}>
                    {PRIORITY_LABELS[task.priority]}
                  </span>
                  {task.category && <span className="text-xs text-slate-500 bg-slate-800 px-2 py-0.5 rounded">{CATEGORY_LABELS[task.category]}</span>}
                </div>
                <h1 className="text-xl font-bold font-display text-white">{task.title}</h1>
              </div>
              <button onClick={startEdit} className="btn-secondary flex-shrink-0">
                <Edit2 size={14} /> Szerkesztés
              </button>
            </div>

            {task.description && (
              <div className="mt-3 text-sm text-slate-300 whitespace-pre-wrap leading-relaxed">
                {task.description}
              </div>
            )}

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-4 border-t border-slate-800">
              <div>
                <p className="text-xs text-slate-500 mb-0.5">Becsült költség</p>
                <p className="text-sm font-semibold text-white">{formatCurrency(task.estimated_cost)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 mb-0.5">Tényleges</p>
                <p className="text-sm font-semibold text-amber-400">{formatCurrency(task.actual_cost)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 mb-0.5">Felelős</p>
                <p className="text-sm text-white">{task.assigned_to?.full_name || '—'}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 mb-0.5">Frissítve</p>
                <p className="text-sm text-white">{formatRelative(task.updated_at)}</p>
              </div>
            </div>

            {/* Quick status change */}
            <div className="flex flex-wrap gap-2 mt-4">
              {Object.entries(STATUS_LABELS).filter(([k]) => k !== task.status).map(([k, v]) => (
                <button key={k} onClick={() => updateTask.mutate({ status: k })}
                  className={`text-xs px-2.5 py-1 rounded-lg border transition-colors ${STATUS_COLORS[k]} border-current/30 hover:opacity-80`}>
                  → {v}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {/* AI Analysis */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-violet-600/20 border border-violet-600/30 flex items-center justify-center">
              <Bot size={16} className="text-violet-400" />
            </div>
            <span className="font-medium text-white text-sm">AI Asszisztens</span>
          </div>
          <button onClick={handleAnalyzeTask} disabled={analyzing} className="btn-secondary text-xs text-violet-300">
            <Sparkles size={14} className="text-violet-400" />
            {analyzing ? 'Elemzés...' : 'Feladat elemzése'}
          </button>
        </div>

        {ai && (
          <div className="space-y-3 mb-4">
            {ai.summary && (
              <div className="p-3 bg-violet-900/10 border border-violet-800/30 rounded-lg">
                <p className="text-sm text-violet-200">{ai.summary}</p>
              </div>
            )}
            {ai.next_steps?.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Következő lépések</p>
                <div className="space-y-1.5">
                  {ai.next_steps.map((step, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <Zap size={13} className="text-amber-400 mt-0.5 flex-shrink-0" />
                      <p className="text-sm text-slate-300">{step}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {ai.steps?.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Végrehajtási lépések</p>
                <ol className="space-y-1">
                  {ai.steps.map((step, i) => (
                    <li key={i} className="text-sm text-slate-300 flex gap-2">
                      <span className="text-slate-500 flex-shrink-0">{i+1}.</span>
                      {step}
                    </li>
                  ))}
                </ol>
              </div>
            )}
            {ai.risks?.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Kockázatok</p>
                {ai.risks.map((r, i) => (
                  <div key={i} className="flex items-start gap-2 mb-1.5">
                    <AlertCircle size={13} className="text-red-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-sm text-slate-300">{r.risk}</p>
                      {r.mitigation && <p className="text-xs text-emerald-400 mt-0.5">✓ {r.mitigation}</p>}
                    </div>
                  </div>
                ))}
              </div>
            )}
            {ai.materials?.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Szükséges anyagok</p>
                <div className="grid grid-cols-2 gap-1.5">
                  {ai.materials.map((m, i) => (
                    <div key={i} className="bg-slate-800/50 rounded p-2 text-xs">
                      <p className="text-white font-medium">{m.name}</p>
                      <p className="text-slate-400">{m.quantity} {m.unit}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {ai.time_estimate && (
              <p className="text-xs text-slate-500">⏱ Időbecslés: <span className="text-slate-300">{ai.time_estimate}</span></p>
            )}
          </div>
        )}

        {/* AI Chat */}
        <form onSubmit={handleAskAI} className="flex gap-2">
          <input
            className="input flex-1 text-xs"
            value={aiQuestion}
            onChange={e => setAiQuestion(e.target.value)}
            placeholder="Kérdezz az AI-tól erről a feladatról..."
          />
          <button type="submit" disabled={aiLoading || !aiQuestion.trim()} className="btn-primary text-xs flex-shrink-0">
            <Send size={14} /> {aiLoading ? '...' : 'Kérdés'}
          </button>
        </form>
        {aiAnswer && (
          <div className="mt-3 p-3 bg-slate-800/50 rounded-lg border border-slate-700">
            <p className="text-xs text-violet-400 mb-1 font-medium">AI válasz:</p>
            <p className="text-sm text-slate-300 whitespace-pre-wrap">{aiAnswer}</p>
            <button onClick={() => setAiAnswer(null)} className="text-xs text-slate-600 hover:text-slate-400 mt-2">Bezárás</button>
          </div>
        )}
      </div>

      {/* Attachments */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-medium text-white text-sm">Csatolmányok ({task.attachments?.length || 0})</h2>
          <div>
            <input ref={fileRef} type="file" className="hidden" onChange={handleFileUpload}
              accept="image/*,.pdf,.doc,.docx,.xls,.xlsx" />
            <button onClick={() => fileRef.current.click()} disabled={uploadProgress} className="btn-secondary text-xs">
              <Paperclip size={14} /> {uploadProgress ? 'Feltöltés...' : 'Fájl feltöltése'}
            </button>
          </div>
        </div>

        {task.attachments?.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {task.attachments.map(att => (
              <div key={att.id} className="card p-3 flex flex-col gap-2">
                {att.file_type === 'image' ? (
                  <a href={att.url} target="_blank" rel="noopener noreferrer">
                    <img src={att.url} alt={att.filename} className="w-full h-24 object-cover rounded" />
                  </a>
                ) : (
                  <div className="w-full h-24 bg-slate-800 rounded flex items-center justify-center">
                    <FileText size={32} className="text-slate-600" />
                  </div>
                )}
                <p className="text-xs text-slate-300 truncate">{att.filename}</p>
                {att.ai_analysis && (
                  <div className="text-xs text-violet-300 bg-violet-900/20 rounded p-1.5">
                    {JSON.parse(att.ai_analysis)?.description?.slice(0, 80)}...
                  </div>
                )}
                <div className="flex gap-1">
                  {att.file_type === 'image' && (
                    <button onClick={() => handleAnalyzeImage(att.id)} disabled={analyzing}
                      className="flex-1 btn-secondary text-xs py-1 text-violet-300">
                      <Bot size={12} /> AI
                    </button>
                  )}
                  <button onClick={() => deleteAttachment.mutate(att.id)} className="btn-danger text-xs py-1 flex-shrink-0">
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-500 text-center py-4">Nincsenek csatolmányok</p>
        )}
      </div>

      {/* Comments */}
      <div className="card p-5">
        <h2 className="font-medium text-white text-sm mb-4">Megjegyzések ({task.comments?.length || 0})</h2>
        <div className="space-y-3 mb-4">
          {task.comments?.map(c => (
            <div key={c.id} className="flex items-start gap-3">
              <div className="w-7 h-7 rounded-full bg-emerald-700 flex items-center justify-center text-xs text-white font-bold flex-shrink-0 mt-0.5">
                {c.user.full_name?.[0] || c.user.username?.[0]}
              </div>
              <div className="flex-1 bg-slate-800/50 rounded-lg p-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-slate-300">{c.user.full_name || c.user.username}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-600">{formatRelative(c.created_at)}</span>
                    {(c.user.id === user?.id || user?.role === 'admin') && (
                      <button onClick={() => deleteComment.mutate(c.id)} className="text-slate-600 hover:text-red-400 transition-colors">
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                </div>
                <p className="text-sm text-slate-200 whitespace-pre-wrap">{c.content}</p>
              </div>
            </div>
          ))}
          {task.comments?.length === 0 && (
            <p className="text-sm text-slate-500 text-center py-2">Legyél az első, aki megjegyzést fűz ehhez a feladathoz!</p>
          )}
        </div>
        <div className="flex gap-2">
          <textarea
            className="input resize-none flex-1 text-sm"
            rows={2}
            value={comment}
            onChange={e => setComment(e.target.value)}
            placeholder="Megjegyzés írása..."
            onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) addComment.mutate(comment) }}
          />
          <button onClick={() => addComment.mutate(comment)} disabled={!comment.trim() || addComment.isPending}
            className="btn-primary flex-shrink-0 self-end">
            <Send size={16} />
          </button>
        </div>
      </div>

      {/* Delete */}
      {user?.role === 'admin' && (
        <div className="flex justify-end">
          <button onClick={() => { if (confirm('Biztosan törlöd a feladatot?')) deleteTask.mutate() }} className="btn-danger text-xs">
            <Trash2 size={14} /> Feladat törlése
          </button>
        </div>
      )}
    </div>
  )
}

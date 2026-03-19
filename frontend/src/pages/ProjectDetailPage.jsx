import React, { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../utils/api'
import { formatCurrency, STATUS_LABELS, STATUS_COLORS, PRIORITY_LABELS, PRIORITY_COLORS, CATEGORY_LABELS, formatDate } from '../utils/helpers'
import { Plus, Filter, Bot, ChevronRight, AlertTriangle, Clock, CheckCircle2, Search, Sparkles } from 'lucide-react'

const STATUSES = ['all', 'pending', 'in_progress', 'review', 'completed', 'blocked']
const PRIORITIES = ['all', 'critical', 'high', 'medium', 'low']

function TaskCard({ task }) {
  return (
    <Link to={`/tasks/${task.id}`} className="flex items-start gap-3 p-4 hover:bg-slate-800/60 rounded-lg transition-colors group">
      <div className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${
        task.priority === 'critical' ? 'bg-red-500' :
        task.priority === 'high' ? 'bg-orange-500' :
        task.priority === 'medium' ? 'bg-yellow-500' : 'bg-slate-600'
      }`} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-white group-hover:text-emerald-300 transition-colors truncate">{task.title}</p>
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[task.status]}`}>
            {STATUS_LABELS[task.status]}
          </span>
          {task.category && (
            <span className="text-xs text-slate-500">{CATEGORY_LABELS[task.category] || task.category}</span>
          )}
          {task.comment_count > 0 && (
            <span className="text-xs text-slate-600">💬 {task.comment_count}</span>
          )}
          {task.attachment_count > 0 && (
            <span className="text-xs text-slate-600">📎 {task.attachment_count}</span>
          )}
        </div>
      </div>
      <div className="flex flex-col items-end gap-1 flex-shrink-0">
        {task.estimated_cost > 0 && (
          <span className="text-xs text-slate-500">{formatCurrency(task.estimated_cost)}</span>
        )}
        {task.assigned_to && (
          <div className="w-6 h-6 rounded-full bg-emerald-700 flex items-center justify-center text-xs text-white">
            {task.assigned_to.full_name?.[0] || '?'}
          </div>
        )}
        <ChevronRight size={14} className="text-slate-600 group-hover:text-slate-400 transition-colors" />
      </div>
    </Link>
  )
}

export default function ProjectDetailPage() {
  const { id } = useParams()
  const [statusFilter, setStatusFilter] = useState('all')
  const [priorityFilter, setPriorityFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [showNewTask, setShowNewTask] = useState(false)
  const [aiGenerating, setAiGenerating] = useState(false)
  const [generatedTasks, setGeneratedTasks] = useState(null)
  const [newTask, setNewTask] = useState({ title: '', description: '', priority: 'medium', category: '', estimated_cost: '' })
  const qc = useQueryClient()

  const { data: project, isLoading: projLoading } = useQuery({
    queryKey: ['project', id],
    queryFn: () => api.get(`/projects/${id}`).then(r => r.data)
  })

  const { data: tasks = [], isLoading: tasksLoading } = useQuery({
    queryKey: ['tasks', id],
    queryFn: () => api.get(`/tasks/project/${id}`).then(r => r.data)
  })

  const createTask = useMutation({
    mutationFn: (data) => api.post('/tasks', data),
    onSuccess: () => { qc.invalidateQueries(['tasks', id]); setShowNewTask(false); setNewTask({ title: '', description: '', priority: 'medium', category: '', estimated_cost: '' }) }
  })

  const addGeneratedTask = useMutation({
    mutationFn: (task) => api.post('/tasks', { ...task, project_id: parseInt(id) }),
    onSuccess: () => qc.invalidateQueries(['tasks', id])
  })

  const filtered = tasks.filter(t => {
    if (statusFilter !== 'all' && t.status !== statusFilter) return false
    if (priorityFilter !== 'all' && t.priority !== priorityFilter) return false
    if (search && !t.title.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const handleGenerateAI = async () => {
    setAiGenerating(true)
    try {
      const res = await api.post('/ai/generate-tasks', { project_id: parseInt(id) })
      setGeneratedTasks(res.data.tasks)
    } catch (e) {
      alert('AI hiba: ' + (e.response?.data?.detail || e.message))
    } finally {
      setAiGenerating(false)
    }
  }

  if (projLoading) return <div className="p-6"><div className="h-32 card animate-pulse" /></div>

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-sm text-slate-500 mb-2">
          <Link to="/projects" className="hover:text-slate-300 transition-colors">Projektek</Link>
          <ChevronRight size={14} />
          <span className="text-slate-300">{project?.name}</span>
        </div>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="font-display text-xl font-bold text-white">{project?.name}</h1>
            {project?.address && <p className="text-slate-400 text-sm mt-0.5">📍 {project.address} {project.hrsz && `(hrsz: ${project.hrsz})`}</p>}
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Összes', value: project?.stats?.total_tasks || 0, color: 'text-white' },
          { label: 'Folyamatban', value: project?.stats?.in_progress || 0, color: 'text-blue-400' },
          { label: 'Kész', value: project?.stats?.completed_tasks || 0, color: 'text-emerald-400' },
          { label: 'Kritikus', value: project?.stats?.critical || 0, color: 'text-red-400' },
        ].map(s => (
          <div key={s.label} className="card p-3 text-center">
            <div className={`text-xl font-bold ${s.color}`}>{s.value}</div>
            <div className="text-xs text-slate-500 mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Budget */}
      {project?.stats && (
        <div className="card p-4">
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="text-slate-400">Becsült: <span className="text-white font-semibold">{formatCurrency(project.stats.estimated_cost)}</span></span>
            <span className="text-slate-400">Tényleges: <span className="text-amber-400 font-semibold">{formatCurrency(project.stats.actual_cost)}</span></span>
          </div>
          {project.stats.estimated_cost > 0 && (
            <div className="w-full bg-slate-800 rounded-full h-1.5">
              <div className="bg-amber-500 h-1.5 rounded-full" style={{ width: `${Math.min(100, (project.stats.actual_cost / project.stats.estimated_cost) * 100)}%` }} />
            </div>
          )}
        </div>
      )}

      {/* AI Generated tasks suggestion */}
      {generatedTasks && (
        <div className="card p-4 border-violet-600/30 bg-violet-900/5">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles size={16} className="text-violet-400" />
            <span className="text-sm font-medium text-violet-300">AI által javasolt feladatok</span>
            <button onClick={() => setGeneratedTasks(null)} className="ml-auto text-slate-500 hover:text-slate-300 text-xs">Bezárás</button>
          </div>
          <div className="space-y-2">
            {generatedTasks.map((t, i) => (
              <div key={i} className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg">
                <div className="flex-1 min-w-0 mr-3">
                  <p className="text-sm font-medium text-white">{t.title}</p>
                  <p className="text-xs text-slate-500">{CATEGORY_LABELS[t.category]} • {PRIORITY_LABELS[t.priority]} • {formatCurrency(t.estimated_cost)}</p>
                </div>
                <button
                  onClick={() => addGeneratedTask.mutate(t)}
                  className="btn-primary text-xs px-3 py-1.5 flex-shrink-0"
                >
                  <Plus size={12} /> Hozzáadás
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input className="input pl-9" placeholder="Keresés feladatok közt..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="flex gap-2 flex-wrap">
          <select className="input !w-auto text-xs" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            {STATUSES.map(s => <option key={s} value={s}>{s === 'all' ? 'Minden státusz' : STATUS_LABELS[s]}</option>)}
          </select>
          <select className="input !w-auto text-xs" value={priorityFilter} onChange={e => setPriorityFilter(e.target.value)}>
            {PRIORITIES.map(p => <option key={p} value={p}>{p === 'all' ? 'Minden prioritás' : PRIORITY_LABELS[p]}</option>)}
          </select>
          <button onClick={handleGenerateAI} disabled={aiGenerating} className="btn-secondary text-violet-300 border-violet-800 text-xs">
            <Bot size={14} className="text-violet-400" />
            {aiGenerating ? 'Generálás...' : 'AI javaslatok'}
          </button>
          <button onClick={() => setShowNewTask(true)} className="btn-primary text-xs">
            <Plus size={14} /> Új feladat
          </button>
        </div>
      </div>

      {/* New task form */}
      {showNewTask && (
        <div className="card p-5 border-emerald-600/30">
          <h3 className="font-medium text-white mb-4 text-sm">Új feladat</h3>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="label">Cím *</label>
              <input className="input" value={newTask.title} onChange={e => setNewTask(p => ({...p, title: e.target.value}))} placeholder="Feladat neve" />
            </div>
            <div className="sm:col-span-2">
              <label className="label">Leírás</label>
              <textarea className="input resize-none" rows={3} value={newTask.description} onChange={e => setNewTask(p => ({...p, description: e.target.value}))} placeholder="Részletes leírás..." />
            </div>
            <div>
              <label className="label">Prioritás</label>
              <select className="input" value={newTask.priority} onChange={e => setNewTask(p => ({...p, priority: e.target.value}))}>
                {Object.entries(PRIORITY_LABELS).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Kategória</label>
              <select className="input" value={newTask.category} onChange={e => setNewTask(p => ({...p, category: e.target.value}))}>
                <option value="">Válassz...</option>
                {Object.entries(CATEGORY_LABELS).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Becsült költség (HUF)</label>
              <input type="number" className="input" value={newTask.estimated_cost} onChange={e => setNewTask(p => ({...p, estimated_cost: e.target.value}))} placeholder="0" />
            </div>
          </div>
          <div className="flex gap-2 justify-end mt-4">
            <button onClick={() => setShowNewTask(false)} className="btn-secondary">Mégsem</button>
            <button
              onClick={() => createTask.mutate({ ...newTask, project_id: parseInt(id), estimated_cost: parseFloat(newTask.estimated_cost) || 0 })}
              disabled={!newTask.title || createTask.isPending}
              className="btn-primary"
            >
              {createTask.isPending ? 'Mentés...' : 'Feladat létrehozása'}
            </button>
          </div>
        </div>
      )}

      {/* Task list */}
      <div className="card divide-y divide-slate-800/50">
        {tasksLoading ? (
          <div className="p-4 space-y-3">
            {[1,2,3].map(i => <div key={i} className="h-12 bg-slate-800 rounded animate-pulse" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center text-slate-500">
            <CheckCircle2 size={32} className="mx-auto mb-2 opacity-30" />
            <p className="text-sm">Nincs találat</p>
          </div>
        ) : (
          filtered.map(task => <TaskCard key={task.id} task={task} />)
        )}
      </div>

      {/* Members */}
      {project?.members?.length > 0 && (
        <div className="card p-5">
          <h3 className="font-medium text-white text-sm mb-3">Projekt tagok</h3>
          <div className="flex flex-wrap gap-2">
            {project.members.map(m => (
              <div key={m.id} className="flex items-center gap-2 bg-slate-800 rounded-lg px-3 py-1.5">
                <div className="w-6 h-6 rounded-full bg-emerald-700 flex items-center justify-center text-xs text-white font-bold">
                  {m.full_name?.[0] || m.username?.[0]}
                </div>
                <span className="text-sm text-slate-300">{m.full_name || m.username}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import api from '../utils/api'
import { formatCurrency, formatDate } from '../utils/helpers'
import { FolderOpen, Plus, MapPin, Users, CheckSquare, TrendingUp, ChevronRight, Building2 } from 'lucide-react'

function ProjectCard({ project }) {
  const progress = project.stats.total_tasks > 0
    ? Math.round((project.stats.completed_tasks / project.stats.total_tasks) * 100) : 0
  return (
    <Link to={`/projects/${project.id}`} className="card-hover p-5 flex flex-col gap-4 block">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-emerald-600/20 border border-emerald-600/30 flex items-center justify-center">
            <Building2 size={20} className="text-emerald-400" />
          </div>
          <div>
            <h3 className="font-semibold text-white text-sm leading-tight">{project.name}</h3>
            <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium mt-1 ${
              project.status === 'active' ? 'bg-emerald-900/50 text-emerald-300' : 'bg-slate-700 text-slate-400'
            }`}>
              {project.status === 'active' ? 'Aktív' : project.status}
            </span>
          </div>
        </div>
        <ChevronRight size={18} className="text-slate-600" />
      </div>

      {project.address && (
        <div className="flex items-center gap-1.5 text-xs text-slate-500">
          <MapPin size={12} />
          {project.address}
        </div>
      )}

      <div className="grid grid-cols-3 gap-3 text-center">
        <div className="bg-slate-800/50 rounded-lg p-2">
          <div className="text-base font-bold text-white">{project.stats.total_tasks}</div>
          <div className="text-xs text-slate-500">Feladat</div>
        </div>
        <div className="bg-slate-800/50 rounded-lg p-2">
          <div className="text-base font-bold text-emerald-400">{project.stats.completed_tasks}</div>
          <div className="text-xs text-slate-500">Kész</div>
        </div>
        <div className="bg-slate-800/50 rounded-lg p-2">
          <div className="text-base font-bold text-white">{project.stats.member_count}</div>
          <div className="text-xs text-slate-500">Tag</div>
        </div>
      </div>

      <div>
        <div className="flex justify-between text-xs text-slate-500 mb-1.5">
          <span>Előrehaladás</span>
          <span className="text-white font-medium">{progress}%</span>
        </div>
        <div className="w-full bg-slate-800 rounded-full h-1.5">
          <div className="bg-emerald-500 h-1.5 rounded-full transition-all" style={{ width: `${progress}%` }} />
        </div>
      </div>

      <div className="flex items-center justify-between text-xs text-slate-500 pt-1 border-t border-slate-800">
        <span className="flex items-center gap-1"><TrendingUp size={12} /> {formatCurrency(project.stats.estimated_cost)}</span>
        <span>{project.total_area ? `${project.total_area} m²` : ''}</span>
      </div>
    </Link>
  )
}

export default function ProjectsPage() {
  const [showNew, setShowNew] = useState(false)
  const [newName, setNewName] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const qc = useQueryClient()

  const { data: projects = [], isLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: () => api.get('/projects').then(r => r.data)
  })

  const createMutation = useMutation({
    mutationFn: (data) => api.post('/projects', data),
    onSuccess: () => { qc.invalidateQueries(['projects']); setShowNew(false); setNewName(''); setNewDesc('') }
  })

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-2xl font-bold text-white">Projektek</h1>
          <p className="text-slate-400 text-sm mt-0.5">{projects.length} projekt</p>
        </div>
        <button onClick={() => setShowNew(true)} className="btn-primary">
          <Plus size={16} /> Új projekt
        </button>
      </div>

      {showNew && (
        <div className="card p-5 mb-6 border-emerald-600/30">
          <h3 className="font-medium text-white mb-4">Új projekt létrehozása</h3>
          <div className="grid gap-4">
            <div>
              <label className="label">Projekt neve *</label>
              <input className="input" value={newName} onChange={e => setNewName(e.target.value)} placeholder="pl. Kert rendezés" />
            </div>
            <div>
              <label className="label">Leírás</label>
              <textarea className="input resize-none" rows={2} value={newDesc} onChange={e => setNewDesc(e.target.value)} placeholder="Projekt rövid leírása..." />
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowNew(false)} className="btn-secondary">Mégsem</button>
              <button
                onClick={() => createMutation.mutate({ name: newName, description: newDesc })}
                disabled={!newName || createMutation.isPending}
                className="btn-primary"
              >
                {createMutation.isPending ? 'Létrehozás...' : 'Projekt létrehozása'}
              </button>
            </div>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {[1,2].map(i => <div key={i} className="card h-64 animate-pulse bg-slate-800" />)}
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {projects.map(p => <ProjectCard key={p.id} project={p} />)}
        </div>
      )}
    </div>
  )
}

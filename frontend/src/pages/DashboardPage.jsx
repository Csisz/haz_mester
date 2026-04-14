import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { useAuthStore } from '../stores/authStore'
import api from '../utils/api'
import { formatCurrency, formatRelative, STATUS_LABELS, STATUS_COLORS, PRIORITY_COLORS, PRIORITY_LABELS } from '../utils/helpers'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import {
  Building2, TrendingUp, CheckCircle2, AlertTriangle, Clock, Bot,
  ChevronRight, Zap, CircleDot, ArrowRight
} from 'lucide-react'

function StatCard({ label, value, sub, icon: Icon, color = 'emerald', trend }) {
  const colors = {
    emerald: 'bg-emerald-600/10 text-emerald-400 border-emerald-600/20',
    blue: 'bg-blue-600/10 text-blue-400 border-blue-600/20',
    amber: 'bg-amber-600/10 text-amber-400 border-amber-600/20',
    red: 'bg-red-600/10 text-red-400 border-red-600/20',
  }
  return (
    <div className="card p-5">
      <div className="flex items-start justify-between mb-3">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center border ${colors[color]}`}>
          <Icon size={20} />
        </div>
        {trend !== undefined && (
          <span className={`text-xs font-medium ${trend >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {trend >= 0 ? '+' : ''}{trend}%
          </span>
        )}
      </div>
      <div className="text-2xl font-bold text-white font-display">{value}</div>
      <div className="text-sm text-slate-400 mt-0.5">{label}</div>
      {sub && <div className="text-xs text-slate-500 mt-1">{sub}</div>}
    </div>
  )
}

export default function DashboardPage() {
  const { user } = useAuthStore()

  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: () => api.get('/projects').then(r => r.data)
  })

  const mainProject = projects[0]

  const { data: tasks = [] } = useQuery({
    queryKey: ['tasks', mainProject?.id],
    queryFn: () => api.get(`/tasks/project/${mainProject.id}`).then(r => r.data),
    enabled: !!mainProject?.id
  })

  const { data: aiSuggestions } = useQuery({
    queryKey: ['ai-suggestions', mainProject?.id],
    queryFn: () => api.get(`/ai/suggestions/${mainProject.id}`).then(r => r.data),
    enabled: !!mainProject?.id,
    staleTime: 5 * 60 * 1000,
  })

  const stats = mainProject?.stats || {}
  const criticalTasks = tasks.filter(t => t.priority === 'critical' && t.status !== 'completed')
  const inProgressTasks = tasks.filter(t => t.status === 'in_progress')
  const recentTasks = [...tasks].sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at)).slice(0, 5)

  // Chart data
  const categoryData = Object.entries(
    tasks.reduce((acc, t) => {
      const cat = t.category || 'other'
      if (!acc[cat]) acc[cat] = { total: 0, done: 0 }
      acc[cat].total += 1
      if (t.status === 'completed') acc[cat].done += 1
      return acc
    }, {})
  ).map(([cat, v]) => ({
    name: cat === 'waterproofing' ? 'Vízszig.' : cat === 'hvac' ? 'Fűtés/Hűtés' : cat === 'carpentry' ? 'Ács' : cat === 'insulation' ? 'Szigetelés' : 'Egyéb',
    total: v.total,
    done: v.done,
  }))

  const progress = stats.total_tasks > 0 ? Math.round((stats.completed_tasks / stats.total_tasks) * 100) : 0

  const greeting = () => {
    const h = new Date().getHours()
    if (h < 12) return 'Jó reggelt'
    if (h < 17) return 'Jó napot'
    return 'Jó estét'
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-white">
            {greeting()}, {user?.full_name?.split(' ').slice(-1)[0]}! 👋
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            {mainProject ? mainProject.name : 'Nincs projekt'}
          </p>
        </div>
        {mainProject && (
          <Link to={`/projects/${mainProject.id}`} className="btn-secondary hidden sm:flex">
            Projekt megnyitása
            <ChevronRight size={16} />
          </Link>
        )}
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Feladatok összesen"
          value={stats.total_tasks || 0}
          sub={`${stats.completed_tasks || 0} befejezett`}
          icon={CheckCircle2}
          color="emerald"
        />
        <StatCard
          label="Folyamatban"
          value={stats.in_progress || 0}
          sub={`${stats.pending || 0} függőben`}
          icon={CircleDot}
          color="blue"
        />
        <StatCard
          label="Kritikus feladat"
          value={criticalTasks.length}
          sub="azonnali intézkedés"
          icon={AlertTriangle}
          color={criticalTasks.length > 0 ? 'red' : 'emerald'}
        />
        <StatCard
          label="Becsült összköltség"
          value={formatCurrency(stats.estimated_cost)}
          sub={`${formatCurrency(stats.actual_cost)} tényleges`}
          icon={TrendingUp}
          color="amber"
        />
      </div>

      {/* Progress bar */}
      {mainProject && (
        <div className="card p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Building2 size={18} className="text-emerald-400" />
              <span className="font-medium text-white text-sm">Projekt előrehaladás</span>
            </div>
            <span className="text-emerald-400 font-bold text-lg">{progress}%</span>
          </div>
          <div className="w-full bg-slate-800 rounded-full h-2.5 mb-2">
            <div
              className="bg-gradient-to-r from-emerald-600 to-emerald-400 h-2.5 rounded-full transition-all duration-700"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="flex items-center gap-4 text-xs text-slate-500 mt-2">
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-500" />{stats.completed_tasks || 0} kész</span>
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-blue-500" />{stats.in_progress || 0} folyamatban</span>
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-slate-600" />{stats.pending || 0} függőben</span>
          </div>
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-6">
        {/* AI Suggestions */}
        <div className="lg:col-span-1 card p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-lg bg-violet-600/20 border border-violet-600/30 flex items-center justify-center">
              <Bot size={16} className="text-violet-400" />
            </div>
            <span className="font-medium text-white text-sm">AI Javaslatok</span>
          </div>

          {aiSuggestions ? (
            <div className="space-y-3">
              {aiSuggestions.urgent_actions?.slice(0, 4).map((action, i) => (
                <div key={i} className="flex items-start gap-2.5">
                  <Zap size={14} className="text-amber-400 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-slate-300 leading-snug">
                    {typeof action === 'string' ? action : JSON.stringify(action)}
                  </p>
                </div>
              ))}
              {aiSuggestions.weekly_focus && (
                <div className="mt-3 p-3 bg-violet-900/20 border border-violet-800/30 rounded-lg">
                  <p className="text-xs text-violet-300 font-medium mb-1">Heti fókusz</p>
                  <p className="text-xs text-slate-300">{aiSuggestions.weekly_focus}</p>
                </div>
              )}
              <Link to="/ai" className="flex items-center gap-1 text-xs text-violet-400 hover:text-violet-300 mt-2 transition-colors">
                Részletes AI elemzés <ArrowRight size={12} />
              </Link>
            </div>
          ) : (
            <div className="space-y-2">
              {[1,2,3].map(i => (
                <div key={i} className="h-4 bg-slate-800 rounded animate-pulse" style={{ width: `${70 + i * 10}%` }} />
              ))}
            </div>
          )}
        </div>

        {/* Recent tasks */}
        <div className="lg:col-span-2 card">
          <div className="flex items-center justify-between p-5 border-b border-slate-800">
            <h2 className="font-medium text-white text-sm">Legutóbbi feladatok</h2>
            {mainProject && (
              <Link to={`/projects/${mainProject.id}`} className="text-xs text-emerald-400 hover:text-emerald-300 transition-colors">
                Összes megtekintése
              </Link>
            )}
          </div>
          <div className="divide-y divide-slate-800">
            {recentTasks.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-sm">Nincsenek feladatok</div>
            ) : recentTasks.map(task => (
              <Link key={task.id} to={`/tasks/${task.id}`}
                className="flex items-center gap-3 p-4 hover:bg-slate-800/50 transition-colors">
                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${task.priority === 'critical' ? 'bg-red-500' : task.priority === 'high' ? 'bg-orange-500' : 'bg-slate-600'}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{task.title}</p>
                  <p className="text-xs text-slate-500">{formatRelative(task.updated_at)}</p>
                </div>
                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[task.status]}`}>
                  {STATUS_LABELS[task.status]}
                </span>
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* Category chart */}
      {categoryData.length > 0 && (
        <div className="card p-5">
          <h2 className="font-medium text-white text-sm mb-4">Feladatok kategóriánként</h2>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={categoryData} barGap={4}>
              <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 12 }}
                labelStyle={{ color: '#e2e8f0' }}
              />
              <Bar dataKey="total" fill="#334155" radius={4} name="Összes" />
              <Bar dataKey="done" fill="#16a34a" radius={4} name="Kész" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Critical tasks alert */}
      {criticalTasks.length > 0 && (
        <div className="card p-5 border-red-900/50 bg-red-900/5">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle size={16} className="text-red-400" />
            <h2 className="font-medium text-red-300 text-sm">Kritikus feladatok — azonnali intézkedés szükséges</h2>
          </div>
          <div className="space-y-2">
            {criticalTasks.map(task => (
              <Link key={task.id} to={`/tasks/${task.id}`}
                className="flex items-center justify-between p-3 bg-red-900/20 hover:bg-red-900/30 rounded-lg transition-colors">
                <span className="text-sm text-red-200">{task.title}</span>
                <ChevronRight size={16} className="text-red-400 flex-shrink-0" />
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

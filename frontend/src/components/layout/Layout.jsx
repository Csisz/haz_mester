import React, { useState } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../stores/authStore'
import {
  LayoutDashboard, FolderOpen, DollarSign, Users, Bot,
  Menu, X, LogOut, ChevronRight, Building2, ScanLine, BookOpen
} from 'lucide-react'

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Áttekintés', exact: true },
  { to: '/projects', icon: FolderOpen, label: 'Projektek' },
  { to: '/ai', icon: Bot, label: 'AI Asszisztens' },
  { to: '/invoice', icon: ScanLine, label: 'Számla beolvasás' },
  { to: '/documents', icon: BookOpen, label: 'Dokumentumok' },
  { to: '/finance', icon: DollarSign, label: 'Pénzügyek' },
  { to: '/users', icon: Users, label: 'Felhasználók', adminOnly: true },
]

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()

  const handleLogout = () => { logout(); navigate('/login') }
  const filtered = navItems.filter(i => !i.adminOnly || user?.role === 'admin')

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      <div className="p-5 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-emerald-600 rounded-lg flex items-center justify-center">
            <Building2 size={20} className="text-white" />
          </div>
          <div>
            <div className="font-display font-bold text-white text-sm">Építész</div>
            <div className="text-slate-500 text-xs">Zugligeti út 44/A</div>
          </div>
        </div>
      </div>
      <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
        {filtered.map(({ to, icon: Icon, label, exact }) => (
          <NavLink key={to} to={to} end={exact} onClick={() => setSidebarOpen(false)}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all group ${
                isActive ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-600/30'
                  : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800'
              }`}>
            <Icon size={18} />
            <span className="flex-1">{label}</span>
            <ChevronRight size={14} className="opacity-0 group-hover:opacity-50 transition-opacity" />
          </NavLink>
        ))}
      </nav>
      <div className="p-3 border-t border-slate-800">
        <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-slate-800/50 mb-1">
          <div className="w-8 h-8 rounded-full bg-emerald-600 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
            {user?.full_name?.[0] || '?'}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-slate-200 truncate">{user?.full_name || user?.username}</div>
            <div className="text-xs text-slate-500">{user?.role === 'admin' ? 'Adminisztrátor' : 'Felhasználó'}</div>
          </div>
        </div>
        <button onClick={handleLogout}
          className="flex items-center gap-2 w-full px-3 py-2 text-sm text-slate-400 hover:text-red-400 hover:bg-red-900/20 rounded-lg transition-colors">
          <LogOut size={16} /> Kijelentkezés
        </button>
      </div>
    </div>
  )

  return (
    <div className="flex h-screen bg-slate-950 overflow-hidden">
      <aside className="hidden lg:flex w-64 flex-col bg-slate-900 border-r border-slate-800 flex-shrink-0">
        <SidebarContent />
      </aside>
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setSidebarOpen(false)} />
          <aside className="relative w-72 h-full bg-slate-900 border-r border-slate-800 flex flex-col">
            <button onClick={() => setSidebarOpen(false)} className="absolute top-4 right-4 text-slate-400 hover:text-white"><X size={20} /></button>
            <SidebarContent />
          </aside>
        </div>
      )}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="lg:hidden flex items-center gap-3 p-4 border-b border-slate-800 bg-slate-900">
          <button onClick={() => setSidebarOpen(true)} className="text-slate-400 hover:text-white"><Menu size={22} /></button>
          <div className="flex items-center gap-2">
            <Building2 size={18} className="text-emerald-500" />
            <span className="font-display font-bold text-white">Építész</span>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto"><Outlet /></main>
      </div>
    </div>
  )
}

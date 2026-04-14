import React, { useState, useCallback, useRef, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../utils/api'
import { formatDate } from '../utils/helpers'
import { useDropzone } from 'react-dropzone'
import {
  FileText, Upload, Trash2, Bot, Send, BookOpen,
  FileImage, File, CheckCircle, AlertCircle, Loader,
  ChevronDown, ChevronUp, X, Plus, User
} from 'lucide-react'

const CATEGORIES = {
  architectural: { label: 'Építészeti terv', color: 'text-blue-400 bg-blue-900/30 border-blue-800' },
  mechanical: { label: 'Gépészeti terv', color: 'text-orange-400 bg-orange-900/30 border-orange-800' },
  structural: { label: 'Statikai terv', color: 'text-red-400 bg-red-900/30 border-red-800' },
  electrical: { label: 'Villamos terv', color: 'text-yellow-400 bg-yellow-900/30 border-yellow-800' },
  permit: { label: 'Engedély / határozat', color: 'text-green-400 bg-green-900/30 border-green-800' },
  modification: { label: 'Módosítás', color: 'text-purple-400 bg-purple-900/30 border-purple-800' },
  other: { label: 'Egyéb', color: 'text-slate-400 bg-slate-800 border-slate-700' },
}

function DocItem({ doc, onDelete }) {
  const [expanded, setExpanded] = useState(false)
  const cat = CATEGORIES[doc.category] || CATEGORIES.other
  const isPdf = doc.mime_type === 'application/pdf'
  const isImage = doc.mime_type?.startsWith('image/')

  return (
    <div className="p-3 rounded-lg bg-slate-800/50 border border-slate-700/50 space-y-2">
      <div className="flex items-start gap-2">
        <div className="w-7 h-7 rounded bg-slate-700 flex items-center justify-center flex-shrink-0 mt-0.5">
          {isImage ? <FileImage size={14} className="text-blue-400" /> :
           isPdf ? <FileText size={14} className="text-red-400" /> :
           <File size={14} className="text-slate-400" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-1">
            <p className="text-xs font-semibold text-white truncate leading-tight">{doc.name}</p>
            <button onClick={() => onDelete(doc.id)} className="text-slate-600 hover:text-red-400 flex-shrink-0 ml-1">
              <Trash2 size={12} />
            </button>
          </div>
          <span className={`inline-flex mt-1 items-center px-1.5 py-0.5 rounded text-xs border ${cat.color}`} style={{fontSize:'10px'}}>
            {cat.label}
          </span>
        </div>
      </div>

      {doc.ai_summary && (
        <div>
          <button onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1 text-violet-400 hover:text-violet-300 transition-colors w-full">
            <Bot size={11} />
            <span style={{fontSize:'10px'}} className="font-medium">AI összefoglaló</span>
            {expanded ? <ChevronUp size={10} className="ml-auto" /> : <ChevronDown size={10} className="ml-auto" />}
          </button>
          {expanded && (
            <p className="text-xs text-slate-400 mt-1.5 leading-relaxed whitespace-pre-wrap bg-slate-900/50 rounded p-2">{doc.ai_summary}</p>
          )}
        </div>
      )}
      <a href={doc.url} target="_blank" rel="noopener noreferrer" style={{fontSize:'10px'}} className="text-emerald-500 hover:text-emerald-400 block">
        📎 Megnyitás
      </a>
    </div>
  )
}

function ChatMessage({ msg }) {
  const isUser = msg.role === 'user'
  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : ''}`}>
      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${isUser ? 'bg-emerald-600' : 'bg-violet-600/30 border border-violet-600/40'}`}>
        {isUser ? <User size={16} className="text-white" /> : <Bot size={16} className="text-violet-400" />}
      </div>
      <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
        isUser ? 'bg-emerald-600 text-white rounded-tr-sm' : 'bg-slate-800 text-slate-200 rounded-tl-sm border border-slate-700'
      }`}>
        {msg.content.split('\n').map((line, i) => {
          // Render markdown-like formatting
          if (line.startsWith('## ')) return <p key={i} className="font-bold text-white mt-2 mb-1">{line.slice(3)}</p>
          if (line.startsWith('# ')) return <p key={i} className="font-bold text-white text-base mt-2 mb-1">{line.slice(2)}</p>
          if (line.startsWith('**') && line.endsWith('**')) return <p key={i} className="font-semibold text-white">{line.slice(2,-2)}</p>
          if (line.startsWith('- ') || line.startsWith('| ')) return <p key={i} className="text-slate-300 font-mono text-xs">{line}</p>
          if (line === '---') return <hr key={i} className="border-slate-600 my-2" />
          if (!line) return <br key={i} />
          // Bold inline
          const parts = line.split(/(\*\*[^*]+\*\*)/)
          return <p key={i} className="mb-0.5">{parts.map((p, j) =>
            p.startsWith('**') && p.endsWith('**')
              ? <strong key={j} className="text-white font-semibold">{p.slice(2,-2)}</strong>
              : p
          )}</p>
        })}
      </div>
    </div>
  )
}

export default function DocumentsPage() {
  const qc = useQueryClient()
  const [showUpload, setShowUpload] = useState(false)
  const [file, setFile] = useState(null)
  const [form, setForm] = useState({ name: '', description: '', category: 'architectural' })
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const [messages, setMessages] = useState([
    { role: 'assistant', content: 'Szia! A feltöltött tervrajzok és dokumentumok alapján válaszolok kérdéseire. Kérdezz bármit az épületről, tervekről, műszaki megoldásokról!' }
  ])
  const [input, setInput] = useState('')
  const [asking, setAsking] = useState(false)
  const [filterCat, setFilterCat] = useState('all')
  const messagesEndRef = useRef(null)

  const { data: projects = [] } = useQuery({ queryKey: ['projects'], queryFn: () => api.get('/projects').then(r => r.data) })
  const mainProject = projects[0]

  const { data: documents = [], isLoading } = useQuery({
    queryKey: ['documents', mainProject?.id],
    queryFn: () => api.get(`/documents/project/${mainProject.id}`).then(r => r.data),
    enabled: !!mainProject?.id
  })

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/documents/${id}`),
    onSuccess: () => qc.invalidateQueries(['documents', mainProject?.id])
  })

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const onDrop = useCallback((accepted) => {
    const f = accepted[0]; if (!f) return
    setFile(f)
    if (!form.name) setForm(p => ({ ...p, name: f.name.replace(/\.[^.]+$/, '') }))
  }, [form.name])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop, maxFiles: 1,
    accept: { 'image/*': [], 'application/pdf': ['.pdf'], 'application/msword': ['.doc'], 'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'] }
  })

  const handleUpload = async (e) => {
    e.preventDefault()
    if (!file || !form.name || !mainProject) return
    setUploading(true); setUploadError('')
    try {
      const fd = new FormData()
      fd.append('file', file); fd.append('project_id', mainProject.id)
      fd.append('name', form.name); fd.append('description', form.description)
      fd.append('category', form.category)
      await api.post('/documents/upload', fd, { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 120000 })
      qc.invalidateQueries(['documents', mainProject?.id])
      setShowUpload(false); setFile(null); setForm({ name: '', description: '', category: 'architectural' })
    } catch (err) {
      setUploadError(err.response?.data?.detail || 'Hiba a feltöltés során')
    } finally { setUploading(false) }
  }

  const handleSend = async (e) => {
    e.preventDefault()
    if (!input.trim() || !mainProject || asking) return
    const question = input.trim()
    setInput('')
    const newMessages = [...messages, { role: 'user', content: question }]
    setMessages(newMessages)
    setAsking(true)
    try {
      // Send full conversation history for context
      const history = newMessages.slice(1) // skip initial greeting
        .filter(m => m.role === 'user' || m.role === 'assistant')
        .slice(-10) // last 10 messages
      const res = await api.post(`/documents/ask/${mainProject.id}`, { question, history }, { timeout: 180000 })
      setMessages(prev => [...prev, { role: 'assistant', content: res.data.answer }])
    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', content: '⚠️ Hiba: ' + (err.response?.data?.detail || err.message) }])
    } finally { setAsking(false) }
  }

  const filtered = filterCat === 'all' ? documents : documents.filter(d => d.category === filterCat)
  const categoryCounts = documents.reduce((acc, d) => { acc[d.category] = (acc[d.category] || 0) + 1; return acc }, {})

  return (
    <div className="flex h-full overflow-hidden">
      {/* LEFT: Document sidebar */}
      <div className="w-72 flex-shrink-0 border-r border-slate-800 flex flex-col bg-slate-900/50 overflow-hidden">
        <div className="p-4 border-b border-slate-800">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="font-semibold text-white text-sm">Dokumentumok</h2>
              <p className="text-xs text-slate-500">{documents.length} feltöltve</p>
            </div>
            <button onClick={() => setShowUpload(!showUpload)}
              className="w-8 h-8 bg-emerald-600 hover:bg-emerald-500 rounded-lg flex items-center justify-center transition-colors">
              <Plus size={16} className="text-white" />
            </button>
          </div>

          {/* Upload form */}
          {showUpload && (
            <form onSubmit={handleUpload} className="space-y-2 mt-3 p-3 bg-slate-800 rounded-lg">
              <div {...getRootProps()} className={`border border-dashed rounded-lg p-3 text-center cursor-pointer text-xs transition-all ${isDragActive ? 'border-emerald-500 bg-emerald-500/10' : 'border-slate-600 hover:border-slate-500'}`}>
                <input {...getInputProps()} />
                {file ? (
                  <div className="flex items-center gap-2">
                    <FileText size={14} className="text-emerald-400 flex-shrink-0" />
                    <span className="text-white truncate text-xs">{file.name}</span>
                    <button type="button" onClick={e => { e.stopPropagation(); setFile(null) }} className="text-slate-500 hover:text-white ml-auto"><X size={12} /></button>
                  </div>
                ) : <><Upload size={16} className="mx-auto text-slate-500 mb-1" /><p className="text-slate-500">PDF, JPG, PNG, DOCX</p></>}
              </div>
              <input className="input text-xs py-1.5" required value={form.name}
                onChange={e => setForm(p => ({...p, name: e.target.value}))} placeholder="Dokumentum neve *" />
              <select className="input text-xs py-1.5" value={form.category}
                onChange={e => setForm(p => ({...p, category: e.target.value}))}>
                {Object.entries(CATEGORIES).map(([k,v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
              <input className="input text-xs py-1.5" value={form.description}
                onChange={e => setForm(p => ({...p, description: e.target.value}))} placeholder="Megjegyzés (opcionális)" />
              {uploadError && <p className="text-red-400 text-xs">{uploadError}</p>}
              <div className="flex gap-2">
                <button type="button" onClick={() => { setShowUpload(false); setFile(null) }}
                  className="flex-1 text-xs py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg transition-colors">Mégsem</button>
                <button type="submit" disabled={!file || !form.name || uploading}
                  className="flex-1 text-xs py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-lg transition-colors flex items-center justify-center gap-1">
                  {uploading ? <><Loader size={12} className="animate-spin" />Feldolgozás...</> : <><Upload size={12} />Feltöltés</>}
                </button>
              </div>
            </form>
          )}

          {/* Category filter */}
          <div className="flex flex-wrap gap-1 mt-2">
            <button onClick={() => setFilterCat('all')}
              className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${filterCat === 'all' ? 'border-emerald-500 bg-emerald-500/20 text-emerald-300' : 'border-slate-700 text-slate-500 hover:border-slate-600'}`}>
              Összes ({documents.length})
            </button>
            {Object.entries(CATEGORIES).map(([k,v]) => categoryCounts[k] ? (
              <button key={k} onClick={() => setFilterCat(k)}
                className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${filterCat === k ? v.color : 'border-slate-700 text-slate-500 hover:border-slate-600'}`}>
                {categoryCounts[k]}×
              </button>
            ) : null)}
          </div>
        </div>

        {/* Document list */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {isLoading ? (
            <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-20 bg-slate-800 rounded-lg animate-pulse" />)}</div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-8 text-slate-600">
              <BookOpen size={28} className="mx-auto mb-2 opacity-30" />
              <p className="text-xs">Nincs dokumentum</p>
            </div>
          ) : filtered.map(doc => (
            <DocItem key={doc.id} doc={doc} onDelete={(id) => {
              if (confirm('Törlöd?')) deleteMutation.mutate(id)
            }} />
          ))}
        </div>
      </div>

      {/* CENTER: Chat */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 bg-slate-900/30">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-violet-600/20 border border-violet-600/30 flex items-center justify-center">
              <Bot size={18} className="text-violet-400" />
            </div>
            <div>
              <h1 className="font-semibold text-white">Dokumentum AI Asszisztens</h1>
              <p className="text-xs text-slate-500">
                {documents.length > 0
                  ? `${documents.length} dokumentum alapján válaszol — tervrajzok, statika, gépészet`
                  : 'Tölts fel dokumentumokat a bal oldali panelben'}
              </p>
            </div>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {messages.map((msg, i) => <ChatMessage key={i} msg={msg} />)}
          {asking && (
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-violet-600/30 border border-violet-600/40 flex items-center justify-center flex-shrink-0">
                <Bot size={16} className="text-violet-400" />
              </div>
              <div className="bg-slate-800 rounded-2xl rounded-tl-sm border border-slate-700 px-4 py-3 flex items-center gap-2">
                <Loader size={14} className="animate-spin text-violet-400" />
                <span className="text-sm text-slate-400">Dokumentumok elemzése...</span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="px-6 py-4 border-t border-slate-800">
          {documents.length === 0 && (
            <p className="text-xs text-amber-500/70 mb-2 text-center">⚠️ Tölts fel dokumentumokat a bal oldali panelben hogy az AI azok alapján válaszoljon</p>
          )}
          <form onSubmit={handleSend} className="flex gap-3">
            <input
              className="input flex-1"
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder={documents.length > 0
                ? "Kérdezz a tervrajzokról, statikáról, gépészetről..."
                : "Először tölts fel dokumentumokat..."}
              disabled={asking || documents.length === 0}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend(e)}
            />
            <button type="submit" disabled={!input.trim() || asking || documents.length === 0}
              className="w-11 h-11 bg-violet-600 hover:bg-violet-500 disabled:bg-slate-700 disabled:text-slate-500 rounded-xl flex items-center justify-center transition-colors flex-shrink-0">
              <Send size={18} className="text-white" />
            </button>
          </form>
          <p className="text-xs text-slate-600 text-center mt-2">Az AI a feltöltött dokumentumok tartalma alapján válaszol</p>
        </div>
      </div>
    </div>
  )
}

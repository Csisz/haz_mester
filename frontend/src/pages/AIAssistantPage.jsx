import React, { useState, useRef, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import api from '../utils/api'
import { Bot, Send, User, Sparkles, Zap, AlertCircle, Building2 } from 'lucide-react'

const QUICK_QUESTIONS = [
  "Milyen rétegrendi sorrendben kell újjáépíteni a tetőteraszt?",
  "Mik az NGBS padlófűtés rendszer beüzemelésének lépései?",
  "Milyen vízszigetelési rendszert javasol a tetőteraszon XPS-sel?",
  "Mikor lehet a beltéri ajtókat beépíteni az NGBS rendszer után?",
  "Mennyi ideig szárad a bitumenes lemez alapozó réteg?",
  "Milyen kockázatai vannak a fordított tetőterasz kialakításnak?",
]

export default function AIAssistantPage() {
  const [messages, setMessages] = useState([
    { role: 'assistant', content: 'Szia! Az AI építési asszisztensed vagyok. Ismerem az Zugligeti út 44/A projekt terveit — az NGBS fűtés/hűtés rendszert, a tetőterasz vízszigetelési problémát, és az összes aktuális feladatot. Miben segíthetek?' }
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [projectId, setProjectId] = useState(null)
  const bottomRef = useRef()

  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: () => api.get('/projects').then(r => r.data),
    onSuccess: (data) => { if (data[0]) setProjectId(data[0].id) }
  })

  useEffect(() => {
    if (projects[0]) setProjectId(projects[0].id)
  }, [projects])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = async (text) => {
    if (!text.trim()) return
    const userMsg = { role: 'user', content: text }
    const newMessages = [...messages, userMsg]
    setMessages(newMessages)
    setInput('')
    setLoading(true)

    try {
      // Send conversation history for multi-turn memory
      const history = newMessages
        .filter(m => m.role === 'user' || m.role === 'assistant')
        .slice(-10)
      const res = await api.post('/ai/ask', { question: text, project_id: projectId, history })
      setMessages(prev => [...prev, { role: 'assistant', content: res.data.answer }])
    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', content: '⚠️ Hiba: ' + (err.response?.data?.detail || 'AI szolgáltatás nem elérhető') }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col h-full max-h-screen">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 sm:p-6 border-b border-slate-800 flex-shrink-0">
        <div className="w-10 h-10 rounded-xl bg-violet-600/20 border border-violet-600/30 flex items-center justify-center">
          <Bot size={22} className="text-violet-400" />
        </div>
        <div>
          <h1 className="font-display text-lg font-bold text-white">AI Építési Asszisztens</h1>
          <p className="text-slate-400 text-xs">Zugligeti út 44/A projekt kontextusban</p>
        </div>
        <div className="ml-auto hidden sm:flex items-center gap-1.5 text-xs text-emerald-400 bg-emerald-900/20 px-3 py-1.5 rounded-full border border-emerald-800/50">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          Online
        </div>
      </div>

      {/* Chat */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
        {/* Context info */}
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-full bg-violet-700 flex items-center justify-center flex-shrink-0">
            <Building2 size={14} className="text-white" />
          </div>
          <div className="bg-slate-800/60 rounded-2xl rounded-tl-sm p-4 max-w-2xl">
            <p className="text-xs text-violet-400 font-medium mb-2">Projektismeret</p>
            <div className="grid grid-cols-2 gap-2 text-xs text-slate-300">
              <span>📐 442 m² összterület (4 szint)</span>
              <span>🏠 2 lakrész, kétlakásos</span>
              <span>🌡️ NGBS padlófűtés/hűtés</span>
              <span>🏗️ Tetőterasz vízszigetelés probléma</span>
              <span>✅ Esztrich kész, ablakok kész</span>
              <span>🔧 Ajtók telepítés folyamatban</span>
            </div>
          </div>
        </div>

        {messages.map((msg, i) => (
          <div key={i} className={`flex items-start gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
              msg.role === 'assistant' ? 'bg-violet-700' : 'bg-emerald-700'
            }`}>
              {msg.role === 'assistant' ? <Bot size={14} className="text-white" /> : <User size={14} className="text-white" />}
            </div>
            <div className={`max-w-2xl rounded-2xl p-4 text-sm whitespace-pre-wrap leading-relaxed ${
              msg.role === 'assistant'
                ? 'bg-slate-800/60 rounded-tl-sm text-slate-200'
                : 'bg-emerald-700 rounded-tr-sm text-white'
            }`}>
              {msg.content}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-violet-700 flex items-center justify-center flex-shrink-0">
              <Bot size={14} className="text-white" />
            </div>
            <div className="bg-slate-800/60 rounded-2xl rounded-tl-sm p-4">
              <div className="flex gap-1">
                {[0,1,2].map(i => (
                  <div key={i} className="w-2 h-2 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                ))}
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Quick questions */}
      <div className="px-4 sm:px-6 pb-3 flex-shrink-0">
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
          {QUICK_QUESTIONS.map((q, i) => (
            <button key={i} onClick={() => sendMessage(q)} disabled={loading}
              className="flex-shrink-0 text-xs bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 px-3 py-1.5 rounded-full transition-colors flex items-center gap-1.5">
              <Zap size={11} className="text-amber-400" />
              {q.slice(0, 35)}...
            </button>
          ))}
        </div>
      </div>

      {/* Input */}
      <div className="p-4 sm:p-6 pt-0 flex-shrink-0">
        <form onSubmit={(e) => { e.preventDefault(); sendMessage(input) }} className="flex gap-2">
          <input
            className="input flex-1"
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Kérdezz az építési projektről..."
            disabled={loading}
          />
          <button type="submit" disabled={loading || !input.trim()} className="btn-primary flex-shrink-0 px-4">
            <Send size={16} />
          </button>
        </form>
        <p className="text-xs text-slate-600 mt-2 text-center">
          Az AI a projekt tervei alapján ad tanácsokat. Szakértői döntés előtt konzultálj a tervezővel.
        </p>
      </div>
    </div>
  )
}

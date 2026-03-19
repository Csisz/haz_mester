import { format, formatDistanceToNow } from 'date-fns'
import { hu } from 'date-fns/locale'

export const formatCurrency = (amount) => {
  if (!amount && amount !== 0) return '—'
  return new Intl.NumberFormat('hu-HU', { style: 'currency', currency: 'HUF', maximumFractionDigits: 0 }).format(amount)
}

export const formatDate = (date) => {
  if (!date) return '—'
  return format(new Date(date), 'yyyy. MM. dd.', { locale: hu })
}

export const formatRelative = (date) => {
  if (!date) return '—'
  return formatDistanceToNow(new Date(date), { addSuffix: true, locale: hu })
}

export const STATUS_LABELS = {
  pending: 'Függőben',
  in_progress: 'Folyamatban',
  review: 'Ellenőrzés',
  completed: 'Kész',
  blocked: 'Blokkolt',
}

export const PRIORITY_LABELS = {
  low: 'Alacsony',
  medium: 'Közepes',
  high: 'Magas',
  critical: 'Kritikus',
}

export const CATEGORY_LABELS = {
  waterproofing: 'Vízszigetelés',
  hvac: 'Fűtés/Hűtés',
  carpentry: 'Ácsmunka/Ajtók',
  insulation: 'Hőszigetelés',
  electrical: 'Villanyszerelés',
  plumbing: 'Vízvezeték',
  finishing: 'Befejező munkák',
  other: 'Egyéb',
}

export const PRIORITY_COLORS = {
  critical: 'text-red-400 bg-red-900/20',
  high: 'text-orange-400 bg-orange-900/20',
  medium: 'text-yellow-400 bg-yellow-900/20',
  low: 'text-slate-400 bg-slate-800',
}

export const STATUS_COLORS = {
  pending: 'text-slate-300 bg-slate-700',
  in_progress: 'text-blue-300 bg-blue-900/50',
  review: 'text-amber-300 bg-amber-900/50',
  completed: 'text-emerald-300 bg-emerald-900/50',
  blocked: 'text-red-300 bg-red-900/50',
}

export const clsx = (...classes) => classes.filter(Boolean).join(' ')

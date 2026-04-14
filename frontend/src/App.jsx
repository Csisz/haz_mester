import React, { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './stores/authStore'
import Layout from './components/layout/Layout'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import ProjectsPage from './pages/ProjectsPage'
import ProjectDetailPage from './pages/ProjectDetailPage'
import TaskDetailPage from './pages/TaskDetailPage'
import FinancePage from './pages/FinancePage'
import UsersPage from './pages/UsersPage'
import ChangePasswordPage from './pages/ChangePasswordPage'
import AIAssistantPage from './pages/AIAssistantPage'
import InvoiceScanPage from './pages/InvoiceScanPage'
import DocumentsPage from './pages/DocumentsPage'

function PrivateRoute({ children }) {
  const { isAuthenticated } = useAuthStore()
  if (!isAuthenticated) return <Navigate to="/login" replace />
  return children
}

function AuthRoute({ children }) {
  const { isAuthenticated } = useAuthStore()
  if (isAuthenticated) return <Navigate to="/" replace />
  return children
}

export default function App() {
  const { isAuthenticated, refreshUser } = useAuthStore()
  useEffect(() => { if (isAuthenticated) refreshUser() }, [])

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<AuthRoute><LoginPage /></AuthRoute>} />
        <Route path="/change-password" element={<ChangePasswordPage />} />
        <Route element={<PrivateRoute><Layout /></PrivateRoute>}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/projects" element={<ProjectsPage />} />
          <Route path="/projects/:id" element={<ProjectDetailPage />} />
          <Route path="/tasks/:id" element={<TaskDetailPage />} />
          <Route path="/finance" element={<FinancePage />} />
          <Route path="/invoice" element={<InvoiceScanPage />} />
          <Route path="/documents" element={<DocumentsPage />} />
          <Route path="/ai" element={<AIAssistantPage />} />
          <Route path="/users" element={<UsersPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

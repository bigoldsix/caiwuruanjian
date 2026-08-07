import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import ExpenseList from './pages/ExpensePages'
import ExpenseForm from './pages/ExpensePages'
import ExpenseDetail from './pages/ExpensePages'
import ApprovalList from './pages/ApprovalPages'
import DepartmentManage from './pages/AdminPages'
import UserManage from './pages/AdminPages'
import ProjectManage from './pages/AdminPages'
import CategoryManage from './pages/AdminPages'
import Statistics from './pages/Statistics'
import NotificationCenter from './pages/NotificationCenter'

function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<Layout />}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="expenses" element={<ExpenseList page="list" />} />
        <Route path="expenses/new" element={<ExpenseForm page="create" />} />
        <Route path="expenses/:id" element={<ExpenseDetail />} />
        <Route path="expenses/:id/edit" element={<ExpenseForm page="edit" />} />
        <Route path="approvals" element={<ApprovalList />} />
        <Route path="admin/departments" element={<DepartmentManage page="departments" />} />
        <Route path="admin/users" element={<UserManage page="users" />} />
        <Route path="admin/projects" element={<ProjectManage page="projects" />} />
        <Route path="admin/categories" element={<CategoryManage page="categories" />} />
        <Route path="statistics" element={<Statistics />} />
        <Route path="notifications" element={<NotificationCenter />} />
      </Route>
    </Routes>
  )
}

export default App

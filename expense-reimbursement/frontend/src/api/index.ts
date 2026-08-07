import axios from 'axios'
import { useAuthStore } from '../store/auth'

const api = axios.create({
  baseURL: '/api',
  timeout: 30000,
})

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    if (err.response?.status === 401) {
      useAuthStore.getState().logout()
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)

// ---- 认证 ----
export const authApi = {
  login: (email: string, password: string) =>
    api.post('/auth/login', { email, password }),
  refresh: (refresh_token: string) =>
    api.post('/auth/refresh', { refresh_token }),
  me: () => api.get('/auth/me'),
  changePassword: (old_password: string, new_password: string) =>
    api.post('/auth/change-password', { old_password, new_password }),
}

// ---- 部门 ----
export const departmentApi = {
  list: () => api.get('/departments'),
  create: (name: string) => api.post('/departments', { name }),
  delete: (id: number) => api.delete(`/departments/${id}`),
}

// ---- 用户 ----
export const userApi = {
  list: (page = 1, pageSize = 20) => api.get('/users', { params: { page, page_size: pageSize } }),
  create: (data: any) => api.post('/users', data),
  update: (id: number, data: any) => api.put(`/users/${id}`, data),
}

// ---- 项目 ----
export const projectApi = {
  list: (includeArchived = false) => api.get('/projects', { params: { include_archived: includeArchived } }),
  create: (data: any) => api.post('/projects', data),
  update: (id: number, data: any) => api.put(`/projects/${id}`, data),
}

// ---- 费用类别 ----
export const categoryApi = {
  list: () => api.get('/categories'),
  create: (name: string) => api.post('/categories', { name }),
  toggle: (id: number, isActive: boolean) => api.put(`/categories/${id}`, null, { params: { is_active: isActive } }),
}

// ---- 报销单 ----
export const expenseApi = {
  list: (params: any) => api.get('/expenses', { params }),
  get: (id: number) => api.get(`/expenses/${id}`),
  create: (data: any) => api.post('/expenses', data),
  update: (id: number, data: any) => api.put(`/expenses/${id}`, data),
  submit: (id: number) => api.post(`/expenses/${id}/submit`),
  delete: (id: number) => api.delete(`/expenses/${id}`),
  approve: (id: number, data: any) => api.post(`/expenses/${id}/approve`, data),
  uploadInvoice: (reportId: number, itemId: number, file: File) => {
    const form = new FormData()
    form.append('file', file)
    return api.post(`/expenses/${reportId}/items/${itemId}/upload`, form)
  },
  export: (params?: any) =>
    api.get('/expenses/export', { params, responseType: 'blob' }),
}

// ---- 审批 ----
export const approvalApi = {
  pending: () => api.get('/approvals/pending'),
}

// ---- 通知 ----
export const notificationApi = {
  list: (page = 1, unreadOnly = false) =>
    api.get('/notifications', { params: { page, page_size: 20, unread_only: unreadOnly } }),
  unreadCount: () => api.get('/notifications/unread-count'),
  markRead: (id: number) => api.put(`/notifications/${id}/read`),
  markAllRead: () => api.put('/notifications/read-all'),
}

// ---- 统计 ----
export const statisticsApi = {
  get: (params?: any) => api.get('/statistics', { params }),
}

export default api

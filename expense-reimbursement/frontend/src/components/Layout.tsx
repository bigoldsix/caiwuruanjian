import { useEffect, useState } from 'react'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { Layout as AntLayout, Menu, Button, Badge, Dropdown, Avatar, theme } from 'antd'
import {
  DashboardOutlined, FileTextOutlined, CheckCircleOutlined,
  SettingOutlined, BarChartOutlined, BellOutlined,
  LogoutOutlined, UserOutlined, MenuFoldOutlined, MenuUnfoldOutlined,
} from '@ant-design/icons'
import { useAuthStore } from '../store/auth'
import { notificationApi } from '../api'

const { Header, Sider, Content } = AntLayout

export default function Layout() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, fetchUser, logout, token } = useAuthStore()
  const [collapsed, setCollapsed] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const { token: themeToken } = theme.useToken()

  useEffect(() => {
    if (!token) {
      navigate('/login')
      return
    }
    fetchUser()
  }, [token])

  useEffect(() => {
    if (!user) return
    const fetchUnread = async () => {
      try {
        const res = await notificationApi.unreadCount()
        setUnreadCount(res.data.count)
      } catch {}
    }
    fetchUnread()
    const timer = setInterval(fetchUnread, 30000)
    return () => clearInterval(timer)
  }, [user])

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const isAdmin = user?.role === 'admin'
  const isFinance = user?.role === 'finance'
  const isManager = user?.role === 'manager'
  const isExecutive = user?.role === 'executive'
  const canManage = isAdmin || isFinance

  const menuItems = [
    { key: '/dashboard', icon: <DashboardOutlined />, label: '工作台' },
    { key: '/expenses', icon: <FileTextOutlined />, label: '我的报销' },
    ...(isManager || isFinance ? [
      { key: '/approvals', icon: <CheckCircleOutlined />, label: '待审批' },
    ] : []),
    ...(canManage ? [
      {
        key: 'admin',
        icon: <SettingOutlined />,
        label: '系统管理',
        children: [
          ...(isAdmin ? [
            { key: '/admin/departments', label: '部门管理' },
            { key: '/admin/users', label: '用户管理' },
            { key: '/admin/projects', label: '项目管理' },
          ] : []),
          ...(isFinance || isAdmin ? [
            { key: '/admin/categories', label: '费用类别' },
          ] : []),
        ],
      },
    ] : []),
    ...(isExecutive || isAdmin ? [
      { key: '/statistics', icon: <BarChartOutlined />, label: '统计报表' },
    ] : []),
  ]

  if (!user) return null

  return (
    <AntLayout style={{ minHeight: '100vh' }}>
      <Sider trigger={null} collapsible collapsed={collapsed} theme="dark">
        <div style={{ height: 64, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: collapsed ? 14 : 18, fontWeight: 'bold' }}>
          {collapsed ? '报销' : '费用报销系统'}
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[location.pathname]}
          defaultOpenKeys={['admin']}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
        />
      </Sider>
      <AntLayout>
        <Header style={{ background: themeToken.colorBgContainer, padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
          <Button
            type="text"
            icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            onClick={() => setCollapsed(!collapsed)}
          />
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <Badge count={unreadCount} size="small">
              <BellOutlined style={{ fontSize: 18, cursor: 'pointer' }} onClick={() => navigate('/notifications')} />
            </Badge>
            <Dropdown
              menu={{
                items: [
                  { key: 'profile', icon: <UserOutlined />, label: `${user.name} (${user.role === 'admin' ? '管理员' : user.role === 'manager' ? '经理' : user.role === 'finance' ? '财务' : user.role === 'executive' ? '高管' : '员工'})`, disabled: true },
                  { type: 'divider' },
                  { key: 'logout', icon: <LogoutOutlined />, label: '退出登录', danger: true },
                ],
                onClick: ({ key }) => { if (key === 'logout') handleLogout() },
              }}
            >
              <Avatar style={{ backgroundColor: '#1677ff', cursor: 'pointer' }}>
                {user.name[0]}
              </Avatar>
            </Dropdown>
          </div>
        </Header>
        <Content style={{ margin: 16, padding: 24, background: themeToken.colorBgContainer, borderRadius: 8, minHeight: 280 }}>
          <Outlet />
        </Content>
      </AntLayout>
    </AntLayout>
  )
}

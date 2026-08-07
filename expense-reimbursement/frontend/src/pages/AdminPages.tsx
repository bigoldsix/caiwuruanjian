import { useEffect, useState } from 'react'
import { Table, Button, Modal, Form, Input, Select, Switch, Space, Card, Typography, Popconfirm, message } from 'antd'
import { PlusOutlined } from '@ant-design/icons'
import { departmentApi, userApi, projectApi, categoryApi } from '../api'

const { Title } = Typography

// ---- 部门管理 ----
function DepartmentManage() {
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [form] = Form.useForm()

  const load = async () => {
    setLoading(true)
    try {
      const res = await departmentApi.list()
      setData(res.data || [])
    } catch {}
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const handleCreate = async (values: any) => {
    try {
      await departmentApi.create(values.name)
      message.success('创建成功')
      setModalOpen(false)
      form.resetFields()
      load()
    } catch (err: any) { message.error(err.response?.data?.detail || '创建失败') }
  }

  const handleDelete = async (id: number) => {
    try {
      await departmentApi.delete(id)
      message.success('删除成功')
      load()
    } catch (err: any) { message.error(err.response?.data?.detail || '删除失败') }
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <Title level={4}>部门管理</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalOpen(true)}>新建部门</Button>
      </div>
      <Table rowKey="id" dataSource={data} loading={loading} pagination={false}
        columns={[
          { title: '部门名称', dataIndex: 'name' },
          { title: '人数', dataIndex: 'user_count' },
          {
            title: '操作', width: 150,
            render: (_: any, record: any) => (
              <Popconfirm title="确定删除该部门？" onConfirm={() => handleDelete(record.id)}>
                <Button type="link" danger disabled={record.user_count > 0}>删除</Button>
              </Popconfirm>
            ),
          },
        ]}
      />
      <Modal title="新建部门" open={modalOpen} onCancel={() => setModalOpen(false)} onOk={() => form.submit()}>
        <Form form={form} onFinish={handleCreate} layout="vertical">
          <Form.Item name="name" label="部门名称" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

// ---- 用户管理 ----
function UserManage() {
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [modalOpen, setModalOpen] = useState(false)
  const [form] = Form.useForm()
  const [departments, setDepartments] = useState<any[]>([])

  const load = async () => {
    setLoading(true)
    try {
      const [uRes, dRes] = await Promise.all([userApi.list(page), departmentApi.list()])
      setData(uRes.data.items || [])
      setTotal(uRes.data.total)
      setDepartments(dRes.data || [])
    } catch {}
    setLoading(false)
  }

  useEffect(() => { load() }, [page])

  const handleCreate = async (values: any) => {
    try {
      await userApi.create(values)
      message.success('创建成功')
      setModalOpen(false)
      form.resetFields()
      load()
    } catch (err: any) { message.error(err.response?.data?.detail || '创建失败') }
  }

  const handleToggleActive = async (userId: number, currentActive: boolean) => {
    try {
      await userApi.update(userId, { is_active: !currentActive })
      message.success(currentActive ? '已禁用' : '已启用')
      load()
    } catch (err: any) { message.error(err.response?.data?.detail || '操作失败') }
  }

  const roleMap: Record<string, string> = {
    employee: '员工', manager: '经理', finance: '财务', admin: '管理员', executive: '高管',
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <Title level={4}>用户管理</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalOpen(true)}>新建用户</Button>
      </div>
      <Table rowKey="id" dataSource={data} loading={loading}
        columns={[
          { title: '姓名', dataIndex: 'name', width: 100 },
          { title: '邮箱', dataIndex: 'email', width: 200 },
          { title: '部门', dataIndex: 'department_name', width: 120 },
          { title: '角色', dataIndex: 'role', width: 80, render: (v: string) => roleMap[v] || v },
          { title: '状态', dataIndex: 'is_active', width: 80, render: (v: boolean) => v ? '启用' : '禁用' },
          {
            title: '操作', width: 100,
            render: (_: any, record: any) => (
              <Button type="link" onClick={() => handleToggleActive(record.id, record.is_active)}>
                {record.is_active ? '禁用' : '启用'}
              </Button>
            ),
          },
        ]}
        pagination={{ current: page, total, pageSize: 20, onChange: setPage, showSizeChanger: false }} />
      <Modal title="新建用户" open={modalOpen} onCancel={() => setModalOpen(false)} onOk={() => form.submit()}>
        <Form form={form} onFinish={handleCreate} layout="vertical">
          <Form.Item name="name" label="姓名" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="email" label="邮箱" rules={[{ required: true, type: 'email' }]}><Input /></Form.Item>
          <Form.Item name="password" label="初始密码" rules={[{ required: true }]}><Input.Password /></Form.Item>
          <Form.Item name="department_id" label="部门">
            <Select allowClear options={departments.map(d => ({ label: d.name, value: d.id }))} />
          </Form.Item>
          <Form.Item name="role" label="角色" initialValue="employee">
            <Select options={[
              { label: '员工', value: 'employee' }, { label: '经理', value: 'manager' },
              { label: '财务', value: 'finance' }, { label: '管理员', value: 'admin' },
              { label: '高管', value: 'executive' },
            ]} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

// ---- 项目管理 ----
function ProjectManage() {
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form] = Form.useForm()

  const load = async () => {
    setLoading(true)
    try {
      const res = await projectApi.list(true)
      setData(res.data || [])
    } catch {}
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const handleSave = async (values: any) => {
    try {
      if (editingId) {
        await projectApi.update(editingId, values)
        message.success('更新成功')
      } else {
        await projectApi.create(values)
        message.success('创建成功')
      }
      setModalOpen(false)
      setEditingId(null)
      form.resetFields()
      load()
    } catch (err: any) { message.error(err.response?.data?.detail || '操作失败') }
  }

  const handleArchive = async (id: number, currentStatus: string) => {
    const newStatus = currentStatus === 'archived' ? 'active' : 'archived'
    try {
      await projectApi.update(id, { status: newStatus })
      message.success(newStatus === 'archived' ? '已归档' : '已恢复')
      load()
    } catch (err: any) { message.error(err.response?.data?.detail || '操作失败') }
  }

  const openEdit = (record: any) => {
    setEditingId(record.id)
    form.setFieldsValue(record)
    setModalOpen(true)
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <Title level={4}>项目管理</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditingId(null); form.resetFields(); setModalOpen(true) }}>新建项目</Button>
      </div>
      <Table rowKey="id" dataSource={data} loading={loading} pagination={false}
        columns={[
          { title: '项目名称', dataIndex: 'name', width: 250 },
          { title: '客户名称', dataIndex: 'client_name', width: 200 },
          { title: '项目编号', dataIndex: 'project_code', width: 150 },
          {
            title: '状态', dataIndex: 'status', width: 100,
            render: (v: string) => v === 'active' ? '进行中' : '已归档',
          },
          {
            title: '操作', width: 200,
            render: (_: any, record: any) => (
              <Space>
                <Button type="link" onClick={() => openEdit(record)}>编辑</Button>
                <Button type="link" onClick={() => handleArchive(record.id, record.status)}>
                  {record.status === 'active' ? '归档' : '恢复'}
                </Button>
              </Space>
            ),
          },
        ]}
      />
      <Modal title={editingId ? '编辑项目' : '新建项目'} open={modalOpen} onCancel={() => setModalOpen(false)} onOk={() => form.submit()}>
        <Form form={form} onFinish={handleSave} layout="vertical">
          <Form.Item name="name" label="项目名称" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="client_name" label="客户名称"><Input /></Form.Item>
          <Form.Item name="project_code" label="项目编号"><Input /></Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

// ---- 费用类别管理 ----
function CategoryManage() {
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [form] = Form.useForm()

  const load = async () => {
    setLoading(true)
    try {
      const res = await categoryApi.list()
      setData(res.data || [])
    } catch {}
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const handleCreate = async (values: any) => {
    try {
      await categoryApi.create(values.name)
      message.success('创建成功')
      setModalOpen(false)
      form.resetFields()
      load()
    } catch (err: any) { message.error(err.response?.data?.detail || '创建失败') }
  }

  const handleToggle = async (id: number, currentActive: boolean) => {
    try {
      await categoryApi.toggle(id, !currentActive)
      message.success(currentActive ? '已禁用' : '已启用')
      load()
    } catch (err: any) { message.error(err.response?.data?.detail || '操作失败') }
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <Title level={4}>费用类别管理</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalOpen(true)}>新建类别</Button>
      </div>
      <Table rowKey="id" dataSource={data} loading={loading} pagination={false}
        columns={[
          { title: '类别名称', dataIndex: 'name' },
          { title: '状态', dataIndex: 'is_active', width: 100, render: (v: boolean) => v ? '启用' : '禁用' },
          {
            title: '操作', width: 100,
            render: (_: any, record: any) => (
              <Button type="link" onClick={() => handleToggle(record.id, record.is_active)}>
                {record.is_active ? '禁用' : '启用'}
              </Button>
            ),
          },
        ]}
      />
      <Modal title="新建类别" open={modalOpen} onCancel={() => setModalOpen(false)} onOk={() => form.submit()}>
        <Form form={form} onFinish={handleCreate} layout="vertical">
          <Form.Item name="name" label="类别名称" rules={[{ required: true }]}><Input /></Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

// ---- 统计报表 ----
function StatisticsPage() {
  const [stats, setStats] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => { load() }, [])

  const load = async () => {
    setLoading(true)
    try {
      const res = await (await import('../api')).statisticsApi.get()
      setStats(res.data)
    } catch {}
    setLoading(false)
  }

  return (
    <div>
      <Title level={4}>统计报表</Title>
      <Card>
        {stats && (
          <>
            <p><strong>已打款总额：</strong>¥{stats.total_paid?.toFixed(2)}</p>
            <Table rowKey="category_id" dataSource={stats.by_category} loading={loading} pagination={false} size="small"
              columns={[
                { title: '费用类别', dataIndex: 'category_name' },
                { title: '报销笔数', dataIndex: 'count' },
                { title: '合计金额', dataIndex: 'total_amount', render: (v: number) => `¥${v?.toFixed(2)}` },
              ]}
            />
          </>
        )}
      </Card>
    </div>
  )
}

// ---- 统一导出 ----
export default function AdminPages({ page }: { page: string }) {
  if (page === 'departments') return <DepartmentManage />
  if (page === 'users') return <UserManage />
  if (page === 'projects') return <ProjectManage />
  if (page === 'categories') return <CategoryManage />
  return null
}

export { StatisticsPage as Statistics }

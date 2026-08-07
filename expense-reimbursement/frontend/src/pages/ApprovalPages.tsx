import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Table, Tag, Button, Space, Card, Typography } from 'antd'
import dayjs from 'dayjs'
import { approvalApi } from '../api'
import { useAuthStore } from '../store/auth'

const { Title } = Typography

export default function ApprovalList() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => { load() }, [])

  const load = async () => {
    setLoading(true)
    try {
      const res = await approvalApi.pending()
      setData(res.data || [])
    } catch {}
    setLoading(false)
  }

  const statusMap: Record<string, { color: string; text: string }> = {
    submitted: { color: 'processing', text: '待经理审批' },
    manager_approved: { color: 'blue', text: '待财务审核' },
  }

  const columns = [
    { title: '报销单号', dataIndex: 'report_no', width: 150 },
    { title: '报销人', dataIndex: 'submitter_name', width: 100 },
    { title: '部门', dataIndex: 'department_name', width: 120 },
    { title: '项目', dataIndex: 'project_name', width: 180, ellipsis: true },
    { title: '类别', dataIndex: 'category_name', width: 100 },
    { title: '金额', dataIndex: 'total_amount', width: 110, render: (v: number) => <strong>¥{v?.toFixed(2)}</strong> },
    {
      title: '状态', dataIndex: 'status', width: 120,
      render: (v: string) => <Tag color={statusMap[v]?.color}>{statusMap[v]?.text || v}</Tag>,
    },
    { title: '提交时间', dataIndex: 'created_at', width: 170, render: (v: string) => v ? dayjs(v).format('YYYY-MM-DD HH:mm') : '-' },
    {
      title: '操作', key: 'action', width: 100,
      render: (_: any, record: any) => (
        <Button type="link" onClick={() => navigate(`/expenses/${record.id}`)}>处理</Button>
      ),
    },
  ]

  return (
    <div>
      <Title level={4} style={{ marginBottom: 16 }}>
        待审批报销
        <span style={{ fontSize: 14, color: '#999', marginLeft: 12, fontWeight: 'normal' }}>
          共 {data.length} 笔
        </span>
      </Title>
      <Table rowKey="id" columns={columns} dataSource={data} loading={loading} pagination={false}
        locale={{ emptyText: user?.role === 'manager' ? '本部门暂无待审批报销' : '暂无待审核报销' }} />
    </div>
  )
}

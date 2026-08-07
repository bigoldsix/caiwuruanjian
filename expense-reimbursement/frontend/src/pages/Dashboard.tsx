import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Row, Col, Card, Statistic, Typography, List, Tag, Button } from 'antd'
import {
  FileTextOutlined, CheckCircleOutlined, DollarOutlined, ClockCircleOutlined,
} from '@ant-design/icons'
import { expenseApi, notificationApi, approvalApi } from '../api'
import { useAuthStore } from '../store/auth'

const { Title } = Typography

export default function Dashboard() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const [stats, setStats] = useState({ draft: 0, submitted: 0, paid: 0 })
  const [pendingCount, setPendingCount] = useState(0)
  const [recentList, setRecentList] = useState<any[]>([])

  useEffect(() => {
    if (!user) return
    loadData()
  }, [user])

  const loadData = async () => {
    try {
      const [draftRes, submittedRes, paidRes, pendingRes] = await Promise.all([
        expenseApi.list({ page: 1, page_size: 1, status: 'draft' }).catch(() => ({ data: { total: 0 } })),
        expenseApi.list({ page: 1, page_size: 1, status: 'submitted' }).catch(() => ({ data: { total: 0 } })),
        expenseApi.list({ page: 1, page_size: 1, status: 'paid' }).catch(() => ({ data: { total: 0 } })),
        user.role === 'manager' || user.role === 'finance'
          ? approvalApi.pending().catch(() => ({ data: [] }))
          : Promise.resolve({ data: [] }),
      ])
      setStats({
        draft: draftRes.data.total,
        submitted: submittedRes.data.total,
        paid: paidRes.data.total,
      })
      setPendingCount(Array.isArray(pendingRes.data) ? pendingRes.data.length : 0)

      const recentRes = await expenseApi.list({ page: 1, page_size: 5 })
      setRecentList(recentRes.data.items || [])
    } catch {}
  }

  const statusMap: Record<string, { color: string; text: string }> = {
    draft: { color: 'default', text: '草稿' },
    submitted: { color: 'processing', text: '已提交' },
    manager_approved: { color: 'blue', text: '经理已批' },
    finance_approved: { color: 'cyan', text: '财务已审' },
    paid: { color: 'success', text: '已打款' },
    rejected: { color: 'error', text: '已驳回' },
    returned: { color: 'warning', text: '退回修改' },
  }

  return (
    <div>
      <Title level={4} style={{ marginBottom: 24 }}>工作台</Title>

      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card hoverable onClick={() => navigate('/expenses')}>
            <Statistic title="待处理" value={stats.draft} prefix={<FileTextOutlined />} suffix="笔" />
          </Card>
        </Col>
        <Col span={6}>
          <Card hoverable onClick={() => navigate('/approvals')} style={pendingCount > 0 ? { borderColor: '#1677ff' } : {}}>
            <Statistic title="待审批" value={pendingCount} prefix={<ClockCircleOutlined />} suffix="笔" valueStyle={pendingCount > 0 ? { color: '#1677ff' } : {}} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="已打款" value={stats.paid} prefix={<CheckCircleOutlined />} suffix="笔" />
          </Card>
        </Col>
        <Col span={6}>
          <Card hoverable onClick={() => navigate('/expenses/new')}>
            <Statistic title="新建报销" value="+" prefix={<DollarOutlined />} valueStyle={{ color: '#52c41a' }} />
          </Card>
        </Col>
      </Row>

      <Card title="最近报销">
        <List
          dataSource={recentList}
          renderItem={(item: any) => (
            <List.Item
              extra={
                <Tag color={statusMap[item.status]?.color}>{statusMap[item.status]?.text || item.status}</Tag>
              }
              style={{ cursor: 'pointer' }}
              onClick={() => navigate(`/expenses/${item.id}`)}
            >
              <List.Item.Meta
                title={`${item.report_no} · ${item.submitter_name}`}
                description={`${item.project_name} · ${item.category_name} · ¥${item.total_amount?.toFixed(2)}`}
              />
            </List.Item>
          )}
          locale={{ emptyText: '暂无报销记录' }}
        />
        <div style={{ textAlign: 'center', marginTop: 12 }}>
          <Button type="link" onClick={() => navigate('/expenses')}>查看全部</Button>
        </div>
      </Card>
    </div>
  )
}

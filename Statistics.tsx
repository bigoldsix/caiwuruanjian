import { useEffect, useState } from 'react'
import { Card, Row, Col, Statistic, Table, Typography, Empty } from 'antd'
import { DollarOutlined, PieChartOutlined } from '@ant-design/icons'
import { statisticsApi } from '../api'

const { Title } = Typography

export default function Statistics() {
  const [data, setData] = useState<{ total_paid: number; by_category: any[] } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      const res = await statisticsApi.get()
      setData(res.data)
    } catch {
      setData(null)
    } finally {
      setLoading(false)
    }
  }

  const columns = [
    { title: '费用类别', dataIndex: 'category_name', key: 'category_name' },
    {
      title: '报销笔数',
      dataIndex: 'count',
      key: 'count',
      render: (v: number) => `${v} 笔`,
    },
    {
      title: '合计金额',
      dataIndex: 'total_amount',
      key: 'total_amount',
      render: (v: number) => `¥${v.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}`,
    },
  ]

  if (!data && !loading) {
    return (
      <div style={{ textAlign: 'center', paddingTop: 80 }}>
        <Empty description="暂无统计数据（仅管理员可查看）" />
      </div>
    )
  }

  return (
    <div>
      <Title level={4} style={{ marginBottom: 24 }}>
        <PieChartOutlined style={{ marginRight: 8 }} />
        报销统计
      </Title>

      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={8}>
          <Card loading={loading}>
            <Statistic
              title="累计已打款金额"
              value={data?.total_paid || 0}
              precision={2}
              prefix={<DollarOutlined />}
              suffix="元"
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card loading={loading}>
            <Statistic
              title="涉及类别数"
              value={data?.by_category?.length || 0}
              suffix="个"
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card loading={loading}>
            <Statistic
              title="总报销笔数"
              value={
                data?.by_category?.reduce((sum: number, c: any) => sum + c.count, 0) || 0
              }
              suffix="笔"
            />
          </Card>
        </Col>
      </Row>

      <Card title="按类别统计" loading={loading}>
        <Table
          dataSource={data?.by_category || []}
          columns={columns}
          rowKey="category_name"
          pagination={false}
          locale={{ emptyText: '暂无数据' }}
          summary={(pageData) => {
            const total = pageData.reduce((sum, row) => sum + row.total_amount, 0)
            return (
              <Table.Summary.Row>
                <Table.Summary.Cell index={0}>
                  <strong>合计</strong>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={1}>
                  <strong>{pageData.reduce((sum, row) => sum + row.count, 0)} 笔</strong>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={2}>
                  <strong>¥{total.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}</strong>
                </Table.Summary.Cell>
              </Table.Summary.Row>
            )
          }}
        />
      </Card>
    </div>
  )
}

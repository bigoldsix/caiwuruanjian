import { useEffect, useState } from 'react'
import { List, Button, Tag, Typography, message, Space, Checkbox } from 'antd'
import dayjs from 'dayjs'
import { notificationApi } from '../api'

const { Title } = Typography

export default function NotificationCenter() {
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [unreadOnly, setUnreadOnly] = useState(false)

  useEffect(() => { load() }, [page, unreadOnly])

  const load = async () => {
    setLoading(true)
    try {
      const res = await notificationApi.list(page, unreadOnly)
      setData(res.data.items || [])
      setTotal(res.data.total)
    } catch {}
    setLoading(false)
  }

  const handleMarkRead = async (id: number) => {
    try {
      await notificationApi.markRead(id)
      load()
    } catch {}
  }

  const handleMarkAllRead = async () => {
    try {
      await notificationApi.markAllRead()
      message.success('全部已读')
      load()
    } catch {}
  }

  return (
    <div style={{ maxWidth: 700 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>消息中心</Title>
        <Space>
          <Checkbox checked={unreadOnly} onChange={e => setUnreadOnly(e.target.checked)}>仅未读</Checkbox>
          <Button size="small" onClick={handleMarkAllRead}>全部已读</Button>
        </Space>
      </div>
      <List
        dataSource={data}
        loading={loading}
        pagination={{ current: page, total, pageSize: 20, onChange: setPage, showSizeChanger: false }}
        renderItem={(item: any) => (
          <List.Item
            style={!item.is_read ? { background: '#e6f4ff', padding: '12px 16px', borderRadius: 8 } : { padding: '12px 16px' }}
            extra={
              !item.is_read && <Button type="link" size="small" onClick={() => handleMarkRead(item.id)}>标为已读</Button>
            }
          >
            <List.Item.Meta
              title={
                <span>
                  {!item.is_read && <Tag color="blue" style={{ marginRight: 8 }}>未读</Tag>}
                  {item.content}
                </span>
              }
              description={dayjs(item.created_at).format('YYYY-MM-DD HH:mm')}
            />
          </List.Item>
        )}
        locale={{ emptyText: '暂无消息' }}
      />
    </div>
  )
}

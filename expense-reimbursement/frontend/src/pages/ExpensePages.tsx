import { useEffect, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  Table, Button, Tag, Space, Select, DatePicker, Input, Modal, Form,
  InputNumber, Upload, message, Descriptions, Timeline, Card, Row, Col, Popconfirm,
} from 'antd'
import {
  PlusOutlined, SearchOutlined, DeleteOutlined, EyeOutlined, EditOutlined,
  SendOutlined, UploadOutlined, DownloadOutlined, PrinterOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import { expenseApi, projectApi, categoryApi } from '../api'
import { useAuthStore } from '../store/auth'

// ---- 报销列表 ----
export function ExpenseListPage() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [status, setStatus] = useState<string | undefined>()

  const load = async () => {
    setLoading(true)
    try {
      const res = await expenseApi.list({ page, page_size: 20, status })
      setData(res.data.items || [])
      setTotal(res.data.total)
    } catch {}
    setLoading(false)
  }

  useEffect(() => { load() }, [page, status])

  const handleExport = async () => {
    try {
      const res = await expenseApi.export({ status })
      const url = URL.createObjectURL(res.data as Blob)
      const a = document.createElement('a')
      a.href = url
      a.download = '报销单导出.xlsx'
      a.click()
      message.success('导出成功')
    } catch { message.error('导出失败') }
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

  const columns = [
    { title: '报销单号', dataIndex: 'report_no', width: 150 },
    { title: '报销人', dataIndex: 'submitter_name', width: 100 },
    { title: '部门', dataIndex: 'department_name', width: 120 },
    { title: '项目', dataIndex: 'project_name', width: 180, ellipsis: true },
    { title: '类别', dataIndex: 'category_name', width: 100 },
    { title: '付款对象', dataIndex: 'payment_type', width: 90, render: (v: string) => v === 'company' ? '对公' : '对私' },
    { title: '金额', dataIndex: 'total_amount', width: 110, render: (v: number) => `¥${v?.toFixed(2)}` },
    {
      title: '状态', dataIndex: 'status', width: 110,
      render: (v: string) => <Tag color={statusMap[v]?.color}>{statusMap[v]?.text || v}</Tag>,
    },
    { title: '提交时间', dataIndex: 'created_at', width: 170, render: (v: string) => v ? dayjs(v).format('YYYY-MM-DD HH:mm') : '-' },
    {
      title: '操作', key: 'action', width: 160, fixed: 'right' as const,
      render: (_: any, record: any) => (
        <Space>
          <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => navigate(`/expenses/${record.id}`)}>查看</Button>
          {(record.status === 'draft' || record.status === 'returned') && (
            <Button type="link" size="small" icon={<EditOutlined />} onClick={() => navigate(`/expenses/${record.id}/edit`)}>编辑</Button>
          )}
        </Space>
      ),
    },
  ]

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <Space>
          <Select placeholder="状态筛选" allowClear style={{ width: 140 }} value={status} onChange={setStatus}
            options={Object.entries(statusMap).map(([k, v]) => ({ label: v.text, value: k }))} />
          <Button icon={<DownloadOutlined />} onClick={handleExport}>导出Excel</Button>
        </Space>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/expenses/new')}>新建报销</Button>
      </div>
      <Table rowKey="id" columns={columns} dataSource={data} loading={loading} scroll={{ x: 1300 }}
        pagination={{ current: page, total, pageSize: 20, onChange: setPage, showSizeChanger: false, showTotal: (t) => `共 ${t} 条` }} />
    </div>
  )
}

// ---- 报销创建/编辑 ----
export function ExpenseFormPage({ page }: { page: 'create' | 'edit' }) {
  const navigate = useNavigate()
  const { id } = useParams()
  const { user } = useAuthStore()
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const [projects, setProjects] = useState<any[]>([])
  const [categories, setCategories] = useState<any[]>([])

  useEffect(() => {
    loadOptions()
    if (page === 'edit' && id) loadReport()
  }, [id])

  const loadOptions = async () => {
    const [pRes, cRes] = await Promise.all([projectApi.list(), categoryApi.list()])
    setProjects(pRes.data.filter((p: any) => p.status === 'active'))
    setCategories(cRes.data.filter((c: any) => c.is_active))
  }

  const loadReport = async () => {
    try {
      const res = await expenseApi.get(Number(id))
      const r = res.data
      form.setFieldsValue({
        project_id: r.project_id,
        category_id: r.category_id,
        payment_type: r.payment_type,
        payee_name: r.payee_name,
        payee_account: r.payee_account,
        payee_bank: r.payee_bank,
        remark: r.remark,
        items: r.items.map((item: any) => ({
          expense_date: dayjs(item.expense_date),
          description: item.description,
          amount: item.amount,
        })),
      })
    } catch { message.error('加载报销单失败') }
  }

  const onFinish = async (values: any) => {
    setLoading(true)
    const payload = {
      ...values,
      items: values.items.map((item: any) => ({
        expense_date: item.expense_date.format('YYYY-MM-DD'),
        description: item.description,
        amount: item.amount,
      })),
    }
    try {
      if (page === 'edit' && id) {
        await expenseApi.update(Number(id), payload)
        message.success('修改成功')
        navigate(`/expenses/${id}`)
      } else {
        const res = await expenseApi.create(payload)
        message.success('创建成功')
        navigate(`/expenses/${res.data.id}`)
      }
    } catch (err: any) {
      message.error(err.response?.data?.detail || '操作失败')
    }
    setLoading(false)
  }

  return (
    <div style={{ maxWidth: 900 }}>
      <Card title={page === 'edit' ? '编辑报销单' : '新建报销单'}>
        <Form form={form} layout="vertical" onFinish={onFinish}
          initialValues={{ payment_type: 'personal', items: [{}] }}>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="所属项目" name="project_id" rules={[{ required: true, message: '请选择项目' }]}>
                <Select placeholder="选择项目" options={projects.map(p => ({ label: p.name, value: p.id }))} showSearch optionFilterProp="label" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="费用类别" name="category_id" rules={[{ required: true, message: '请选择类别' }]}>
                <Select placeholder="选择类别" options={categories.map(c => ({ label: c.name, value: c.id }))} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item label="付款对象" name="payment_type">
            <Select options={[{ label: '对公', value: 'company' }, { label: '对私', value: 'personal' }]} />
          </Form.Item>
          <Form.Item noStyle shouldUpdate={(prev, cur) => prev.payment_type !== cur.payment_type}>
            {({ getFieldValue }) =>
              getFieldValue('payment_type') === 'personal' ? (
                <Row gutter={16}>
                  <Col span={8}>
                    <Form.Item label="收款户名" name="payee_name" rules={[{ required: true, message: '请输入' }]}>
                      <Input placeholder="户名" />
                    </Form.Item>
                  </Col>
                  <Col span={8}>
                    <Form.Item label="收款账号" name="payee_account" rules={[{ required: true, message: '请输入' }]}>
                      <Input placeholder="银行账号" />
                    </Form.Item>
                  </Col>
                  <Col span={8}>
                    <Form.Item label="开户行" name="payee_bank" rules={[{ required: true, message: '请输入' }]}>
                      <Input placeholder="开户行" />
                    </Form.Item>
                  </Col>
                </Row>
              ) : null
            }
          </Form.Item>

          <Card title="费用明细" size="small" style={{ marginBottom: 16 }}>
            <Form.List name="items">
              {(fields, { add, remove }) => (
                <>
                  {fields.map(({ key, name, ...rest }) => (
                    <Row key={key} gutter={8} align="middle" style={{ marginBottom: 8 }}>
                      <Col span={6}>
                        <Form.Item {...rest} name={[name, 'expense_date']} rules={[{ required: true }]} style={{ marginBottom: 0 }}>
                          <DatePicker placeholder="日期" style={{ width: '100%' }} />
                        </Form.Item>
                      </Col>
                      <Col span={10}>
                        <Form.Item {...rest} name={[name, 'description']} rules={[{ required: true, message: '必填' }]} style={{ marginBottom: 0 }}>
                          <Input placeholder="事项说明" />
                        </Form.Item>
                      </Col>
                      <Col span={5}>
                        <Form.Item {...rest} name={[name, 'amount']} rules={[{ required: true, message: '必填' }]} style={{ marginBottom: 0 }}>
                          <InputNumber placeholder="金额" style={{ width: '100%' }} min={0} precision={2} prefix="¥" />
                        </Form.Item>
                      </Col>
                      <Col span={3}>
                        {fields.length > 1 && <Button danger onClick={() => remove(name)} icon={<DeleteOutlined />} size="small" />}
                      </Col>
                    </Row>
                  ))}
                  <Button type="dashed" onClick={() => add({ expense_date: dayjs() })} block icon={<PlusOutlined />}>
                    添加费用明细
                  </Button>
                </>
              )}
            </Form.List>
          </Card>

          <Form.Item label="备注" name="remark">
            <Input.TextArea rows={3} placeholder="选填" />
          </Form.Item>

          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit" loading={loading}>
                {page === 'edit' ? '保存修改' : '保存草稿'}
              </Button>
              <Button onClick={() => navigate(-1)}>取消</Button>
            </Space>
          </Form.Item>
        </Form>
      </Card>
    </div>
  )
}

// ---- 报销详情 ----
export function ExpenseDetailPage() {
  const navigate = useNavigate()
  const { id } = useParams()
  const { user } = useAuthStore()
  const [report, setReport] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [approveModal, setApproveModal] = useState(false)
  const [approveAction, setApproveAction] = useState('')
  const [approveComment, setApproveComment] = useState('')

  const load = async () => {
    setLoading(true)
    try {
      const res = await expenseApi.get(Number(id))
      setReport(res.data)
    } catch {}
    setLoading(false)
  }

  useEffect(() => { load() }, [id])

  const handleSubmit = async () => {
    try {
      await expenseApi.submit(Number(id))
      message.success('提交成功')
      load()
    } catch (err: any) {
      message.error(err.response?.data?.detail || '提交失败')
    }
  }

  const handleApprove = async () => {
    try {
      await expenseApi.approve(Number(id), { action: approveAction, comment: approveComment })
      message.success(approveAction === 'approve' ? '审批通过' : approveAction === 'reject' ? '已驳回' : '已退回')
      setApproveModal(false)
      load()
    } catch (err: any) {
      message.error(err.response?.data?.detail || '操作失败')
    }
  }

  const handleUpload = async (itemId: number, file: File) => {
    try {
      await expenseApi.uploadInvoice(Number(id), itemId, file)
      message.success('上传成功')
      load()
    } catch (err: any) {
      message.error(err.response?.data?.detail || '上传失败')
    }
    return false
  }

  const statusMap: Record<string, { color: string; text: string }> = {
    draft: { color: 'default', text: '草稿' }, submitted: { color: 'processing', text: '已提交' },
    manager_approved: { color: 'blue', text: '经理已批' }, finance_approved: { color: 'cyan', text: '财务已审' },
    paid: { color: 'success', text: '已打款' }, rejected: { color: 'error', text: '已驳回' },
    returned: { color: 'warning', text: '退回修改' },
  }

  const canEdit = report && (report.status === 'draft' || report.status === 'returned') && report.submitter_name === user?.name
  const canSubmit = report && (report.status === 'draft' || report.status === 'returned')
  const canApprove = report && (
    (user?.role === 'manager' && report.status === 'submitted') ||
    (user?.role === 'finance' && report.status === 'manager_approved')
  )

  if (!report) return null

  return (
    <div style={{ maxWidth: 1000 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <Space>
          <Button onClick={() => navigate('/expenses')}>返回列表</Button>
          {canEdit && <Button onClick={() => navigate(`/expenses/${id}/edit`)}>编辑</Button>}
          {canSubmit && <Button type="primary" icon={<SendOutlined />} onClick={handleSubmit}>提交审批</Button>}
        </Space>
        {canApprove && (
          <Space>
            <Button type="primary" onClick={() => { setApproveAction('approve'); setApproveModal(true) }}>通过</Button>
            <Button onClick={() => { setApproveAction('return'); setApproveModal(true) }}>退回修改</Button>
            <Button danger onClick={() => { setApproveAction('reject'); setApproveModal(true) }}>驳回</Button>
          </Space>
        )}
      </div>

      <Card>
        <Descriptions title={`报销单 ${report.report_no}`} bordered size="small" column={2}
          extra={<Tag color={statusMap[report.status]?.color}>{statusMap[report.status]?.text}</Tag>}>
          <Descriptions.Item label="报销人">{report.submitter_name}</Descriptions.Item>
          <Descriptions.Item label="部门">{report.department_name}</Descriptions.Item>
          <Descriptions.Item label="项目">{report.project_name}</Descriptions.Item>
          <Descriptions.Item label="费用类别">{report.category_name}</Descriptions.Item>
          <Descriptions.Item label="付款对象">{report.payment_type === 'company' ? '对公' : '对私'}</Descriptions.Item>
          <Descriptions.Item label="合计金额"><strong>¥{report.total_amount?.toFixed(2)}</strong></Descriptions.Item>
          {report.payment_type === 'personal' && (
            <>
              <Descriptions.Item label="收款户名">{report.payee_name}</Descriptions.Item>
              <Descriptions.Item label="收款账号">{report.payee_account}</Descriptions.Item>
              <Descriptions.Item label="开户行">{report.payee_bank}</Descriptions.Item>
            </>
          )}
          {report.remark && <Descriptions.Item label="备注" span={2}>{report.remark}</Descriptions.Item>}
        </Descriptions>
      </Card>

      <Card title="费用明细" style={{ marginTop: 16 }}>
        <Table rowKey="id" dataSource={report.items} pagination={false} size="small"
          columns={[
            { title: '日期', dataIndex: 'expense_date', width: 120 },
            { title: '事项说明', dataIndex: 'description' },
            { title: '金额', dataIndex: 'amount', width: 120, render: (v: number) => `¥${v?.toFixed(2)}` },
            {
              title: '发票', dataIndex: 'invoices', width: 200,
              render: (invoices: any[], record: any) => (
                <Space>
                  {invoices?.map((inv: any) => (
                    <a key={inv.id} href={inv.file_path} target="_blank">
                      <img src={inv.file_path} alt="发票" style={{ maxHeight: 40, maxWidth: 60, border: '1px solid #eee', borderRadius: 4 }} />
                    </a>
                  ))}
                  {canEdit && (
                    <Upload accept=".jpg,.jpeg,.png,.pdf" showUploadList={false} beforeUpload={(file) => { handleUpload(record.id, file); return false }}>
                      <Button size="small" icon={<UploadOutlined />}>上传</Button>
                    </Upload>
                  )}
                </Space>
              ),
            },
            {
              title: 'OCR识别', width: 200,
              render: (_: any, record: any) => {
                const inv = record.invoices?.[0]
                return inv?.ocr_invoice_no ? (
                  <span>发票号: {inv.ocr_invoice_no}<br />金额: ¥{inv.ocr_amount}</span>
                ) : '-'
              },
            },
          ]}
        />
      </Card>

      {report.approval_records?.length > 0 && (
        <Card title="审批记录" style={{ marginTop: 16 }}>
          <Timeline
            items={report.approval_records.map((r: any) => ({
              color: r.action === 'approve' ? 'green' : r.action === 'reject' ? 'red' : 'orange',
              children: (
                <div>
                  <strong>{r.approver_name}</strong> ({r.approver_role === 'manager' ? '经理' : '财务'})
                  {' '}{r.action === 'approve' ? '通过' : r.action === 'reject' ? '驳回' : '退回修改'}
                  {r.comment && <div style={{ color: '#666' }}>{r.comment}</div>}
                  <div style={{ fontSize: 12, color: '#999' }}>{dayjs(r.created_at).format('YYYY-MM-DD HH:mm')}</div>
                </div>
              ),
            }))}
          />
        </Card>
      )}

      <Modal title="审批意见" open={approveModal} onOk={handleApprove} onCancel={() => setApproveModal(false)}>
        <Input.TextArea rows={3} placeholder="请输入审批意见（驳回时必填）" value={approveComment} onChange={e => setApproveComment(e.target.value)} />
      </Modal>
    </div>
  )
}

// ---- 统一导出 ----
export default function ExpensePages({ page }: { page: string }) {
  if (page === 'list') return <ExpenseListPage />
  if (page === 'create' || page === 'edit') return <ExpenseFormPage page={page} />
  return null
}

export { ExpenseDetailPage as ExpenseDetail }

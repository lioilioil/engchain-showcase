// 全站状态文案/配色统一映射
// key: 状态码；label: 中文文案；type: el-tag 类型
export const STATUS_MAP = {
  pending: { label: '待审核', type: 'warning' },
  open: { label: '待处理', type: 'warning' },
  reviewing: { label: '审核中', type: 'warning' },
  processing: { label: '处理中', type: 'primary' },
  approved: { label: '已通过', type: 'success' },
  rejected: { label: '已驳回', type: 'danger' },
  done: { label: '已完成', type: 'success' },
  resolved: { label: '已处理', type: 'success' },
  on: { label: '已上架', type: 'success' },
  off: { label: '已下架', type: 'info' },
  rejected_off: { label: '已驳回', type: 'danger' },
  settled: { label: '已结算', type: 'success' },
  paid: { label: '已发放', type: 'success' },
  cancelled: { label: '已取消', type: 'info' },
  serving: { label: '服务中', type: 'primary' },
  await_accept: { label: '待验收', type: 'warning' },
  high: { label: '高危', type: 'danger' },
  medium: { label: '中', type: 'warning' },
  low: { label: '低', type: 'info' }
}

export function statusOf(key) {
  return STATUS_MAP[key] || { label: key || '-', type: 'info' }
}

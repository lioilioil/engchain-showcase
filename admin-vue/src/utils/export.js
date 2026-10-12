// 统一导出工具：toCsv 真实下载
export function toCsv(rows, filename, columns) {
  const cols = columns || Object.keys(rows[0] || {})
  const head = cols.map(c => c.label || c)
  const body = rows.map(r => cols.map(c => {
    const v = typeof c === 'object' ? r[c.prop] : r[c]
    return `"${String(v ?? '').replace(/"/g, '""')}"`
  }).join(','))
  const csv = '\uFEFF' + [head.join(','), ...body].join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  const d = new Date()
  const ds = `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}`
  a.download = `${filename}_${ds}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

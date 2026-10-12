/**
 * 敏感字段脱敏工具
 * - maskPhone: 13800001234 → 138****1234
 * - maskCard:  6222021234567890 → ************7890
 */
export function maskPhone(phone) {
  if (!phone) return ''
  const s = String(phone)
  if (s.length < 7) return s
  return s.slice(0, 3) + '****' + s.slice(-4)
}

export function maskCard(card) {
  if (!card) return ''
  const s = String(card)
  if (s.length < 8) return s
  return '*'.repeat(s.length - 4) + s.slice(-4)
}

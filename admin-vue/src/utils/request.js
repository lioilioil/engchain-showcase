/**
 * 统一 axios 实例 + 拦截层
 * - 请求拦截：自动带 Authorization: Bearer <token>
 * - 响应拦截：统一解包 data；401 清登录态跳 /login；业务错误码统一 ElMessage.error toast
 *
 * Mock 阶段边界：
 *   当前数据来自 src/api/request.js 的本地 mock 模块（无真实后端）。
 *   该 axios 实例在接真实后端时直接启用；为让 Mock 阶段也享有同一套
 *   401/错误处理语义，api/request.js 的 mockRequest 会复用本文件导出的
 *   handleResponseError。接后端时页面代码无需改动。
 */
import axios from 'axios'
import { ElMessage } from 'element-plus'
import { useUserStore } from '@/store/user.js'

const TOKEN_KEY = 'engchain_mock_token'

function getToken() {
  try { return localStorage.getItem(TOKEN_KEY) || '' } catch { return '' }
}

function clearAuthAndRedirect() {
  try { localStorage.removeItem(TOKEN_KEY) } catch { /* ignore */ }
  if (location.hash !== '#/login') {
    location.hash = '#/login'
  }
}

// 统一响应错误处理（axios 拦截与 mock 层共用）
export function handleResponseError(error) {
  const status = error?.response?.status
  const code = error?.response?.data?.code ?? error?.code
  if (status === 401 || code === 401) {
    ElMessage.error('登录已过期，请重新登录')
    clearAuthAndRedirect()
  } else {
    const msg = error?.response?.data?.message || error?.message || '请求失败'
    ElMessage.error(msg)
  }
  return Promise.reject(error)
}

const request = axios.create({
  baseURL: '/api',
  timeout: 10000
})

// 请求拦截：自动带 token
request.interceptors.request.use((config) => {
  const token = getToken()
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// 响应拦截：解包 + 统一错误
request.interceptors.response.use(
  (response) => {
    const res = response.data
    // 业务错误码（约定 { code: 0 成功 }）
    if (res && typeof res === 'object' && 'code' in res && res.code !== 0) {
      ElMessage.error(res.message || '业务处理失败')
      return Promise.reject(new Error(res.message || 'business error'))
    }
    return res
  },
  handleResponseError
)

export default request

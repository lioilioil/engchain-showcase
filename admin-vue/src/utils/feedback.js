import { ElMessage, ElMessageBox, ElLoading } from 'element-plus'

/* ============================== Toast ============================== */

/**
 * 全局轻提示，自动消失
 * 用法：
 *   toast.success('操作成功')
 *   toast.error('操作失败')
 *   toast.warning('请注意')
 *   toast.info('提示信息')
 */
const DURATION = 2500

function createToast(type) {
  return (message, options = {}) => {
    return ElMessage({
      type,
      message,
      duration: DURATION,
      showClose: false,
      ...options
    })
  }
}

export const toast = {
  success: createToast('success'),
  error: createToast('error'),
  warning: createToast('warning'),
  info: createToast('info')
}

/* ============================== Confirm ============================== */

/**
 * 确认弹窗，返回 Promise<boolean>
 *   - 点确认 → resolve(true)
 *   - 点取消 / 右上角关闭 / ESC → resolve(false)
 *   - 永不 reject
 *
 * 用法 1（对象配置）：
 *   await confirm({
 *     title: '提示',
 *     message: '确定要删除这条数据吗？',
 *     confirmText: '确定删除',
 *     cancelText: '取消',
 *     danger: true
 *   })
 *
 * 用法 2（简写，只传 message）：
 *   confirm('确定删除吗？').then(ok => { if (ok) { ... } })
 *
 * @param {string | object} opts  弹窗消息，或完整配置对象
 * @param {string} [opts.title='提示']
 * @param {string} opts.message   弹窗正文
 * @param {string} [opts.confirmText='确定']
 * @param {string} [opts.cancelText='取消']
 * @param {boolean} [opts.danger=false]  为 true 时确认按钮使用 danger 红色样式
 * @returns {Promise<boolean>}
 */
export function confirm(opts) {
  // 简写：confirm('文本内容')
  if (typeof opts === 'string') {
    opts = { message: opts }
  }

  const {
    title = '提示',
    message = '',
    confirmText = '确定',
    cancelText = '取消',
    danger = false
  } = opts || {}

  return ElMessageBox.confirm(message, title, {
    type: 'warning',
    confirmButtonText: confirmText,
    cancelButtonText: cancelText,
    confirmButtonType: danger ? 'danger' : 'primary',
    closeOnClickModal: true,
    closeOnPressEscape: true
  })
    .then(() => true)
    .catch(() => false)
}

/* ============================== Loading ============================== */

let loadingInstance = null
let loadingCount = 0

/**
 * 全屏 Loading 遮罩，支持嵌套计数
 *   loading.show('加载中...')
 *   // ...异步操作
 *   loading.hide()
 */
export const loading = {
  /**
   * 显示全屏 loading
   * @param {string} [text='加载中']
   */
  show(text = '加载中') {
    loadingCount++
    // 已有实例则不重复创建，避免重复挂载报错
    if (loadingInstance) return loadingInstance

    loadingInstance = ElLoading.service({
      lock: true,
      text,
      background: 'rgba(255, 255, 255, 0.7)'
    })
    return loadingInstance
  },

  /**
   * 关闭 loading（计数归零才真正关闭）
   */
  hide() {
    loadingCount = Math.max(0, loadingCount - 1)
    if (loadingCount > 0) return
    if (!loadingInstance) return

    try {
      loadingInstance.close()
    } catch (e) {
      /* 已关闭的实例再次 close 静默忽略 */
    }
    loadingInstance = null
  },

  /**
   * 强制关闭（忽略计数）
   */
  clear() {
    loadingCount = 0
    if (!loadingInstance) return
    try {
      loadingInstance.close()
    } catch (e) {
      /* ignore */
    }
    loadingInstance = null
  }
}

export default { toast, confirm, loading }

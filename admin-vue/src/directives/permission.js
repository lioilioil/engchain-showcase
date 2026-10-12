import { watch, onUnmounted } from 'vue'
import { usePermissionStore } from '@/store/permission.js'

/**
 * v-permission="'code'" 或 v-permission="['code1','code2']"
 * 响应式：依赖 permission store 的 codes，切角色后按钮/元素显隐即时更新，无需刷新。
 * 无权限时移除元素（不渲染），有权限时插回。
 */
export const permissionDirective = {
  mounted(el, binding) {
    const permStore = usePermissionStore()
    const parent = el.parentNode
    if (!parent) return
    // 占位锚点（注释节点），便于移除/插回
    const anchor = document.createComment('v-permission')
    parent.insertBefore(anchor, el)

    const evaluate = () => {
      const value = binding.value
      const codes = Array.isArray(value) ? value : [value]
      const ok = codes.every(c => permStore.has(c))
      const inserted = el.parentNode === parent
      if (ok && !inserted) {
        parent.insertBefore(el, anchor)
      } else if (!ok && inserted) {
        parent.removeChild(el)
      }
    }

    // 响应式追踪 codes 变化
    const stop = watch(() => permStore.codes, evaluate, { immediate: true })
    el.__permStop = stop
  },
  unmounted(el) {
    if (el.__permStop) el.__permStop()
  }
}

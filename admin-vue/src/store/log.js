import { defineStore } from 'pinia'
import { ref } from 'vue'
import { useUserStore } from './user.js'

export const useLogStore = defineStore('log', () => {
  const logs = ref([
    {
      id: 1,
      ts: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
      operator: '系统管理员',
      action: '登录系统',
      module: '系统',
      target: '-',
      extra: 'IP: 127.0.0.1'
    },
    {
      id: 2,
      ts: new Date(Date.now() - 1000 * 60 * 35).toISOString(),
      operator: '系统管理员',
      action: '审核通过',
      module: '认证审核',
      target: '用户张三 (ID: 1001)',
      extra: '实名认证审核通过'
    },
    {
      id: 3,
      ts: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
      operator: '系统管理员',
      action: '提现审批',
      module: '提现审批',
      target: '用户李四 (ID: 1002)',
      extra: '金额: ¥5,000'
    }
  ])

  let nextId = 4

  function addLog({ action, module, target = '-', extra = '' }) {
    const userStore = useUserStore()
    logs.value.unshift({
      id: nextId++,
      ts: new Date().toISOString(),
      operator: userStore.name || '系统管理员',
      action,
      module,
      target,
      extra
    })

    // 最多保留 100 条
    if (logs.value.length > 100) {
      logs.value = logs.value.slice(0, 100)
    }
  }

  function getLogs() {
    return logs.value
  }

  return {
    logs,
    addLog,
    getLogs
  }
})

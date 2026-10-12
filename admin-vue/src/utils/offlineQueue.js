// 离线队列：模拟断网时写操作入 localStorage 队列，恢复联网后按序提交并清除
const QUEUE_KEY = 'engchain_offline_queue'
let online = true // 模拟联网状态（演示开关）

function isOnline() { return online }

function setOnline(v) {
  online = v
  if (v) flushQueue()
}

function getQueue() {
  try { return JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]') } catch (e) { return [] }
}

function setQueue(q) {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(q))
}

// 入队（含操作元数据+时间戳）
function enqueue(op) {
  const q = getQueue()
  q.push({ ...op, ts: Date.now() })
  setQueue(q)
}

// 联网恢复：按序提交并清除
function flushQueue() {
  const q = getQueue()
  if (!q.length) return
  const done = q.filter(op => {
    // Mock：提交即成功
    return true
  })
  setQueue([])
  return done.length
}

export { isOnline, setOnline, enqueue, flushQueue, getQueue }

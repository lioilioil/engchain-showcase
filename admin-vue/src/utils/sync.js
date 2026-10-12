// 跨 Tab 协作：BroadcastChannel 用户变更 + 编辑锁协议（lock/unlock/beat）
const ch = new BroadcastChannel('engchain-sync')

// 广播用户变更（ban/delete）
function broadcastUserMutation(type, ids) {
  ch.postMessage({ kind: 'mutation', type, ids, ts: Date.now() })
}

// 编辑锁：lock/unlock/beat
function broadcastLock(action, rowId, operator) {
  ch.postMessage({ kind: 'lock', action, rowId, operator, ts: Date.now() })
}

// 订阅：变更 + 锁消息统一回调
function onUserMutation(cb) {
  ch.onmessage = (e) => cb(e.data)
}

export { broadcastUserMutation, onUserMutation, broadcastLock }

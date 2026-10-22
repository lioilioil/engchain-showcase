/**
 * 统一请求层
 * 当前为 Mock 模式：直接调用本地 mock 模块
 * 后续接真实后端时，只需将此文件改为 axios 实例，页面代码无需改动
 */

import * as users from './mock/users'
import * as supply from './mock/supply'
import * as orders from './mock/orders'
import * as finance from './mock/finance'
import * as risk from './mock/risk'
import * as distribution from './mock/distribution'
import * as system from './mock/system'
import { handleResponseError } from '@/utils/request.js'

/**
 * 模拟网络延迟（让加载状态有意义）
 */
function delay(data, ms = 30) {
  return new Promise(resolve => {
    setTimeout(() => resolve(JSON.parse(JSON.stringify(data))), ms)
  })
}

/**
 * Mock 请求封装
 * 统一返回 Promise，模拟真实接口行为；异常走统一拦截层 handleResponseError
 */
function mockRequest(fn) {
  return async (...args) => {
    try {
      const result = fn(...args)
      if (result && typeof result.then === 'function') {
        return await result
      }
      return delay(result)
    } catch (err) {
      // 统一错误处理（401/业务错误 toast），保持与 axios 拦截层一致
      handleResponseError(err)
      throw err
    }
  }
}

// ========== 用户 API ==========
export const userApi = {
  list: mockRequest(users.list),
  byId: mockRequest(users.byId),
  byMobile: mockRequest(users.byMobile),
  create: mockRequest(users.create),
  update: mockRequest(users.update),
  save: mockRequest(users.save),
  stats: mockRequest(users.stats),
  statusOf: users.statusOf,
  tagOf: users.tagOf
}

// ========== 供需/撮合 API ==========
export const supplyApi = {
  list: mockRequest(supply.list),
  byId: mockRequest(supply.byId),
  audit: mockRequest(supply.audit),
  create: mockRequest(supply.create)
}

// ========== 订单 API ==========
export const orderApi = {
  list: mockRequest(orders.list),
  byId: mockRequest(orders.byId),
  transition: mockRequest(orders.transition),
  advanceMilestone: mockRequest(orders.advanceMilestone),
  calc: orders.orderCalc
}

// ========== 财务 API ==========
export const financeApi = {
  // 提现
  listWithdrawals: mockRequest(finance.listWithdrawals),
  withdrawApprove: mockRequest(finance.withdrawalApprove),
  withdrawReject: mockRequest(finance.withdrawalReject),
  // 发票
  listInvoices: mockRequest(finance.listInvoices),
  invoiceUpdate: mockRequest(finance.invoiceUpdate),
  // 佣金
  listCommissionFlows: mockRequest(finance.listCommissionFlows),
  // 违规
  listViolations: mockRequest(finance.listViolations),
  punishViolation: mockRequest(finance.punishViolation),
  punishSteps: finance.PUNISH_STEPS
}

// ========== 风控 API ==========
export const riskApi = {
  listQualifications: mockRequest(risk.listQualifications),
  listMonitorFeed: mockRequest(risk.listMonitorFeed),
  monitorStat: mockRequest(risk.monitorStat)
}

// ========== 分销 API ==========
export const distributionApi = {
  listTeams: mockRequest(distribution.listTeam),
  listFlows: mockRequest(distribution.listFlows),
  settleFlow: mockRequest(distribution.settleFlow),
  payFlow: mockRequest(distribution.payFlow),
  stat: mockRequest(distribution.stat)
}

// ========== 系统 API ==========
export const systemApi = {
  // 日志
  listAuditLogs: mockRequest(system.listAuditLogs),
  addAuditLog: mockRequest(system.addAuditLog),
  // 消息
  listMessages: mockRequest(system.listMessages),
  publishMessage: mockRequest(system.publishMessage),
  // 快捷短语
  listPhrases: mockRequest(system.listPhrases)
}

// ========== 默认导出聚合 API ==========
export default {
  user: userApi,
  supply: supplyApi,
  order: orderApi,
  finance: financeApi,
  risk: riskApi,
  distribution: distributionApi,
  system: systemApi
}

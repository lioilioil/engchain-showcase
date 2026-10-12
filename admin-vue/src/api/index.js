/**
 * 统一 API 入口
 * 页面只需要 import api from '@/api'，然后调用 api.user.list() 等
 * 不需要关心是 mock 还是真实接口
 */

import request from './request'

export const {
  user: userApi,
  supply: supplyApi,
  order: orderApi,
  finance: financeApi,
  risk: riskApi,
  distribution: distributionApi,
  system: systemApi
} = request

export default request

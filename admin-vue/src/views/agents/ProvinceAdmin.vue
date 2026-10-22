<script setup>
/**
 * 省级总代开通/审核/终止 后台视图（M2-2/M2-3/M2-7）
 * 新独立视图，避开已占用的 /users/agent（Agent.vue），不改名复用。
 * 方案A：动作进内存队列 → 导出审核种子 JSON → App 导入落盘；无后端、无短信/Push/邮件外发。
 */
import { ref, computed } from 'vue'
import { ElMessage } from 'element-plus'
import {
  pushAction, clearQueue, listQueue, removeAction,
  buildSeed, seedToText, validateDirectGrant, canTransition
} from '@/bridge/provinceBridge.js'

const tab = ref('grant')

/* ---------- M2-3 直接指定开通（先全约束校验，失败不落占位、无残留） ---------- */
const grantForm = ref({ uid: '', companyName: '', uscc: '', license: '', legalRep: '', contact: '', phone: '', province: '' })
const grantResult = ref('')
const existingList = ref([]) // demo：在册列表由生产后端提供；冲突在前置校验拦截
function submitGrant() {
  const v = validateDirectGrant(grantForm.value, existingList.value)
  if (!v.ok) {
    grantResult.value = '校验未通过，未落库：' + v.msg
    ElMessage.warning(v.msg)
    return
  }
  pushAction({
    op: 'province.directGrant',
    operator: 'admin',
    reason: '后台直接指定开通',
    record: {
      uid: grantForm.value.uid,
      province: grantForm.value.province,
      branchCompany: {
        name: grantForm.value.companyName,
        uscc: grantForm.value.uscc,
        license: grantForm.value.license,
        legalRep: grantForm.value.legalRep,
        contact: grantForm.value.contact,
        phone: grantForm.value.phone || ''
      }
    }
  })
  grantResult.value = '已加入导出队列（冲突已前置拦截，无占位残留）'
  ElMessage.success('已加入审核种子队列')
  grantForm.value = { uid: '', companyName: '', uscc: '', license: '', legalRep: '', contact: '', phone: '', province: '' }
}

/* ---------- M2-2 审核队列（通过/驳回，rejectReason 落盘可见） ---------- */
const pendingList = ref([
  { id: 'pa-demo-1', company: '示例四川总代公司', province: '四川省', uscc: 'DEMO-001' }
])
const reviewForm = ref({ rejectReason: '' })
function auditApprove(row) {
  pushAction({ op: 'province.approve', id: row.id, operator: 'admin', reason: '审核通过' })
  ElMessage.success('已加入通过队列，导出种子后 App 落盘')
}
function auditReject(row) {
  if (!reviewForm.value.rejectReason.trim()) { ElMessage.warning('驳回原因必填'); return }
  pushAction({ op: 'province.reject', id: row.id, operator: 'admin', reason: '驳回', rejectReason: reviewForm.value.rejectReason.trim() })
  reviewForm.value.rejectReason = ''
  ElMessage.success('已加入驳回队列，原因将落盘可见')
}

/* ---------- M2-7 终止态操作（解约/独家收回/暂停恢复/二级解绑/违规清退） ---------- */
const termForm = ref({ kind: 'province', id: '', op: 'suspend', reason: '' })
const termResult = ref('')
const PROVINCE_OPS = [
  { value: 'suspend', label: '暂停（权益冻结，可恢复）' },
  { value: 'resume', label: '恢复（suspended→active）' },
  { value: 'terminate', label: '解约（terminated，不可逆，释放省）' },
  { value: 'revoke', label: '违规清退（revoked，不可逆，释放省）' }
]
const SUB_OPS = [
  { value: 'remove', label: '二级解绑（removed，释放名额）' },
  { value: 'terminate', label: '二级违约终止（terminated，释放名额）' }
]
const TERM_MAP = {
  province: { suspend: 'suspended', resume: 'active', terminate: 'terminated', revoke: 'revoked' },
  sub: { remove: 'removed', terminate: 'terminated' }
}
function submitTerm() {
  const f = termForm.value
  if (!f.id) { termResult.value = '请填写记录 id'; return }
  const to = TERM_MAP[f.kind][f.op]
  const from = f.kind === 'province' ? 'active' : 'approved'
  if (!canTransition(f.kind, from, to)) {
    termResult.value = '非法状态流转被拦截：' + from + ' → ' + to
    ElMessage.warning('非法状态流转')
    return
  }
  pushAction({ op: f.kind + '.' + f.op, id: f.id, operator: 'admin', reason: f.reason || '' })
  termResult.value = '已加入终止队列：' + f.kind + ' → ' + to + '（statusLog 留痕，sealedAt 封存）'
  ElMessage.success('已加入终止队列')
}

/* ---------- 导出审核种子（方案A） ---------- */
const queue = ref([])
const seedText = ref('')
function refreshQueue() { queue.value = listQueue() }
function exportSeed() {
  seedText.value = seedToText(buildSeed({ source: 'admin-vue', note: '方案A 共享种子，App 导入落盘' }))
  refreshQueue()
  ElMessage.success('种子已生成，复制后到 App「审核进度-导入审核种子」粘贴落盘')
}
function copySeed() {
  if (!seedText.value) { ElMessage.warning('请先生成种子'); return }
  if (navigator.clipboard) navigator.clipboard.writeText(seedText.value)
  ElMessage.success('已复制')
}
function removeQueued(i) { removeAction(i); refreshQueue() }
function clearAll() { clearQueue(); refreshQueue(); seedText.value = '' }

const opsLabel = computed(() => ({
  'province.directGrant': '直接指定开通',
  'province.approve': '总代通过',
  'province.reject': '总代驳回',
  'province.suspend': '暂停',
  'province.resume': '恢复',
  'province.terminate': '解约',
  'province.revoke': '违规清退',
  'sub.approve': '二级通过',
  'sub.reject': '二级驳回',
  'sub.remove': '二级解绑',
  'sub.terminate': '二级违约终止'
}))
</script>

<template>
  <div class="province-admin">
    <div class="page-header">
      <h2>省级总代开通 / 审核 / 终止</h2>
      <p class="page-desc">方案A 共享种子桥接：动作入内存队列 → 导出 JSON → App 导入落盘；无后端、无短信/Push/邮件外发</p>
    </div>

    <el-tabs v-model="tab">
      <el-tab-pane label="直接指定开通 (M2-3)" name="grant">
        <el-form label-width="110px" style="max-width:560px;">
          <el-form-item label="主体UID"><el-input v-model="grantForm.uid" placeholder="可选，后台指定主体标识" /></el-form-item>
          <el-form-item label="分公司名称" required><el-input v-model="grantForm.companyName" /></el-form-item>
          <el-form-item label="统一信用代码" required><el-input v-model="grantForm.uscc" /></el-form-item>
          <el-form-item label="营业执照" required><el-input v-model="grantForm.license" /></el-form-item>
          <el-form-item label="法定代表人" required><el-input v-model="grantForm.legalRep" /></el-form-item>
          <el-form-item label="联系人"><el-input v-model="grantForm.contact" /></el-form-item>
          <el-form-item label="意向授权省" required>
            <el-select v-model="grantForm.province" placeholder="选择省份" style="width:100%">
              <el-option label="四川省" value="四川省" /><el-option label="广东省" value="广东省" />
              <el-option label="浙江省" value="浙江省" /><el-option label="江苏省" value="江苏省" />
            </el-select>
          </el-form-item>
          <el-form-item>
            <el-button type="primary" @click="submitGrant">校验并加入队列（失败不落占位）</el-button>
          </el-form-item>
          <div v-if="grantResult" class="tip">{{ grantResult }}</div>
        </el-form>
      </el-tab-pane>

      <el-tab-pane label="审核队列 (M2-2)" name="review">
        <el-table :data="pendingList" border size="small">
          <el-table-column prop="id" label="申请ID" width="120" />
          <el-table-column prop="company" label="企业" />
          <el-table-column prop="province" label="意向省" width="100" />
          <el-table-column label="操作" width="220">
            <template #default="{ row }">
              <el-button size="small" type="success" @click="auditApprove(row)">通过</el-button>
              <el-button size="small" type="danger" @click="auditReject(row)">驳回</el-button>
            </template>
          </el-table-column>
        </el-table>
        <el-input v-model="reviewForm.rejectReason" placeholder="驳回原因（驳回必填，落盘可见）" style="margin-top:10px;max-width:560px;" />
      </el-tab-pane>

      <el-tab-pane label="终止态操作 (M2-7)" name="term">
        <el-form label-width="110px" style="max-width:560px;">
          <el-form-item label="对象类型">
            <el-radio-group v-model="termForm.kind">
              <el-radio-button value="province">总代</el-radio-button>
              <el-radio-button value="sub">二级</el-radio-button>
            </el-radio-group>
          </el-form-item>
          <el-form-item label="记录ID" required><el-input v-model="termForm.id" placeholder="province id / sub id" /></el-form-item>
          <el-form-item label="操作">
            <el-select v-model="termForm.op" style="width:100%">
              <el-option v-for="o in (termForm.kind==='province'?PROVINCE_OPS:SUB_OPS)" :key="o.value" :label="o.label" :value="o.value" />
            </el-select>
          </el-form-item>
          <el-form-item label="原因"><el-input v-model="termForm.reason" type="textarea" :rows="2" /></el-form-item>
          <el-form-item><el-button type="warning" @click="submitTerm">加入终止队列</el-button></el-form-item>
          <div v-if="termResult" class="tip">{{ termResult }}</div>
        </el-form>
      </el-tab-pane>

      <el-tab-pane label="导出审核种子" name="seed">
        <el-button type="primary" @click="exportSeed">生成种子 JSON</el-button>
        <el-button @click="copySeed">复制</el-button>
        <el-button type="danger" plain @click="clearAll">清空队列</el-button>
        <pre class="seed-box">{{ seedText || '（生成后在此显示种子 JSON）' }}</pre>
        <el-table :data="queue" border size="small" style="margin-top:12px;">
          <el-table-column label="动作" width="160">
            <template #default="{ row }">{{ opsLabel[row.op] || row.op }}</template>
          </el-table-column>
          <el-table-column prop="id" label="目标ID" width="120" />
          <el-table-column prop="reason" label="说明" />
          <el-table-column label="操作" width="80">
            <template #default="{ $index }"><el-button size="small" type="danger" link @click="removeQueued($index)">移除</el-button></template>
          </el-table-column>
        </el-table>
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<style lang="scss" scoped>
.province-admin { display: flex; flex-direction: column; gap: $spacing-lg; }
.page-header h2 { margin: 0; font-size: 20px; font-weight: 600; }
.page-desc { margin: $spacing-xs 0 0; font-size: 13px; color: $color-text-secondary; }
.tip { margin-top: 10px; font-size: 13px; color: $color-text-secondary; }
.seed-box { margin-top: 12px; max-height: 280px; overflow: auto; background: $color-bg-page; padding: 12px; border-radius: $radius-md; font-size: 12px; }
</style>

<template>
  <div class="page-view">
    <div class="page-view__head">
      <div>
        <div class="page-view__eyebrow">系统设置</div>
        <h1 class="page-view__title">价格配置</h1>
        <div class="page-view__sub">佣金费率 / 服务费 / 提现手续费</div>
      </div>
      <div class="page-view__actions">
        <button class="btn btn--primary" @click="save"><AppIcon name="check" :size="14" />保存</button>
      </div>
    </div>
    <div class="card form-card">
      <div class="form-row">
        <label>普通订单佣金费率</label>
        <el-input-number v-model="form.commissionRate" :min="0" :max="50" :precision="2" />
        <span class="unit">%</span>
      </div>
      <div class="form-row">
        <label>中介服务费率</label>
        <el-input-number v-model="form.mediationRate" :min="0" :max="50" :precision="2" />
        <span class="unit">%</span>
      </div>
      <div class="form-row">
        <label>提现手续费率</label>
        <el-input-number v-model="form.withdrawFeeRate" :min="0" :max="10" :precision="2" />
        <span class="unit">%</span>
      </div>
      <div class="form-row">
        <label>提现最低金额</label>
        <el-input-number v-model="form.withdrawMin" :min="0" :precision="2" />
        <span class="unit">元</span>
      </div>
      <div class="form-row">
        <label>里程碑分账阈值</label>
        <el-input-number v-model="form.milestoneThreshold" :min="0" :precision="0" />
        <span class="unit">元（≥ 该金额启用 4 节点分账）</span>
      </div>
    </div>
  </div>
</template>
<script setup lang="ts">
import { reactive, onMounted } from 'vue';
import { ElMessage } from 'element-plus';
import AppIcon from '@/components/AppIcon.vue';
import EmptyState from '@/components/EmptyState.vue';

const PRICING_KEY = 'engchain-pricing-config';
const form = reactive({
  commissionRate: 5, mediationRate: 3, withdrawFeeRate: 0.5, withdrawMin: 100, milestoneThreshold: 50000,
});

function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(PRICING_KEY) || '{}');
    Object.assign(form, saved);
  } catch {}
}
function save() {
  localStorage.setItem(PRICING_KEY, JSON.stringify(form));
  window.dispatchEvent(new CustomEvent('engchain:pricing', { detail: { ...form } }));
  ElMessage.success('已保存');
}
onMounted(() => { load(); });
</script>
<style scoped>
.page-view { padding: 0 24px 24px; display: flex; flex-direction: column; gap: 16px; }
.page-view__eyebrow { font-size: var(--font-size-xs); color: var(--font-light); text-transform: uppercase; letter-spacing: 0.05em; }
.page-view__title { font-size: var(--font-size-h1); font-weight: var(--font-weight-semibold); color: var(--font-primary); margin: 2px 0 4px; }
.page-view__sub { font-size: var(--font-size-md); color: var(--font-tertiary); }
.page-view__head { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; }
.page-view__actions { display: flex; gap: 8px; flex-shrink: 0; }
.form-card { padding: 24px; display: flex; flex-direction: column; gap: 20px; max-width: 600px; }
.form-row { display: flex; align-items: center; gap: 12px; }
.form-row label { width: 160px; font-size: var(--font-size-md); color: var(--font-secondary); }
.unit { font-size: var(--font-size-sm); color: var(--font-tertiary); }
</style>

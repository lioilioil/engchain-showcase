<template>
  <div class="page-view">
    <div class="page-view__head">
      <div>
        <div class="page-view__eyebrow">系统设置</div>
        <h1 class="page-view__title">阶段开关</h1>
        <div class="page-view__sub">功能模块灰度 / 阶段发布控制</div>
      </div>
    </div>
    <div class="card">
      <div class="phase-list">
        <div v-for="p in phases" :key="p.key" class="phase-item">
          <div class="phase-info">
            <div class="phase-name">{{ p.name }}</div>
            <div class="phase-desc">{{ p.desc }}</div>
          </div>
          <el-switch v-model="p.enabled" @change="onToggle(p)" />
        </div>
      </div>
    </div>
  </div>
</template>
<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { ElMessage } from 'element-plus';

const REGISTRY_KEY = 'engchain-phase-registry';
const phases = ref<any[]>([]);

function load() {
  let saved: any = {};
  try { saved = JSON.parse(localStorage.getItem(REGISTRY_KEY) || '{}'); } catch {}
  const defaults = [
    { key: 'supply', name: '供需发布', desc: 'App 端供需信息发布与浏览', enabled: true },
    { key: 'orders', name: '订单交易', desc: '普通订单全流程', enabled: true },
    { key: 'mediation', name: '中介托管', desc: '中介撮合与资金托管', enabled: true },
    { key: 'distribution', name: '分销系统', desc: '分销代理与结算', enabled: false },
    { key: 'invoice', name: '发票申请', desc: '用户在线开票', enabled: true },
  ];
  phases.value = defaults.map(p => ({ ...p, enabled: saved[p.key] !== undefined ? saved[p.key] : p.enabled }));
}

function onToggle(p: any) {
  let saved: any = {};
  try { saved = JSON.parse(localStorage.getItem(REGISTRY_KEY) || '{}'); } catch {}
  saved[p.key] = p.enabled;
  localStorage.setItem(REGISTRY_KEY, JSON.stringify(saved));
  window.dispatchEvent(new CustomEvent('engchain:phase', { detail: { phase: p.key, enabled: p.enabled } }));
  ElMessage.success(`${p.name} 已${p.enabled ? '开启' : '关闭'}`);
}

onMounted(() => { load(); });
</script>
<style scoped>
.page-view { padding: 0 24px 24px; display: flex; flex-direction: column; gap: 16px; }
.page-view__eyebrow { font-size: var(--font-size-xs); color: var(--font-light); text-transform: uppercase; letter-spacing: 0.05em; }
.page-view__title { font-size: var(--font-size-h1); font-weight: var(--font-weight-semibold); color: var(--font-primary); margin: 2px 0 4px; }
.page-view__sub { font-size: var(--font-size-md); color: var(--font-tertiary); }
.phase-list { display: flex; flex-direction: column; }
.phase-item { display: flex; justify-content: space-between; align-items: center; padding: 14px 8px; border-bottom: 1px solid var(--border-light); }
.phase-item:last-child { border-bottom: none; }
.phase-name { font-size: var(--font-size-md); color: var(--font-primary); font-weight: var(--font-weight-medium); }
.phase-desc { font-size: var(--font-size-sm); color: var(--font-tertiary); margin-top: 2px; }
</style>

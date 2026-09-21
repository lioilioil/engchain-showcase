<template>
  <div class="page-view">
    <div class="page-view__head">
      <div>
        <div class="page-view__eyebrow">用户中心</div>
        <h1 class="page-view__title">我的认证</h1>
        <div class="page-view__sub">实名认证 · 企业认证 · 资质上传</div>
      </div>
    </div>

    <div class="auth-cards">
      <div v-for="item in authItems" :key="item.title" class="card auth-card" :class="item.status">
        <div class="auth-icon">
          <AppIcon :name="item.icon" :size="24" />
        </div>
        <div class="auth-body">
          <div class="auth-title">{{ item.title }}</div>
          <div class="auth-desc">{{ item.desc }}</div>
          <div class="auth-status">
            <span class="tag" :class="item.status === 'done' ? 'tag--green' : item.status === 'pending' ? 'tag--yellow' : 'tag--gray'">
              {{ item.statusText }}
            </span>
          </div>
        </div>
        <button v-if="item.status === 'none'" class="btn btn--primary btn--sm" @click="startAuth(item)">立即认证</button>
        <button v-else-if="item.status === 'rejected'" class="btn btn--danger btn--sm" @click="reauth(item)">重新提交</button>
      </div>
    </div>

    <div class="card" v-if="currentUser.auth?.realname?.ok">
      <div class="card-title">实名认证信息</div>
      <div class="info-grid">
        <div class="info-item"><span class="k">姓名</span><span class="v">{{ currentUser.auth?.realname?.name || '—' }}</span></div>
        <div class="info-item"><span class="k">身份证号</span><span class="v">{{ currentUser.auth?.realname?.idCard || '—' }}</span></div>
        <div class="info-item"><span class="k">认证时间</span><span class="v">{{ currentUser.auth?.realname?.time || '—' }}</span></div>
      </div>
    </div>

    <div class="card" v-if="currentUser.auth?.enterprise?.ok">
      <div class="card-title">企业认证信息</div>
      <div class="info-grid">
        <div class="info-item"><span class="k">企业名称</span><span class="v">{{ currentUser.name }}</span></div>
        <div class="info-item"><span class="k">统一信用代码</span><span class="v">{{ currentUser.auth?.enterprise?.creditCode || '—' }}</span></div>
        <div class="info-item"><span class="k">认证时间</span><span class="v">{{ currentUser.auth?.enterprise?.time || '—' }}</span></div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import AppIcon from '@/components/AppIcon.vue';
import { useBus } from '@/composables/useLegacyBus';

const { bus } = useBus();
const currentUser = computed(() => bus()?.current ? bus().current() : {});

const authItems = ref([
  { title: '实名认证', desc: '上传身份证，完成个人身份验证', icon: 'user', status: 'done', statusText: '已认证' },
  { title: '企业认证', desc: '上传营业执照，完成企业资质验证', icon: 'building', status: 'pending', statusText: '审核中' },
  { title: '资质上传', desc: '上传专业资质证书（建造师/工程师等）', icon: 'certificate', status: 'none', statusText: '未认证' },
  { title: '银行账户', desc: '绑定对公账户，用于提现结算', icon: 'card', status: 'none', statusText: '未绑定' },
]);

function startAuth(item: any) {
  item.status = 'pending';
  item.statusText = '审核中';
}
function reauth(item: any) {
  item.status = 'pending';
  item.statusText = '审核中';
}
</script>

<style scoped>
.page-view { padding: 0 24px 24px; display: flex; flex-direction: column; gap: 16px; }
.page-view__eyebrow { font-size: var(--font-size-xs); color: var(--font-light); text-transform: uppercase; letter-spacing: 0.05em; }
.page-view__title { font-size: var(--font-size-h1); font-weight: var(--font-weight-semibold); color: var(--font-primary); margin: 2px 0 4px; }
.page-view__sub { font-size: var(--font-size-md); color: var(--font-tertiary); }
.auth-cards { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; }
.auth-card { display: flex; align-items: flex-start; gap: 12px; padding: 16px; }
.auth-icon { width: 40px; height: 40px; border-radius: 8px; background: var(--bg-tertiary); display: flex; align-items: center; justify-content: center; color: var(--font-secondary); flex-shrink: 0; }
.auth-body { flex: 1; }
.auth-title { font-size: var(--font-size-md); font-weight: var(--font-weight-semibold); color: var(--font-primary); }
.auth-desc { font-size: var(--font-size-sm); color: var(--font-tertiary); margin-top: 2px; }
.auth-status { margin-top: 8px; }
.card { padding: 16px; }
.card-title { font-size: var(--font-size-sm); font-weight: var(--font-weight-semibold); color: var(--font-secondary); margin-bottom: 12px; }
.info-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
.info-item { display: flex; flex-direction: column; gap: 4px; }
.info-item .k { font-size: var(--font-size-xs); color: var(--font-light); }
.info-item .v { font-size: var(--font-size-md); color: var(--font-primary); }
</style>

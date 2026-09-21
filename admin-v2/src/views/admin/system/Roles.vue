<template>
  <div class="page-view">
    <div class="page-view__head">
      <div>
        <div class="page-view__eyebrow">系统设置</div>
        <h1 class="page-view__title">角色权限</h1>
        <div class="page-view__sub">后台角色与权限矩阵</div>
      </div>
      <div class="page-view__actions">
        <button class="btn btn--primary" @click="addRole"><AppIcon name="plus" :size="14" />新建角色</button>
      </div>
    </div>
    <div class="card table-card">
      <el-table :data="roles" stripe row-key="id">
        <el-table-column prop="id" label="ID" width="80" />
        <el-table-column prop="name" label="角色名" width="160" />
        <el-table-column prop="desc" label="描述" min-width="240" />
        <el-table-column label="成员数" width="100">
          <template #default="{ row }">{{ row.userCount || 0 }}</template>
        </el-table-column>
        <el-table-column label="操作" width="160" fixed="right">
          <template #default="{ row }">
            <div class="ops">
              <button class="btn btn--tertiary btn--sm" @click="editPerms(row)">权限配置</button>
            </div>
          </template>
        </el-table-column>
            <template #empty>
        <EmptyState title='暂无数据' desc='当前筛选条件下没有匹配的记录' />
      </template>
      </el-table>
    </div>
  </div>
</template>
<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { ElMessage } from 'element-plus';
import AppIcon from '@/components/AppIcon.vue';
import EmptyState from '@/components/EmptyState.vue';
const roles = ref<any[]>([]);
function load() {
  roles.value = (window as any).AdminRoles?.list?.() || [
    { id: 1, name: '超级管理员', desc: '全部权限', userCount: 1 },
    { id: 2, name: '运营', desc: '供需 / 订单 / 消息审核', userCount: 3 },
    { id: 3, name: '财务', desc: '钱包 / 提现 / 发票 / 佣金', userCount: 2 },
    { id: 4, name: '风控', desc: '合规审核 / 监控 / 日志', userCount: 2 },
  ];
}
function addRole() { ElMessage.info('新建角色'); }
function editPerms(row: any) { ElMessage.info(`配置 ${row.name} 权限`); }
onMounted(() => { load(); });
</script>
<style scoped>
.page-view { padding: 0 24px 24px; display: flex; flex-direction: column; gap: 16px; }
.page-view__eyebrow { font-size: var(--font-size-xs); color: var(--font-light); text-transform: uppercase; letter-spacing: 0.05em; }
.page-view__title { font-size: var(--font-size-h1); font-weight: var(--font-weight-semibold); color: var(--font-primary); margin: 2px 0 4px; }
.page-view__sub { font-size: var(--font-size-md); color: var(--font-tertiary); }
.page-view__head { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; }
.page-view__actions { display: flex; gap: 8px; flex-shrink: 0; }
.table-card { padding: 0; overflow: hidden; }
.ops { display: flex; gap: 4px; flex-wrap: wrap; }
</style>

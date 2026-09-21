<template>
  <div class="page-view">
    <div class="page-view__head">
      <div>
        <div class="page-view__eyebrow">运营中心</div>
        <h1 class="page-view__title">消息中心</h1>
        <div class="page-view__sub">系统公告 / 消息发布（发布写回 DataBus，App 消息入口可监听同步）</div>
      </div>
      <div class="page-view__actions">
        <button class="btn btn--primary" @click="openPublish"><AppIcon name="plus" :size="14" />发布新消息</button>
        <button class="btn btn--secondary" @click="load"><AppIcon name="refresh" :size="14" />刷新</button>
        <button class="btn btn--secondary" @click="onExport"><AppIcon name="download" :size="14" />导出 CSV</button>
      </div>
    </div>

    <div class="kpis">
      <div v-for="k in kpis" :key="k.label" class="card kpi">
        <div class="kpi__label">{{ k.label }}</div>
        <div class="kpi__value">{{ k.value }}</div>
        <div class="kpi__hint">{{ k.hint }}</div>
      </div>
    </div>

    <div class="filter-bar card">
      <el-select v-model="filter.type" placeholder="消息类型" clearable size="small" style="width:120px" @change="onFilter">
        <el-option v-for="t in TYPES" :key="t" :label="t" :value="t" />
      </el-select>
      <el-select v-model="filter.read" placeholder="已读状态" clearable size="small" style="width:120px" @change="onFilter">
        <el-option label="未读" value="unread" />
        <el-option label="已读" value="read" />
      </el-select>
      <el-date-picker v-model="filter.dateRange" type="daterange" size="small" range-separator="至"
        start-placeholder="开始日期" end-placeholder="结束日期" style="width:240px" @change="onFilter" />
      <el-input v-model="filter.q" placeholder="搜索标题 / 内容 / 目标" size="small" clearable style="width:220px" @change="onFilter" />
      <button class="btn btn--tertiary btn--sm" @click="onReset">重置</button>
    </div>

    <div class="card table-card">
      <el-table :data="paged" v-loading="loading" stripe row-key="id" @row-click="openDetail">
        <el-table-column prop="id" label="ID" width="80" />
        <el-table-column label="消息" min-width="300">
          <template #default="{ row }">
            <div class="cell-main">
              <span v-if="!isRead(row.id)" class="dot-unread" />{{ row.title }}
            </div>
            <div class="cell-sub">{{ row.body }}</div>
          </template>
        </el-table-column>
        <el-table-column label="类型" width="90">
          <template #default="{ row }"><span class="tag" :class="typeClass(row.type)">{{ row.type }}</span></template>
        </el-table-column>
        <el-table-column prop="target" label="推送目标" width="120" />
        <el-table-column label="状态" width="90">
          <template #default="{ row }">
            <span class="tag" :class="isRead(row.id) ? 'tag--gray' : 'tag--yellow'">{{ isRead(row.id) ? '已读' : '未读' }}</span>
          </template>
        </el-table-column>
        <el-table-column label="发布时间" width="110">
          <template #default="{ row }">{{ fmtDate(row.ts) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="160" fixed="right">
          <template #default="{ row }">
            <div class="ops">
              <button class="btn btn--tertiary btn--sm" @click.stop="markRead(row.id)">标已读</button>
              <button class="btn btn--danger btn--sm" @click.stop="del(row.id)">删除</button>
            </div>
          </template>
        </el-table-column>
            <template #empty>
        <EmptyState title='暂无数据' desc='当前筛选条件下没有匹配的记录' />
      </template>
      </el-table>
      <div class="pager">
        <el-pagination v-model:current-page="page" v-model:page-size="pageSize" :total="filtered.length"
          :page-sizes="[10, 20, 50]" layout="total, sizes, prev, pager, next" @size-change="onFilter" @current-change="onFilter" />
      </div>
    </div>

    <!-- 新建推送弹窗 -->
    <div v-if="showPushDialog" class="modal-mask" @click.self="showPushDialog = false">
      <div class="modal">
        <div class="modal-title">新建消息推送</div>
        <div class="modal-body">
          <div class="form-group">
            <label>推送目标</label>
            <el-select v-model="pushForm.target" placeholder="选择目标人群" style="width:100%">
              <el-option label="全部用户" value="all" />
              <el-option label="入驻企业" value="resident" />
              <el-option label="认证企业" value="enterprise" />
              <el-option label="中介服务商" value="agency" />
              <el-option label="VIP 客户" value="vip" />
            </el-select>
          </div>
          <div class="form-group">
            <label>消息类型</label>
            <el-select v-model="pushForm.type" placeholder="选择类型" style="width:100%">
              <el-option label="系统通知" value="system" />
              <el-option label="活动公告" value="announcement" />
              <el-option label="营销推广" value="marketing" />
            </el-select>
          </div>
          <div class="form-group">
            <label>标题</label>
            <input v-model="pushForm.title" class="form-input" placeholder="请输入消息标题" />
          </div>
          <div class="form-group">
            <label>内容</label>
            <textarea v-model="pushForm.content" class="form-input" rows="4" placeholder="请输入消息内容"></textarea>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn--tertiary" @click="showPushDialog = false">取消</button>
          <button class="btn btn--primary" @click="sendPush">发送</button>
        </div>
      </div>
    </div>

    <RightDrawer v-model="drawerVisible" :title="`消息详情 · ${current?.id || ''}`">
      <template v-if="current">
        <div class="ds-section">
          <div class="ds-title">基本信息</div>
          <div class="ds-grid">
            <div class="ds-item"><span class="ds-k">类型</span><span class="ds-v">{{ current.type }}</span></div>
            <div class="ds-item"><span class="ds-k">推送目标</span><span class="ds-v">{{ current.target }}</span></div>
            <div class="ds-item"><span class="ds-k">状态</span><span class="ds-v">{{ isRead(current.id) ? '已读' : '未读' }}</span></div>
            <div class="ds-item"><span class="ds-k">发布时间</span><span class="ds-v">{{ fmtDate(current.ts) }}</span></div>
            <div class="ds-item ds-full"><span class="ds-k">标题</span><span class="ds-v">{{ current.title }}</span></div>
          </div>
        </div>
        <div class="ds-section">
          <div class="ds-title">正文</div>
          <div class="ds-desc">{{ current.body }}</div>
        </div>
      </template>
    </RightDrawer>

    <el-dialog v-model="publishVisible" title="发布新消息" width="520px">
      <el-form :model="publishForm" label-width="80px">
        <el-form-item label="类型">
          <el-select v-model="publishForm.type" style="width:100%">
            <el-option v-for="t in TYPES" :key="t" :label="t" :value="t" />
          </el-select>
        </el-form-item>
        <el-form-item label="推送目标">
          <el-select v-model="publishForm.target" style="width:100%">
            <el-option v-for="t in TARGETS" :key="t" :label="t" :value="t" />
          </el-select>
        </el-form-item>
        <el-form-item label="标题">
          <el-input v-model="publishForm.title" placeholder="消息标题" />
        </el-form-item>
        <el-form-item label="正文">
          <el-input v-model="publishForm.body" type="textarea" :rows="4" placeholder="消息正文" />
        </el-form-item>
      </el-form>
      <template #footer>
        <button class="btn btn--tertiary" @click="publishVisible = false">取消</button>
        <button class="btn btn--primary" @click="doPublish">发布</button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, onUnmounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import AppIcon from '@/components/AppIcon.vue';
import RightDrawer from '@/components/RightDrawer.vue';
import EmptyState from '@/components/EmptyState.vue';
import { useBus } from '@/composables/useLegacyBus';

const { bus } = useBus();
const TYPES = ['公告', '系统', '活动', '风控'];
const TARGETS = ['全部用户', '入驻企业', '认证企业', '中介企业', '个人认证'];
const READ_KEY = 'engchain-msg-read';
const DEL_KEY = 'engchain-msg-deleted';
const TYPE_CLASS: Record<string, string> = { 公告: 'tag--blue', 系统: 'tag--gray', 活动: 'tag--yellow', 风控: 'tag--red' };

const loading = ref(false);
const list = ref<any[]>([]);
const page = ref(1);
const pageSize = ref(10);
const filter = reactive({ type: '', read: '', q: '', dateRange: null as [string, string] | null });
const drawerVisible = ref(false);
const showPushDialog = ref(false);
const pushForm = ref({ target: 'all', type: 'system', title: '', content: '' });
function sendPush() {
  if (!pushForm.value.title || !pushForm.value.content) {
    alert('请填写标题和内容');
    return;
  }
  // 模拟发送
  const newMsg = {
    id: 'MSG-' + Date.now(),
    type: pushForm.value.type,
    title: pushForm.value.title,
    content: pushForm.value.content,
    target: pushForm.value.target,
    ts: Date.now()
  };
  list.value.unshift(newMsg);
  showPushDialog.value = false;
  pushForm.value = { target: 'all', type: 'system', title: '', content: '' };
  alert('推送成功，已发送至目标用户');
}
const current = ref<any>(null);
const publishVisible = ref(false);
const publishForm = reactive({ type: '公告', target: '全部用户', title: '', body: '' });

function fmtDate(ts: any) {
  if (!ts) return '';
  if (typeof ts === 'number') return new Date(ts).toISOString().slice(0, 10);
  return String(ts).slice(0, 10);
}
function getSet(key: string) {
  try { return new Set(JSON.parse(localStorage.getItem(key) || '[]')); } catch { return new Set(); }
}
function isRead(id: string) { return getSet(READ_KEY).has(id); }
function markRead(id: string) {
  const s = getSet(READ_KEY); s.add(id);
  localStorage.setItem(READ_KEY, JSON.stringify(Array.from(s)));
  ElMessage.success('已标记为已读');
}
function typeClass(t: string) { return TYPE_CLASS[t] || 'tag--gray'; }

function load() {
  const deleted = getSet(DEL_KEY);
  let a = bus()?.messages ? bus().messages() : [];
  // Mock fallback
  if (!a.length) {
    a = [
      { id: 'MSG-001', type: 'system', title: '系统维护通知', content: '本周六凌晨 2:00-4:00 系统升级维护，请提前保存工作内容。', target: '全部用户', ts: Date.now() - 86400000*1 },
      { id: 'MSG-002', type: 'order', title: '订单审核通过', content: '您发布的订单已通过审核，可正式接单。', target: '张三', ts: Date.now() - 86400000*2 },
      { id: 'MSG-003', type: 'finance', title: '提现到账通知', content: '您的提现申请已处理完成，资金已到账。', target: '李四', ts: Date.now() - 86400000*3 },
      { id: 'MSG-004', type: 'system', title: '新功能上线', content: '平台新增 CRM 客户管理模块，欢迎体验。', target: '全部用户', ts: Date.now() - 86400000*5 },
      { id: 'MSG-005', type: 'order', title: '订单状态变更', content: '订单 ORD-2024-001 状态变更为"进行中"。', target: '王五', ts: Date.now() - 86400000*7 },
    ];
  }
  list.value = a.filter((m: any) => !deleted.has(m.id));
}

const filtered = computed(() => {
  const q = filter.q.trim().toLowerCase();
  return list.value.filter((m: any) => {
    if (filter.type && m.type !== filter.type) return false;
    if (filter.read === 'read' && !isRead(m.id)) return false;
    if (filter.read === 'unread' && isRead(m.id)) return false;
    if (filter.dateRange && filter.dateRange[0] && fmtDate(m.ts) < filter.dateRange[0]) return false;
    if (filter.dateRange && filter.dateRange[1] && fmtDate(m.ts) > filter.dateRange[1]) return false;
    if (q && `${m.id}${m.title}${m.body}${m.target}`.toLowerCase().indexOf(q) < 0) return false;
    return true;
  });
});
const paged = computed(() => filtered.value.slice((page.value - 1) * pageSize.value, page.value * pageSize.value));

const kpis = computed(() => {
  const total = list.value.length;
  let unread = 0, notice = 0, today = 0;
  const todayStr = new Date().toISOString().slice(0, 10);
  list.value.forEach((m: any) => {
    if (!isRead(m.id)) unread++;
    if (m.type === '公告') notice++;
    if (fmtDate(m.ts) === todayStr) today++;
  });
  return [
    { label: '总消息', value: total, hint: '不含已删除' },
    { label: '未读', value: unread, hint: '本地未读标记' },
    { label: '公告', value: notice, hint: '类型=公告' },
    { label: '今日发布', value: today, hint: '当天新建' },
  ];
});

function onFilter() { page.value = 1; }
function onReset() {
  filter.type = ''; filter.read = ''; filter.q = ''; filter.dateRange = null;
  page.value = 1;
}
function openDetail(row: any) {
  current.value = row;
  drawerVisible.value = true;
  if (!isRead(row.id)) markRead(row.id);
}
function del(id: string) {
  ElMessageBox.confirm('删除后该消息不再展示，确认？', '删除消息', { type: 'warning' }).then(() => {
    const s = getSet(DEL_KEY); s.add(id);
    localStorage.setItem(DEL_KEY, JSON.stringify(Array.from(s)));
    ElMessage.success('已删除');
    load();
  }).catch(() => {});
}
function openPublish() {
  publishForm.type = '公告'; publishForm.target = '全部用户'; publishForm.title = ''; publishForm.body = '';
  publishVisible.value = true;
}
function doPublish() {
  if (!publishForm.title.trim() || !publishForm.body.trim()) {
    ElMessage.warning('请填写标题和正文');
    return;
  }
  const r = bus()?.publishMessage?.(publishForm);
  if (r) {
    ElMessage.success('已发布');
    publishVisible.value = false;
    load();
  } else {
    ElMessage.warning('当前环境未接入 DataBus 发布接口，消息仅在本地草稿预览');
    publishVisible.value = false;
  }
}
function onExport() {
  const rows = filtered.value.map((m: any) => [m.id, m.type, m.title, m.target, isRead(m.id) ? '已读' : '未读', fmtDate(m.ts)]);
  const header = ['ID', '类型', '标题', '目标', '状态', '时间'];
  const csv = '\uFEFF' + [header, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = '消息中心.csv';
  a.click();
}
function onBusChange() { load(); }
onMounted(() => {
  load();
  window.addEventListener('engchain:messages', onBusChange);
});
onUnmounted(() => {
  window.removeEventListener('engchain:messages', onBusChange);
});
</script>

<style scoped>
.page-view { padding: 0 24px 24px; display: flex; flex-direction: column; gap: 16px; }
.page-view__eyebrow { font-size: var(--font-size-xs); color: var(--font-light); text-transform: uppercase; letter-spacing: 0.05em; }
.page-view__title { font-size: var(--font-size-h1); font-weight: var(--font-weight-semibold); color: var(--font-primary); margin: 2px 0 4px; }
.page-view__sub { font-size: var(--font-size-md); color: var(--font-tertiary); }
.page-view__head { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; }
.page-view__actions { display: flex; gap: 8px; flex-shrink: 0; }
.kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
.kpi { display: flex; flex-direction: column; gap: 2px; }
.kpi__label { font-size: var(--font-size-sm); color: var(--font-tertiary); }
.kpi__value { font-size: 24px; font-weight: var(--font-weight-semibold); color: var(--font-primary); }
.kpi__hint { font-size: var(--font-size-xs); color: var(--font-light); }
.filter-bar { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; padding: 12px 16px; }
.modal-mask { position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 1000; }
.modal { background: var(--bg-primary); border-radius: 8px; width: 480px; max-width: 90vw; }
.modal-title { padding: 16px 20px; font-size: 16px; font-weight: 600; border-bottom: 1px solid var(--border-light); }
.modal-body { padding: 20px; display: flex; flex-direction: column; gap: 16px; }
.form-group { display: flex; flex-direction: column; gap: 6px; }
.form-group label { font-size: 13px; color: var(--font-tertiary); }
.form-input { padding: 8px 12px; border: 1px solid var(--border-light); border-radius: 4px; font-size: 14px; background: var(--bg-secondary); color: var(--font-primary); }
.modal-footer { padding: 12px 20px; display: flex; gap: 8px; justify-content: flex-end; border-top: 1px solid var(--border-light); }
.table-card { padding: 0; overflow: hidden; }
.cell-main { color: var(--font-primary); line-height: 1.3; display: flex; gap: 6px; align-items: center; }
.cell-sub { font-size: var(--font-size-sm); color: var(--font-tertiary); margin-top: 2px; }
.dot-unread { width: 8px; height: 8px; border-radius: 50%; background: var(--color-blue); flex-shrink: 0; }
.ops { display: flex; gap: 4px; flex-wrap: wrap; }
.pager { display: flex; justify-content: flex-end; padding: 12px 16px; border-top: 1px solid var(--border-light); }
.ds-section { display: flex; flex-direction: column; gap: 8px; }
.ds-title { font-size: var(--font-size-sm); font-weight: var(--font-weight-semibold); color: var(--font-light); text-transform: uppercase; letter-spacing: 0.05em; }
.ds-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.ds-item { display: flex; flex-direction: column; gap: 2px; padding: 6px 8px; border-radius: var(--radius-sm); background: var(--bg-secondary); }
.ds-item.ds-full { grid-column: 1 / -1; }
.ds-k { font-size: var(--font-size-xs); color: var(--font-light); }
.ds-v { font-size: var(--font-size-md); color: var(--font-primary); }
.ds-desc { font-size: var(--font-size-md); color: var(--font-secondary); line-height: 1.5; padding: 8px 12px; background: var(--bg-secondary); border-radius: var(--radius-sm); }
</style>

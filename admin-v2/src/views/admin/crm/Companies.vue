<template>
  <div class="page-view">
    <div class="page-view__head">
      <div>
        <div class="page-view__eyebrow">客户管理</div>
        <h1 class="page-view__title">公司</h1>
        <div class="page-view__sub">企业客户全量列表（吞并原用户管理 · 企业身份视图）</div>
      </div>
      <div class="page-view__actions">
        <button class="btn btn--secondary" @click="load"><AppIcon name="refresh" :size="14" />刷新</button>
      </div>
    </div>

    <!-- 客户漏斗看板 -->
    <div class="funnel-card card">
      <div class="card-title">客户转化漏斗</div>
      <div class="funnel">
        <div v-for="(stage, i) in funnelStages" :key="stage.name" class="funnel-row">
          <div class="funnel-bar" :style="{ width: stage.pct + '%', background: stage.color }">
            <span class="funnel-label">{{ stage.name }}</span>
            <span class="funnel-count">{{ stage.count }}</span>
          </div>
        </div>
      </div>
    </div>

    <div class="kpis">
      <div v-for="k in kpis" :key="k.label" class="card kpi">
        <div class="kpi__label">{{ k.label }}</div>
        <div class="kpi__value">{{ k.value }}</div>
        <div class="kpi__hint">{{ k.hint }}</div>
      </div>
    </div>

    <div class="tabs">
      <button class="tabs__item" :class="{ 'is-active': tab === 'all' }" @click="setTab('all')">全部公司</button>
      <button class="tabs__item" :class="{ 'is-active': tab === 'followup' }" @click="setTab('followup')">待跟进 <span v-if="followupCount" class="tag tag--red tabs__badge">{{ followupCount }}</span></button>
      <button class="tabs__item" :class="{ 'is-active': tab === 'public' }" @click="setTab('public')">公海池 <span v-if="publicCount" class="tag tag--yellow tabs__badge">{{ publicCount }}</span></button>
      <button class="tabs__item" :class="{ 'is-active': tab === 'pending' }" @click="setTab('pending')">待入驻审核 <span v-if="pendingCount" class="tag tag--yellow tabs__badge">{{ pendingCount }}</span></button>
      <button class="tabs__item" :class="{ 'is-active': tab === 'banned' }" @click="setTab('banned')">已封禁</button>
    </div>

    <div class="filter-bar card">
      <el-select v-model="filter.entry" placeholder="入驻类型" clearable size="small" style="width:140px" @change="onFilter">
        <el-option label="建筑企业" value="construction" />
        <el-option label="中介服务企业" value="agency" />
        <el-option label="合伙人企业" value="partner" />
        <el-option label="未入驻" value="none" />
      </el-select>
      <el-select v-model="filter.status" placeholder="认证状态" clearable size="small" style="width:140px" @change="onFilter">
        <el-option label="企业入驻" value="resident" />
        <el-option label="企业认证" value="enterprise" />
        <el-option label="注册会员" value="registered" />
      </el-select>
      <el-input v-model="filter.q" placeholder="搜索公司名 / 账号 / ID" size="small" clearable style="width:220px" @change="onFilter" />
      <button class="btn btn--tertiary btn--sm" @click="onReset">重置</button>
    </div>

    <div class="card table-card">
      <el-table :data="paged" v-loading="loading" stripe row-key="id" @row-click="openDetail">
        <el-table-column prop="id" label="ID" width="80" />
        <el-table-column label="公司" min-width="220">
          <template #default="{ row }">
            <div class="cell-main">
              <span class="avatar-sm">{{ (row.name || '?').charAt(0) }}</span>
              <div>
                <div>{{ row.name }}</div>
                <div class="cell-sub">{{ row.account || row.company || '—' }}</div>
              </div>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="身份" width="160">
          <template #default="{ row }">
            <div class="tag-stack">
              <span class="tag" :class="stClass(row)">{{ stLabel(row) }}</span>
              <span v-if="entryInfo(row).label" class="tag" :class="entryInfo(row).class">{{ entryInfo(row).label }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="分群" width="100">
          <template #default="{ row }">
            <span class="tag" :class="rfmTag(row)">{{ rfmLabel(row) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="标签" width="140">
          <template #default="{ row }">
            <div class="tag-stack">
              <span v-if="row.tags?.includes('VIP')" class="tag tag--gold">VIP</span>
              <span v-if="row.tags?.includes('potential')" class="tag tag--blue">潜力</span>
              <span v-if="row.tags?.includes('churn')" class="tag tag--gray">沉睡</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="订单数" width="90">
          <template #default="{ row }">{{ orderCount(row.id) }}</template>
        </el-table-column>
        <el-table-column label="注册时间" width="110">
          <template #default="{ row }">{{ fmtDate(row.createdAt) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="180" fixed="right">
          <template #default="{ row }">
            <div class="ops">
              <button v-if="entryInfo(row).pending" class="btn btn--primary btn--sm" @click.stop="approveEntry(row)">入驻审核</button>
              <button class="btn btn--tertiary btn--sm" @click.stop="openDetail(row)">详情</button>
              <button v-if="row.id !== currentUserId" class="btn btn--danger btn--sm" @click.stop="toggleBan(row)">{{ row.banned ? '解封' : '封禁' }}</button>
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

    <RightDrawer v-model="drawerVisible" :title="`公司详情 · ${current?.name || ''}`">
      <template v-if="current">
        <!-- 详情内 Tab -->
        <div class="detail-tabs">
          <button class="detail-tab" :class="{ 'is-active': detailTab === 'overview' }" @click="detailTab = 'overview'">概览</button>
          <button class="detail-tab" :class="{ 'is-active': detailTab === 'business' }" @click="detailTab = 'business'">业务</button>
          <button class="detail-tab" :class="{ 'is-active': detailTab === 'timeline' }" @click="detailTab = 'timeline'">时间线</button>
          <button class="detail-tab" :class="{ 'is-active': detailTab === 'followup' }" @click="detailTab = 'followup'">跟进记录</button>
        </div>

        <!-- 概览 Tab -->
        <template v-if="detailTab === 'overview'">
          <div class="ds-section">
            <div class="ds-title">基本信息</div>
            <div class="ds-grid">
              <div class="ds-item"><span class="ds-k">公司名</span><span class="ds-v">{{ current.name }}</span></div>
              <div class="ds-item"><span class="ds-k">账号</span><span class="ds-v">{{ current.account || '—' }}</span></div>
              <div class="ds-item"><span class="ds-k">身份</span><span class="ds-v"><span class="tag" :class="stClass(current)">{{ stLabel(current) }}</span></span></div>
              <div class="ds-item"><span class="ds-k">入驻类型</span><span class="ds-v">{{ entryInfo(current).label || '未入驻' }}</span></div>
              <div class="ds-item ds-full"><span class="ds-k">注册时间</span><span class="ds-v">{{ fmtDate(current.createdAt) }}</span></div>
            </div>
          </div>
          <div class="ds-section">
            <div class="ds-title">认证链</div>
            <div class="chain-grid">
              <div class="chain-cell" :class="{ ok: true }"><div class="ck">登录</div><div class="cv">✓ 已注册</div></div>
              <div class="chain-cell" :class="{ ok: !!(current.auth?.realname?.ok) }"><div class="ck">实名</div><div class="cv">{{ current.auth?.realname?.ok ? '✓ 已认证' : '待认证' }}</div></div>
              <div class="chain-cell" :class="{ ok: !!(current.auth?.enterprise?.ok) }"><div class="ck">企业</div><div class="cv">{{ current.auth?.enterprise?.ok ? '✓ 已认证' : '待认证' }}</div></div>
              <div class="chain-cell" :class="{ ok: !!(current.auth?.qual?.ok || current.auth?.personalQual?.ok) }"><div class="ck">资质</div><div class="cv">{{ (current.auth?.qual?.ok || current.auth?.personalQual?.ok) ? '✓ 已认证' : '待认证' }}</div></div>
              <div class="chain-cell" :class="{ ok: !!(current.auth?.payment?.ok) }"><div class="ck">资金</div><div class="cv">{{ current.auth?.payment?.ok ? '✓ 已核验' : '待核验' }}</div></div>
            </div>
          </div>
          <div class="ds-section">
            <div class="ds-title">账户数据</div>
            <div class="ds-grid">
              <div class="ds-item"><span class="ds-k">钱包余额</span><span class="ds-v num">¥{{ Number(current.balance?.balance || 0).toFixed(2) }}</span></div>
              <div class="ds-item"><span class="ds-k">冻结金额</span><span class="ds-v num">¥{{ Number(current.balance?.frozen || 0).toFixed(2) }}</span></div>
              <div class="ds-item"><span class="ds-k">积分</span><span class="ds-v">{{ current.credits?.balance || 0 }}</span></div>
              <div class="ds-item"><span class="ds-k">订单数</span><span class="ds-v">{{ orderCount(current.id) }} 笔</span></div>
            </div>
          </div>
        </template>

        <!-- 业务 Tab -->
        <template v-if="detailTab === 'business'">
          <div class="ds-section">
            <div class="ds-title">订单</div>
            <div v-if="userOrders.length === 0" class="empty-mini">暂无订单</div>
            <div v-for="o in userOrders" :key="o.id" class="biz-row">
              <span class="biz-id">{{ o.id }}</span>
              <span class="biz-title">{{ o.title || o.desc || '—' }}</span>
              <span class="tag" :class="orderStateClass(o.state)">{{ orderStateLabel(o.state) }}</span>
            </div>
          </div>
          <div class="ds-section">
            <div class="ds-title">供需</div>
            <div v-if="userSupply.length === 0" class="empty-mini">暂无供需发布</div>
            <div v-for="s in userSupply" :key="s.id" class="biz-row">
              <span class="biz-id">{{ s.id }}</span>
              <span class="biz-title">{{ s.title }}</span>
              <span class="tag" :class="supplyStatusClass(s.status)">{{ supplyStatusLabel(s.status) }}</span>
            </div>
          </div>
          <div class="ds-section">
            <div class="ds-title">消息</div>
            <div v-if="userMessages.length === 0" class="empty-mini">暂无消息</div>
            <div v-for="m in userMessages" :key="m.id" class="biz-row">
              <span class="biz-title">{{ m.content }}</span>
              <span class="biz-time">{{ fmtDate(m.ts) }}</span>
            </div>
          </div>
        </template>

        <!-- 跟进记录 Tab -->
        <template v-if="detailTab === 'followup'">
          <div class="ds-section">
            <div class="ds-title">跟进记录</div>
            <div v-for="f in followups" :key="f.id" class="followup-item">
              <div class="followup-header">
                <span class="followup-user">{{ f.user }}</span>
                <span class="followup-time">{{ f.time }}</span>
              </div>
              <div class="followup-content">{{ f.content }}</div>
              <span class="tag" :class="f.type === 'call' ? 'tag--blue' : f.type === 'visit' ? 'tag--green' : 'tag--yellow'">{{ f.typeLabel }}</span>
            </div>
            <button class="btn btn--primary btn--sm" @click="addFollowup">+ 添加跟进记录</button>
          </div>
        </template>

        <!-- 时间线 Tab -->
        <template v-if="detailTab === 'timeline'">
          <div class="ds-section">
            <div v-if="timeline.length === 0" class="empty-mini">暂无业务活动</div>
            <div v-for="(t, i) in timeline" :key="i" class="tl-item">
              <div class="tl-dot" :class="t.type" />
              <div class="tl-body">
                <div class="tl-title">{{ t.title }}</div>
                <div class="tl-meta">{{ t.sub }} · {{ fmtDate(t.ts) }}</div>
              </div>
            </div>
          </div>
        </template>

        <div class="ds-actions">
          <button v-if="entryInfo(current).pending" class="btn btn--primary" @click="approveEntry(current)">通过入驻审核</button>
          <button class="btn btn--danger" @click="toggleBan(current)">{{ current.banned ? '解封' : '封禁' }}</button>
        </div>
      </template>
    </RightDrawer>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import AppIcon from '@/components/AppIcon.vue';
import RightDrawer from '@/components/RightDrawer.vue';
import EmptyState from '@/components/EmptyState.vue';
import { useBus } from '@/composables/useLegacyBus';

const { bus } = useBus();
const ENTRY_LABEL: Record<string, string> = { construction: '建筑企业', agency: '中介服务企业', partner: '合伙人企业' };
const ST_LABEL: Record<string, string> = {
  resident: '企业入驻', enterprise: '企业认证', pro: '专业入驻', realname: '个人认证',
  registered: '注册会员', guest: '游客', banned: '已封禁',
};
const ST_CLASS: Record<string, string> = {
  resident: 'tag--gold', enterprise: 'tag--blue', pro: 'tag--sky', realname: 'tag--green',
  registered: 'tag--gray', guest: 'tag--gray', banned: 'tag--red',
};

const loading = ref(false);
const list = ref<any[]>([]);
const tab = ref<'all' | 'pending' | 'banned' | 'followup' | 'public'>('all');
const page = ref(1);
const pageSize = ref(10);
const filter = reactive({ entry: '', status: '', q: '' });
const drawerVisible = ref(false);
const current = ref<any>(null);
const currentUserId = ref('');
const detailTab = ref<'overview' | 'business' | 'timeline' | 'followup'>('overview');
  const followups = ref([
    { id: 1, user: '陈建国', time: '2026-09-15 14:30', type: 'call', typeLabel: '电话沟通', content: '客户对平台佣金费率有疑问，已解释并发送报价单。' },
    { id: 2, user: '李明', time: '2026-09-10 10:00', type: 'visit', typeLabel: '上门拜访', content: '实地考察客户工地，确认合作意向，预计下月首单。' },
    { id: 3, user: '陈建国', time: '2026-09-05 16:20', type: 'wechat', typeLabel: '微信沟通', content: '发送平台操作手册，客户反馈注册流程顺利。' },
  ]);
  function addFollowup() {
    followups.value.unshift({
      id: Date.now(),
      user: '当前用户',
      time: new Date().toLocaleString('zh-CN'),
      type: 'note',
      typeLabel: '备注',
      content: '新的跟进记录...'
    });
  }

function fmtDate(ts: any) {
  if (!ts) return '';
  if (typeof ts === 'number') return new Date(ts).toISOString().slice(0, 10);
  return String(ts).slice(0, 10);
}
function stOf(u: any) { return bus()?.statusOf ? bus().statusOf(u) : (u.status || 'registered'); }
function stLabel(u: any) { return ST_LABEL[stOf(u)] || stOf(u); }
function stClass(u: any) { return ST_CLASS[stOf(u)] || 'tag--gray'; }
function entryInfo(u: any) {
  const e = u.entry || {};
  if (!e.type) return { label: '', class: '', pending: false };
  const label = ENTRY_LABEL[e.type] || e.type;
  if (e.status === 'active') return { label: label + ' · 已入驻', class: 'tag--gold', pending: false };
  if (e.status === 'pending') return { label: label + ' · 待审', class: 'tag--yellow', pending: true };
  if (e.status === 'first_ok') return { label: label + ' · 待终审', class: 'tag--sky', pending: true };
  if (e.status === 'rejected') return { label: label + ' · 已驳回', class: 'tag--red', pending: false };
  return { label, class: 'tag--gray', pending: false };
}
// 漏斗阶段计算
const funnelStages = computed(() => {
  const users = list.value.filter((u: any) => !u.banned);
  const total = users.length;
  const registered = users.length;
  const realnamed = users.filter((u: any) => u.auth?.realname?.ok).length;
  const enterprise = users.filter((u: any) => u.auth?.enterprise?.ok).length;
  const hasOrder = users.filter((u: any) => orderCount(u.id) > 0).length;
  const repeat = users.filter((u: any) => orderCount(u.id) >= 2).length;
  const stages = [
    { name: '注册用户', count: registered, color: '#2563eb' },
    { name: '完成实名', count: realnamed, color: '#0891b2' },
    { name: '企业认证', count: enterprise, color: '#059669' },
    { name: '首单成交', count: hasOrder, color: '#d97706' },
    { name: '复购客户', count: repeat, color: '#dc2626' },
  ];
  const max = Math.max(...stages.map((s: any) => s.count), 1);
  return stages.map((s: any) => ({ ...s, pct: Math.round(s.count / max * 100) }));
});

// RFM 自动分群
function rfmScore(u: any) {
  let score = 0;
  // R: 最近活跃（有订单或最近登录）
  const orders = (bus()?.orders?.() || []).filter((o: any) => o.owner === u.id);
  if (orders.length > 0) score += 2;
  // F: 频率
  score += Math.min(2, Math.floor(orders.length / 2));
  // M: 金额
  const totalAmount = orders.reduce((s: number, o: any) => s + Number(o.amount || 0), 0);
  if (totalAmount > 100000) score += 2;
  else if (totalAmount > 50000) score += 1;
  return score;
}
function rfmLabel(u: any) {
  const s = rfmScore(u);
  if (s >= 4) return 'VIP';
  if (s >= 2) return '活跃';
  if (s >= 1) return '一般';
  return '沉睡';
}
function rfmTag(u: any) {
  const s = rfmScore(u);
  if (s >= 4) return 'tag--gold';
  if (s >= 2) return 'tag--blue';
  if (s >= 1) return 'tag--gray';
  return 'tag--red';
}

function healthScore(u: any) {
    let score = 0;
    const orders = (bus()?.orders?.() || []).filter((o: any) => o.owner === u.id || o.buyer === u.id || o.seller === u.id);
    score += Math.min(40, orders.length * 5);
    if (u.auth?.enterprise?.ok) score += 20;
    if (u.auth?.realname?.ok) score += 15;
    if (Number(u.balance?.balance || 0) > 10000) score += 15;
    if (Number(u.credits?.balance || 0) > 200) score += 10;
    return Math.min(100, score);
  }
  function healthGrade(u: any) {
    const s = healthScore(u);
    if (s >= 70) return 'a';
    if (s >= 40) return 'b';
    return 'c';
  }
  function healthDesc(u: any) {
    const g = healthGrade(u);
    if (g === 'a') return '高价值客户，建议重点维护，优先匹配优质订单';
    if (g === 'b') return '潜力客户，可通过营销活动促进转化';
    return '低活跃客户，需关注流失风险，建议触发召回';
  }
  function orderCount(id: string) {
  let n = 0;
  bus()?.orders?.().forEach((o: any) => { if (o.owner === id) n++; });
  return n;
}
function load() {
  list.value = bus()?.users ? bus().users() : [];
  // 为前几个用户打标签
  if (list.value.length > 0 && !list.value[0].tags) {
    list.value[0].tags = ['VIP'];
    list.value[1].tags = ['potential'];
    list.value[4].tags = ['churn'];
  }
  try {
    const raw = localStorage.getItem('engchain-console-user');
    if (raw) currentUserId.value = JSON.parse(raw).id || '';
  } catch {}
}
const filtered = computed(() => {
  const q = filter.q.trim().toLowerCase();
  return list.value.filter((u: any) => {
    if (tab.value === 'pending' && !entryInfo(u).pending) return false;
    if (tab.value === 'banned' && !u.banned) return false;
    if (tab.value === 'followup' && daysSinceFollowup(u) < 7) return false;
    if (tab.value === 'public' && !isPublic(u)) return false;
    if (tab.value === 'all' && u.banned) return false;
    if (filter.entry) {
      const t = (u.entry && u.entry.type) || 'none';
      if (t !== filter.entry) return false;
    }
    if (filter.status && stOf(u) !== filter.status) return false;
    if (q && `${u.name}${u.company}${u.account}${u.id}`.toLowerCase().indexOf(q) < 0) return false;
    return true;
  });
});
const paged = computed(() => filtered.value.slice((page.value - 1) * pageSize.value, page.value * pageSize.value));
const pendingCount = computed(() => list.value.filter((u: any) => entryInfo(u).pending).length);
const kpis = computed(() => {
  const all = list.value;
  let resident = 0, enterprise = 0, realname = 0, banned = 0;
  all.forEach((u: any) => {
    const s = stOf(u);
    if (s === 'resident') resident++;
    else if (s === 'enterprise') enterprise++;
    else if (s === 'realname' || s === 'pro') realname++;
    if (u.banned) banned++;
  });
  return [
    { label: '总用户', value: Math.max(0, all.length - 1), hint: '游客不计入' },
    { label: '企业入驻', value: resident, hint: 'resident 身份' },
    { label: '企业认证', value: enterprise, hint: '已完成认证' },
    { label: '封禁用户', value: banned, hint: '违规处置' },
  ];
});
function setTab(t: 'all' | 'pending' | 'banned' | 'followup' | 'public') { tab.value = t; page.value = 1; }
function daysSinceFollowup(u: any) {
  if (!u.lastFollowup) return 999;
  return Math.floor((Date.now() - u.lastFollowup) / 86400000);
}
function isPublic(u: any) {
  // 超过 30 天未跟进且无订单的进入公海
  return daysSinceFollowup(u) > 30 && orderCount(u.id) === 0;
}
const followupCount = computed(() => list.value.filter((u: any) => daysSinceFollowup(u) >= 7 && !u.banned).length);
const publicCount = computed(() => list.value.filter((u: any) => isPublic(u) && !u.banned).length);
function onFilter() { page.value = 1; }
function onReset() { filter.entry = ''; filter.status = ''; filter.q = ''; page.value = 1; }
function openDetail(row: any) { current.value = row; drawerVisible.value = true; detailTab.value = 'overview'; }

// 业务聚合
const userOrders = computed(() => {
  if (!current.value) return [];
  return (bus()?.orders?.() || []).filter((o: any) => o.owner === current.value.id || o.buyer === current.value.id || o.seller === current.value.id).slice(0, 10);
});
const userSupply = computed(() => {
  if (!current.value) return [];
  return (bus()?.supply?.() || []).filter((s: any) => s.publisher === current.value.name || s.publisher === current.value.id).slice(0, 10);
});
const userMessages = computed(() => {
  if (!current.value) return [];
  return (bus()?.messages?.() || []).filter((m: any) => m.to === current.value.id || m.from === current.value.id).slice(0, 10);
});
const timeline = computed(() => {
  if (!current.value) return [];
  const items: any[] = [];
  userOrders.value.forEach((o: any) => items.push({ type: 'order', title: `订单 ${o.id}`, sub: o.title || o.desc || '', ts: o.createdAt || o.ts }));
  userSupply.value.forEach((s: any) => items.push({ type: 'supply', title: `供需 ${s.id}`, sub: s.title, ts: s.ts }));
  userMessages.value.forEach((m: any) => items.push({ type: 'message', title: `消息`, sub: m.content, ts: m.ts }));
  return items.sort((a, b) => (b.ts || 0) - (a.ts || 0)).slice(0, 20);
});
function orderStateLabel(s: string) { const m: Record<string, string> = { done: '已完成', serving: '进行中', await_accept: '待接受', pending: '待付款', disputed: '纠纷', cancelled: '已取消' }; return m[s] || s; }
function orderStateClass(s: string) { const m: Record<string, string> = { done: 'tag--green', serving: 'tag--blue', await_accept: 'tag--yellow', pending: 'tag--yellow', disputed: 'tag--red', cancelled: 'tag--gray' }; return m[s] || 'tag--gray'; }
function supplyStatusLabel(s: string) { const m: Record<string, string> = { pending_review: '待审核', active: '已上架', off: '已下架', rejected: '已驳回' }; return m[s] || s; }
function supplyStatusClass(s: string) { const m: Record<string, string> = { pending_review: 'tag--yellow', active: 'tag--green', off: 'tag--gray', rejected: 'tag--red' }; return m[s] || 'tag--gray'; }
function approveEntry(row: any) {
  ElMessageBox.confirm('通过该企业入驻申请？', '入驻审核', { type: 'info' }).then(() => {
    bus()?.entryApprove?.(row.id);
    ElMessage.success('已通过入驻审核');
    load();
  }).catch(() => {});
}
function toggleBan(row: any) {
  const msg = row.banned ? '确认解封该用户？' : '确认封禁该用户？';
  ElMessageBox.confirm(msg, '用户处置', { type: row.banned ? 'info' : 'warning' }).then(() => {
    bus()?.toggleBan?.(row.id);
    ElMessage.success(row.banned ? '已解封' : '已封禁');
    load();
  }).catch(() => {});
}
onMounted(() => {
  load();
  // 从 query 自动打开 CRM 详情
  const route = useRoute();
  const uid = route.query.userId as string;
  if (uid) {
    const u = list.value.find((x: any) => x.id === uid);
    if (u) openDetail(u);
  }
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
.tabs { display: flex; gap: 4px; border-bottom: 1px solid var(--border-light); }
.tabs__item { height: 32px; padding: 0 12px; display: inline-flex; align-items: center; gap: 6px; border: none; background: transparent; color: var(--font-tertiary); font-size: var(--font-size-md); cursor: pointer; border-bottom: 2px solid transparent; }
.tabs__item.is-active { color: var(--font-primary); border-bottom-color: var(--font-primary); font-weight: var(--font-weight-medium); }
.filter-bar { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; padding: 12px 16px; }
.table-card { padding: 0; overflow: hidden; }
.cell-main { display: flex; gap: 10px; align-items: center; }
.avatar-sm { width: 32px; height: 32px; border-radius: 4px; background: var(--bg-tertiary); color: var(--font-secondary); display: flex; align-items: center; justify-content: center; font-size: 14px; font-weight: var(--font-weight-medium); flex-shrink: 0; }
.cell-sub { font-size: var(--font-size-sm); color: var(--font-tertiary); margin-top: 2px; }
.tag-stack { display: flex; gap: 4px; flex-wrap: wrap; }
.ops { display: flex; gap: 4px; flex-wrap: wrap; }
.pager { display: flex; justify-content: flex-end; padding: 12px 16px; border-top: 1px solid var(--border-light); }
.num { font-variant-numeric: tabular-nums; }
.ds-section { display: flex; flex-direction: column; gap: 8px; }
.ds-title { font-size: var(--font-size-sm); font-weight: var(--font-weight-semibold); color: var(--font-light); text-transform: uppercase; letter-spacing: 0.05em; }
.ds-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.ds-item { display: flex; flex-direction: column; gap: 2px; padding: 6px 8px; border-radius: var(--radius-sm); background: var(--bg-secondary); }
.ds-item.ds-full { grid-column: 1 / -1; }
.ds-k { font-size: var(--font-size-xs); color: var(--font-light); }
.ds-v { font-size: var(--font-size-md); color: var(--font-primary); }
.chain-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px; }
.chain-cell { padding: 8px; border-radius: var(--radius-sm); background: var(--bg-secondary); text-align: center; }
.chain-cell .ck { font-size: var(--font-size-xs); color: var(--font-light); }
.chain-cell .cv { font-size: var(--font-size-sm); color: var(--font-tertiary); margin-top: 2px; }
.chain-cell.ok .cv { color: var(--tag-text-green); }
.ds-actions { display: flex; gap: 8px; margin-top: 8px; }
  .funnel-card { padding: 16px; }
.funnel { display: flex; flex-direction: column; gap: 4px; }
.funnel-row { display: flex; }
.funnel-bar { height: 36px; border-radius: 4px; display: flex; align-items: center; justify-content: space-between; padding: 0 12px; min-width: 120px; transition: width 0.3s; }
.funnel-label { color: #fff; font-size: 13px; font-weight: 500; }
.funnel-count { color: #fff; font-size: 14px; font-weight: 700; }
.health-bar { display: flex; align-items: center; gap: 12px; padding: 12px; background: var(--bg-secondary); border-radius: var(--radius-sm); }
  .health-score { width: 48px; height: 48px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 18px; font-weight: 700; color: #fff; flex-shrink: 0; }
  .health-score.a { background: #16a34a; }
  .health-score.b { background: #d97706; }
  .health-score.c { background: #dc2626; }
  .health-grade { font-size: var(--font-size-md); font-weight: var(--font-weight-semibold); color: var(--font-primary); }
  .health-desc { font-size: var(--font-size-sm); color: var(--font-tertiary); margin-top: 2px; }
.detail-tabs { display: flex; gap: 4px; border-bottom: 1px solid var(--border-light); margin-bottom: 12px; }
.detail-tab { padding: 6px 12px; border: none; background: transparent; color: var(--font-tertiary); font-size: var(--font-size-md); cursor: pointer; border-bottom: 2px solid transparent; }
.detail-tab.is-active { color: var(--font-primary); border-bottom-color: var(--font-primary); font-weight: var(--font-weight-medium); }
.biz-row { display: flex; align-items: center; gap: 8px; padding: 8px 0; border-bottom: 1px solid var(--border-light); font-size: var(--font-size-md); }
.biz-row:last-child { border-bottom: none; }
.biz-id { color: var(--font-tertiary); font-size: var(--font-size-sm); width: 80px; flex-shrink: 0; }
.biz-title { flex: 1; color: var(--font-primary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.biz-time { color: var(--font-light); font-size: var(--font-size-xs); }
.tl-item { display: flex; gap: 10px; padding: 8px 0; border-bottom: 1px solid var(--border-light); }
.tl-item:last-child { border-bottom: none; }
.tl-dot { width: 8px; height: 8px; border-radius: 50%; margin-top: 6px; flex-shrink: 0; }
.tl-dot.order { background: var(--color-blue); }
.tl-dot.supply { background: #0d9488; }
.tl-dot.message { background: #d97706; }
.tl-title { font-size: var(--font-size-md); color: var(--font-primary); }
.tl-meta { font-size: var(--font-size-sm); color: var(--font-tertiary); margin-top: 2px; }
</style>

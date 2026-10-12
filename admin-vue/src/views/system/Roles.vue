<script setup>
import { ref } from 'vue'
import { ElMessage } from 'element-plus'
import { useUserStore, ROLE_GROUP_MAP, ROLE_LABELS } from '@/store/user.js'
import { usePermissionStore } from '@/store/permission.js'

const userStore = useUserStore()
const permStore = usePermissionStore()

// 以 ROLE_GROUP_MAP 为唯一数据源渲染（与实际生效权限一致），补 viewer
const DESC = {
  super: '拥有全部权限，可管理所有模块',
  ops: '负责日常运营、营销、分销、电子签与系统设置',
  finance: '负责资金、分销、电子签与系统设置',
  risk: '负责合规审核、举报处理、风险监控与电子签',
  viewer: '只读，仅可查看总览与用户与认证'
}
const roles = Object.keys(ROLE_GROUP_MAP).map(key => ({
  key,
  name: ROLE_LABELS[key],
  desc: DESC[key],
  groups: [...ROLE_GROUP_MAP[key]],
  users: key === 'super' ? 1 : key === 'viewer' ? 1 : 2
}))

const expandedRows = ref(['super'])

// 编辑权限弹窗
const editVisible = ref(false)
const currentRole = ref(null)
const selectedGroups = ref([])

const allGroups = ['总览', '运营中心', '营销中心', '撮合中心', '用户与认证', '会员中心', '资金中心', '分销中心', '电子签', '风控合规', '数据分析', '系统设置']

function handleEditPermission(row) {
  currentRole.value = row
  selectedGroups.value = [...row.groups]
  editVisible.value = true
}

function handleSave() {
  currentRole.value.groups = [...selectedGroups.value]
  // 回写 store：若编辑的是当前登录角色，运行时分组与权限码即时生效
  if (currentRole.value.key === userStore.role) {
    userStore.groupOverride = [...selectedGroups.value]
  }
  permStore.setRole(currentRole.value.key)
  ElMessage.success('已保存权限配置')
  editVisible.value = false
}
</script>

<template>
  <div class="roles-page">
    <div class="page-header">
      <h2>角色权限</h2>
      <p class="page-desc">系统角色与模块权限配置</p>
    </div>

    <el-table :data="roles" :row-key="row => row.key" :expand-row-keys="expandedRows" size="default">
      <el-table-column type="expand">
        <template #default="{ row }">
          <div class="permission-detail">
            <h4>可访问模块</h4>
            <div class="permission-tags">
              <el-tag v-for="g in row.groups" :key="g" size="small" style="margin-right: 8px; margin-bottom: 8px">{{ g }}</el-tag>
            </div>
          </div>
        </template>
      </el-table-column>
      <el-table-column prop="name" label="角色名称" width="160" />
      <el-table-column prop="desc" label="描述" min-width="300" />
      <el-table-column prop="users" label="用户数" width="100" />
      <el-table-column label="操作" width="120">
        <template #default="{ row }">
          <el-button size="small" type="primary" link @click="handleEditPermission(row)">编辑权限</el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-alert
      title="说明：点击行展开查看该角色的详细模块权限"
      type="info"
      :closable="false"
      style="margin-top: 16px"
    />

    <!-- 编辑权限弹窗 -->
    <el-dialog v-model="editVisible" title="编辑角色权限" width="600px">
      <div style="margin-bottom: 16px">
        <strong>角色：</strong>{{ currentRole?.name }}
      </div>
      <div style="margin-bottom: 8px">可访问模块（勾选）：</div>
      <el-checkbox-group v-model="selectedGroups">
        <el-checkbox v-for="g in allGroups" :key="g" :value="g" style="margin-right: 16px; margin-bottom: 12px">
          {{ g }}
        </el-checkbox>
      </el-checkbox-group>
      <template #footer>
        <el-button @click="editVisible = false">取消</el-button>
        <el-button type="primary" @click="handleSave">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style lang="scss" scoped>
.roles-page {
  display: flex;
  flex-direction: column;
  gap: $spacing-lg;
}

.page-header {
  h2 {
    margin: 0;
    font-size: 20px;
    font-weight: 600;
  }
}

.page-desc {
  margin: $spacing-xs 0 0;
  font-size: 13px;
  color: $color-text-secondary;
}

.permission-detail {
  padding: $spacing-md $spacing-lg;

  h4 {
    margin: 0 0 $spacing-sm;
    font-size: 14px;
  }
}
</style>

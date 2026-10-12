<script setup>
import { ref, onMounted } from 'vue'
import api from '@/api'

const loading = ref(false)
const teams = ref([])

async function loadData() {
  loading.value = true
  try {
    teams.value = await api.distribution.listTeams()
  } finally { loading.value = false }
}

onMounted(loadData)
</script>

<template>
  <div class="team-page" v-loading="loading">
    <div class="page-header">
      <h2>团队关系树</h2>
      <p class="page-desc">分销团队层级关系</p>
    </div>
    <div class="team-tree">
      <div v-for="team in teams" :key="team.id" class="team-node">
        <div class="team-node__card">
          <div class="team-node__name">{{ team.name }}</div>
          <div class="team-node__meta">{{ team.level }}级 · {{ team.children?.length || 0 }} 下级</div>
        </div>
        <div v-if="team.children?.length" class="team-node__children">
          <div v-for="child in team.children" :key="child.id" class="team-node__child">
            {{ child.name }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.team-page { display: flex; flex-direction: column; gap: $spacing-lg; }
.page-header h2 { margin: 0; font-size: 20px; font-weight: 600; }
.page-desc { margin: $spacing-xs 0 0; font-size: 13px; color: $color-text-secondary; }
.team-tree { display: flex; flex-direction: column; gap: $spacing-lg; }
.team-node { display: flex; flex-direction: column; align-items: center;
  &__card { padding: $spacing-md $spacing-lg; background: $color-bg-container; border: 1px solid $color-primary; border-radius: $radius-md; text-align: center; }
  &__name { font-weight: 600; }
  &__meta { font-size: 12px; color: $color-text-secondary; margin-top: 2px; }
  &__children { display: flex; gap: $spacing-md; margin-top: $spacing-md; }
  &__child { padding: $spacing-sm $spacing-md; background: $color-bg-page; border: 1px solid $color-border; border-radius: $radius-sm; font-size: 13px; }
}
</style>

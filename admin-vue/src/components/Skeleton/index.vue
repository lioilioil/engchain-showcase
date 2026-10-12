<template>
  <div class="skeleton" :class="{ 'skeleton--table': variant === 'table' }">
    <!-- 表格骨架 -->
    <template v-if="variant === 'table'">
      <!-- 筛选栏骨架 -->
      <div class="skeleton__filter">
        <div v-for="i in 4" :key="i" class="skeleton__filter-item">
          <div class="skeleton__bar skeleton__bar--sm"></div>
          <div class="skeleton__bar skeleton__bar--input"></div>
        </div>
      </div>
      
      <!-- 表格骨架 -->
      <div class="skeleton__table">
        <div class="skeleton__row skeleton__row--header">
          <div v-for="i in 5" :key="i" class="skeleton__bar skeleton__bar--header"></div>
        </div>
        <div v-for="row in rows" :key="row" class="skeleton__row">
          <div v-for="i in 5" :key="i" class="skeleton__bar skeleton__bar--cell"></div>
        </div>
      </div>
    </template>

    <!-- 卡片骨架 -->
    <template v-else-if="variant === 'card'">
      <div class="skeleton__card">
        <div class="skeleton__bar skeleton__bar--title"></div>
        <div class="skeleton__bar skeleton__bar--value"></div>
        <div class="skeleton__bar skeleton__bar--desc"></div>
      </div>
    </template>

    <!-- 列表骨架 -->
    <template v-else>
      <div v-for="i in rows" :key="i" class="skeleton__list-item">
        <div class="skeleton__avatar"></div>
        <div class="skeleton__content">
          <div class="skeleton__bar skeleton__bar--title"></div>
          <div class="skeleton__bar skeleton__bar--desc"></div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
defineProps({
  variant: { type: String, default: 'list', validator: v => ['list', 'table', 'card'].includes(v) },
  rows: { type: Number, default: 5 }
})
</script>

<style lang="scss" scoped>
.skeleton {
  width: 100%;
}

// 骨架屏动画
.skeleton__bar,
.skeleton__avatar {
  background: linear-gradient(90deg, 
    var(--color-border-light) 25%, 
    var(--color-bg-hover) 50%, 
    var(--color-border-light) 75%
  );
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
  border-radius: $radius-sm;
}

@keyframes shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

// 各种尺寸
.skeleton__bar--sm { width: 60px; height: 14px; }
.skeleton__bar--input { width: 160px; height: 32px; }
.skeleton__bar--header { height: 36px; flex: 1; }
.skeleton__bar--cell { height: 20px; flex: 1; }
.skeleton__bar--title { width: 40%; height: 16px; margin-bottom: $spacing-sm; }
.skeleton__bar--value { width: 60%; height: 32px; margin-bottom: $spacing-sm; }
.skeleton__bar--desc { width: 80%; height: 12px; }

// 表格骨架
.skeleton__filter {
  display: flex;
  gap: $spacing-lg;
  margin-bottom: $spacing-lg;
  padding-bottom: $spacing-md;
  border-bottom: 1px solid var(--color-border-light);
}

.skeleton__filter-item {
  display: flex;
  align-items: center;
  gap: $spacing-sm;
}

.skeleton__table {
  width: 100%;
}

.skeleton__row {
  display: flex;
  gap: $spacing-md;
  padding: $spacing-md 0;
  border-bottom: 1px solid var(--color-border-light);
}

.skeleton__row--header {
  padding-bottom: $spacing-sm;
}

// 列表骨架
.skeleton__list-item {
  display: flex;
  align-items: center;
  gap: $spacing-md;
  padding: $spacing-md 0;
  border-bottom: 1px solid var(--color-border-light);
}

.skeleton__avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  flex-shrink: 0;
}

.skeleton__content {
  flex: 1;
}

// 卡片骨架
.skeleton__card {
  padding: $spacing-lg;
  border: 1px solid var(--color-border-light);
  border-radius: $radius-lg;
}
</style>

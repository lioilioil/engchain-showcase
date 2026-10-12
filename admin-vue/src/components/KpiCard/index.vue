<template>
  <div
    class="kpi-card"
    :class="[
      `theme-${theme}`,
      { 'is-clickable': clickable }
    ]"
    @click="onClick"
  >
    <div class="kpi-card__title">
      <span class="kpi-card__dot" />
      <span>{{ title }}</span>
    </div>

    <div class="kpi-card__main">
      <div class="kpi-card__value">{{ displayValue }}</div>
      <svg
        v-if="trendData && trendData.length >= 2"
        class="kpi-card__spark"
        :viewBox="`0 0 ${W} ${H}`"
        preserveAspectRatio="none"
      >
        <polygon :points="areaPoints" :fill="sparkColor" fill-opacity="0.1" />
        <polyline
          :points="linePoints"
          fill="none"
          :stroke="sparkColor"
          stroke-width="1.5"
          stroke-linejoin="round"
          stroke-linecap="round"
        />
      </svg>
    </div>

    <div class="kpi-card__footer">
      <span class="kpi-card__change" :class="`is-${trend}`">
        {{ trendIcon }}
        较上周 {{ changeText }}
      </span>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  title: { type: String, default: '' },
  value: { type: [Number, String], default: 0 },
  change: { type: Number, default: 0 },
  trend: { type: String, default: 'flat', validator: v => ['up', 'down', 'flat'].includes(v) },
  trendData: { type: Array, default: () => [] },
  theme: { type: String, default: 'primary', validator: v => ['primary', 'success', 'warning', 'danger'].includes(v) },
  clickable: { type: Boolean, default: false }
})

const emit = defineEmits(['click'])

const W = 80
const H = 28

const displayValue = computed(() => {
  if (typeof props.value === 'number') {
    return props.value.toLocaleString()
  }
  return props.value
})

const changeText = computed(() => {
  if (!props.change) return '0%'
  const sign = props.change > 0 ? '+' : ''
  return `${sign}${props.change}%`
})

const trendIcon = computed(() => {
  if (props.trend === 'up') return '↑'
  if (props.trend === 'down') return '↓'
  return '—'
})

const linePoints = computed(() => buildPoints(props.trendData, false))
const areaPoints = computed(() => {
  const line = buildPoints(props.trendData, false)
  if (!line) return ''
  return `${line} ${W},${H} 0,${H}`
})

const sparkColor = computed(() => {
  // 用主题色作为折线色
  if (props.theme === 'success') return '#1f883d'
  if (props.theme === 'warning') return '#d4a72c'
  if (props.theme === 'danger') return '#cf222e'
  return '#1f883d'
})

function buildPoints(arr, _area) {
  if (!arr || arr.length < 2) return ''
  const min = Math.min(...arr)
  const max = Math.max(...arr)
  const range = max - min || 1
  const stepX = W / (arr.length - 1)
  return arr
    .map((v, i) => {
      const x = +(i * stepX).toFixed(2)
      const y = +(H - 2 - ((v - min) / range) * (H - 4)).toFixed(2)
      return `${x},${y}`
    })
    .join(' ')
}

function onClick() {
  if (props.clickable) emit('click')
}
</script>

<style lang="scss" scoped>
.kpi-card {
  position: relative;
  background: var(--color-bg-container);
  border: 1px solid var(--color-border-light);
  border-radius: $radius-lg;
  padding: $spacing-lg $spacing-xl;
  box-shadow: var(--shadow-sm);
  transition: all $duration-base $ease-out;

  &.is-clickable {
    cursor: pointer;

    &:hover {
      box-shadow: var(--shadow-lg);
      transform: translateY(-2px);
      border-color: var(--color-primary-200);
    }
  }

  &__title {
    display: flex;
    align-items: center;
    font-size: $font-size-sm;
    color: var(--color-text-secondary);
    line-height: 1.6;
    font-weight: $font-weight-medium;
  }

  &__dot {
    display: inline-block;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    margin-right: $spacing-sm;
    background: var(--color-primary);
    box-shadow: 0 0 0 3px var(--color-primary-50);
  }

  &.theme-success .kpi-card__dot {
    background: var(--color-success);
    box-shadow: 0 0 0 3px var(--color-success-bg);
  }
  &.theme-warning .kpi-card__dot {
    background: var(--color-warning);
    box-shadow: 0 0 0 3px var(--color-warning-bg);
  }
  &.theme-danger  .kpi-card__dot {
    background: var(--color-danger);
    box-shadow: 0 0 0 3px var(--color-danger-bg);
  }

  &__main {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    margin-top: $spacing-sm;
  }

  &__value {
    font-size: $font-size-3xl;
    font-weight: $font-weight-bold;
    color: var(--color-text-primary);
    line-height: 1.2;
    font-variant-numeric: tabular-nums;
    letter-spacing: -0.02em;
  }

  &__spark {
    width: 80px;
    height: 28px;
    flex-shrink: 0;
  }

  &__footer {
    margin-top: $spacing-sm;
    font-size: $font-size-xs;
  }

  &__change {
    display: inline-flex;
    align-items: center;
    gap: 2px;
    padding: 2px 8px;
    border-radius: $radius-full;
    font-weight: $font-weight-medium;

    &.is-up {
      color: var(--color-success);
      background: var(--color-success-bg);
    }
    &.is-down {
      color: var(--color-danger);
      background: var(--color-danger-bg);
    }
    &.is-flat {
      color: var(--color-text-secondary);
      background: var(--color-bg-hover);
    }
  }
}
</style>

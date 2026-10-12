<template>
  <a href="#main-content" class="skip-link">跳到主内容</a>
  <router-view />
  <Onboarding />
</template>

<script setup>
import Onboarding from '@/components/Onboarding/index.vue'
</script>

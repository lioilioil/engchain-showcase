<template>
  <div class="layout-wrapper" :class="{ collapsed: sidebarCollapsed }">
    <Sidebar />
    <div class="layout-main">
      <Navbar />
      <TabsBar />
      <AppMain />
    </div>
  </div>
</template>

<script setup>
import { provide, ref } from 'vue'
import Sidebar from './Sidebar.vue'
import Navbar from './Navbar.vue'
import TabsBar from './TabsBar.vue'
import AppMain from './AppMain.vue'

const sidebarCollapsed = ref(false)
provide('sidebarCollapsed', sidebarCollapsed)
provide('toggleSidebar', () => { sidebarCollapsed.value = !sidebarCollapsed.value })
</script>

<style lang="scss" scoped>
.layout-wrapper {
  display: flex;
  height: 100vh;
  overflow: hidden;
}
.layout-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  transition: margin-left 0.28s;
}
</style>

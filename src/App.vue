<script setup lang="ts">
import { onMounted } from 'vue'
import AppHeader from './components/AppHeader.vue'
import PostComposer from './components/PostComposer.vue'
import PostFeed from './components/PostFeed.vue'
import ServerNotice from './components/ServerNotice.vue'
import { useGeolocation } from './composables/useGeolocation'
import { useFeedStore } from './stores/feed'

const feed = useFeedStore()
const { locate } = useGeolocation()

/** 定位异步进行，不阻塞首屏；失败只降级，不影响发布与浏览 */
async function requestLocation(): Promise<void> {
  feed.setLocationStatus('locating')

  const result = await locate()

  feed.setLocation(result.location)
  feed.setLocationStatus(result.status)
}

// 首屏从服务端拉取数据，加载期间信息流不展示空状态，避免闪烁
onMounted(() => {
  void feed.init()
  void requestLocation()
})
</script>

<template>
  <!-- 背景光斑：纯 CSS 渐变，仅装饰 -->
  <div class="bg-glow bg-glow-1" aria-hidden="true"></div>
  <div class="bg-glow bg-glow-2" aria-hidden="true"></div>
  <div class="bg-glow bg-glow-3" aria-hidden="true"></div>

  <div class="layout">
    <AppHeader />
    <ServerNotice />
    <PostComposer />
    <PostFeed />
  </div>
</template>

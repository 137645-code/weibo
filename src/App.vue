<script setup lang="ts">
import { onMounted } from 'vue'
import AppHeader from './components/AppHeader.vue'
import PostComposer from './components/PostComposer.vue'
import PostFeed from './components/PostFeed.vue'
import StorageNotice from './components/StorageNotice.vue'
import { useGeolocation } from './composables/useGeolocation'
import { useFeedStore } from './stores/feed'

const feed = useFeedStore()
const { locate } = useGeolocation()

// 首屏同步读取本地数据，避免空白态闪烁
feed.init()

/** 定位异步进行，不阻塞首屏；失败只降级，不影响发布与浏览 */
async function requestLocation(): Promise<void> {
  feed.setLocationStatus('locating')

  const result = await locate()

  feed.setLocation(result.location)
  feed.setLocationStatus(result.status)
}

onMounted(() => {
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
    <StorageNotice />
    <PostComposer />
    <PostFeed />
  </div>
</template>

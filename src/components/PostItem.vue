<script setup lang="ts">
import { computed, shallowRef } from 'vue'
import type { Post } from '@/types/post'
import { avatarSrc, formatTime } from '@/utils/format'

const props = defineProps<{ post: Post }>()

// 加载失败时只隐藏图片，由容器渐变兜底，不出现破图
const broken = shallowRef(false)
const time = computed(() => formatTime(props.post.createdAt))
const src = computed(() => avatarSrc(props.post.avatar))
</script>

<template>
  <li class="feed-item">
    <span class="feed-avatar">
      <img
        class="feed-avatar-img"
        :src="src"
        alt=""
        width="44"
        height="44"
        decoding="async"
        :style="broken ? { visibility: 'hidden' } : undefined"
        @error="broken = true"
      />
    </span>

    <div class="feed-main">
      <p class="feed-meta">
        <span class="feed-author">{{ props.post.author }}</span>
        <span class="feed-sep">·</span>
        <span class="feed-time">{{ time }}</span>
        <template v-if="props.post.location">
          <span class="feed-sep">·</span>
          <span class="feed-loc">{{ props.post.location }}</span>
        </template>
      </p>
      <p class="feed-content">{{ props.post.content }}</p>
    </div>
  </li>
</template>

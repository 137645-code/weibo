<script setup lang="ts">
import { computed, shallowRef } from 'vue'
import {
  FAVORITE_LABEL,
  FAVORITED_TEXT,
  FAVORITE_TEXT,
  LIKE_LABEL,
  UNFAVORITE_LABEL,
  UNLIKE_LABEL,
} from '@/constants/feed'
import type { Post } from '@/types/post'
import { avatarSrc, formatTime } from '@/utils/format'

const props = withDefaults(
  defineProps<{
    post: Post
    /** 点赞请求在途，禁用按钮避免重复计数 */
    pendingLike?: boolean
    /** 收藏请求在途 */
    pendingFavorite?: boolean
  }>(),
  { pendingLike: false, pendingFavorite: false },
)

const emit = defineEmits<{ 'toggle-like': []; 'toggle-favorite': [] }>()

// 加载失败时只隐藏图片，由容器渐变兜底，不出现破图
const broken = shallowRef(false)
const time = computed(() => formatTime(props.post.createdAt))
const src = computed(() => avatarSrc(props.post.avatar))

// 可访问名称随状态变化；视觉上的激活态交给 CSS
// 点赞按钮只有数字可见，名称里补上计数，屏幕阅读器才读得到「几个赞」
const likeLabel = computed(
  () => `${props.post.liked ? UNLIKE_LABEL : LIKE_LABEL}（${props.post.likes} 个赞）`,
)
const favoriteText = computed(() => (props.post.favorited ? FAVORITED_TEXT : FAVORITE_TEXT))
// 名称包含可见文字，避免「念可见文字却点不到」的语音控制问题
const favoriteLabel = computed(() =>
  props.post.favorited ? `${FAVORITED_TEXT}，${UNFAVORITE_LABEL}` : FAVORITE_LABEL,
)
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

      <div class="feed-actions">
        <button
          type="button"
          class="feed-action feed-action-like"
          :class="{ 'is-active': props.post.liked }"
          :aria-pressed="props.post.liked"
          :aria-label="likeLabel"
          :disabled="props.pendingLike"
          @click="emit('toggle-like')"
        >
          <svg
            class="feed-action-icon"
            viewBox="0 0 24 24"
            aria-hidden="true"
            focusable="false"
          >
            <path d="M12 20.2 4.6 12.9a4.7 4.7 0 0 1 6.6-6.7l.8.8.8-.8a4.7 4.7 0 1 1 6.6 6.7Z" />
          </svg>
          <span class="feed-action-count">{{ props.post.likes }}</span>
        </button>

        <button
          type="button"
          class="feed-action feed-action-favorite"
          :class="{ 'is-active': props.post.favorited }"
          :aria-pressed="props.post.favorited"
          :aria-label="favoriteLabel"
          :disabled="props.pendingFavorite"
          @click="emit('toggle-favorite')"
        >
          <svg
            class="feed-action-icon"
            viewBox="0 0 24 24"
            aria-hidden="true"
            focusable="false"
          >
            <path d="m12 4.2 2.3 5 5.5.8-4 3.9.9 5.5-4.7-2.5-4.7 2.5.9-5.5-4-3.9 5.5-.8Z" />
          </svg>
          <span class="feed-action-text">{{ favoriteText }}</span>
        </button>
      </div>
    </div>
  </li>
</template>

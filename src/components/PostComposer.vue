<script setup lang="ts">
import { computed, nextTick, onUnmounted, shallowRef, useTemplateRef } from 'vue'
import {
  AVATAR_INDEXES,
  DEFAULT_HINT,
  EMPTY_CONTENT_HINT,
  HINT_RESET_DELAY,
  MAX_AUTHOR_LENGTH,
  MAX_CONTENT_LENGTH,
} from '@/constants/feed'
import { useFeedStore } from '@/stores/feed'
import { avatarSrc } from '@/utils/format'

const feed = useFeedStore()

// 输入草稿：与原版一致，不持久化，发布后保留昵称与头像
const content = shallowRef('')
const author = shallowRef('')
const avatar = shallowRef(0)

const hintText = shallowRef(DEFAULT_HINT)
const hintWarn = shallowRef(false)
const textareaRef = useTemplateRef<HTMLTextAreaElement>('textarea')

let hintTimer: ReturnType<typeof setTimeout> | undefined

/** 输入区轻提示，2 秒后恢复默认文案 */
function showHint(text: string, warn = false): void {
  hintText.value = text
  hintWarn.value = warn

  if (hintTimer) clearTimeout(hintTimer)
  hintTimer = setTimeout(() => {
    hintText.value = DEFAULT_HINT
    hintWarn.value = false
  }, HINT_RESET_DELAY)
}

onUnmounted(() => {
  if (hintTimer) clearTimeout(hintTimer)
})

const locationText = computed(() => {
  switch (feed.locationStatus) {
    case 'locating':
      return '定位中…'
    case 'ready':
      return feed.location ? `已定位：${feed.location}` : ''
    case 'unavailable':
      return '位置不可用'
    default:
      return ''
  }
})

const locationWarn = computed(() => feed.locationStatus === 'unavailable')

/** 发布：校验 → 入列 → 持久化；只清空正文，保留昵称与头像便于连续发布 */
async function handleSubmit(): Promise<void> {
  const result = feed.addPost({
    content: content.value,
    author: author.value,
    avatar: avatar.value,
  })

  content.value = ''
  await nextTick()
  textareaRef.value?.focus()

  if (!result.ok) showHint(EMPTY_CONTENT_HINT, true)
}

/** 头像加载失败时隐藏图片，由容器渐变兜底 */
function hideBrokenImage(event: Event): void {
  const target = event.target as HTMLImageElement | null
  target?.classList.add('is-broken')
}
</script>

<template>
  <form class="composer" autocomplete="off" @submit.prevent="handleSubmit">
    <label class="visually-hidden" for="postInput">发布新动态</label>

    <div class="composer-fields">
      <input
        id="postAuthor"
        v-model="author"
        class="composer-name"
        type="text"
        :maxlength="MAX_AUTHOR_LENGTH"
        placeholder="昵称（可选，默认匿名用户）"
        aria-label="昵称"
      />
    </div>

    <!-- 头像选择：原生 radio，选中态由 CSS 兄弟选择器控制 -->
    <fieldset class="avatar-field">
      <legend class="visually-hidden">选择头像</legend>
      <template v-for="index in AVATAR_INDEXES" :key="index">
        <input
          :id="`av${index}`"
          v-model="avatar"
          class="avatar-radio"
          type="radio"
          name="avatar"
          :value="index"
        />
        <label class="avatar-option" :for="`av${index}`" :title="`头像 ${index + 1}`">
          <img
            :src="avatarSrc(index)"
            alt=""
            width="64"
            height="64"
            loading="lazy"
            decoding="async"
            @error="hideBrokenImage"
          />
        </label>
      </template>
    </fieldset>

    <textarea
      id="postInput"
      ref="textarea"
      v-model="content"
      class="composer-input"
      :maxlength="MAX_CONTENT_LENGTH"
      placeholder="写点什么…"
      rows="3"
    ></textarea>

    <div class="composer-actions">
      <span class="composer-meta">
        <span
          v-if="locationText"
          class="loc-status"
          :data-state="locationWarn ? 'warn' : 'normal'"
        >
          {{ locationText }}
        </span>
        <span class="hint-text" :data-state="hintWarn ? 'warn' : 'normal'">{{ hintText }}</span>
      </span>
      <button class="btn-submit" type="submit">发布</button>
    </div>
  </form>
</template>

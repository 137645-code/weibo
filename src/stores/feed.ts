import { defineStore } from 'pinia'
import { computed, ref, shallowRef } from 'vue'
import type { AddPostResult, LocationStatus, Post, PostDraft } from '@/types/post'
import { createPost } from '@/utils/post'
import { createPostStorage } from '@/utils/storage'

/**
 * 信息流状态：只持有数据与业务状态，不感知任何 UI 文案。
 * 昵称与头像属于输入草稿，留在发布组件内。
 */
export const useFeedStore = defineStore('feed', () => {
  const storage = createPostStorage()

  const posts = ref<Post[]>([])
  const storageOk = shallowRef(true)
  const location = shallowRef<string | null>(null)
  const locationStatus = shallowRef<LocationStatus>('idle')

  /** 按发布时间倒序，派生而非原地排序，避免破坏原始顺序 */
  const sortedPosts = computed(() =>
    posts.value.slice().sort((a, b) => b.createdAt - a.createdAt),
  )

  const isEmpty = computed(() => posts.value.length === 0)

  /** 首屏读取本地数据；失败时标记存储不可用，界面据此展示提示条 */
  function init(): void {
    const { list, ok } = storage.load()
    posts.value = list
    storageOk.value = ok
  }

  /**
   * 发布一条动态：校验 → 构造 → 入列 → 持久化。
   * 写入失败只降级提示，内存数据仍保留，本次会话可正常浏览。
   */
  function addPost(draft: PostDraft): AddPostResult {
    const post = createPost({ ...draft, location: draft.location ?? location.value })
    if (!post) return { ok: false, reason: 'empty' }

    posts.value = [...posts.value, post]
    if (!storage.save(posts.value)) storageOk.value = false

    return { ok: true, post }
  }

  function setLocation(city: string | null): void {
    location.value = city
  }

  function setLocationStatus(status: LocationStatus): void {
    locationStatus.value = status
  }

  return {
    // 状态
    posts,
    storageOk,
    location,
    locationStatus,
    // 派生
    sortedPosts,
    isEmpty,
    // 动作
    init,
    addPost,
    setLocation,
    setLocationStatus,
  }
})

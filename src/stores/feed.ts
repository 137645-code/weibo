import { defineStore } from 'pinia'
import { computed, ref, shallowRef } from 'vue'
import type { AddPostResult, LocationStatus, Post, PostDraft } from '@/types/post'
import { createPostApi } from '@/utils/api'

/**
 * 信息流状态：只持有数据与业务状态，不感知任何 UI 文案。
 * 数据来自后端 RESTful API，昵称与头像属于输入草稿，留在发布组件内。
 */
export const useFeedStore = defineStore('feed', () => {
  const api = createPostApi()

  const posts = ref<Post[]>([])
  /** 服务端是否可用；不可用时界面展示提示条，仍允许浏览已有数据 */
  const apiOk = shallowRef(true)
  /** 首屏加载是否结束，避免加载期间闪烁「空信息流」占位 */
  const initialized = shallowRef(false)
  /** 是否有发布请求在途，用于禁用提交按钮防止重复提交 */
  const submitting = shallowRef(false)
  const location = shallowRef<string | null>(null)
  const locationStatus = shallowRef<LocationStatus>('idle')

  /** 只接受最后一次发起的加载结果，避免旧快照覆盖新状态 */
  let loadSeq = 0
  /** 计数而非布尔，并发发布时不会提前解除禁用 */
  let pendingSubmits = 0

  /** 按发布时间倒序，派生而非原地排序，避免破坏原始顺序 */
  const sortedPosts = computed(() =>
    posts.value.slice().sort((a, b) => b.createdAt - a.createdAt),
  )

  const isEmpty = computed(() => posts.value.length === 0)

  /**
   * 首屏从服务端拉取数据。失败时标记服务不可用，界面据此展示提示条。
   * 若加载期间已有新动态发布成功（服务端快照里还没有），按 id 合并保留。
   */
  async function init(): Promise<void> {
    const seq = ++loadSeq
    const { list, ok } = await api.load()

    if (seq !== loadSeq) return

    apiOk.value = ok
    initialized.value = true
    if (!ok) return

    const known = new Set(list.map((post) => post.id))
    const localOnly = posts.value.filter((post) => !known.has(post.id))
    posts.value = [...list, ...localOnly]
  }

  /**
   * 发布一条动态：交给服务端校验与入库，成功后并入本地列表。
   * 校验失败只回原因；服务端不可用时降级标记，本次会话仍可浏览已有内容。
   */
  async function addPost(draft: PostDraft): Promise<AddPostResult> {
    pendingSubmits += 1
    submitting.value = true

    try {
      const result = await api.create({ ...draft, location: draft.location ?? location.value })

      if (result.ok) {
        posts.value = [...posts.value, result.post]
        apiOk.value = true
      } else if (result.reason === 'unavailable') {
        apiOk.value = false
      }

      return result
    } finally {
      pendingSubmits -= 1
      submitting.value = pendingSubmits > 0
    }
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
    apiOk,
    initialized,
    submitting,
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

import { defineStore } from 'pinia'
import { computed, ref, shallowRef } from 'vue'
import { EMPTY_FAVORITE_TEXT, EMPTY_FEED_TEXT } from '@/constants/feed'
import type {
  AddPostResult,
  LocationStatus,
  Post,
  PostDraft,
  PostReaction,
  SetReactionResult,
} from '@/types/post'
import { createPostApi } from '@/utils/api'

/** 信息流筛选：全部 / 仅收藏 */
export type FeedFilter = 'all' | 'favorites'

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
  const filter = shallowRef<FeedFilter>('all')
  /** 在途互动请求：`${id}:${kind}`，既禁用按钮，也阻止同一按钮重复计数 */
  const pendingReactions = ref<string[]>([])
  /** 最近一次互动是否失败，供界面给出轻提示 */
  const reactionFailed = shallowRef(false)

  /** 只接受最后一次发起的加载结果，避免旧快照覆盖新状态 */
  let loadSeq = 0
  /** 计数而非布尔，并发发布时不会提前解除禁用 */
  let pendingSubmits = 0
  /** 互动变更的自增序号：用来判断某次互动是否发生在某次加载之后 */
  let reactionEpoch = 0
  /** 每个 `${id}:${kind}` 最近一次互动的序号，完成后仍保留 */
  const reactionVersions = new Map<string, number>()

  /** 按发布时间倒序，派生而非原地排序，避免破坏原始顺序 */
  const sortedPosts = computed(() =>
    posts.value.slice().sort((a, b) => b.createdAt - a.createdAt),
  )

  /** 当前筛选下可见的动态 */
  const visiblePosts = computed(() =>
    filter.value === 'favorites'
      ? sortedPosts.value.filter((post) => post.favorited)
      : sortedPosts.value,
  )

  /** 当前筛选下是否没有内容（收藏筛选下的空态与全量空态文案不同） */
  const isEmpty = computed(() => visiblePosts.value.length === 0)

  const emptyText = computed(() =>
    filter.value === 'favorites' ? EMPTY_FAVORITE_TEXT : EMPTY_FEED_TEXT,
  )

  function reactionKey(id: string, kind: PostReaction): string {
    return `${id}:${kind}`
  }

  /** 只改指定字段：互动互不干扰，也避免整条覆盖丢字段 */
  function patchPost(id: string, patch: Partial<Post>): void {
    posts.value = posts.value.map((post) => (post.id === id ? { ...post, ...patch } : post))
  }

  function isReactionPending(id: string, kind: PostReaction): boolean {
    return pendingReactions.value.includes(reactionKey(id, kind))
  }

  /**
   * 首屏从服务端拉取数据。失败时标记服务不可用，界面据此展示提示条。
   * 若加载期间已有新动态发布成功（服务端快照里还没有），按 id 合并保留。
   *
   * 互动字段额外按「快照发起时刻」裁决：请求发出之后才发生的互动
   * （无论已结束还是在途）都用本地值覆盖快照，否则慢响应会把
   * 刚点好的点赞/收藏刷回旧状态。
   */
  async function init(): Promise<void> {
    const seq = ++loadSeq
    const epochAtStart = reactionEpoch
    const { list, ok } = await api.load()

    if (seq !== loadSeq) return

    apiOk.value = ok
    initialized.value = true
    if (!ok) return

    const known = new Set(list.map((post) => post.id))
    const localOnly = posts.value.filter((post) => !known.has(post.id))
    const changedAfterLoadStart = (id: string, kind: PostReaction): boolean =>
      (reactionVersions.get(reactionKey(id, kind)) ?? 0) > epochAtStart

    const merged = list.map((post) => {
      const local = posts.value.find((item) => item.id === post.id)
      if (!local) return post

      // 在途的互动无论何时发起都不能被快照覆盖；已完成的需要按发起时刻裁决
      const likeLocal =
        isReactionPending(post.id, 'like') || changedAfterLoadStart(post.id, 'like')
      const favoriteLocal =
        isReactionPending(post.id, 'favorite') || changedAfterLoadStart(post.id, 'favorite')
      if (!likeLocal && !favoriteLocal) return post

      return {
        ...post,
        ...(likeLocal ? { liked: local.liked, likes: local.likes } : null),
        ...(favoriteLocal ? { favorited: local.favorited } : null),
      }
    })

    posts.value = [...merged, ...localOnly]
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

  /**
   * 切换点赞 / 收藏：先乐观更新，再以服务端结果对齐本次改动的字段。
   * 失败只回滚这两个字段，不影响期间其它已成功的互动；
   * 同一按钮在途时直接忽略再次点击，避免计数被点花。
   */
  async function toggleReaction(id: string, kind: PostReaction): Promise<SetReactionResult> {
    const current = posts.value.find((post) => post.id === id)
    if (!current) return { ok: false, reason: 'not-found' }

    const key = reactionKey(id, kind)
    if (pendingReactions.value.includes(key)) return { ok: true, post: current }

    const active = kind === 'like' ? !current.liked : !current.favorited
    const before: Partial<Post> =
      kind === 'like'
        ? { liked: current.liked, likes: current.likes }
        : { favorited: current.favorited }

    patchPost(
      id,
      kind === 'like'
        ? { liked: active, likes: Math.max(0, current.likes + (active ? 1 : -1)) }
        : { favorited: active },
    )

    // 记下互动发生时刻：此后到达的旧快照不允许覆盖这一组字段
    reactionVersions.set(key, ++reactionEpoch)
    pendingReactions.value = [...pendingReactions.value, key]
    reactionFailed.value = false

    try {
      const result = await api.setReaction(id, kind, active)

      if (result.ok) {
        patchPost(
          id,
          kind === 'like'
            ? { liked: result.post.liked, likes: result.post.likes }
            : { favorited: result.post.favorited },
        )
        apiOk.value = true

        return { ok: true, post: result.post }
      }

      patchPost(id, before)
      reactionFailed.value = true
      if (result.reason === 'unavailable') apiOk.value = false

      return result
    } catch {
      // 传输层约定不抛错，这里只是兜底：任何异常都不该让界面停在乐观状态
      patchPost(id, before)
      reactionFailed.value = true
      apiOk.value = false

      return { ok: false, reason: 'unavailable' }
    } finally {
      pendingReactions.value = pendingReactions.value.filter((item) => item !== key)
    }
  }

  function setFilter(next: FeedFilter): void {
    filter.value = next
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
    filter,
    pendingReactions,
    reactionFailed,
    // 派生
    sortedPosts,
    visiblePosts,
    isEmpty,
    emptyText,
    // 动作
    init,
    addPost,
    toggleReaction,
    isReactionPending,
    setFilter,
    setLocation,
    setLocationStatus,
  }
})

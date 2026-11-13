import type { Post, PostDraft } from '../src/types/post'
import { normalizeCount, normalizeFlag } from '../src/utils/normalize'
import { createPost } from '../src/utils/post'

/** 可注入的时钟与随机源，便于测试得到确定结果 */
export interface PostStoreDeps {
  now?: () => number
  random?: () => number
}

/**
 * 内存存储的仓储契约。
 * 读取一律返回深拷贝，调用方改到的永远不是内部数据；写入由调用方先做参数校验。
 */
export interface PostStore {
  /** 按发布时间倒序返回全部动态 */
  list(): Post[]
  find(id: string): Post | undefined
  count(): number
  /** 构造并入列一条动态；正文为空属于调用方错误，直接抛错 */
  add(draft: PostDraft): Post
  /** 设置点赞状态（幂等）：返回更新后的副本，id 不存在返回 undefined */
  setLike(id: string, liked: boolean): Post | undefined
  /** 设置收藏状态（幂等）：返回更新后的副本，id 不存在返回 undefined */
  setFavorite(id: string, favorited: boolean): Post | undefined
  /** 预置数据，仅用于测试与演示 */
  seed(posts: Post[]): void
  reset(): void
}

function clone(post: Post): Post {
  return { ...post }
}

/**
 * 互动字段归一化：seed 可能来自测试或旧快照，
 * 缺字段按未点赞未收藏处理，计数不与 liked 标记自相矛盾。
 */
function normalizeReactions(post: Post): Post {
  const liked = normalizeFlag(post.liked)
  const likes = Math.max(normalizeCount(post.likes), liked ? 1 : 0)

  return { ...post, likes, liked, favorited: normalizeFlag(post.favorited) }
}

/**
 * 创建进程内存储。数据只活在当前进程，重启即清空。
 */
export function createPostStore(deps: PostStoreDeps = {}): PostStore {
  let items: Post[] = []

  /** 原地替换命中项并返回副本；未命中返回 undefined，交由路由回 404 */
  function patch(id: string, updater: (post: Post) => Post): Post | undefined {
    const index = items.findIndex((post) => post.id === id)
    if (index === -1) return undefined

    // 传副本：即使 updater 原地改字段也污染不到内部数据
    const next = updater(clone(items[index]))
    items = items.map((item, current) => (current === index ? next : item))

    return clone(next)
  }

  return {
    list(): Post[] {
      // 先反转再稳定排序：时间戳相同时，后写入的排在前面
      return items
        .map(clone)
        .reverse()
        .sort((a, b) => b.createdAt - a.createdAt)
    },

    find(id: string): Post | undefined {
      const found = items.find((post) => post.id === id)
      return found ? clone(found) : undefined
    },

    count(): number {
      return items.length
    },

    add(draft: PostDraft): Post {
      const post = createPost(draft, deps)
      if (!post) throw new Error('post content is required')

      // 同一毫秒 + 相同随机源可能撞 id，撞了就加后缀，保证 key 唯一
      let id = post.id
      let suffix = 1
      while (items.some((item) => item.id === id)) {
        suffix += 1
        id = `${post.id}_${suffix}`
      }

      const created = { ...post, id }
      items = [...items, created]

      return clone(created)
    },

    setLike(id: string, liked: boolean): Post | undefined {
      return patch(id, (post) => {
        // 幂等：目标状态与当前一致时不动计数，避免重复点击把数字刷上天
        if (post.liked === liked) return post

        const likes = Math.max(0, post.likes + (liked ? 1 : -1))
        return { ...post, liked, likes }
      })
    },

    setFavorite(id: string, favorited: boolean): Post | undefined {
      return patch(id, (post) => (post.favorited === favorited ? post : { ...post, favorited }))
    },

    seed(posts: Post[]): void {
      items = posts.map((post) => normalizeReactions(clone(post)))
    },

    reset(): void {
      items = []
    },
  }
}

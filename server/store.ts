import type { Post, PostDraft } from '../src/types/post'
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
  /** 预置数据，仅用于测试与演示 */
  seed(posts: Post[]): void
  reset(): void
}

function clone(post: Post): Post {
  return { ...post }
}

/**
 * 创建进程内存储。数据只活在当前进程，重启即清空。
 */
export function createPostStore(deps: PostStoreDeps = {}): PostStore {
  let items: Post[] = []

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

    seed(posts: Post[]): void {
      items = posts.map(clone)
    },

    reset(): void {
      items = []
    },
  }
}

/** 存储键名，带版本号，与旧版保持兼容 */
export const STORAGE_KEY = 'feed_posts_v1'

/** 昵称留空时的默认值 */
export const DEFAULT_AUTHOR = '匿名用户'

/** 本地头像数量，对应 public/avatars/avatar-01.jpg … avatar-10.jpg */
export const AVATAR_COUNT = 10

/** 正文最大长度 */
export const MAX_CONTENT_LENGTH = 500

/** 昵称最大长度 */
export const MAX_AUTHOR_LENGTH = 20

/** 城市名最大长度 */
export const MAX_LOCATION_LENGTH = 20

/** 输入区默认提示文案 */
export const DEFAULT_HINT = '最多 500 字'

/** 输入校验失败提示文案 */
export const EMPTY_CONTENT_HINT = '内容不能为空'

/** 提示文案自动恢复默认值的延时（毫秒） */
export const HINT_RESET_DELAY = 2000

/** 空信息流占位文案 */
export const EMPTY_FEED_TEXT = '还没有内容，试着发布第一条吧'

/** 存储不可用提示文案 */
export const STORAGE_NOTICE_TEXT = '当前浏览器无法保存数据，内容仅在本次会话有效。'

/** 头像索引列表，供发布区渲染单选项 */
export const AVATAR_INDEXES: number[] = Array.from(
  { length: AVATAR_COUNT },
  (_unused, index) => index,
)

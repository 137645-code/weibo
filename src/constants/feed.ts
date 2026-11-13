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

/** 正文超长提示文案 */
export const TOO_LONG_HINT = '内容超出长度限制'

/** 发布请求失败提示文案 */
export const PUBLISH_FAILED_HINT = '发布失败，请稍后再试'

/** 提示文案自动恢复默认值的延时（毫秒） */
export const HINT_RESET_DELAY = 2000

/** 空信息流占位文案 */
export const EMPTY_FEED_TEXT = '还没有内容，试着发布第一条吧'

/** 服务端不可用提示文案 */
export const API_NOTICE_TEXT = '无法连接服务器，内容暂时无法加载或发布。'

/** 头像索引列表，供发布区渲染单选项 */
export const AVATAR_INDEXES: number[] = Array.from(
  { length: AVATAR_COUNT },
  (_unused, index) => index,
)

/** 点赞按钮：未点赞 / 已点赞的可访问名称 */
export const LIKE_LABEL = '点赞'
export const UNLIKE_LABEL = '取消点赞'

/** 收藏按钮：未收藏 / 已收藏的可访问名称 */
export const FAVORITE_LABEL = '收藏'
export const UNFAVORITE_LABEL = '取消收藏'

/** 收藏按钮上的文字 */
export const FAVORITE_TEXT = '收藏'
export const FAVORITED_TEXT = '已收藏'

/** 互动请求失败提示文案 */
export const REACTION_FAILED_HINT = '操作失败，请稍后再试'

/** 信息流筛选：全部 / 仅收藏 */
export const FILTER_ALL_TEXT = '全部'
export const FILTER_FAVORITE_TEXT = '我的收藏'

/** 收藏筛选下没有内容时的占位文案 */
export const EMPTY_FAVORITE_TEXT = '还没有收藏的动态，点一下星标就能收藏'

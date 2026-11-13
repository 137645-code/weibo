<script setup lang="ts">
import { FILTER_ALL_TEXT, FILTER_FAVORITE_TEXT, REACTION_FAILED_HINT } from '@/constants/feed'
import { useFeedStore } from '@/stores/feed'
import PostItem from './PostItem.vue'

const feed = useFeedStore()
</script>

<template>
  <main>
    <div v-if="feed.posts.length > 0" class="feed-toolbar">
      <div class="feed-filters" role="group" aria-label="信息流筛选">
        <button
          type="button"
          class="filter-tab"
          :class="{ 'is-active': feed.filter === 'all' }"
          :aria-pressed="feed.filter === 'all'"
          @click="feed.setFilter('all')"
        >
          {{ FILTER_ALL_TEXT }}
        </button>
        <button
          type="button"
          class="filter-tab"
          :class="{ 'is-active': feed.filter === 'favorites' }"
          :aria-pressed="feed.filter === 'favorites'"
          @click="feed.setFilter('favorites')"
        >
          {{ FILTER_FAVORITE_TEXT }}
        </button>
      </div>
    </div>

    <p v-if="feed.reactionFailed" class="feed-alert" role="status">{{ REACTION_FAILED_HINT }}</p>

    <ul class="feed">
      <PostItem
        v-for="post in feed.visiblePosts"
        :key="post.id"
        :post="post"
        :pending-like="feed.isReactionPending(post.id, 'like')"
        :pending-favorite="feed.isReactionPending(post.id, 'favorite')"
        @toggle-like="feed.toggleReaction(post.id, 'like')"
        @toggle-favorite="feed.toggleReaction(post.id, 'favorite')"
      />
    </ul>
    <p v-if="feed.isEmpty && feed.initialized" class="empty">{{ feed.emptyText }}</p>
  </main>
</template>

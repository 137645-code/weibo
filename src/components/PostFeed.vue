<script setup lang="ts">
import { EMPTY_FEED_TEXT } from '@/constants/feed'
import { useFeedStore } from '@/stores/feed'
import PostItem from './PostItem.vue'

const feed = useFeedStore()
</script>

<template>
  <main>
    <ul class="feed">
      <PostItem v-for="post in feed.sortedPosts" :key="post.id" :post="post" />
    </ul>
    <p v-if="feed.isEmpty" class="empty">{{ EMPTY_FEED_TEXT }}</p>
  </main>
</template>

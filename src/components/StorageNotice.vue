<script setup lang="ts">
import { STORAGE_NOTICE_TEXT } from '@/constants/feed'
import { useFeedStore } from '@/stores/feed'

const feed = useFeedStore()
</script>

<template>
  <p v-if="!feed.storageOk" class="notice is-visible" role="status">
    {{ STORAGE_NOTICE_TEXT }}
  </p>
</template>

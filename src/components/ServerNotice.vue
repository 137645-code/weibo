<script setup lang="ts">
import { API_NOTICE_TEXT } from '@/constants/feed'
import { useFeedStore } from '@/stores/feed'

const feed = useFeedStore()
</script>

<template>
  <p v-if="!feed.apiOk" class="notice is-visible" role="status">
    {{ API_NOTICE_TEXT }}
  </p>
</template>

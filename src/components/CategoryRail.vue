<script setup lang="ts">
import { ChevronRight } from 'lucide-vue-next'
import type { BookmarkCategoryViewItem } from '../types/bookmark'

defineProps<{
  categories: readonly BookmarkCategoryViewItem[]
  activeCategoryId: string
}>()

const emit = defineEmits<{
  select: [category: BookmarkCategoryViewItem]
  toggle: [categoryId: string]
  move: [categoryId: string, direction: 'up' | 'down']
}>()

function moveCategory(categoryId: string, direction: 'up' | 'down') {
  emit('move', categoryId, direction)
}

function displayCategoryName(name: string) {
  return splitCategorySegment(name).at(-1) ?? name
}

function displayCategoryPath(path: readonly string[]) {
  return path.flatMap(segment => splitCategorySegment(segment)).join(' / ')
}

function splitCategorySegment(segment: string) {
  return segment
    .split(/[\/／]+/)
    .map(part => part.trim())
    .filter(Boolean)
}
</script>

<template>
  <nav class="category-rail" aria-label="书签分类">
    <article
      v-for="category in categories"
      :key="category.id"
      class="category-button"
      :class="{
        'is-active': category.id === activeCategoryId,
        'is-child': category.depth > 0,
        'is-expanded': category.isExpanded,
      }"
      :style="{ '--accent': category.accent, '--tree-indent': `${Math.max(0, category.depth - 1) * 16}px` }"
    >
      <button
        v-if="category.hasChildren"
        class="category-toggle"
        type="button"
        :style="{ '--depth': category.depth }"
        :aria-label="category.isExpanded ? `${displayCategoryName(category.name)} 收起` : `${displayCategoryName(category.name)} 展开`"
        :aria-expanded="category.isExpanded"
        @click="emit('toggle', category.id)"
      >
        <ChevronRight :size="14" />
      </button>
      <span
        v-else
        class="category-toggle-spacer"
        :style="{ '--depth': category.depth }"
        aria-hidden="true"
      />
      <button
        class="category-button__main"
        type="button"
        @click="emit('select', category)"
      >
        <span class="category-index">{{ String(category.links.length).padStart(2, '0') }}</span>
        <span class="category-name">{{ displayCategoryName(category.name) }}</span>
        <span class="category-path">{{ displayCategoryPath(category.path) }}</span>
      </button>
      <span
        v-if="category.siblingCount > 1"
        class="category-sort-actions"
        aria-label="分类排序"
      >
        <button
          class="category-sort-action category-sort-action--up"
          type="button"
          :aria-label="`${displayCategoryName(category.name)} 前移`"
          :disabled="category.siblingIndex === 0"
          @click="moveCategory(category.id, 'up')"
        >
          <span class="cyber-arrow cyber-arrow--up" aria-hidden="true">
            <span class="cyber-arrow__beam" />
            <span class="cyber-arrow__head" />
            <span class="cyber-arrow__tail" />
          </span>
        </button>
        <button
          class="category-sort-action category-sort-action--down"
          type="button"
          :aria-label="`${displayCategoryName(category.name)} 后移`"
          :disabled="category.siblingIndex === category.siblingCount - 1"
          @click="moveCategory(category.id, 'down')"
        >
          <span class="cyber-arrow cyber-arrow--down" aria-hidden="true">
            <span class="cyber-arrow__beam" />
            <span class="cyber-arrow__head" />
            <span class="cyber-arrow__tail" />
          </span>
        </button>
      </span>
      <span v-else class="category-sort-spacer" aria-hidden="true" />
    </article>
  </nav>
</template>

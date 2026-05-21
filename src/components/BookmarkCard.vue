<script setup lang="ts">
import type { BookmarkLink } from '../types/bookmark'
import { Copy, ExternalLink, MoreHorizontal, PanelTopOpen, Star } from 'lucide-vue-next'
import { computed, nextTick, onMounted, onUnmounted, shallowRef, useTemplateRef } from 'vue'
import { useI18n } from 'vue-i18n'

const props = defineProps<{
  link: BookmarkLink
  isFavorite: boolean
}>()

const emit = defineEmits<{
  open: [link: BookmarkLink]
  openCurrent: [link: BookmarkLink]
  openWindow: [link: BookmarkLink]
  copy: [link: BookmarkLink]
  toggleFavorite: [link: BookmarkLink]
}>()

const { t } = useI18n()

const failedFaviconIds = shallowRef(new Set<string>())
const isMenuOpen = shallowRef(false)
const moreRef = useTemplateRef<HTMLElement>('moreRef')
const menuRef = useTemplateRef<HTMLElement>('menuRef')
const menuPosition = shallowRef({ top: 0, left: 0, minWidth: 132 })
const faviconSource = computed(() => faviconUrl(props.link.url))
const shouldShowFallback = computed(() => !faviconSource.value || failedFaviconIds.value.has(props.link.id))
const menuStyle = computed(() => ({
  top: `${menuPosition.value.top}px`,
  left: `${menuPosition.value.left}px`,
  minWidth: `${menuPosition.value.minWidth}px`,
}))

let closeTimer = 0

onMounted(() => {
  document.addEventListener('pointerdown', closeMenuOnOutsidePointer, true)
  document.addEventListener('keydown', closeMenuOnEscape)
  window.addEventListener('resize', closeMenu)
  window.addEventListener('scroll', closeMenu, true)
})

onUnmounted(() => {
  clearCloseTimer()
  document.removeEventListener('pointerdown', closeMenuOnOutsidePointer, true)
  document.removeEventListener('keydown', closeMenuOnEscape)
  window.removeEventListener('resize', closeMenu)
  window.removeEventListener('scroll', closeMenu, true)
})

function faviconUrl(url: string) {
  const faviconBase = globalThis.chrome?.runtime?.getURL?.('/_favicon/')

  if (!faviconBase) {
    return ''
  }

  const params = new URLSearchParams({
    pageUrl: url,
    size: '64',
  })

  return `${faviconBase}?${params.toString()}`
}

function faviconFallback(domain: string) {
  return domain.charAt(0).toUpperCase()
}

function markFaviconFailed(id: string) {
  failedFaviconIds.value = new Set([...failedFaviconIds.value, id])
}

function toggleFavorite(event: MouseEvent | KeyboardEvent) {
  event.stopPropagation()
  emit('toggleFavorite', props.link)
}

function emitAction(event: MouseEvent | KeyboardEvent, action: 'openCurrent' | 'openWindow' | 'copy') {
  event.stopPropagation()
  closeMenu()

  if (action === 'openCurrent') {
    emit('openCurrent', props.link)
    return
  }

  if (action === 'openWindow') {
    emit('openWindow', props.link)
    return
  }

  emit('copy', props.link)
}

function toggleMenu(event: MouseEvent | KeyboardEvent) {
  event.stopPropagation()

  if (isMenuOpen.value) {
    closeMenu()
    return
  }

  openMenu()
}

async function openMenu() {
  clearCloseTimer()
  updateMenuPosition()
  isMenuOpen.value = true
  await nextTick()
  updateMenuPosition()
}

function closeMenu() {
  clearCloseTimer()
  isMenuOpen.value = false
}

function closeMenuSoon() {
  clearCloseTimer()
  closeTimer = window.setTimeout(() => {
    isMenuOpen.value = false
  }, 120)
}

function clearCloseTimer() {
  if (!closeTimer) {
    return
  }

  window.clearTimeout(closeTimer)
  closeTimer = 0
}

function updateMenuPosition() {
  const trigger = moreRef.value

  if (!trigger) {
    return
  }

  const rect = trigger.getBoundingClientRect()
  const width = menuRef.value?.offsetWidth ?? 168
  const left = Math.min(
    Math.max(12, rect.right - width),
    window.innerWidth - width - 12,
  )

  menuPosition.value = {
    top: rect.bottom + 8,
    left,
    minWidth: Math.max(148, rect.width),
  }
}

function closeMenuOnOutsidePointer(event: PointerEvent) {
  if (!isMenuOpen.value) {
    return
  }

  const target = event.target

  if (target instanceof Node && moreRef.value?.contains(target)) {
    return
  }

  if (target instanceof Node && menuRef.value?.contains(target)) {
    return
  }

  closeMenu()
}

function closeMenuOnEscape(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    closeMenu()
  }
}
</script>

<template>
  <article
    class="bookmark-card"
    :style="{ '--accent': props.link.accent }"
    tabindex="0"
    @click="emit('open', props.link)"
    @keydown.enter="emit('open', props.link)"
  >
    <div class="bookmark-card__top">
      <span class="bookmark-card__favicon-shell" aria-hidden="true">
        <span v-if="shouldShowFallback" class="bookmark-card__favicon-fallback">
          {{ faviconFallback(props.link.domain) }}
        </span>
        <img
          v-else
          class="bookmark-card__favicon"
          :src="faviconSource"
          alt=""
          @error="markFaviconFailed(props.link.id)"
        >
      </span>
      <span class="bookmark-card__domain">{{ props.link.domain }}</span>
      <button
        class="bookmark-card__favorite"
        :class="{ 'is-active': props.isFavorite }"
        type="button"
        :aria-label="props.isFavorite ? t('card.removeFavorite') : t('card.addFavorite')"
        :aria-pressed="props.isFavorite"
        @click="toggleFavorite"
        @keydown.enter.stop
        @keydown.space.stop
      >
        <Star :size="16" :fill="props.isFavorite ? 'currentColor' : 'none'" />
      </button>
      <div
        ref="moreRef"
        class="bookmark-card__more"
        :class="{ 'is-menu-open': isMenuOpen }"
        @click.stop
        @pointerenter="openMenu"
        @pointerleave="closeMenuSoon"
        @keydown.enter.stop
        @keydown.space.stop
      >
        <button
          class="bookmark-card__more-trigger"
          type="button"
          :aria-label="t('card.moreActions')"
          :aria-expanded="isMenuOpen"
          aria-haspopup="menu"
          @click="toggleMenu"
          @keydown.enter="toggleMenu"
          @keydown.space.prevent="toggleMenu"
        >
          <MoreHorizontal :size="16" />
        </button>
      </div>
    </div>

    <h2 class="bookmark-card__title">
      {{ props.link.title }}
    </h2>

    <p class="bookmark-card__url">
      {{ props.link.url }}
    </p>

    <Teleport to="body">
      <div
        v-if="isMenuOpen"
        ref="menuRef"
        class="bookmark-card-dropdown"
        :style="menuStyle"
        role="menu"
        @click.stop
        @pointerenter="openMenu"
        @pointerleave="closeMenuSoon"
      >
        <button type="button" role="menuitem" @click="emitAction($event, 'copy')">
          <Copy :size="14" />
          {{ t('card.copy') }}
        </button>
        <button type="button" role="menuitem" @click="emitAction($event, 'openCurrent')">
          <PanelTopOpen :size="14" />
          {{ t('card.openCurrent') }}
        </button>
        <button type="button" role="menuitem" @click="emitAction($event, 'openWindow')">
          <ExternalLink :size="14" />
          {{ t('card.openWindow') }}
        </button>
      </div>
    </Teleport>
  </article>
</template>

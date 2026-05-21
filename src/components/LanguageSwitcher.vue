<script setup lang="ts">
import type { AppLocale } from '../i18n'
import { Check, ChevronDown, Languages } from 'lucide-vue-next'
import { computed, onMounted, onUnmounted, shallowRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { localeOptions, localeStorageKey } from '../i18n'

const { locale, t } = useI18n()

const isOpen = shallowRef(false)
const rootId = `language-switcher-${Math.random().toString(36).slice(2)}`
const currentLocale = computed(() => locale.value as AppLocale)
const activeOption = computed(() => {
  return localeOptions.find(option => option.code === currentLocale.value) ?? localeOptions[0]
})

watch(locale, (nextLocale) => {
  localStorage.setItem(localeStorageKey, nextLocale)
  document.documentElement.lang = nextLocale
}, { immediate: true })

onMounted(() => {
  document.addEventListener('pointerdown', closeOnOutsidePointer, true)
  document.addEventListener('keydown', closeOnEscape)
})

onUnmounted(() => {
  document.removeEventListener('pointerdown', closeOnOutsidePointer, true)
  document.removeEventListener('keydown', closeOnEscape)
})

function selectLocale(nextLocale: AppLocale) {
  locale.value = nextLocale
  isOpen.value = false
}

function closeOnOutsidePointer(event: PointerEvent) {
  const target = event.target

  if (!(target instanceof HTMLElement)) {
    return
  }

  if (!target.closest(`#${rootId}`)) {
    isOpen.value = false
  }
}

function closeOnEscape(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    isOpen.value = false
  }
}
</script>

<template>
  <div :id="rootId" class="language-switcher">
    <button
      class="language-switcher__trigger"
      type="button"
      :aria-label="t('app.switchLanguage')"
      :aria-expanded="isOpen"
      aria-haspopup="listbox"
      @click="isOpen = !isOpen"
    >
      <Languages :size="16" />
      <span class="language-switcher__signal">{{ activeOption.signal }}</span>
      <span class="language-switcher__label">{{ activeOption.label }}</span>
      <ChevronDown :size="15" class="language-switcher__chevron" :class="{ 'is-open': isOpen }" />
    </button>

    <div v-if="isOpen" class="language-switcher__menu" role="listbox" :aria-label="t('app.language')">
      <button
        v-for="option in localeOptions"
        :key="option.code"
        class="language-switcher__option"
        :class="{ 'is-active': option.code === currentLocale }"
        type="button"
        role="option"
        :aria-selected="option.code === currentLocale"
        @click="selectLocale(option.code)"
      >
        <span class="language-switcher__option-signal">{{ option.signal }}</span>
        <span>{{ option.label }}</span>
        <Check v-if="option.code === currentLocale" :size="15" />
      </button>
    </div>
  </div>
</template>

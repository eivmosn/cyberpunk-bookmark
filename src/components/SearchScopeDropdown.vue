<script setup lang="ts">
import { Check, ChevronDown } from 'lucide-vue-next'
import { computed, onMounted, onUnmounted, shallowRef } from 'vue'

type SearchScope = 'global' | 'category'

const props = defineProps<{
  categoryLabel: string
  globalLabel: string
  label: string
}>()

const model = defineModel<SearchScope>({ required: true })
const isOpen = shallowRef(false)
const rootId = `search-scope-${Math.random().toString(36).slice(2)}`
const options = computed<Array<{ label: string, value: SearchScope }>>(() => [
  { label: props.globalLabel, value: 'global' },
  { label: props.categoryLabel, value: 'category' },
])
const activeLabel = computed(() => {
  return options.value.find(option => option.value === model.value)?.label ?? props.globalLabel
})

onMounted(() => {
  document.addEventListener('pointerdown', closeOnOutsidePointer, true)
  document.addEventListener('keydown', closeOnEscape)
})

onUnmounted(() => {
  document.removeEventListener('pointerdown', closeOnOutsidePointer, true)
  document.removeEventListener('keydown', closeOnEscape)
})

/**
 * Selects the search scope and closes the custom dropdown.
 *
 * @param value - Search scope selected by the user.
 */
function selectScope(value: SearchScope) {
  model.value = value
  isOpen.value = false
}

/**
 * Closes the dropdown when the user clicks outside this component.
 *
 * @param event - Document pointer event to inspect.
 */
function closeOnOutsidePointer(event: PointerEvent) {
  const target = event.target

  if (!(target instanceof HTMLElement)) {
    return
  }

  if (!target.closest(`#${rootId}`)) {
    isOpen.value = false
  }
}

/**
 * Closes the dropdown from the Escape key.
 *
 * @param event - Document keyboard event to inspect.
 */
function closeOnEscape(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    isOpen.value = false
  }
}
</script>

<template>
  <div :id="rootId" class="search-scope">
    <button
      class="search-scope__trigger"
      type="button"
      :aria-label="label"
      :aria-expanded="isOpen"
      :data-tooltip="activeLabel"
      aria-haspopup="listbox"
      @click.stop="isOpen = !isOpen"
    >
      <span>{{ activeLabel }}</span>
      <ChevronDown :size="14" class="search-scope__chevron" :class="{ 'is-open': isOpen }" />
    </button>

    <div v-if="isOpen" class="search-scope__menu" role="listbox" :aria-label="label">
      <button
        v-for="option in options"
        :key="option.value"
        class="search-scope__option"
        :class="{ 'is-active': option.value === model }"
        type="button"
        role="option"
        :aria-selected="option.value === model"
        @click="selectScope(option.value)"
      >
        <span>{{ option.label }}</span>
        <Check v-if="option.value === model" :size="14" />
      </button>
    </div>
  </div>
</template>

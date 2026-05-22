<script setup lang="ts">
import { Eye, EyeOff } from 'lucide-vue-next'
import { computed, nextTick, onMounted, onUnmounted, shallowRef, useTemplateRef } from 'vue'

const props = defineProps<{
  accent: string
  collapseLabel: string
  expandLabel: string
  placeholder: string
  title: string
}>()

const note = defineModel<string>({ required: true })
const isOpen = shallowRef(false)
const triggerRef = useTemplateRef<HTMLElement>('triggerRef')
const panelRef = useTemplateRef<HTMLElement>('panelRef')
const panelPosition = shallowRef({ top: 0, left: 0, width: 286 })
const panelStyle = computed(() => ({
  '--accent': props.accent,
  'top': `${panelPosition.value.top}px`,
  'left': `${panelPosition.value.left}px`,
  'width': `${panelPosition.value.width}px`,
}))

onMounted(() => {
  document.addEventListener('pointerdown', closePanelOnOutsidePointer, true)
  document.addEventListener('keydown', closePanelOnEscape)
  window.addEventListener('resize', closePanel)
  window.addEventListener('scroll', closePanel, true)
})

onUnmounted(() => {
  document.removeEventListener('pointerdown', closePanelOnOutsidePointer, true)
  document.removeEventListener('keydown', closePanelOnEscape)
  window.removeEventListener('resize', closePanel)
  window.removeEventListener('scroll', closePanel, true)
})

/**
 * Toggles the private note panel without triggering bookmark navigation.
 *
 * @param event - Pointer or keyboard interaction from the trigger button.
 */
function togglePanel(event: MouseEvent | KeyboardEvent) {
  event.stopPropagation()

  if (isOpen.value) {
    closePanel()
    return
  }

  openPanel()
}

/**
 * Opens the private note popover and aligns it to the eye trigger button.
 */
async function openPanel() {
  updatePanelPosition()
  isOpen.value = true
  await nextTick()
  updatePanelPosition()
}

/**
 * Closes the private note popover.
 */
function closePanel() {
  isOpen.value = false
}

/**
 * Positions the teleported note popover within the viewport.
 */
function updatePanelPosition() {
  const trigger = triggerRef.value

  if (!trigger) {
    return
  }

  const rect = trigger.getBoundingClientRect()
  const width = Math.min(320, window.innerWidth - 24)
  const left = Math.min(
    Math.max(12, rect.right - width),
    window.innerWidth - width - 12,
  )

  panelPosition.value = {
    top: rect.bottom + 8,
    left,
    width,
  }
}

/**
 * Closes the note popover when the user clicks outside it.
 *
 * @param event - Document-level pointer event to inspect.
 */
function closePanelOnOutsidePointer(event: PointerEvent) {
  if (!isOpen.value) {
    return
  }

  const target = event.target

  if (target instanceof Node && triggerRef.value?.contains(target)) {
    return
  }

  if (target instanceof Node && panelRef.value?.contains(target)) {
    return
  }

  closePanel()
}

/**
 * Closes the note popover from the Escape key.
 *
 * @param event - Document-level keyboard event to inspect.
 */
function closePanelOnEscape(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    closePanel()
  }
}
</script>

<template>
  <button
    ref="triggerRef"
    class="bookmark-card__detail-toggle"
    :class="{ 'is-open': isOpen }"
    type="button"
    :aria-expanded="isOpen"
    :aria-label="isOpen ? collapseLabel : expandLabel"
    @click="togglePanel"
    @keydown.enter="togglePanel"
    @keydown.space.prevent="togglePanel"
  >
    <Eye v-if="isOpen" :size="16" />
    <EyeOff v-else :size="16" />
  </button>

  <Teleport to="body">
    <Transition name="bookmark-card-detail">
      <section
        v-if="isOpen"
        ref="panelRef"
        class="bookmark-card-detail"
        :style="panelStyle"
        @click.stop
        @keydown.stop
      >
        <label class="bookmark-card-detail__field">
          <span>{{ title }}</span>
          <textarea
            v-model="note"
            rows="4"
            spellcheck="false"
            autocomplete="off"
            :placeholder="placeholder"
          />
        </label>
      </section>
    </Transition>
  </Teleport>
</template>

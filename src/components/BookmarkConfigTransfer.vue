<script setup lang="ts">
import { Download, Upload } from 'lucide-vue-next'
import { shallowRef, useTemplateRef } from 'vue'

defineProps<{
  exportLabel: string
  importLabel: string
  warning: string
}>()

const emit = defineEmits<{
  export: []
  import: [content: string]
}>()

const fileInputRef = useTemplateRef<HTMLInputElement>('fileInputRef')
const isReading = shallowRef(false)

/**
 * Opens the hidden JSON file input from the styled import button.
 */
function chooseImportFile() {
  fileInputRef.value?.click()
}

/**
 * Reads the selected backup file and sends its text content upstream.
 *
 * @param event - File input change event containing the backup file.
 */
async function importSelectedFile(event: Event) {
  const input = event.target

  if (!(input instanceof HTMLInputElement) || !input.files?.[0]) {
    return
  }

  isReading.value = true

  try {
    emit('import', await input.files[0].text())
  }
  finally {
    input.value = ''
    isReading.value = false
  }
}
</script>

<template>
  <div class="config-transfer" :title="warning">
    <button
      class="config-transfer__button"
      type="button"
      :aria-label="exportLabel"
      :data-label="exportLabel"
      @click="emit('export')"
    >
      <Download :size="15" />
    </button>
    <button
      class="config-transfer__button"
      type="button"
      :aria-label="importLabel"
      :data-label="importLabel"
      :disabled="isReading"
      @click="chooseImportFile"
    >
      <Upload :size="15" />
    </button>
    <input
      ref="fileInputRef"
      class="config-transfer__input"
      type="file"
      accept="application/json,.json"
      @change="importSelectedFile"
    >
  </div>
</template>

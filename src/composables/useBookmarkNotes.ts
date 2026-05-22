import { readonly, shallowRef, watch } from 'vue'

const bookmarkNotesStorageKey = 'cyber-bookmark-notes'
const bookmarkNotesBackupVersion = 1

interface BookmarkNotesBackup {
  app: 'cyber-bookmark-newtab'
  exportedAt: string
  notes: Record<string, string>
  version: number
}

export function useBookmarkNotes() {
  const notes = shallowRef<Record<string, string>>(readBookmarkNotes())

  watch(notes, (nextNotes) => {
    localStorage.setItem(bookmarkNotesStorageKey, JSON.stringify(nextNotes))
  })

  return {
    exportBookmarkNotes,
    importBookmarkNotes,
    notes: readonly(notes),
    noteForLink,
    setBookmarkNote,
  }

  /**
   * Serializes all private bookmark notes into a portable JSON backup file.
   *
   * @returns Pretty-printed JSON that can be saved as a backup file.
   */
  function exportBookmarkNotes() {
    const backup: BookmarkNotesBackup = {
      app: 'cyber-bookmark-newtab',
      exportedAt: new Date().toISOString(),
      notes: notes.value,
      version: bookmarkNotesBackupVersion,
    }

    return JSON.stringify(backup, null, 2)
  }

  /**
   * Imports bookmark notes from a backup JSON string and merges them locally.
   *
   * @param content - Raw JSON file content selected by the user.
   * @returns Number of note records restored from the backup.
   */
  function importBookmarkNotes(content: string) {
    const importedNotes = parseBookmarkNotesBackup(content)

    notes.value = {
      ...notes.value,
      ...importedNotes,
    }

    return Object.keys(importedNotes).length
  }

  /**
   * Reads one persisted private note by bookmark id.
   *
   * @param linkId - Chrome bookmark id used as the stable storage key.
   * @returns Saved note content, or an empty string when nothing is stored.
   */
  function noteForLink(linkId: string) {
    return notes.value[linkId] ?? ''
  }

  /**
   * Persists account, password, or memo text for one bookmark.
   *
   * @param linkId - Chrome bookmark id used as the stable storage key.
   * @param value - Free-form note content entered by the user.
   */
  function setBookmarkNote(linkId: string, value: string) {
    const nextNotes = { ...notes.value }

    if (value) {
      nextNotes[linkId] = value
    }
    else {
      delete nextNotes[linkId]
    }

    notes.value = nextNotes
  }
}

/**
 * Loads persisted bookmark notes while discarding malformed storage values.
 *
 * @returns A bookmark-id keyed note dictionary safe for reactive state.
 */
function readBookmarkNotes() {
  try {
    const rawNotes = localStorage.getItem(bookmarkNotesStorageKey)

    if (!rawNotes) {
      return {}
    }

    const parsedNotes = JSON.parse(rawNotes)

    if (!parsedNotes || typeof parsedNotes !== 'object' || Array.isArray(parsedNotes)) {
      return {}
    }

    return Object.fromEntries(
      Object.entries(parsedNotes).filter((entry): entry is [string, string] => {
        const [linkId, note] = entry
        return typeof linkId === 'string' && typeof note === 'string'
      }),
    )
  }
  catch {
    return {}
  }
}

/**
 * Parses the supported backup shape while accepting legacy raw note objects.
 *
 * @param content - Raw JSON file content selected by the user.
 * @returns Sanitized bookmark-id keyed notes.
 */
function parseBookmarkNotesBackup(content: string) {
  const parsedBackup = JSON.parse(content)
  const candidateNotes = isBookmarkNotesBackup(parsedBackup)
    ? parsedBackup.notes
    : parsedBackup

  return sanitizeBookmarkNotes(candidateNotes)
}

/**
 * Checks whether parsed JSON uses the formal bookmark notes backup shape.
 *
 * @param value - Parsed JSON value to inspect.
 * @returns True when the value is a supported backup object.
 */
function isBookmarkNotesBackup(value: unknown): value is BookmarkNotesBackup {
  return !!value
    && typeof value === 'object'
    && !Array.isArray(value)
    && 'notes' in value
}

/**
 * Keeps only string bookmark ids with string note content.
 *
 * @param value - Unknown parsed JSON section to sanitize.
 * @returns Clean note dictionary safe to merge into state.
 */
function sanitizeBookmarkNotes(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Invalid bookmark notes backup')
  }

  return Object.fromEntries(
    Object.entries(value).filter((entry): entry is [string, string] => {
      const [linkId, note] = entry
      return typeof linkId === 'string' && typeof note === 'string'
    }),
  )
}

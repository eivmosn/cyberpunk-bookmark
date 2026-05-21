import type { BookmarkCategory, BookmarkLink } from '../types/bookmark'
import { computed, onMounted, readonly, shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'

const accents = ['#18f0ff', '#ff2fd6', '#f9f871', '#7dff7a', '#ff7a2f', '#a78bfa']

export function useBookmarks() {
  const { t } = useI18n()
  const categories = shallowRef<BookmarkCategory[]>([])
  const isLoading = shallowRef(true)
  const errorKey = shallowRef<'bookmark.unavailableError' | 'bookmark.readError' | null>(null)
  const caughtError = shallowRef<string | null>(null)

  const totalLinks = computed(() => categories.value.reduce((total, category) => total + category.links.length, 0))
  const error = computed(() => {
    if (errorKey.value) {
      return t(errorKey.value)
    }

    return caughtError.value
  })

  onMounted(async () => {
    try {
      const chromeBookmarks = globalThis.chrome?.bookmarks

      if (!chromeBookmarks?.getTree) {
        errorKey.value = 'bookmark.unavailableError'
        isLoading.value = false
        return
      }

      const tree = await chromeBookmarks.getTree()
      categories.value = parseBookmarkTree(tree)
    }
    catch (caught) {
      caughtError.value = caught instanceof Error ? caught.message : null
      errorKey.value = caughtError.value ? null : 'bookmark.readError'
    }
    finally {
      isLoading.value = false
    }
  })

  return {
    categories: readonly(categories),
    error,
    isLoading: readonly(isLoading),
    totalLinks,
  }
}

function parseBookmarkTree(nodes: chrome.bookmarks.BookmarkTreeNode[]) {
  const groups = new Map<string, BookmarkLink[]>()

  function visit(node: chrome.bookmarks.BookmarkTreeNode, folderPath: string[]) {
    if (node.url) {
      const categoryPath = folderPath.length > 0 ? folderPath : ['未分类']
      const key = categoryPath.join(' / ')
      const links = groups.get(key) ?? []
      const accent = accents[links.length % accents.length]

      links.push({
        id: node.id,
        title: node.title || getDomain(node.url),
        url: node.url,
        folderPath: categoryPath,
        domain: getDomain(node.url),
        accent,
      })

      groups.set(key, links)
      return
    }

    const nextPath = node.title ? [...folderPath, node.title] : folderPath
    node.children?.forEach(child => visit(child, nextPath))
  }

  nodes.forEach(node => visit(node, []))

  return [...groups.entries()]
    .map(([key, links], index): BookmarkCategory => ({
      id: key.toLowerCase().replace(/[^a-z0-9\u4E00-\u9FA5]+/gi, '-'),
      name: key.split(' / ').at(-1) ?? '未分类',
      path: key.split(' / '),
      links,
      accent: accents[index % accents.length],
    }))
}

function getDomain(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  }
  catch {
    return url
  }
}

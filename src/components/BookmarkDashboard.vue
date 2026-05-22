<script setup lang="ts">
import type { BookmarkCategory, BookmarkCategoryNode, BookmarkCategoryViewItem, BookmarkLink } from '../types/bookmark'
import { gsap } from 'gsap'
import { BookmarkPlus, ChevronRight, LayoutGrid, LayoutList, PanelsTopLeft, RefreshCw, Search, Zap } from 'lucide-vue-next'
import { computed, nextTick, onMounted, onUnmounted, shallowRef, useTemplateRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useBookmarkNotes } from '../composables/useBookmarkNotes'
import { useBookmarks } from '../composables/useBookmarks'
import BookmarkCard from './BookmarkCard.vue'
import BookmarkConfigTransfer from './BookmarkConfigTransfer.vue'
import CategoryRail from './CategoryRail.vue'
import LanguageSwitcher from './LanguageSwitcher.vue'
import Scrollbar from './Scrollbar'
import SearchScopeDropdown from './SearchScopeDropdown.vue'

const { t } = useI18n()
const { categories, error, isLoading, totalLinks } = useBookmarks()
const { exportBookmarkNotes, importBookmarkNotes, noteForLink, setBookmarkNote } = useBookmarkNotes()

interface MutableCategoryNode {
  id: string
  name: string
  path: string[]
  links: BookmarkLink[]
  directLinks: BookmarkLink[]
  accent: string
  children: MutableCategoryNode[]
}

const favoriteStorageKey = 'cyber-bookmark-favorite-ids'
const categoryOrderStorageKey = 'cyber-bookmark-category-order'
const expandedCategoryStorageKey = 'cyber-bookmark-expanded-category-ids'
const linkMetricsStorageKey = 'cyber-bookmark-link-metrics'
const searchScopeStorageKey = 'cyber-bookmark-search-scope'
const densityStorageKey = 'cyber-bookmark-view-density'
const tickerModeStorageKey = 'cyber-bookmark-ticker-mode'

type SearchScope = 'global' | 'category'
type ViewDensity = 'compact' | 'standard' | 'showcase'
type TickerMode = 'favorite' | 'recent' | 'frequent'

interface LinkMetric {
  count: number
  lastOpenedAt: number
}

const activeCategoryId = shallowRef('')
const query = shallowRef('')
const now = shallowRef(new Date())
const transferMessage = shallowRef('')
const favoriteIds = shallowRef(new Set<string>())
const categoryOrderIds = shallowRef<string[]>([])
const expandedCategoryIds = shallowRef(new Set<string>())
const linkMetrics = shallowRef<Record<string, LinkMetric>>({})
const searchScope = shallowRef<SearchScope>('global')
const viewDensity = shallowRef<ViewDensity>('standard')
const tickerMode = shallowRef<TickerMode>('favorite')
const dashboardRef = useTemplateRef<HTMLElement>('dashboardRef')
const cursorRef = useTemplateRef<HTMLElement>('cursorRef')
const bookmarkGridRef = useTemplateRef<HTMLElement>('bookmarkGridRef')
const searchInputRef = useTemplateRef<HTMLInputElement>('searchInputRef')
const tickerRef = useTemplateRef<HTMLElement>('tickerRef')
const tickerGroupRef = useTemplateRef<HTMLElement>('tickerGroupRef')
const bookmarkGridWidth = shallowRef(0)
const isTickerScrollable = shallowRef(false)
let animationContext: gsap.Context | null = null
let removePointerListener: (() => void) | null = null
let removeKeyboardListener: (() => void) | null = null
let clockTimer: number | null = null
let gridResizeFrame = 0
let tickerResizeFrame = 0
let transferMessageTimer = 0
let gridResizeObserver: ResizeObserver | null = null
let tickerResizeObserver: ResizeObserver | null = null

const orderedCategories = computed(() => {
  return [...categories.value].sort((firstCategory, secondCategory) => {
    return firstCategory.name.localeCompare(secondCategory.name, 'zh-Hans-CN')
  })
})

const allLinks = computed(() => {
  return orderedCategories.value.flatMap(category => category.links)
})

const categoryTree = computed(() => {
  return sortCategoryNodes(buildCategoryTree(orderedCategories.value), categoryOrderIds.value)
})

const activeCategory = computed(() => {
  return findCategoryNode(categoryTree.value, activeCategoryId.value) ?? categoryTree.value[0]
})

const categoryNavigationItems = computed(() => {
  return flattenCategoryNodes(categoryTree.value, expandedCategoryIds.value)
})

const activeCategoryPath = computed(() => {
  return activeCategory.value?.path ?? []
})

const activeDisplayPath = computed(() => {
  return activeCategoryPath.value.flatMap(segment => splitCategorySegment(segment))
})

const activeChildCategories = computed(() => {
  return activeCategory.value?.children ?? []
})

const activeCategoryDeepLinks = computed(() => {
  return activeCategory.value ? collectNodeLinks(activeCategory.value) : []
})

const activeChildCategoryCards = computed(() => {
  return activeChildCategories.value.map((category) => {
    const latestLink = childCategoryLatestLink(category)

    return {
      category,
      id: category.id,
      accent: category.accent,
      name: displayCategoryName(category.name),
      path: displayCategoryPath(category.path),
      childCount: category.children.length,
      linkCount: childCategoryLinkCount(category),
      latestTitle: latestLink?.title ?? t('dashboard.latestSignalPending'),
    }
  })
})

const favoriteLinks = computed(() => {
  return allLinks.value.filter(link => favoriteIds.value.has(link.id))
})

const recentLinks = computed(() => {
  return sortLinksByMetric(allLinks.value, 'recent').slice(0, 18)
})

const frequentLinks = computed(() => {
  return sortLinksByMetric(allLinks.value, 'frequent').slice(0, 18)
})

const tickerLinks = computed(() => {
  if (tickerMode.value === 'recent') {
    return recentLinks.value
  }

  if (tickerMode.value === 'frequent') {
    return frequentLinks.value
  }

  return favoriteLinks.value.slice(0, 18)
})

const filteredLinks = computed(() => {
  const category = activeCategory.value
  const search = query.value.trim().toLowerCase()

  if (!search) {
    if (!category) {
      return []
    }

    return category.links
  }

  const sourceLinks = searchScope.value === 'category'
    ? activeCategoryDeepLinks.value
    : allLinks.value

  return sourceLinks.filter((link) => {
    return matchesFuzzy(createSearchText(link), search)
  })
})

const masonryConfig = computed(() => {
  if (viewDensity.value === 'compact') {
    return { minColumnWidth: 218, gap: 9 }
  }

  if (viewDensity.value === 'showcase') {
    return { minColumnWidth: 340, gap: 16 }
  }

  return { minColumnWidth: 286, gap: 12 }
})

const masonryColumnCount = computed(() => {
  if (filteredLinks.value.length === 0) {
    return 1
  }

  const { minColumnWidth, gap } = masonryConfig.value
  const availableWidth = bookmarkGridWidth.value

  if (availableWidth <= 0) {
    return 1
  }

  const columnCount = Math.floor((availableWidth + gap) / (minColumnWidth + gap))

  return Math.max(1, Math.min(filteredLinks.value.length, columnCount))
})

const masonryColumns = computed(() => {
  const columns: BookmarkLink[][] = Array.from({ length: masonryColumnCount.value }, () => [])

  filteredLinks.value.forEach((link, index) => {
    columns[index % masonryColumnCount.value].push(link)
  })

  return columns
})

const syncStatus = computed(() => {
  if (isLoading.value) {
    return t('dashboard.syncStatus.loading')
  }

  if (error.value) {
    return t('dashboard.syncStatus.extensionRequired')
  }

  return totalLinks.value > 0
    ? t('dashboard.syncStatus.connected')
    : t('dashboard.syncStatus.empty')
})

const isBookmarkLibraryEmpty = computed(() => {
  return !isLoading.value && !error.value && totalLinks.value === 0
})

const shouldShowBookmarkWorkspace = computed(() => {
  return !isLoading.value && !error.value && totalLinks.value > 0
})

const tickerEmptyText = computed(() => {
  if (tickerMode.value === 'recent') {
    return t('dashboard.ticker.recentEmpty')
  }

  if (tickerMode.value === 'frequent') {
    return t('dashboard.ticker.frequentEmpty')
  }

  return t('dashboard.ticker.favoriteEmpty')
})

const heroEmptyText = computed(() => {
  if (isLoading.value) {
    return t('dashboard.hero.loading')
  }

  return isBookmarkLibraryEmpty.value
    ? t('dashboard.hero.empty')
    : tickerEmptyText.value
})

const searchPlaceholder = computed(() => {
  return searchScope.value === 'category'
    ? t('dashboard.search.categoryPlaceholder')
    : t('dashboard.search.globalPlaceholder')
})

const currentDateTime = computed(() => {
  const date = now.value
  const year = date.getFullYear()
  const month = padTimePart(date.getMonth() + 1)
  const day = padTimePart(date.getDate())
  const hours = padTimePart(date.getHours())
  const minutes = padTimePart(date.getMinutes())
  const seconds = padTimePart(date.getSeconds())

  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`
})

watch(categoryTree, (nextCategories) => {
  if (!activeCategoryId.value && nextCategories[0]) {
    activeCategoryId.value = nextCategories[0].id
  }
}, { immediate: true })

onMounted(() => {
  const root = dashboardRef.value
  const cursor = cursorRef.value

  favoriteIds.value = readFavoriteIds()
  categoryOrderIds.value = readCategoryOrderIds()
  expandedCategoryIds.value = readExpandedCategoryIds()
  linkMetrics.value = readLinkMetrics()
  searchScope.value = readSearchScope()
  viewDensity.value = readViewDensity()
  tickerMode.value = readTickerMode()

  clockTimer = window.setInterval(() => {
    now.value = new Date()
  }, 1000)

  if (!root) {
    return
  }

  const onKeyDown = (event: KeyboardEvent) => {
    const target = event.target
    const isTypingTarget = target instanceof HTMLInputElement
      || target instanceof HTMLTextAreaElement
      || target instanceof HTMLSelectElement
      || (target instanceof HTMLElement && target.isContentEditable)

    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault()
      focusSearch()
      return
    }

    if (!isTypingTarget && event.key === '/') {
      event.preventDefault()
      focusSearch()
    }
  }

  window.addEventListener('keydown', onKeyDown)
  removeKeyboardListener = () => {
    window.removeEventListener('keydown', onKeyDown)
  }

  if (tickerRef.value) {
    tickerResizeObserver = new ResizeObserver(() => {
      scheduleTickerOverflowMeasure()
    })

    tickerResizeObserver.observe(tickerRef.value)
  }

  bindBookmarkGridResizeObserver()

  animationContext = gsap.context(() => {
    gsap.timeline({ defaults: { duration: 0.72, ease: 'power3.out' } })
      .from('.hero-kicker', { autoAlpha: 0, y: 18 })
      .from('.hud-panel', { autoAlpha: 0, y: 24, stagger: 0.08 }, '<0.1')
  }, root)

  if (cursor) {
    const xTo = gsap.quickTo(cursor, 'x', { duration: 0.36, ease: 'power3' })
    const yTo = gsap.quickTo(cursor, 'y', { duration: 0.36, ease: 'power3' })

    const onPointerMove = (event: PointerEvent) => {
      xTo(event.clientX)
      yTo(event.clientY)
    }

    window.addEventListener('pointermove', onPointerMove)
    removePointerListener = () => {
      window.removeEventListener('pointermove', onPointerMove)
    }
  }
})

watch(favoriteIds, (ids) => {
  localStorage.setItem(favoriteStorageKey, JSON.stringify([...ids]))
})

watch(categoryOrderIds, (ids) => {
  localStorage.setItem(categoryOrderStorageKey, JSON.stringify(ids))
})

watch(expandedCategoryIds, (ids) => {
  localStorage.setItem(expandedCategoryStorageKey, JSON.stringify([...ids]))
})

watch(linkMetrics, (metrics) => {
  localStorage.setItem(linkMetricsStorageKey, JSON.stringify(metrics))
})

watch(searchScope, (scope) => {
  localStorage.setItem(searchScopeStorageKey, scope)
})

watch(viewDensity, (density) => {
  localStorage.setItem(densityStorageKey, density)
})

watch(tickerMode, (mode) => {
  localStorage.setItem(tickerModeStorageKey, mode)
})

watch(tickerLinks, async () => {
  await nextTick()
  scheduleTickerOverflowMeasure()
}, { flush: 'post' })

watch(filteredLinks, async () => {
  await nextTick()
  bindBookmarkGridResizeObserver()
  animateBookmarkCards()
}, { flush: 'post' })

watch(shouldShowBookmarkWorkspace, async (shouldShow) => {
  if (!shouldShow) {
    gridResizeObserver?.disconnect()
    gridResizeObserver = null
    bookmarkGridWidth.value = 0
    return
  }

  await nextTick()
  bindBookmarkGridResizeObserver()
}, { flush: 'post' })

watch(filteredLinks, (links) => {
  const search = query.value.trim()

  if (!search || links.length === 0 || searchScope.value === 'category') {
    return
  }

  const category = findCategoryForLink(links[0])

  if (category && category.id !== activeCategoryId.value) {
    activeCategoryId.value = category.id
    expandCategoryAncestors(category.id)
  }
})

onUnmounted(() => {
  if (clockTimer) {
    window.clearInterval(clockTimer)
  }

  removePointerListener?.()
  removeKeyboardListener?.()
  cancelAnimationFrame(gridResizeFrame)
  cancelAnimationFrame(tickerResizeFrame)
  window.clearTimeout(transferMessageTimer)
  gridResizeObserver?.disconnect()
  tickerResizeObserver?.disconnect()
  animationContext?.revert()
})

function selectCategory(category: BookmarkCategoryNode) {
  activeCategoryId.value = category.id

  if (category.children.length > 0) {
    expandedCategoryIds.value = new Set([...expandedCategoryIds.value, category.id])
  }
}

function focusSearch() {
  searchInputRef.value?.focus()
  searchInputRef.value?.select()
}

function reloadDashboard() {
  window.location.reload()
}

function toggleCategory(categoryId: string) {
  const nextCategoryIds = new Set(expandedCategoryIds.value)

  if (nextCategoryIds.has(categoryId)) {
    nextCategoryIds.delete(categoryId)
  }
  else {
    nextCategoryIds.add(categoryId)
  }

  expandedCategoryIds.value = nextCategoryIds
}

function expandCategoryAncestors(categoryId: string) {
  const ancestorIds = findAncestorNodeIds(categoryTree.value, categoryId)

  if (ancestorIds.length === 0) {
    return
  }

  expandedCategoryIds.value = new Set([...expandedCategoryIds.value, ...ancestorIds])
}

function moveCategory(categoryId: string, direction: 'up' | 'down') {
  const siblingIds = findSiblingNodeIds(categoryTree.value, categoryId)
  const currentIndex = siblingIds.indexOf(categoryId)

  if (currentIndex === -1) {
    return
  }

  const nextIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1

  if (nextIndex < 0 || nextIndex >= siblingIds.length) {
    return
  }

  const nextSiblingIds = [...siblingIds]
  const [movedCategoryId] = nextSiblingIds.splice(currentIndex, 1)
  nextSiblingIds.splice(nextIndex, 0, movedCategoryId)
  categoryOrderIds.value = mergeNodeOrderIds(categoryOrderIds.value, siblingIds, nextSiblingIds)
}

function openLink(link: BookmarkLink) {
  recordLinkOpen(link)
  window.open(link.url, '_blank')
}

function openLinkInCurrentTab(link: BookmarkLink) {
  recordLinkOpen(link)
  window.location.href = link.url
}

function openLinkInWindow(link: BookmarkLink) {
  recordLinkOpen(link)
  window.open(link.url, '_blank', 'noopener,noreferrer,width=1280,height=820')
}

async function copyLink(link: BookmarkLink) {
  try {
    await navigator.clipboard.writeText(link.url)
  }
  catch {
    const textarea = document.createElement('textarea')
    textarea.value = link.url
    textarea.style.position = 'fixed'
    textarea.style.opacity = '0'
    document.body.append(textarea)
    textarea.select()
    document.execCommand('copy')
    textarea.remove()
  }
}

/**
 * Downloads a JSON backup containing all saved private bookmark notes.
 */
function exportNotesBackup() {
  const backupContent = exportBookmarkNotes()
  const backupFile = new Blob([backupContent], { type: 'application/json;charset=utf-8' })
  const downloadUrl = URL.createObjectURL(backupFile)
  const anchor = document.createElement('a')

  anchor.href = downloadUrl
  anchor.download = `cyber-bookmark-notes-${new Date().toISOString().slice(0, 10)}.json`
  anchor.click()
  URL.revokeObjectURL(downloadUrl)
  showTransferMessage(t('dashboard.config.exported'))
}

/**
 * Restores private bookmark notes from a selected JSON backup file.
 *
 * @param content - Raw JSON backup content emitted by the import control.
 */
function importNotesBackup(content: string) {
  try {
    const importedCount = importBookmarkNotes(content)
    showTransferMessage(t('dashboard.config.imported', { count: importedCount }))
  }
  catch {
    showTransferMessage(t('dashboard.config.importFailed'))
  }
}

/**
 * Shows a short global feedback message for backup import and export actions.
 *
 * @param message - Localized message text shown in the global toast.
 */
function showTransferMessage(message: string) {
  window.clearTimeout(transferMessageTimer)
  transferMessage.value = message
  transferMessageTimer = window.setTimeout(() => {
    transferMessage.value = ''
  }, 2400)
}

function recordLinkOpen(link: BookmarkLink) {
  const currentMetric = linkMetrics.value[link.id] ?? { count: 0, lastOpenedAt: 0 }

  linkMetrics.value = {
    ...linkMetrics.value,
    [link.id]: {
      count: currentMetric.count + 1,
      lastOpenedAt: Date.now(),
    },
  }
}

function toggleFavorite(link: BookmarkLink) {
  const nextIds = new Set(favoriteIds.value)

  if (nextIds.has(link.id)) {
    nextIds.delete(link.id)
  }
  else {
    nextIds.add(link.id)
  }

  favoriteIds.value = nextIds
}

function isFavorite(link: BookmarkLink) {
  return favoriteIds.value.has(link.id)
}

function measureTickerOverflow() {
  const ticker = tickerRef.value
  const tickerGroup = tickerGroupRef.value

  if (!ticker || !tickerGroup || tickerLinks.value.length === 0) {
    if (isTickerScrollable.value) {
      isTickerScrollable.value = false
    }
    return
  }

  const nextIsScrollable = tickerGroup.scrollWidth > ticker.clientWidth

  if (isTickerScrollable.value !== nextIsScrollable) {
    isTickerScrollable.value = nextIsScrollable
  }
}

/**
 * Binds grid width observation after the workspace grid has actually rendered.
 */
function bindBookmarkGridResizeObserver() {
  const grid = bookmarkGridRef.value

  if (!grid) {
    return
  }

  scheduleBookmarkGridResize(grid.getBoundingClientRect().width)

  if (gridResizeObserver) {
    return
  }

  gridResizeObserver = new ResizeObserver(([entry]) => {
    scheduleBookmarkGridResize(entry.contentRect.width)
  })

  gridResizeObserver.observe(grid)
}

function scheduleBookmarkGridResize(width: number) {
  cancelAnimationFrame(gridResizeFrame)
  gridResizeFrame = requestAnimationFrame(() => {
    if (Math.abs(bookmarkGridWidth.value - width) > 0.5) {
      bookmarkGridWidth.value = width
    }
  })
}

function scheduleTickerOverflowMeasure() {
  cancelAnimationFrame(tickerResizeFrame)
  tickerResizeFrame = requestAnimationFrame(() => {
    measureTickerOverflow()
  })
}

function animateBookmarkCards() {
  const root = dashboardRef.value

  if (!root) {
    return
  }

  const cards = [...root.querySelectorAll<HTMLElement>('.bookmark-card')]

  if (cards.length === 0) {
    return
  }

  gsap.fromTo(
    cards,
    { autoAlpha: 0, y: 16 },
    { autoAlpha: 1, y: 0, duration: 0.46, ease: 'power3.out', stagger: 0.025, overwrite: 'auto' },
  )
}

function padTimePart(value: number) {
  return value.toString().padStart(2, '0')
}

function createSearchText(link: BookmarkLink) {
  return [
    link.title,
    link.domain,
    link.url,
    ...link.folderPath,
  ].join(' ').toLowerCase()
}

function matchesFuzzy(text: string, search: string) {
  const normalizedText = text.toLowerCase()
  const normalizedSearch = search.toLowerCase()

  if (normalizedText.includes(normalizedSearch)) {
    return true
  }

  let searchIndex = 0

  for (const character of normalizedText) {
    if (character === normalizedSearch[searchIndex]) {
      searchIndex += 1
    }

    if (searchIndex === normalizedSearch.length) {
      return true
    }
  }

  return false
}

function findCategoryForLink(link: BookmarkLink) {
  return findDeepestNodeForLink(categoryTree.value, link.id)
}

function collectNodeLinks(node: BookmarkCategoryNode): BookmarkLink[] {
  return [
    ...node.directLinks,
    ...node.children.flatMap(child => collectNodeLinks(child)),
  ]
}

function sortLinksByMetric(links: readonly BookmarkLink[], mode: 'recent' | 'frequent') {
  return links
    .filter(link => linkMetrics.value[link.id]?.lastOpenedAt)
    .sort((firstLink, secondLink) => {
      const firstMetric = linkMetrics.value[firstLink.id]
      const secondMetric = linkMetrics.value[secondLink.id]

      if (mode === 'frequent') {
        const countDiff = (secondMetric?.count ?? 0) - (firstMetric?.count ?? 0)

        if (countDiff !== 0) {
          return countDiff
        }
      }

      return (secondMetric?.lastOpenedAt ?? 0) - (firstMetric?.lastOpenedAt ?? 0)
    })
}

function displayCategoryName(name: string) {
  return splitCategorySegment(name).at(-1) ?? name
}

function displayCategoryPath(path: readonly string[]) {
  return path.flatMap(segment => splitCategorySegment(segment)).join(' / ')
}

function splitCategorySegment(segment: string) {
  return segment
    .split(/[/／]+/)
    .map(part => part.trim())
    .filter(Boolean)
}

function childCategoryLatestLink(category: BookmarkCategoryNode) {
  return sortLinksByMetric(collectNodeLinks(category), 'recent')[0]
}

function childCategoryLinkCount(category: BookmarkCategoryNode) {
  return collectNodeLinks(category).length
}

function buildCategoryTree(sourceCategories: readonly BookmarkCategory[]) {
  const nodeMap = new Map<string, MutableCategoryNode>()
  const rootNodes: MutableCategoryNode[] = []

  sourceCategories.forEach((category) => {
    const startDepth = category.path.length > 1 ? 2 : 1
    let parentNode: MutableCategoryNode | null = null

    for (let depth = startDepth; depth <= category.path.length; depth += 1) {
      const path = category.path.slice(0, depth)
      const id = categoryNodeId(path)
      const existingNode = nodeMap.get(id)
      const isLeaf = depth === category.path.length

      if (existingNode) {
        if (isLeaf) {
          existingNode.directLinks = [...category.links]
          existingNode.accent = category.accent
        }

        parentNode = existingNode
        continue
      }

      const node: MutableCategoryNode = {
        id,
        name: path.at(-1) ?? category.name,
        path,
        directLinks: isLeaf ? [...category.links] : [],
        links: [],
        accent: category.accent,
        children: [],
      }

      nodeMap.set(id, node)

      if (parentNode) {
        parentNode.children.push(node)
      }
      else {
        rootNodes.push(node)
      }

      parentNode = node
    }
  })

  rootNodes.forEach(hydrateCategoryNodeLinks)

  return rootNodes
}

function hydrateCategoryNodeLinks(node: MutableCategoryNode) {
  node.children.forEach(hydrateCategoryNodeLinks)
  node.links = [...node.directLinks]

  return node.links
}

function sortCategoryNodes(nodes: readonly BookmarkCategoryNode[], orderIds: readonly string[]): BookmarkCategoryNode[] {
  const orderLookup = new Map(orderIds.map((id, index) => [id, index]))

  return [...nodes]
    .sort((firstNode, secondNode) => {
      const firstIndex = orderLookup.get(firstNode.id) ?? Number.MAX_SAFE_INTEGER
      const secondIndex = orderLookup.get(secondNode.id) ?? Number.MAX_SAFE_INTEGER

      if (firstIndex !== secondIndex) {
        return firstIndex - secondIndex
      }

      return firstNode.name.localeCompare(secondNode.name, 'zh-Hans-CN')
    })
    .map(node => ({
      ...node,
      children: sortCategoryNodes(node.children, orderIds),
    }))
}

function flattenCategoryNodes(
  nodes: readonly BookmarkCategoryNode[],
  expandedIds: ReadonlySet<string>,
  depth = 0,
): BookmarkCategoryViewItem[] {
  return nodes.flatMap((node, siblingIndex) => {
    const item: BookmarkCategoryViewItem = {
      ...node,
      depth,
      hasChildren: node.children.length > 0,
      isExpanded: expandedIds.has(node.id),
      siblingCount: nodes.length,
      siblingIndex,
    }

    if (!item.isExpanded) {
      return [item]
    }

    return [
      item,
      ...flattenCategoryNodes(node.children, expandedIds, depth + 1),
    ]
  })
}

function findCategoryNode(nodes: readonly BookmarkCategoryNode[], categoryId: string): BookmarkCategoryNode | undefined {
  for (const node of nodes) {
    if (node.id === categoryId) {
      return node
    }

    const childNode = findCategoryNode(node.children, categoryId)

    if (childNode) {
      return childNode
    }
  }
}

function findDeepestNodeForLink(nodes: readonly BookmarkCategoryNode[], linkId: string): BookmarkCategoryNode | undefined {
  for (const node of nodes) {
    const childNode = findDeepestNodeForLink(node.children, linkId)

    if (childNode) {
      return childNode
    }

    if (node.directLinks.some(link => link.id === linkId)) {
      return node
    }
  }
}

function findSiblingNodeIds(nodes: readonly BookmarkCategoryNode[], categoryId: string): string[] {
  if (nodes.some(node => node.id === categoryId)) {
    return nodes.map(node => node.id)
  }

  for (const node of nodes) {
    const siblingIds = findSiblingNodeIds(node.children, categoryId)

    if (siblingIds.length > 0) {
      return siblingIds
    }
  }

  return []
}

function findAncestorNodeIds(
  nodes: readonly BookmarkCategoryNode[],
  categoryId: string,
  ancestors: readonly string[] = [],
): string[] {
  for (const node of nodes) {
    if (node.id === categoryId) {
      return [...ancestors]
    }

    const childAncestors = findAncestorNodeIds(node.children, categoryId, [...ancestors, node.id])

    if (childAncestors.length > 0) {
      return childAncestors
    }
  }

  return []
}

function mergeNodeOrderIds(currentOrderIds: readonly string[], previousSiblingIds: readonly string[], nextSiblingIds: readonly string[]) {
  const nextSiblingLookup = new Map(nextSiblingIds.map((id, index) => [id, index]))
  const preservedOrderIds = currentOrderIds.filter(id => !nextSiblingLookup.has(id))
  const insertionIndex = currentOrderIds.findIndex(id => previousSiblingIds.includes(id))

  if (insertionIndex === -1) {
    return [...preservedOrderIds, ...nextSiblingIds]
  }

  return [
    ...preservedOrderIds.slice(0, insertionIndex),
    ...nextSiblingIds,
    ...preservedOrderIds.slice(insertionIndex),
  ]
}

function categoryNodeId(path: readonly string[]) {
  return `node:${path.join(' / ').toLowerCase().replace(/[^a-z0-9\u4E00-\u9FA5]+/gi, '-')}`
}

function readFavoriteIds() {
  try {
    const rawFavoriteIds = localStorage.getItem(favoriteStorageKey)

    if (!rawFavoriteIds) {
      return new Set<string>()
    }

    const parsedFavoriteIds = JSON.parse(rawFavoriteIds)

    if (!Array.isArray(parsedFavoriteIds)) {
      return new Set<string>()
    }

    return new Set(parsedFavoriteIds.filter((id): id is string => typeof id === 'string'))
  }
  catch {
    return new Set<string>()
  }
}

function readCategoryOrderIds() {
  try {
    const rawCategoryOrderIds = localStorage.getItem(categoryOrderStorageKey)

    if (!rawCategoryOrderIds) {
      return []
    }

    const parsedCategoryOrderIds = JSON.parse(rawCategoryOrderIds)

    if (!Array.isArray(parsedCategoryOrderIds)) {
      return []
    }

    return parsedCategoryOrderIds.filter((id): id is string => typeof id === 'string')
  }
  catch {
    return []
  }
}

function readExpandedCategoryIds() {
  try {
    const rawExpandedCategoryIds = localStorage.getItem(expandedCategoryStorageKey)

    if (!rawExpandedCategoryIds) {
      return new Set<string>()
    }

    const parsedExpandedCategoryIds = JSON.parse(rawExpandedCategoryIds)

    if (!Array.isArray(parsedExpandedCategoryIds)) {
      return new Set<string>()
    }

    return new Set(parsedExpandedCategoryIds.filter((id): id is string => typeof id === 'string'))
  }
  catch {
    return new Set<string>()
  }
}

function readLinkMetrics() {
  try {
    const rawMetrics = localStorage.getItem(linkMetricsStorageKey)

    if (!rawMetrics) {
      return {}
    }

    const parsedMetrics = JSON.parse(rawMetrics)

    if (!parsedMetrics || typeof parsedMetrics !== 'object' || Array.isArray(parsedMetrics)) {
      return {}
    }

    return Object.fromEntries(
      Object.entries(parsedMetrics)
        .filter((entry): entry is [string, LinkMetric] => {
          const [, metric] = entry
          return !!metric
            && typeof metric === 'object'
            && typeof (metric as LinkMetric).count === 'number'
            && typeof (metric as LinkMetric).lastOpenedAt === 'number'
        }),
    )
  }
  catch {
    return {}
  }
}

function readSearchScope(): SearchScope {
  return localStorage.getItem(searchScopeStorageKey) === 'category' ? 'category' : 'global'
}

function readViewDensity(): ViewDensity {
  const density = localStorage.getItem(densityStorageKey)

  if (density === 'compact' || density === 'showcase') {
    return density
  }

  return 'standard'
}

function readTickerMode(): TickerMode {
  const mode = localStorage.getItem(tickerModeStorageKey)

  if (mode === 'recent' || mode === 'frequent') {
    return mode
  }

  return 'favorite'
}
</script>

<template>
  <Scrollbar
    class="app-scrollbar"
    view-class="app-scrollbar__view"
    :min-size="46"
  >
    <main
      ref="dashboardRef"
      class="dashboard"
      :class="`density-${viewDensity}`"
    >
      <div ref="cursorRef" class="cursor-glow" />
      <div class="grid-backdrop" />
      <div class="scanline" />

      <section class="hero hud-panel">
        <div class="ticker-shell">
          <div class="hero-meta">
            <p class="hero-kicker">
              <Zap :size="16" />
              {{ currentDateTime }}
            </p>
            <div class="hero-actions">
              <LanguageSwitcher />
            </div>
            <div v-if="isBookmarkLibraryEmpty" class="hero-empty-badge">
              {{ t('dashboard.hero.emptyBadge') }}
            </div>
            <div v-else class="ticker-tabs" :aria-label="t('dashboard.ticker.sourceLabel')">
              <button
                type="button"
                :class="{ 'is-active': tickerMode === 'favorite' }"
                @click="tickerMode = 'favorite'"
              >
                {{ t('dashboard.ticker.favorite') }}
              </button>
              <button
                type="button"
                :class="{ 'is-active': tickerMode === 'recent' }"
                @click="tickerMode = 'recent'"
              >
                {{ t('dashboard.ticker.recent') }}
              </button>
              <button
                type="button"
                :class="{ 'is-active': tickerMode === 'frequent' }"
                @click="tickerMode = 'frequent'"
              >
                {{ t('dashboard.ticker.frequent') }}
              </button>
            </div>
          </div>

          <div
            ref="tickerRef"
            class="site-ticker"
            :class="{ 'is-scrollable': isTickerScrollable }"
            :aria-label="t('dashboard.ticker.listLabel')"
          >
            <div
              ref="tickerGroupRef"
              class="site-ticker__group"
            >
              <button
                v-for="link in tickerLinks"
                :key="link.id"
                class="site-ticker__item"
                type="button"
                :style="{ '--accent': link.accent }"
                @click="openLink(link)"
              >
                <span class="site-ticker__domain">{{ link.domain }}</span>
                <span class="site-ticker__title">{{ link.title }}</span>
              </button>
            </div>
            <div
              v-if="isTickerScrollable"
              class="site-ticker__group"
              aria-hidden="true"
            >
              <button
                v-for="link in tickerLinks"
                :key="`copy-${link.id}`"
                class="site-ticker__item"
                type="button"
                tabindex="-1"
                :style="{ '--accent': link.accent }"
                @click="openLink(link)"
              >
                <span class="site-ticker__domain">{{ link.domain }}</span>
                <span class="site-ticker__title">{{ link.title }}</span>
              </button>
            </div>
            <span v-if="tickerLinks.length === 0" class="site-ticker__empty">
              {{ heroEmptyText }}
            </span>
          </div>

          <div class="stats">
            <span>{{ t('dashboard.stats.categories', { count: categories.length }) }}</span>
            <span>{{ t('dashboard.stats.links', { count: totalLinks }) }}</span>
            <span>{{ t('dashboard.stats.favorites', { count: favoriteLinks.length }) }}</span>
            <span>{{ t('dashboard.stats.recent', { count: recentLinks.length }) }}</span>
            <span>{{ t('dashboard.stats.frequent', { count: frequentLinks.length }) }}</span>
            <span>{{ t('dashboard.stats.status', { status: isBookmarkLibraryEmpty ? t('dashboard.syncStatus.waiting') : syncStatus }) }}</span>
          </div>
        </div>
      </section>
      <section v-if="shouldShowBookmarkWorkspace" class="control-strip hud-panel">
        <div class="control-strip__actions">
          <div class="search-box">
            <Search :size="18" />
            <input
              ref="searchInputRef"
              v-model="query"
              :aria-label="searchPlaceholder"
              :placeholder="searchPlaceholder"
            >
            <SearchScopeDropdown
              v-model="searchScope"
              :category-label="t('dashboard.search.category')"
              :global-label="t('dashboard.search.global')"
              :label="t('dashboard.search.scopeLabel')"
            />
          </div>
          <div class="segmented-control density-control" :aria-label="t('dashboard.density.label')">
            <button
              type="button"
              :class="{ 'is-active': viewDensity === 'compact' }"
              :aria-label="t('dashboard.density.compact')"
              :data-tooltip="t('dashboard.density.compact')"
              @click="viewDensity = 'compact'"
            >
              <LayoutList :size="16" />
            </button>
            <button
              type="button"
              :class="{ 'is-active': viewDensity === 'standard' }"
              :aria-label="t('dashboard.density.standard')"
              :data-tooltip="t('dashboard.density.standard')"
              @click="viewDensity = 'standard'"
            >
              <LayoutGrid :size="16" />
            </button>
            <button
              type="button"
              :class="{ 'is-active': viewDensity === 'showcase' }"
              :aria-label="t('dashboard.density.showcase')"
              :data-tooltip="t('dashboard.density.showcase')"
              @click="viewDensity = 'showcase'"
            >
              <PanelsTopLeft :size="16" />
            </button>
          </div>
          <BookmarkConfigTransfer
            :export-label="t('dashboard.config.export')"
            :import-label="t('dashboard.config.import')"
            :warning="t('dashboard.config.warning')"
            @export="exportNotesBackup"
            @import="importNotesBackup"
          />
        </div>
      </section>

      <section v-if="error" class="error-panel">
        {{ error }}
      </section>

      <section v-else-if="isBookmarkLibraryEmpty" class="empty-library hud-panel" aria-labelledby="empty-library-title">
        <div class="empty-library__mark" aria-hidden="true">
          <BookmarkPlus :size="34" />
        </div>
        <div class="empty-library__copy">
          <p class="empty-library__eyebrow">
            {{ t('dashboard.emptyLibrary.eyebrow') }}
          </p>
          <h1 id="empty-library-title">
            {{ t('dashboard.emptyLibrary.title') }}
          </h1>
          <p>
            {{ t('dashboard.emptyLibrary.body') }}
          </p>
        </div>
        <div class="empty-library__steps" :aria-label="t('dashboard.emptyLibrary.stepsLabel')">
          <span>{{ t('dashboard.emptyLibrary.stepOpen') }}</span>
          <span>{{ t('dashboard.emptyLibrary.stepStar') }}</span>
          <span>{{ t('dashboard.emptyLibrary.stepRefresh') }}</span>
        </div>
        <button class="empty-library__action" type="button" @click="reloadDashboard">
          <RefreshCw :size="16" />
          {{ t('dashboard.emptyLibrary.refresh') }}
        </button>
      </section>

      <section v-else-if="shouldShowBookmarkWorkspace" class="workspace">
        <CategoryRail
          v-if="categoryNavigationItems.length"
          :categories="categoryNavigationItems"
          :active-category-id="activeCategoryId"
          @select="selectCategory"
          @toggle="toggleCategory"
          @move="moveCategory"
        />

        <div class="content-pane">
          <section class="channel-hud">
            <div class="channel-path" :aria-label="t('dashboard.channel.pathLabel')">
              <span class="channel-path__label">{{ t('dashboard.channel.label') }}</span>
              <span
                v-for="(segment, index) in activeDisplayPath"
                :key="`${segment}-${index}`"
                class="channel-path__segment"
              >
                <ChevronRight :size="13" class="channel-path__icon" aria-hidden="true" />
                <span>{{ segment }}</span>
              </span>
            </div>
            <span class="channel-count">{{ t('dashboard.channel.count', { count: filteredLinks.length }) }}</span>
          </section>

          <div
            ref="bookmarkGridRef"
            class="bookmark-grid"
            :style="{ '--masonry-columns': masonryColumnCount, '--masonry-gap': `${masonryConfig.gap}px` }"
          >
            <div
              v-if="!query.trim() && filteredLinks.length === 0 && activeChildCategoryCards.length > 0"
              class="child-category-panel"
            >
              <button
                v-for="childCard in activeChildCategoryCards"
                :key="childCard.id"
                class="child-category-card"
                type="button"
                :style="{ '--accent': childCard.accent }"
                @click="selectCategory(childCard.category)"
              >
                <span class="child-category-card__count">{{ String(childCard.linkCount).padStart(2, '0') }}</span>
                <span class="child-category-card__name">{{ childCard.name }}</span>
                <span class="child-category-card__path">{{ childCard.path }}</span>
                <span class="child-category-card__meta">
                  {{ t('dashboard.channel.childMeta', { count: childCard.childCount, title: childCard.latestTitle }) }}
                </span>
              </button>
            </div>
            <template v-if="filteredLinks.length > 0">
              <div
                v-for="(column, columnIndex) in masonryColumns"
                :key="columnIndex"
                class="bookmark-column"
              >
                <BookmarkCard
                  v-for="link in column"
                  :key="link.id"
                  :link="link"
                  :is-favorite="isFavorite(link)"
                  :note="noteForLink(link.id)"
                  @open="openLink"
                  @open-current="openLinkInCurrentTab"
                  @open-window="openLinkInWindow"
                  @copy="copyLink"
                  @toggle-favorite="toggleFavorite"
                  @update-note="setBookmarkNote(link.id, $event)"
                />
              </div>
            </template>
            <div v-else-if="activeChildCategories.length === 0 || query.trim()" class="empty-state">
              <span class="empty-state__scan" aria-hidden="true" />
              <strong>{{ query.trim() ? t('dashboard.emptyState.searchTitle') : t('dashboard.emptyState.channelTitle') }}</strong>
              <span>{{ query.trim() ? t('dashboard.emptyState.searchBody') : t('dashboard.emptyState.channelBody') }}</span>
            </div>
          </div>
        </div>
      </section>

      <Teleport to="body">
        <Transition name="global-message">
          <div v-if="transferMessage" class="global-message" role="status">
            {{ transferMessage }}
          </div>
        </Transition>
      </Teleport>
    </main>
  </Scrollbar>
</template>

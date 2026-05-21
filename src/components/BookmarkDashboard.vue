<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, shallowRef, useTemplateRef, watch } from 'vue'
import { gsap } from 'gsap'
import { ChevronRight, Search, Zap } from 'lucide-vue-next'
import BookmarkCard from './BookmarkCard.vue'
import CategoryRail from './CategoryRail.vue'
import Scrollbar from './Scrollbar'
import { useBookmarks } from '../composables/useBookmarks'
import type { BookmarkCategory, BookmarkCategoryNode, BookmarkCategoryViewItem, BookmarkLink } from '../types/bookmark'

const { categories, error, isLoading, totalLinks } = useBookmarks()

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
const favoriteIds = shallowRef(new Set<string>())
const categoryOrderIds = shallowRef<string[]>([])
const expandedCategoryIds = shallowRef(new Set<string>())
const linkMetrics = shallowRef<Record<string, LinkMetric>>({})
const searchScope = shallowRef<SearchScope>('global')
const viewDensity = shallowRef<ViewDensity>('standard')
const tickerMode = shallowRef<TickerMode>('favorite')
const dashboardRef = useTemplateRef<HTMLElement>('dashboardRef')
const cursorRef = useTemplateRef<HTMLElement>('cursorRef')
const heroRef = useTemplateRef<HTMLElement>('heroRef')
const bookmarkGridRef = useTemplateRef<HTMLElement>('bookmarkGridRef')
const searchInputRef = useTemplateRef<HTMLInputElement>('searchInputRef')
const tickerRef = useTemplateRef<HTMLElement>('tickerRef')
const tickerGroupRef = useTemplateRef<HTMLElement>('tickerGroupRef')
const bookmarkGridWidth = shallowRef(0)
const isTickerScrollable = shallowRef(false)
const isHeroDocked = shallowRef(false)
const heroHeight = shallowRef(0)
let animationContext: gsap.Context | null = null
let removePointerListener: (() => void) | null = null
let removeKeyboardListener: (() => void) | null = null
let clockTimer: number | null = null
let gridResizeFrame = 0
let tickerResizeFrame = 0
let gridResizeObserver: ResizeObserver | null = null
let heroResizeObserver: ResizeObserver | null = null
let tickerResizeObserver: ResizeObserver | null = null

const activeCategory = computed(() => {
  return findCategoryNode(categoryTree.value, activeCategoryId.value) ?? categoryTree.value[0]
})

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
      latestTitle: latestLink?.title ?? '等待访问信号',
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
    return '同步中'
  }

  if (error.value) {
    return '需扩展环境'
  }

  return totalLinks.value > 0 ? '已接入' : '无书签'
})

const tickerEmptyText = computed(() => {
  if (tickerMode.value === 'recent') {
    return '暂无最近访问，打开一个书签后自动记录'
  }

  if (tickerMode.value === 'frequent') {
    return '暂无高频访问，多打开几次后自动排序'
  }

  return '暂无常用，点击书签卡片星标添加'
})

const searchPlaceholder = computed(() => {
  return searchScope.value === 'category'
    ? '当前分类内搜索...'
    : '全局模糊搜索...'
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

  if (bookmarkGridRef.value) {
    scheduleBookmarkGridResize(bookmarkGridRef.value.getBoundingClientRect().width)
    gridResizeObserver = new ResizeObserver(([entry]) => {
      scheduleBookmarkGridResize(entry.contentRect.width)
    })

    gridResizeObserver.observe(bookmarkGridRef.value)
  }

  if (heroRef.value) {
    heroHeight.value = heroRef.value.offsetHeight
    heroResizeObserver = new ResizeObserver(([entry]) => {
      heroHeight.value = entry.borderBoxSize?.[0]?.blockSize ?? entry.contentRect.height
    })

    heroResizeObserver.observe(heroRef.value)
  }

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
  animateBookmarkCards()
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
  gridResizeObserver?.disconnect()
  heroResizeObserver?.disconnect()
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

function handleDashboardScroll(payload: { scrollTop: number }) {
  isHeroDocked.value = payload.scrollTop > 18
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
    .split(/[\/／]+/)
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
  return `node:${path.join(' / ').toLowerCase().replace(/[^a-z0-9\u4e00-\u9fa5]+/gi, '-')}`
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
    @scroll="handleDashboardScroll"
  >
    <main
      ref="dashboardRef"
      class="dashboard"
      :class="`density-${viewDensity}`"
    >
      <div ref="cursorRef" class="cursor-glow" />
      <div class="grid-backdrop" />
      <div class="scanline" />

      <section
        ref="heroRef"
        class="hero hud-panel"
        :class="{ 'is-docked': isHeroDocked }"
      >
        <div class="ticker-shell">
          <div class="hero-meta">
            <p class="hero-kicker">
              <Zap :size="16" />
              {{ currentDateTime }}
            </p>
            <div class="ticker-tabs" aria-label="顶部滚动来源">
              <button
                type="button"
                :class="{ 'is-active': tickerMode === 'favorite' }"
                @click="tickerMode = 'favorite'"
              >
                常用
              </button>
              <button
                type="button"
                :class="{ 'is-active': tickerMode === 'recent' }"
                @click="tickerMode = 'recent'"
              >
                最近
              </button>
              <button
                type="button"
                :class="{ 'is-active': tickerMode === 'frequent' }"
                @click="tickerMode = 'frequent'"
              >
                高频
              </button>
            </div>
          </div>

          <div
            ref="tickerRef"
            class="site-ticker"
            :class="{ 'is-scrollable': isTickerScrollable }"
            aria-label="网站滚动列表"
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
              {{ tickerEmptyText }}
            </span>
          </div>

          <div class="stats">
            <span>分类 {{ categories.length }}</span>
            <span>链接 {{ totalLinks }}</span>
            <span>常用 {{ favoriteLinks.length }}</span>
            <span>最近 {{ recentLinks.length }}</span>
            <span>高频 {{ frequentLinks.length }}</span>
            <span>状态 {{ syncStatus }}</span>
          </div>
        </div>
      </section>
      <div
        v-if="isHeroDocked"
        class="hero-spacer"
        :style="{ height: `${heroHeight}px` }"
        aria-hidden="true"
      />

      <section class="control-strip hud-panel">
        <label class="search-box">
          <Search :size="18" />
          <input ref="searchInputRef" v-model="query" :placeholder="searchPlaceholder" />
        </label>
        <div class="segmented-control" aria-label="搜索范围">
          <button
            type="button"
            :class="{ 'is-active': searchScope === 'global' }"
            @click="searchScope = 'global'"
          >
            全局
          </button>
          <button
            type="button"
            :class="{ 'is-active': searchScope === 'category' }"
            @click="searchScope = 'category'"
          >
            当前分类
          </button>
        </div>
        <div class="segmented-control density-control" aria-label="视觉密度">
          <button
            type="button"
            :class="{ 'is-active': viewDensity === 'compact' }"
            @click="viewDensity = 'compact'"
          >
            紧凑
          </button>
          <button
            type="button"
            :class="{ 'is-active': viewDensity === 'standard' }"
            @click="viewDensity = 'standard'"
          >
            标准
          </button>
          <button
            type="button"
            :class="{ 'is-active': viewDensity === 'showcase' }"
            @click="viewDensity = 'showcase'"
          >
            展示
          </button>
        </div>
      </section>

      <section v-if="error" class="error-panel">
        {{ error }}
      </section>

      <section class="workspace">
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
            <div class="channel-path" aria-label="当前分类路径">
              <span class="channel-path__label">CHANNEL</span>
              <span
                v-for="(segment, index) in activeDisplayPath"
                :key="`${segment}-${index}`"
                class="channel-path__segment"
              >
                <ChevronRight :size="13" class="channel-path__icon" aria-hidden="true" />
                <span>{{ segment }}</span>
              </span>
            </div>
            <span class="channel-count">{{ filteredLinks.length }} LINKS</span>
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
                  子分类 {{ childCard.childCount }} / 最近 {{ childCard.latestTitle }}
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
                  @open="openLink"
                  @open-current="openLinkInCurrentTab"
                  @open-window="openLinkInWindow"
                  @copy="copyLink"
                  @toggle-favorite="toggleFavorite"
                />
              </div>
            </template>
            <div v-else-if="activeChildCategories.length === 0 || query.trim()" class="empty-state">
              <span class="empty-state__scan" aria-hidden="true" />
              <strong>{{ query.trim() ? '未捕获匹配信号' : '当前频道为空' }}</strong>
              <span>{{ query.trim() ? '试试切换搜索范围，或者缩短关键词。' : '选择左侧其他分类，或在浏览器书签里添加新链接。' }}</span>
            </div>
          </div>
        </div>
      </section>
    </main>
  </Scrollbar>
</template>

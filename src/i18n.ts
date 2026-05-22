import { createI18n } from 'vue-i18n'

export type AppLocale = 'zh-CN' | 'en'

export const localeStorageKey = 'cyber-bookmark-locale'

export const localeOptions: Array<{ code: AppLocale, label: string, signal: string }> = [
  { code: 'zh-CN', label: '中文', signal: 'CN' },
  { code: 'en', label: 'English', signal: 'EN' },
]

const messages = {
  'zh-CN': {
    app: {
      language: '语言',
      switchLanguage: '切换语言',
    },
    bookmark: {
      unavailableError: '请在已加载的 Chrome 扩展新标签页中查看，当前环境无法访问 chrome.bookmarks。',
      readError: '读取 Chrome 书签失败',
    },
    dashboard: {
      latestSignalPending: '等待访问信号',
      syncStatus: {
        loading: '同步中',
        extensionRequired: '需扩展环境',
        connected: '已接入',
        empty: '无书签',
        waiting: '等待添加',
      },
      hero: {
        emptyBadge: '空库',
        loading: '正在读取浏览器书签...',
        empty: '浏览器书签库为空，添加第一个书签后即可生成频道',
      },
      ticker: {
        favorite: '常用',
        recent: '最近',
        frequent: '高频',
        favoriteEmpty: '暂无常用，点击书签卡片星标添加',
        recentEmpty: '暂无最近访问，打开一个书签后自动记录',
        frequentEmpty: '暂无高频访问，多打开几次后自动排序',
        sourceLabel: '顶部滚动来源',
        listLabel: '网站滚动列表',
      },
      stats: {
        categories: '分类 {count}',
        links: '链接 {count}',
        favorites: '常用 {count}',
        recent: '最近 {count}',
        frequent: '高频 {count}',
        status: '状态 {status}',
      },
      search: {
        globalPlaceholder: '全局模糊搜索...',
        categoryPlaceholder: '当前分类内搜索...',
        scopeLabel: '搜索范围',
        global: '全局',
        category: '当前分类',
      },
      density: {
        label: '视觉密度',
        compact: '紧凑',
        standard: '标准',
        showcase: '展示',
      },
      config: {
        export: '导出记录',
        import: '导入记录',
        exported: '记录备份已导出',
        imported: '已恢复 {count} 条记录',
        importFailed: '导入失败，请选择有效的 JSON 备份',
        warning: '导出的账号密码备注是明文 JSON，请妥善保管。',
      },
      emptyLibrary: {
        eyebrow: '书签输入待接入',
        title: '还没有可展示的书签',
        body: '在浏览器里把常用网页加入书签，刷新后这里会按文件夹自动生成频道、搜索和常用列表。',
        stepsLabel: '添加书签流程',
        stepOpen: '打开常用网页',
        stepStar: '点击地址栏星标',
        stepRefresh: '回到这里刷新',
        refresh: '刷新书签',
      },
      channel: {
        label: '频道',
        count: '{count} 个链接',
        pathLabel: '当前分类路径',
        childMeta: '子分类 {count} / 最近 {title}',
      },
      emptyState: {
        searchTitle: '未捕获匹配信号',
        searchBody: '试试切换搜索范围，或者缩短关键词。',
        channelTitle: '当前频道为空',
        channelBody: '选择左侧其他分类，或在浏览器书签里添加新链接。',
      },
    },
    categoryRail: {
      label: '书签分类',
      collapse: '{name} 收起',
      expand: '{name} 展开',
      sortLabel: '分类排序',
      moveUp: '{name} 前移',
      moveDown: '{name} 后移',
    },
    card: {
      removeFavorite: '从常用移除',
      addFavorite: '添加到常用',
      moreActions: '更多操作',
      copy: '复制链接',
      openCurrent: '当前页打开',
      openWindow: '新窗口打开',
      expandDetail: '展开账号密码或备注',
      collapseDetail: '收起账号密码或备注',
      noteTitle: '账号 / 密码 / 备注',
      notePlaceholder: '输入该网站的账号、密码提示或备注...',
    },
  },
  'en': {
    app: {
      language: 'Language',
      switchLanguage: 'Switch language',
    },
    bookmark: {
      unavailableError: 'Open this page from the loaded Chrome extension new tab. This environment cannot access chrome.bookmarks.',
      readError: 'Failed to read Chrome bookmarks',
    },
    dashboard: {
      latestSignalPending: 'Waiting for signal',
      syncStatus: {
        loading: 'Syncing',
        extensionRequired: 'Extension required',
        connected: 'Connected',
        empty: 'No bookmarks',
        waiting: 'Waiting for input',
      },
      hero: {
        emptyBadge: 'EMPTY LIBRARY',
        loading: 'Reading browser bookmarks...',
        empty: 'Bookmark library is empty. Add the first bookmark to generate channels.',
      },
      ticker: {
        favorite: 'Favorites',
        recent: 'Recent',
        frequent: 'Frequent',
        favoriteEmpty: 'No favorites yet. Star a bookmark card to pin it here.',
        recentEmpty: 'No recent visits yet. Opening a bookmark will start the log.',
        frequentEmpty: 'No frequent sites yet. Repeated opens will sort this lane.',
        sourceLabel: 'Ticker source',
        listLabel: 'Site ticker list',
      },
      stats: {
        categories: 'Categories {count}',
        links: 'Links {count}',
        favorites: 'Favorites {count}',
        recent: 'Recent {count}',
        frequent: 'Frequent {count}',
        status: 'Status {status}',
      },
      search: {
        globalPlaceholder: 'Global fuzzy search...',
        categoryPlaceholder: 'Search current category...',
        scopeLabel: 'Search scope',
        global: 'Global',
        category: 'Current',
      },
      density: {
        label: 'View density',
        compact: 'Compact',
        standard: 'Standard',
        showcase: 'Showcase',
      },
      config: {
        export: 'Export notes',
        import: 'Import notes',
        exported: 'Notes backup exported',
        imported: 'Restored {count} notes',
        importFailed: 'Import failed. Choose a valid JSON backup.',
        warning: 'Exported account, password, and note data is plain JSON. Keep it private.',
      },
      emptyLibrary: {
        eyebrow: 'BOOKMARK INPUT REQUIRED',
        title: 'No bookmarks to display yet',
        body: 'Add useful pages to your browser bookmarks, then refresh. Channels, search, and favorites will be generated from folders automatically.',
        stepsLabel: 'Add bookmark flow',
        stepOpen: 'Open a useful page',
        stepStar: 'Click the address-bar star',
        stepRefresh: 'Return here and refresh',
        refresh: 'Refresh bookmarks',
      },
      channel: {
        label: 'CHANNEL',
        count: '{count} LINKS',
        pathLabel: 'Current category path',
        childMeta: 'Subfolders {count} / Latest {title}',
      },
      emptyState: {
        searchTitle: 'No matching signal',
        searchBody: 'Try another scope or shorten the keyword.',
        channelTitle: 'This channel is empty',
        channelBody: 'Select another category on the left, or add links in browser bookmarks.',
      },
    },
    categoryRail: {
      label: 'Bookmark categories',
      collapse: 'Collapse {name}',
      expand: 'Expand {name}',
      sortLabel: 'Category sorting',
      moveUp: 'Move {name} up',
      moveDown: 'Move {name} down',
    },
    card: {
      removeFavorite: 'Remove from favorites',
      addFavorite: 'Add to favorites',
      moreActions: 'More actions',
      copy: 'Copy link',
      openCurrent: 'Open in current tab',
      openWindow: 'Open in new window',
      expandDetail: 'Expand account, password, or note',
      collapseDetail: 'Collapse account, password, or note',
      noteTitle: 'Account / password / note',
      notePlaceholder: 'Enter account, password hint, or site note...',
    },
  },
} as const

export const i18n = createI18n({
  legacy: false,
  locale: readInitialLocale(),
  fallbackLocale: 'en',
  messages,
})

function readInitialLocale(): AppLocale {
  const storedLocale = localStorage.getItem(localeStorageKey)

  if (storedLocale === 'zh-CN' || storedLocale === 'en') {
    return storedLocale
  }

  return navigator.language.toLowerCase().startsWith('zh') ? 'zh-CN' : 'en'
}

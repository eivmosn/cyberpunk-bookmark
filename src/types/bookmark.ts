export interface BookmarkLink {
  id: string
  title: string
  url: string
  folderPath: readonly string[]
  domain: string
  accent: string
}

export interface BookmarkCategory {
  id: string
  name: string
  path: readonly string[]
  links: readonly BookmarkLink[]
  accent: string
}

export interface BookmarkCategoryNode {
  id: string
  name: string
  path: readonly string[]
  links: readonly BookmarkLink[]
  directLinks: readonly BookmarkLink[]
  accent: string
  children: readonly BookmarkCategoryNode[]
}

export interface BookmarkCategoryViewItem extends BookmarkCategoryNode {
  depth: number
  hasChildren: boolean
  isExpanded: boolean
  siblingCount: number
  siblingIndex: number
}

import type { UUID } from './types'

const UUID_PATTERN = '[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}'
const TREE_PATH_PATTERN = new RegExp(`^/trees/(${UUID_PATTERN})/?$`, 'i')

export function treePath(treeId: UUID): string {
  return `/trees/${treeId}`
}

export function treeIdFromPath(pathname: string): UUID | null {
  return TREE_PATH_PATTERN.exec(pathname)?.[1] ?? null
}

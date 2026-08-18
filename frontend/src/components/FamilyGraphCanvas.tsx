import { useEffect, useMemo } from 'react'
import ELK from 'elkjs/lib/elk.bundled.js'
import {
  Background, BaseEdge, Controls, EdgeLabelRenderer, MarkerType, ReactFlow, ReactFlowProvider, getStraightPath,
  useEdgesState, useNodesState, useReactFlow, type Edge, type EdgeProps,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import type { FamilyGraph, Person, UUID } from '../types'
import { PersonNode, type PersonFlowNode } from './PersonNode'
import { useI18n } from '../i18n'

const elk = new ELK()
const nodeTypes = { person: PersonNode }
const edgeTypes = { partnership: PartnershipEdge }
const NODE_WIDTH = 156
const NODE_HEIGHT = 190
const PARTNER_GAP = 48
const GROUP_GAP = 88
const GENERATION_GAP = 90

interface Props {
  graph: FamilyGraph
  selectedPersonIds: UUID[]
  focusId: string | null
  onSelect: (personId: UUID, nodeId: string) => void
  onToggleSelect: (personId: UUID) => void
  onSelectConnection: (personIds: UUID[]) => void
  onClearSelection: () => void
  onAddRelative: (kind: 'parent' | 'child' | 'partner') => void
}

export interface PersonAlias {
  id: string
  personId: UUID
}

export interface VisualGraphOccurrences {
  aliases: PersonAlias[]
  relationshipTargets: Map<UUID, string>
}

export function FamilyGraphCanvas(props: Props) {
  return <ReactFlowProvider><Canvas {...props} /></ReactFlowProvider>
}

function Canvas({ graph, selectedPersonIds, focusId, onSelect, onToggleSelect, onSelectConnection, onClearSelection, onAddRelative }: Props) {
  const { t } = useI18n()
  const [nodes, setNodes, onNodesChange] = useNodesState<PersonFlowNode>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([])
  const flow = useReactFlow<PersonFlowNode, Edge>()
  const visualOccurrences = useMemo(() => findVisualGraphOccurrences(graph), [graph])
  const peopleById = useMemo(() => new Map(graph.people.map((person) => [person.id, person])), [graph.people])
  const visualPeople = useMemo<Array<{ id: string; person: Person; isAlias: boolean }>>(() => [
    ...graph.people.map((person) => ({ id: person.id, person, isAlias: false })),
    ...visualOccurrences.aliases.flatMap((alias) => {
      const person = peopleById.get(alias.personId)
      return person ? [{ id: alias.id, person, isAlias: true }] : []
    }),
  ], [graph.people, peopleById, visualOccurrences.aliases])

  const graphEdges = useMemo<Edge[]>(() => [
    ...graph.parentChildRelationships.map((relation) => ({
      id: `pc-${relation.id}`, source: relation.parentId, target: visualOccurrences.relationshipTargets.get(relation.id) ?? relation.childId,
      sourceHandle: 'child', targetHandle: 'parent', type: 'smoothstep',
      markerEnd: { type: MarkerType.ArrowClosed, color: '#97a59d' },
      style: { stroke: relation.relationshipType === 'BIOLOGICAL' ? '#97a59d' : '#b4a58d', strokeDasharray: relation.relationshipType === 'BIOLOGICAL' ? undefined : '6 4' },
    })),
    ...graph.partnerships.map((relation) => ({
      id: `partner-${relation.id}`, source: relation.person1Id, target: relation.person2Id,
      sourceHandle: 'partner-right', targetHandle: 'partner-left', type: 'partnership',
      style: { stroke: '#c47b70', strokeWidth: 2 }, label: relation.partnershipType === 'MARRIAGE' ? t('married') : undefined,
      labelStyle: { fill: '#8d5d55', fontSize: 10 },
    })),
  ], [graph.parentChildRelationships, graph.partnerships, t, visualOccurrences.relationshipTargets])

  useEffect(() => {
    let current = true
    const layout = async () => {
      const result = await elk.layout({
        id: 'root',
        layoutOptions: {
          'elk.algorithm': 'layered', 'elk.direction': 'DOWN', 'elk.spacing.nodeNode': '48',
          'elk.layered.spacing.nodeNodeBetweenLayers': '90', 'elk.layered.nodePlacement.strategy': 'NETWORK_SIMPLEX',
        },
        children: visualPeople.map((occurrence) => ({ id: occurrence.id, width: NODE_WIDTH, height: NODE_HEIGHT })),
        edges: graph.parentChildRelationships.map((relation) => ({
          id: relation.id,
          sources: [relation.parentId],
          targets: [visualOccurrences.relationshipTargets.get(relation.id) ?? relation.childId],
        })),
      })
      if (!current) return
      const positions = arrangeFamilyTreePositions(
        new Map((result.children ?? []).map((node) => [node.id, { x: node.x ?? 0, y: node.y ?? 0 }])),
        visualPeople.map((occurrence) => occurrence.id),
        graph.parentChildRelationships.map((relationship) => [relationship.parentId, visualOccurrences.relationshipTargets.get(relationship.id) ?? relationship.childId]),
        graph.partnerships.map((partnership) => [partnership.person1Id, partnership.person2Id]),
        new Map(visualPeople.map((occurrence) => [occurrence.id, occurrence.person.gender])),
      )
      setNodes(visualPeople.map((occurrence) => {
        const position = positions.get(occurrence.id)
        return {
          id: occurrence.id,
          type: 'person',
          position: position ?? { x: 0, y: 0 },
          data: { person: occurrence.person, onAddRelative, isAlias: occurrence.isAlias },
          selected: selectedPersonIds.includes(occurrence.person.id),
          draggable: false,
        }
      }))
      const positionedEdges = graphEdges.map((edge) => {
        if (!edge.id.startsWith('partner-')) return edge
        const sourceIsLeft = (positions.get(edge.source)?.x ?? 0) <= (positions.get(edge.target)?.x ?? 0)
        return {
          ...edge,
          sourceHandle: sourceIsLeft ? 'partner-right' : 'partner-source-left',
          targetHandle: sourceIsLeft ? 'partner-left' : 'partner-target-right',
        }
      })
      setEdges(positionedEdges)
      requestAnimationFrame(() => flow.fitView({ padding: 0.25, duration: 500 }))
    }
    void layout()
    return () => { current = false }
  }, [graph.parentChildRelationships, graph.partnerships, graphEdges, flow, setEdges, setNodes, visualOccurrences.relationshipTargets, visualPeople])

  useEffect(() => {
    setNodes((existing) => selectPersonOccurrences(existing, selectedPersonIds))
  }, [selectedPersonIds, setNodes])

  useEffect(() => {
    if (!focusId) return
    const node = flow.getNode(focusId)
    if (node) flow.setCenter(node.position.x + NODE_WIDTH / 2, node.position.y + NODE_HEIGHT / 2, { zoom: 1.25, duration: 600 })
  }, [focusId, flow, nodes])

  return (
    <ReactFlow<PersonFlowNode, Edge>
      nodes={nodes} edges={edges} nodeTypes={nodeTypes}
      onNodesChange={(changes) => onNodesChange(changes.filter((change) => change.type !== 'select'))}
      onEdgesChange={onEdgesChange}
      edgeTypes={edgeTypes}
      onNodeClick={(event, node) => {
        if (event.ctrlKey || event.metaKey || event.shiftKey) onToggleSelect(node.data.person.id)
        else onSelect(node.data.person.id, node.id)
      }} minZoom={0.08} maxZoom={2.5} fitView nodesDraggable={false} elementsSelectable
      onEdgeClick={(event, edge) => {
        const pointElements = document.elementsFromPoint?.(event.clientX, event.clientY) ?? []
        const overlappingEdgeIds = edgeIdsFromPointElements(pointElements, edge.id)
        const selectedEdges = new Set(overlappingEdgeIds)
        setEdges((existing) => existing.map((candidate) => ({ ...candidate, selected: selectedEdges.has(candidate.id) })))
        const personIds = personIdsForGraphEdges(overlappingEdgeIds, graph)
        if (personIds.length) {
          onSelectConnection(personIds)
          return
        }
        const fallbackPersonIds = [flow.getNode(edge.source)?.data.person.id, flow.getNode(edge.target)?.data.person.id]
          .filter((personId): personId is UUID => personId !== undefined)
        onSelectConnection([...new Set(fallbackPersonIds)])
      }}
      onPaneClick={() => {
        setEdges((existing) => existing.map((edge) => ({ ...edge, selected: false })))
        onClearSelection()
      }}
      proOptions={{ hideAttribution: true }}
    >
      <Background color="#d7dbd5" gap={24} size={1} />
      <Controls showInteractive={false} />
    </ReactFlow>
  )
}

export function selectPersonOccurrences(nodes: PersonFlowNode[], selectedPersonIds: readonly UUID[]): PersonFlowNode[] {
  const selected = new Set(selectedPersonIds)
  return nodes.map((node) => ({ ...node, selected: selected.has(node.data.person.id) }))
}

export function edgeIdsFromPointElements(elements: Element[], clickedEdgeId: string): string[] {
  const edgeIds = elements
    .map((element) => element.closest('.react-flow__edge')?.getAttribute('data-id'))
    .filter((edgeId): edgeId is string => Boolean(edgeId))
  return [...new Set([clickedEdgeId, ...edgeIds])]
}

export function personIdsForGraphEdges(edgeIds: readonly string[], graph: FamilyGraph): UUID[] {
  const personIds = edgeIds.flatMap((edgeId) => {
    if (edgeId.startsWith('pc-')) {
      const relationship = graph.parentChildRelationships.find((candidate) => `pc-${candidate.id}` === edgeId)
      return relationship ? [relationship.parentId, relationship.childId] : []
    }
    if (edgeId.startsWith('partner-')) {
      const partnership = graph.partnerships.find((candidate) => `partner-${candidate.id}` === edgeId)
      return partnership ? [partnership.person1Id, partnership.person2Id] : []
    }
    return []
  })
  return [...new Set(personIds)]
}

export function haveDirectRelationship(firstPersonId: UUID, secondPersonId: UUID, graph: FamilyGraph): boolean {
  const isSelectedPair = (firstId: UUID, secondId: UUID) =>
    (firstId === firstPersonId && secondId === secondPersonId) || (firstId === secondPersonId && secondId === firstPersonId)
  return graph.partnerships.some((partnership) => isSelectedPair(partnership.person1Id, partnership.person2Id))
    || graph.parentChildRelationships.some((relationship) => isSelectedPair(relationship.parentId, relationship.childId))
}

export function toggleConnectionPerson(currentPersonIds: readonly UUID[], personId: UUID): UUID[] {
  if (currentPersonIds.includes(personId)) return currentPersonIds.filter((id) => id !== personId)
  if (currentPersonIds.length === 2) return [currentPersonIds[0], personId]
  return currentPersonIds.length < 2 ? [...currentPersonIds, personId] : [...currentPersonIds]
}

export function findVisualGraphOccurrences(graph: FamilyGraph): VisualGraphOccurrences {
  const parent = new Map(graph.people.map((person) => [person.id, person.id]))
  const find = (id: UUID): UUID => {
    const direct = parent.get(id) ?? id
    if (direct === id) return id
    const root = find(direct)
    parent.set(id, root)
    return root
  }
  const union = (first: UUID, second: UUID) => {
    const firstRoot = find(first)
    const secondRoot = find(second)
    if (firstRoot !== secondRoot) parent.set(secondRoot, firstRoot)
  }
  graph.partnerships.forEach((partnership) => union(partnership.person1Id, partnership.person2Id))

  const componentIds = new Set(graph.people.map((person) => find(person.id)))
  const outgoing = new Map<UUID, Set<UUID>>()
  const indegree = new Map([...componentIds].map((id) => [id, 0]))
  graph.parentChildRelationships.forEach((relationship) => {
    const from = find(relationship.parentId)
    const to = find(relationship.childId)
    if (from === to || outgoing.get(from)?.has(to)) return
    outgoing.set(from, new Set([...(outgoing.get(from) ?? []), to]))
    indegree.set(to, (indegree.get(to) ?? 0) + 1)
  })

  const rank = new Map([...componentIds].map((id) => [id, 0]))
  const pending = [...componentIds].filter((id) => indegree.get(id) === 0)
  for (let index = 0; index < pending.length; index += 1) {
    const componentId = pending[index]
    for (const child of outgoing.get(componentId) ?? []) {
      rank.set(child, Math.max(rank.get(child) ?? 0, (rank.get(componentId) ?? 0) + 1))
      indegree.set(child, (indegree.get(child) ?? 1) - 1)
      if (indegree.get(child) === 0) pending.push(child)
    }
  }

  const aliasesById = new Map<string, PersonAlias>()
  const relationshipTargets = new Map<UUID, string>()
  graph.parentChildRelationships.forEach((relationship) => {
    const parentRank = rank.get(find(relationship.parentId)) ?? 0
    const childRank = rank.get(find(relationship.childId)) ?? 0
    if (childRank <= parentRank + 1) return
    const aliasId = `alias:${relationship.childId}:generation:${parentRank + 1}`
    aliasesById.set(aliasId, { id: aliasId, personId: relationship.childId })
    relationshipTargets.set(relationship.id, aliasId)
  })

  return { aliases: [...aliasesById.values()], relationshipTargets }
}

function PartnershipEdge({ id, sourceX, sourceY, targetX, targetY, style, label }: EdgeProps) {
  const [path, labelX, labelY] = getStraightPath({ sourceX, sourceY, targetX, targetY })
  return <>
    <BaseEdge id={id} path={path} style={style} />
    {label && <EdgeLabelRenderer>
      <div
        className="partnership-edge-label"
        role="img"
        aria-label={typeof label === 'string' ? label : undefined}
        style={{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY - 17}px)` }}
      >
        <WeddingRingsIcon />
      </div>
    </EdgeLabelRenderer>}
  </>
}

export function WeddingRingsIcon() {
  return (
    <svg viewBox="0 0 32 20" aria-hidden="true" focusable="false">
      <circle cx="11" cy="12" r="6" />
      <circle cx="21" cy="12" r="6" />
      <path d="M18.5 5.2 21 1.8l2.5 3.4L21 7.6Z" />
    </svg>
  )
}

export function arrangeFamilyTreePositions(
  suggested: Map<string, { x: number; y: number }>,
  personIds: string[],
  parentChildEdges: Array<[string, string]>,
  partnerships: Array<[string, string]>,
  genders: Map<string, string | null> = new Map(),
) {
  const parent = new Map(personIds.map((id) => [id, id]))
  const find = (id: string): string => {
    const direct = parent.get(id) ?? id
    if (direct === id) return id
    const root = find(direct)
    parent.set(id, root)
    return root
  }
  const union = (first: string, second: string) => {
    const firstRoot = find(first)
    const secondRoot = find(second)
    if (firstRoot !== secondRoot) parent.set(secondRoot, firstRoot)
  }
  partnerships.forEach(([first, second]) => union(first, second))
  const partnerOrder = new Map<string, number>()
  partnerships.forEach(([first, second]) => {
    partnerOrder.set(first, (partnerOrder.get(first) ?? 0) - 1)
    partnerOrder.set(second, (partnerOrder.get(second) ?? 0) + 1)
  })

  const members = new Map<string, string[]>()
  personIds.forEach((id) => {
    const root = find(id)
    members.set(root, [...(members.get(root) ?? []), id])
  })
  const outgoing = new Map<string, Set<string>>()
  const indegree = new Map([...members.keys()].map((root) => [root, 0]))
  parentChildEdges.forEach(([parentId, childId]) => {
    const from = find(parentId)
    const to = find(childId)
    if (from === to || outgoing.get(from)?.has(to)) return
    outgoing.set(from, new Set([...(outgoing.get(from) ?? []), to]))
    indegree.set(to, (indegree.get(to) ?? 0) + 1)
  })

  const rank = new Map([...members.keys()].map((root) => [root, 0]))
  const pending = [...members.keys()].filter((root) => indegree.get(root) === 0)
  for (let index = 0; index < pending.length; index += 1) {
    const root = pending[index]
    for (const child of outgoing.get(root) ?? []) {
      rank.set(child, Math.max(rank.get(child) ?? 0, (rank.get(root) ?? 0) + 1))
      indegree.set(child, (indegree.get(child) ?? 1) - 1)
      if (indegree.get(child) === 0) pending.push(child)
    }
  }

  const suggestedX = (root: string) => {
    const group = members.get(root) ?? []
    return group.reduce((sum, id) => sum + (suggested.get(id)?.x ?? 0), 0) / Math.max(group.length, 1)
  }
  const rows = new Map<number, string[]>()
  members.forEach((_, root) => {
    const row = rank.get(root) ?? 0
    rows.set(row, [...(rows.get(row) ?? []), root])
  })

  const incoming = new Map<string, Set<string>>()
  outgoing.forEach((children, root) => children.forEach((child) => incoming.set(child, new Set([...(incoming.get(child) ?? []), root]))))
  const groupWidth = (root: string) => {
    const count = members.get(root)?.length ?? 1
    return count * NODE_WIDTH + (count - 1) * PARTNER_GAP
  }
  const centers = new Map<string, number>()

  const packRow = (row: number, desired: (root: string) => number) => {
    const roots = [...(rows.get(row) ?? [])].sort((first, second) => {
      const difference = desired(first) - desired(second)
      return difference === 0 ? suggestedX(first) - suggestedX(second) : difference
    })
    if (!roots.length) return
    const leftEdges: number[] = []
    roots.forEach((root, index) => {
      const preferredLeft = desired(root) - groupWidth(root) / 2
      leftEdges[index] = index === 0 ? preferredLeft : Math.max(preferredLeft, leftEdges[index - 1] + groupWidth(roots[index - 1]) + GROUP_GAP)
    })
    const averageOffset = roots.reduce((sum, root, index) => sum + desired(root) - (leftEdges[index] + groupWidth(root) / 2), 0) / roots.length
    roots.forEach((root, index) => centers.set(root, leftEdges[index] + averageOffset + groupWidth(root) / 2))
    rows.set(row, roots)
  }

  const rowNumbers = [...rows.keys()].sort((first, second) => first - second)
  rowNumbers.forEach((row) => packRow(row, (root) => suggestedX(root)))
  repeat(5, () => {
    rowNumbers.slice(1).forEach((row) => packRow(row, (root) => averageCenter(incoming.get(root), centers) ?? centers.get(root) ?? suggestedX(root)))
    rowNumbers.slice(0, -1).reverse().forEach((row) => packRow(row, (root) => averageCenter(outgoing.get(root), centers) ?? centers.get(root) ?? suggestedX(root)))
  })

  const result = new Map<string, { x: number; y: number }>()
  rows.forEach((roots, row) => roots.forEach((root) => {
    const group = [...(members.get(root) ?? [])].sort((first, second) => {
      const genderDifference = genderOrder(genders.get(first)) - genderOrder(genders.get(second))
      if (genderDifference !== 0) return genderDifference
      const partnershipDifference = (partnerOrder.get(first) ?? 0) - (partnerOrder.get(second) ?? 0)
      return partnershipDifference === 0 ? (suggested.get(first)?.x ?? 0) - (suggested.get(second)?.x ?? 0) : partnershipDifference
    })
    const left = (centers.get(root) ?? 0) - groupWidth(root) / 2
    group.forEach((id, personIndex) => result.set(id, { x: left + personIndex * (NODE_WIDTH + PARTNER_GAP), y: row * (NODE_HEIGHT + GENERATION_GAP) }))
  }))
  return result
}

function genderOrder(gender: string | null | undefined) {
  const normalized = gender?.trim().toUpperCase()
  if (normalized === 'FEMALE' || normalized === 'ŽENSKI' || normalized === 'ZENSKI' || normalized === 'ŽENSKA' || normalized === 'ZENSKA' || normalized === 'F') return 0
  if (normalized === 'MALE' || normalized === 'MOŠKI' || normalized === 'MOSKI' || normalized === 'M') return 2
  return 1
}

function averageCenter(related: Set<string> | undefined, centers: Map<string, number>) {
  const values = [...(related ?? [])].map((id) => centers.get(id)).filter((value): value is number => value !== undefined)
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : undefined
}

function repeat(times: number, action: () => void) {
  for (let iteration = 0; iteration < times; iteration += 1) action()
}

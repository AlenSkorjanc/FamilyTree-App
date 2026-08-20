import { useEffect, useMemo } from 'react'
import ELK from 'elkjs/lib/elk.bundled.js'
import {
  Background, Controls, ReactFlow, ReactFlowProvider, useEdgesState, useNodesState, useReactFlow, type Edge,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import type { FamilyGraph, Person, UUID } from '../types'
import { PersonNode, type PersonFlowNode } from './PersonNode'
import { useI18n } from '../i18n'
import { arrangeFamilyTreePositions, findVisualGraphOccurrences, joinsPartnerCards, NODE_HEIGHT, NODE_WIDTH, PARTNER_GAP, partnershipRouteLevel, partnershipRouteY } from './familyGraphLayout'
import { completeFamilyBranchEdgeIds, edgeIdsFromPointElements, mobileFocusedViewport, personIdsForGraphEdges, selectPersonOccurrences } from './familyGraphInteractions'
import { PartnershipEdge } from './PartnershipEdge'
import { ParentChildEdge } from './ParentChildEdge'
import { sharedFamilyEdgeId, sharedFamilyTrunkEdgeId, sharedParentFamilies } from './familyGraphEdges'
import { partnershipStatusLabel } from '../i18n'

const elk = new ELK()
const nodeTypes = { person: PersonNode }
const edgeTypes = { parentChild: ParentChildEdge, partnership: PartnershipEdge }

interface Props {
  graph: FamilyGraph
  readOnly?: boolean
  selectedPersonIds: UUID[]
  edgeSelectionActive: boolean
  focusId: string | null
  onSelect: (personId: UUID, nodeId: string) => void
  onToggleSelect: (personId: UUID) => void
  onSelectConnection: (personIds: UUID[]) => void
  onClearSelection: () => void
  onAddRelative: (personId: UUID, nodeId: string, kind: 'parent' | 'child' | 'partner') => void
}

export function FamilyGraphCanvas(props: Props) {
  return <ReactFlowProvider><Canvas {...props} /></ReactFlowProvider>
}

function Canvas({ graph, readOnly = false, selectedPersonIds, edgeSelectionActive, focusId, onSelect, onToggleSelect, onSelectConnection, onClearSelection, onAddRelative }: Props) {
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
  const sharedFamilies = useMemo(() => sharedParentFamilies(graph), [graph])
  const sharedRelationships = useMemo(() => new Set(
    sharedFamilies.flatMap((family) => family.children.flatMap((child) => child.relationships.map((relationship) => relationship.id))),
  ), [sharedFamilies])
  const partnershipCounts = useMemo(() => {
    const counts = new Map<UUID, number>()
    graph.partnerships.forEach((partnership) => {
      counts.set(partnership.person1Id, (counts.get(partnership.person1Id) ?? 0) + 1)
      counts.set(partnership.person2Id, (counts.get(partnership.person2Id) ?? 0) + 1)
    })
    return counts
  }, [graph.partnerships])
  const sharedBranchesByEdgeId = useMemo(() => new Map<string, { family: (typeof sharedFamilies)[number]; part: 'trunk' | 'child' }>(
    sharedFamilies.flatMap((family) => [
      [sharedFamilyTrunkEdgeId(family.partnership.id), { family, part: 'trunk' as const }] as const,
      ...family.children.map((child) => [
        sharedFamilyEdgeId(family.partnership.id, child.childId),
        { family, part: 'child' as const },
      ] as const),
    ]),
  ), [sharedFamilies])

  const graphEdges = useMemo<Edge[]>(() => [
    ...graph.parentChildRelationships.filter((relation) => !sharedRelationships.has(relation.id)).map((relation) => ({
      id: `pc-${relation.id}`, source: relation.parentId, target: visualOccurrences.relationshipTargets.get(relation.id) ?? relation.childId,
      sourceHandle: 'child', targetHandle: 'parent', type: 'parentChild',
      style: {
        stroke: relation.relationshipType === 'BIOLOGICAL' ? '#899b90' : '#aa9b84',
        strokeWidth: 1.4,
        strokeDasharray: relation.relationshipType === 'BIOLOGICAL' ? undefined : '6 5',
      },
    })),
    ...sharedFamilies.flatMap((family) => family.children.map((child) => ({
      id: sharedFamilyEdgeId(family.partnership.id, child.childId),
      source: family.partnership.person1Id,
      target: visualOccurrences.relationshipTargets.get(child.relationships[0].id)
        ?? visualOccurrences.relationshipTargets.get(child.relationships[1].id)
        ?? child.childId,
      sourceHandle: 'child', targetHandle: 'parent', type: 'parentChild',
      style: {
        stroke: child.relationships.every((relationship) => relationship.relationshipType === 'BIOLOGICAL') ? '#899b90' : '#aa9b84',
        strokeWidth: 1.4,
        strokeDasharray: child.relationships.every((relationship) => relationship.relationshipType === 'BIOLOGICAL') ? undefined : '6 5',
      },
    }))),
    ...sharedFamilies.map((family) => ({
      id: sharedFamilyTrunkEdgeId(family.partnership.id),
      source: family.partnership.person1Id, target: family.partnership.person2Id,
      type: 'parentChild',
      style: { stroke: '#899b90', strokeWidth: 1.4 },
    })),
    ...graph.partnerships.map((relation) => ({
      id: `partner-${relation.id}`, source: relation.person1Id, target: relation.person2Id,
      sourceHandle: 'partner-bottom-source', targetHandle: 'partner-bottom-target', type: 'partnership',
      style: { stroke: relation.isCurrent ? '#a96057' : '#c47b70', strokeWidth: 1.4 },
      label: relation.isCurrent || (partnershipCounts.get(relation.person1Id) === 1 && partnershipCounts.get(relation.person2Id) === 1)
        ? partnershipStatusLabel(relation.partnershipType, t)
        : undefined,
      data: { partnershipType: relation.partnershipType, isCurrent: relation.isCurrent, joined: true },
      labelStyle: { fill: '#8d5d55', fontSize: 10 },
    })),
  ], [graph.parentChildRelationships, graph.partnerships, partnershipCounts, sharedFamilies, sharedRelationships, t, visualOccurrences.relationshipTargets])

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
        graph.partnerships.map((partnership) => ({
          id: partnership.id,
          person1Id: partnership.person1Id,
          person2Id: partnership.person2Id,
          partnershipType: partnership.partnershipType,
          isCurrent: partnership.isCurrent,
          startDate: partnership.startDate,
          createdAt: partnership.createdAt,
        })),
        new Map(visualPeople.map((occurrence) => [occurrence.id, occurrence.person.gender])),
        new Map(visualPeople.map((occurrence) => [occurrence.id, occurrence.person.birthDate])),
      )
      setNodes(visualPeople.map((occurrence) => {
        const position = positions.get(occurrence.id)
        const joinedPartners = graph.partnerships.filter((partnership) => joinsPartnerCards(partnership.partnershipType)).flatMap((partnership) => {
          if (partnership.person1Id === occurrence.id) return [partnership.person2Id]
          if (partnership.person2Id === occurrence.id) return [partnership.person1Id]
          return []
        }).map((partnerId) => positions.get(partnerId)).filter((partnerPosition): partnerPosition is { x: number; y: number } => Boolean(partnerPosition))
        return {
          id: occurrence.id,
          type: 'person',
          position: position ?? { x: 0, y: 0 },
          data: {
            person: occurrence.person,
            onAddRelative: (kind) => onAddRelative(occurrence.person.id, occurrence.id, kind),
            quickAddEnabled: !readOnly,
            isAlias: occurrence.isAlias,
            joinedPartnerLeft: joinedPartners.some((partnerPosition) => partnerPosition.x < (position?.x ?? 0) && partnerPosition.y === position?.y && Math.abs(partnerPosition.x - (position?.x ?? 0)) <= NODE_WIDTH + PARTNER_GAP + 1),
            joinedPartnerRight: joinedPartners.some((partnerPosition) => partnerPosition.x > (position?.x ?? 0) && partnerPosition.y === position?.y && Math.abs(partnerPosition.x - (position?.x ?? 0)) <= NODE_WIDTH + PARTNER_GAP + 1),
          },
          selected: selectedPersonIds.includes(occurrence.person.id),
          draggable: false,
        }
      }))
      const positionedEdges = graphEdges.map((edge) => {
        const sharedBranch = sharedBranchesByEdgeId.get(edge.id)
        if (sharedBranch) {
          const firstPosition = positions.get(sharedBranch.family.partnership.person1Id)
          const secondPosition = positions.get(sharedBranch.family.partnership.person2Id)
          if (!firstPosition || !secondPosition) return edge
          const parentBottomY = Math.max(firstPosition.y, secondPosition.y) + NODE_HEIGHT
          const horizontalDistance = Math.abs(firstPosition.x - secondPosition.x)
          const routeLevel = partnershipRouteLevel(horizontalDistance, firstPosition.y === secondPosition.y)
          const partnershipY = partnershipRouteY(parentBottomY, routeLevel)
          return {
            ...edge,
            data: {
              branchOrigin: {
                x: (firstPosition.x + secondPosition.x) / 2 + NODE_WIDTH / 2,
                y: partnershipY + 2,
                splitY: partnershipY + 44,
              },
              branchPart: sharedBranch.part,
            },
          }
        }
        if (!edge.id.startsWith('partner-')) return edge
        const sourcePosition = positions.get(edge.source)
        const targetPosition = positions.get(edge.target)
        const horizontalDistance = Math.abs((sourcePosition?.x ?? 0) - (targetPosition?.x ?? 0))
        const joined = sourcePosition?.y === targetPosition?.y
          && joinsPartnerCards(graph.partnerships.find((partnership) => `partner-${partnership.id}` === edge.id)?.partnershipType ?? 'OTHER')
          && horizontalDistance <= NODE_WIDTH + PARTNER_GAP + 1
        const routeLevel = partnershipRouteLevel(horizontalDistance, sourcePosition?.y === targetPosition?.y)
        return {
          ...edge,
          data: { ...edge.data, joined, routeLevel },
        }
      })
      setEdges(positionedEdges)
      requestAnimationFrame(() => flow.fitView({ padding: 0.25, duration: 500 }))
    }
    void layout()
    return () => { current = false }
  }, [graph.parentChildRelationships, graph.partnerships, graphEdges, flow, setEdges, setNodes, sharedBranchesByEdgeId, visualOccurrences.relationshipTargets, visualPeople])

  useEffect(() => {
    setNodes((existing) => selectPersonOccurrences(existing, selectedPersonIds, edgeSelectionActive))
  }, [edgeSelectionActive, selectedPersonIds, setNodes])

  useEffect(() => {
    if (!focusId) return
    const node = flow.getNode(focusId)
    if (!node) return
    const nodeCenter = { x: node.position.x + NODE_WIDTH / 2, y: node.position.y + NODE_HEIGHT / 2 }
    if (window.matchMedia('(max-width: 520px)').matches) {
      const viewport = document.querySelector<HTMLElement>('.canvas-area .react-flow')?.getBoundingClientRect()
      if (viewport) {
        void flow.setViewport(mobileFocusedViewport(nodeCenter, viewport.width, viewport.height), { duration: 600 })
        return
      }
    }
    void flow.setCenter(nodeCenter.x, nodeCenter.y, { zoom: 1.25, duration: 600 })
  }, [focusId, flow, nodes])

  return (
    <ReactFlow<PersonFlowNode, Edge>
      nodes={nodes} edges={edges} nodeTypes={nodeTypes}
      onNodesChange={(changes) => onNodesChange(changes.filter((change) => change.type !== 'select'))}
      onEdgesChange={onEdgesChange}
      edgeTypes={edgeTypes}
      onNodeClick={(event, node) => {
        if (!readOnly && (event.ctrlKey || event.metaKey || event.shiftKey)) onToggleSelect(node.data.person.id)
        else onSelect(node.data.person.id, node.id)
      }} minZoom={0.08} maxZoom={2.5} fitView nodesDraggable={false} elementsSelectable elevateEdgesOnSelect
      onEdgeClick={(event, edge) => {
        const pointElements = document.elementsFromPoint?.(event.clientX, event.clientY) ?? []
        const overlappingEdgeIds = edgeIdsFromPointElements(pointElements, edge.id)
        const selectedEdges = new Set(completeFamilyBranchEdgeIds(overlappingEdgeIds, graph))
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
      <Background color="#e1e6e1" gap={28} size={0.8} />
      <Controls showInteractive={false} />
    </ReactFlow>
  )
}

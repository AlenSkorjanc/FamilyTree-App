import { useEffect, useMemo } from 'react'
import ELK from 'elkjs/lib/elk.bundled.js'
import {
  Background, ControlButton, Controls, ReactFlow, ReactFlowProvider, useEdgesState, useNodesState, useReactFlow, type Edge,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import type { FamilyGraph, Person, UUID } from '../types'
import { PersonNode, type PersonFlowNode } from './PersonNode'
import { useI18n } from '../i18n'
import { arrangeFamilyTreePositions, joinsPartnerCards, NODE_HEIGHT, NODE_WIDTH, PARTNER_GAP, partnershipRouteLevel, partnershipRouteY } from './familyGraphLayout'
import { closestEdgeIdFromPointElements, completeFamilyBranchEdgeIds, focusedViewportLeftOfDetails, mobileFocusedViewport, personIdsForGraphEdges, selectPersonOccurrences } from './familyGraphInteractions'
import { findVisualGraphOccurrences, validateVisualGraphPositions } from './familyGraphOccurrences'
import { PartnershipEdge } from './PartnershipEdge'
import { ParentChildEdge } from './ParentChildEdge'
import { sharedFamilyEdgeId, sharedFamilyTrunkEdgeId, sharedParentFamilies } from './familyGraphEdges'
import { partnershipStatusLabel } from '../i18n'
import { FitViewIcon, MinusIcon, PlusIcon } from './Icons'

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
  const visualPeople = useMemo<Array<{ id: string; person: Person; isAlias: boolean }>>(() => visualOccurrences.occurrences.flatMap((occurrence) => {
    const person = peopleById.get(occurrence.personId)
    return person ? [{ id: occurrence.id, person, isAlias: occurrence.isAlias }] : []
  }), [peopleById, visualOccurrences.occurrences])
  // Co-parent links are display-only; never add them to the persisted graph.
  const displayGraph = useMemo<FamilyGraph>(() => {
    const partnerships = [...graph.partnerships]
    const byChild = new Map<UUID, typeof graph.parentChildRelationships>()
    graph.parentChildRelationships.forEach((relation) => {
      byChild.set(relation.childId, [...(byChild.get(relation.childId) ?? []), relation])
    })
    byChild.forEach((relations) => {
      if (relations.length !== 2) return
      const [first, second] = [...relations].sort((a, b) => a.parentId.localeCompare(b.parentId))
      if (partnerships.some((p) => (p.person1Id === first.parentId && p.person2Id === second.parentId)
        || (p.person2Id === first.parentId && p.person1Id === second.parentId))) return
      const a = visualOccurrences.relationshipEndpoints.get(first.id)
      const b = visualOccurrences.relationshipEndpoints.get(second.id)
      if (!a || !b || a.sourceId !== first.parentId || b.sourceId !== second.parentId
        || visualOccurrences.ranks.get(a.sourceId) !== visualOccurrences.ranks.get(b.sourceId)) return
      partnerships.push({
        id: `coparent:${first.parentId}:${second.parentId}`,
        person1Id: first.parentId, person2Id: second.parentId,
        partnershipType: 'OTHER', isCurrent: false, startDate: null, createdAt: '',
      } as FamilyGraph['partnerships'][number])
    })
    return { ...graph, partnerships }
  }, [graph, visualOccurrences])
  const displayEndpoints = useMemo(() => {
    const endpoints = new Map(visualOccurrences.partnershipEndpoints)
    displayGraph.partnerships.filter((p) => p.id.startsWith('coparent:')).forEach((p) => {
      endpoints.set(p.id, { sourceId: p.person1Id, targetId: p.person2Id })
    })
    return endpoints
  }, [displayGraph, visualOccurrences])
  const sharedFamilies = useMemo(() => sharedParentFamilies(displayGraph, displayEndpoints), [displayGraph, displayEndpoints])
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
  const layoutPartnerships = useMemo(() => displayGraph.partnerships.flatMap((partnership) => {
    const endpoints = displayEndpoints.get(partnership.id)
    return endpoints ? [{
      id: partnership.id,
      person1Id: endpoints.sourceId,
      person2Id: endpoints.targetId,
      partnershipType: partnership.partnershipType,
      isCurrent: partnership.isCurrent,
      startDate: partnership.startDate,
      createdAt: partnership.createdAt,
    }] : []
  }), [displayGraph.partnerships, displayEndpoints])

  const graphEdges = useMemo<Edge[]>(() => [
    ...graph.parentChildRelationships.filter((relation) => !sharedRelationships.has(relation.id)).flatMap((relation) => {
      const endpoints = visualOccurrences.relationshipEndpoints.get(relation.id)
      return endpoints ? [{
      id: `pc-${relation.id}`, source: endpoints.sourceId, target: endpoints.targetId,
      sourceHandle: 'child', targetHandle: 'parent', type: 'parentChild',
      style: {
        stroke: relation.relationshipType === 'BIOLOGICAL' ? '#899b90' : '#aa9b84',
        strokeWidth: 3.15,
        strokeDasharray: relation.relationshipType === 'BIOLOGICAL' ? undefined : '6 5',
      },
    }] : []
    }),
    ...sharedFamilies.flatMap((family) => family.children.flatMap((child) => {
      const partnershipEndpoints = displayEndpoints.get(family.partnership.id)
      const childEndpoints = visualOccurrences.relationshipEndpoints.get(child.relationships[0].id)
      return partnershipEndpoints && childEndpoints ? [{
      id: sharedFamilyEdgeId(family.partnership.id, child.childId),
      source: partnershipEndpoints.sourceId,
      target: childEndpoints.targetId,
      sourceHandle: 'child', targetHandle: 'parent', type: 'parentChild',
      style: {
        stroke: child.relationships.every((relationship) => relationship.relationshipType === 'BIOLOGICAL') ? '#899b90' : '#aa9b84',
        strokeWidth: 3.15,
        strokeDasharray: child.relationships.every((relationship) => relationship.relationshipType === 'BIOLOGICAL') ? undefined : '6 5',
      },
    }] : []
    })),
    ...sharedFamilies.flatMap((family) => {
      const endpoints = displayEndpoints.get(family.partnership.id)
      return endpoints ? [{
      id: sharedFamilyTrunkEdgeId(family.partnership.id),
      source: endpoints.sourceId, target: endpoints.targetId,
      type: 'parentChild',
      style: { stroke: '#899b90', strokeWidth: 3.15 },
    }] : []
    }),
    ...displayGraph.partnerships.flatMap((relation) => {
      const endpoints = displayEndpoints.get(relation.id)
      return endpoints ? [{
      id: `partner-${relation.id}`, source: endpoints.sourceId, target: endpoints.targetId,
      sourceHandle: 'partner-bottom-source', targetHandle: 'partner-bottom-target', type: 'partnership',
      style: { stroke: relation.id.startsWith('coparent:') ? '#899b90' : relation.isCurrent ? '#a96057' : '#c47b70', strokeWidth: 3.15, strokeDasharray: relation.id.startsWith('coparent:') ? '6 5' : undefined },
      label: !relation.id.startsWith('coparent:') && (relation.isCurrent || (partnershipCounts.get(relation.person1Id) === 1 && partnershipCounts.get(relation.person2Id) === 1))
        ? partnershipStatusLabel(relation.partnershipType, t)
        : undefined,
      data: { partnershipType: relation.partnershipType, isCurrent: relation.isCurrent, joined: true },
      labelStyle: { fill: '#8d5d55', fontSize: 10 },
    }] : []
    }),
  ], [graph.parentChildRelationships, displayGraph.partnerships, partnershipCounts, sharedFamilies, sharedRelationships, t, displayEndpoints, visualOccurrences.relationshipEndpoints])

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
        edges: graph.parentChildRelationships.flatMap((relation) => {
          const endpoints = visualOccurrences.relationshipEndpoints.get(relation.id)
          return endpoints ? [{
          id: relation.id,
          sources: [endpoints.sourceId],
          targets: [endpoints.targetId],
        }] : []
        }),
      })
      if (!current) return
      const positions = arrangeFamilyTreePositions(
        new Map((result.children ?? []).map((node) => [node.id, { x: node.x ?? 0, y: node.y ?? 0 }])),
        visualPeople.map((occurrence) => occurrence.id),
        graph.parentChildRelationships.flatMap((relationship): Array<[string, string]> => {
          const endpoints = visualOccurrences.relationshipEndpoints.get(relationship.id)
          return endpoints ? [[endpoints.sourceId, endpoints.targetId]] : []
        }),
        layoutPartnerships,
        new Map(visualPeople.map((occurrence) => [occurrence.id, occurrence.person.gender])),
        new Map(visualPeople.map((occurrence) => [occurrence.id, occurrence.person.birthDate])),
        visualOccurrences.ranks,
      )
      validateVisualGraphPositions(graph, visualOccurrences, positions)
      setNodes(visualPeople.map((occurrence) => {
        const position = positions.get(occurrence.id)
        const joinedPartners = layoutPartnerships.filter((partnership) => joinsPartnerCards(partnership.partnershipType)).flatMap((partnership) => {
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
            canAddParent: graph.parentChildRelationships.filter((relationship) => relationship.childId === occurrence.person.id).length < 2,
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
          const partnershipEndpoints = displayEndpoints.get(sharedBranch.family.partnership.id)
          const firstPosition = partnershipEndpoints ? positions.get(partnershipEndpoints.sourceId) : undefined
          const secondPosition = partnershipEndpoints ? positions.get(partnershipEndpoints.targetId) : undefined
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
  }, [graph.parentChildRelationships, graph.partnerships, graphEdges, flow, layoutPartnerships, setEdges, setNodes, sharedBranchesByEdgeId, displayEndpoints, visualOccurrences.ranks, visualOccurrences.relationshipEndpoints, visualPeople])

  useEffect(() => {
    setNodes((existing) => selectPersonOccurrences(existing, selectedPersonIds, edgeSelectionActive))
  }, [edgeSelectionActive, selectedPersonIds, setNodes])

  useEffect(() => {
    if (!focusId) return
    const fallbackPersonId = selectedPersonIds.length === 1 ? selectedPersonIds[0] : focusId
    const preferredOccurrenceId = visualOccurrences.preferredOccurrenceByPerson.get(fallbackPersonId)
    const node = flow.getNode(focusId) ?? (preferredOccurrenceId ? flow.getNode(preferredOccurrenceId) : undefined)
    if (!node) return
    const nodeCenter = { x: node.position.x + NODE_WIDTH / 2, y: node.position.y + NODE_HEIGHT / 2 }
    const viewport = document.querySelector<HTMLElement>('.canvas-area .react-flow')?.getBoundingClientRect()
    const touchDevice = window.matchMedia('(pointer: coarse), (hover: none)').matches
    if (touchDevice && window.matchMedia('(max-width: 520px)').matches) {
      if (viewport) {
        void flow.setViewport(mobileFocusedViewport(nodeCenter, viewport.width, viewport.height), { duration: 600 })
        return
      }
    }
    if (!touchDevice && viewport) {
      const details = document.querySelector<HTMLElement>('.details-panel')?.getBoundingClientRect()
      const visibleWidth = details ? Math.min(viewport.width, Math.max(0, details.left - viewport.left)) : viewport.width
      if (details && details.left < viewport.right && visibleWidth > 0) {
        void flow.setViewport(focusedViewportLeftOfDetails(nodeCenter, visibleWidth, viewport.height), { duration: 600 })
        return
      }
    }
    void flow.setCenter(nodeCenter.x, nodeCenter.y, { zoom: 1.25, duration: 600 })
  }, [focusId, flow, nodes, selectedPersonIds, visualOccurrences.preferredOccurrenceByPerson])

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
        const closestEdgeId = closestEdgeIdFromPointElements(pointElements, edge.id, event.clientX, event.clientY)
        const selectedEdges = new Set(completeFamilyBranchEdgeIds([closestEdgeId], displayGraph))
        setEdges((existing) => existing.map((candidate) => ({ ...candidate, selected: selectedEdges.has(candidate.id) })))
        const personIds = personIdsForGraphEdges([closestEdgeId], displayGraph)
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
      <Controls showZoom={false} showFitView={false} showInteractive={false}>
        <ControlButton title={t('zoomIn')} aria-label={t('zoomIn')} onClick={() => { void flow.zoomIn({ duration: 350 }) }}>
          <PlusIcon />
        </ControlButton>
        <ControlButton title={t('zoomOut')} aria-label={t('zoomOut')} onClick={() => { void flow.zoomOut({ duration: 350 }) }}>
          <MinusIcon />
        </ControlButton>
        <ControlButton title={t('fitView')} aria-label={t('fitView')} onClick={() => { void flow.fitView({ padding: 0.25, duration: 500 }) }}>
          <FitViewIcon />
        </ControlButton>
      </Controls>
    </ReactFlow>
  )
}

import { useEffect, useMemo } from 'react'
import ELK from 'elkjs/lib/elk.bundled.js'
import {
  Background, Controls, MarkerType, ReactFlow, ReactFlowProvider, useEdgesState, useNodesState, useReactFlow,
  type Edge,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import type { FamilyGraph, UUID } from '../types'
import { PersonNode, type PersonFlowNode } from './PersonNode'

const elk = new ELK()
const nodeTypes = { person: PersonNode }

interface Props { graph: FamilyGraph; selectedId: UUID | null; focusId: UUID | null; onSelect: (id: UUID) => void }

export function FamilyGraphCanvas(props: Props) {
  return <ReactFlowProvider><Canvas {...props} /></ReactFlowProvider>
}

function Canvas({ graph, selectedId, focusId, onSelect }: Props) {
  const [nodes, setNodes, onNodesChange] = useNodesState<PersonFlowNode>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([])
  const flow = useReactFlow<PersonFlowNode, Edge>()

  const graphEdges = useMemo<Edge[]>(() => [
    ...graph.parentChildRelationships.map((relation) => ({
      id: `pc-${relation.id}`, source: relation.parentId, target: relation.childId,
      sourceHandle: 'child', targetHandle: 'parent', type: 'smoothstep',
      markerEnd: { type: MarkerType.ArrowClosed, color: '#97a59d' },
      style: { stroke: relation.relationshipType === 'BIOLOGICAL' ? '#97a59d' : '#b4a58d', strokeDasharray: relation.relationshipType === 'BIOLOGICAL' ? undefined : '6 4' },
    })),
    ...graph.partnerships.map((relation) => ({
      id: `partner-${relation.id}`, source: relation.person1Id, target: relation.person2Id,
      sourceHandle: 'partner-right', targetHandle: 'partner-left', type: 'straight',
      style: { stroke: '#c47b70', strokeWidth: 2 }, label: relation.partnershipType === 'MARRIAGE' ? 'married' : undefined,
      labelStyle: { fill: '#8d5d55', fontSize: 10 },
    })),
  ], [graph.parentChildRelationships, graph.partnerships])

  useEffect(() => {
    let current = true
    const layout = async () => {
      const result = await elk.layout({
        id: 'root',
        layoutOptions: {
          'elk.algorithm': 'layered', 'elk.direction': 'DOWN', 'elk.spacing.nodeNode': '48',
          'elk.layered.spacing.nodeNodeBetweenLayers': '90', 'elk.layered.nodePlacement.strategy': 'NETWORK_SIMPLEX',
        },
        children: graph.people.map((person) => ({ id: person.id, width: 190, height: 82 })),
        edges: graphEdges.map((edge) => ({ id: edge.id, sources: [edge.source], targets: [edge.target] })),
      })
      if (!current) return
      setNodes(graph.people.map((person) => {
        const position = result.children?.find((node) => node.id === person.id)
        return { id: person.id, type: 'person', position: { x: position?.x ?? 0, y: position?.y ?? 0 }, data: { person }, selected: person.id === selectedId }
      }))
      setEdges(graphEdges)
      requestAnimationFrame(() => flow.fitView({ padding: 0.25, duration: 500 }))
    }
    void layout()
    return () => { current = false }
  }, [graph.people, graphEdges, flow, setEdges, setNodes])

  useEffect(() => {
    setNodes((existing) => existing.map((node) => ({ ...node, selected: node.id === selectedId })))
  }, [selectedId, setNodes])

  useEffect(() => {
    if (!focusId) return
    const node = flow.getNode(focusId)
    if (node) flow.setCenter(node.position.x + 95, node.position.y + 41, { zoom: 1.25, duration: 600 })
  }, [focusId, flow, nodes])

  return (
    <ReactFlow<PersonFlowNode, Edge>
      nodes={nodes} edges={edges} nodeTypes={nodeTypes} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange}
      onNodeClick={(_, node) => onSelect(node.id)} minZoom={0.08} maxZoom={2.5} fitView nodesDraggable elementsSelectable
      proOptions={{ hideAttribution: true }}
    >
      <Background color="#d7dbd5" gap={24} size={1} />
      <Controls showInteractive={false} />
    </ReactFlow>
  )
}

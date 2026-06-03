"use client";

import { useCallback, useRef, useState, lazy, Suspense } from "react";
import "@xyflow/react/dist/style.css";

// Dynamically import to avoid ESM/CJS interop issues with @xyflow/react
const ReactFlow = lazy(() =>
  import("@xyflow/react").then((m) => ({ default: m.ReactFlow }))
);

import {
  Background,
  Controls,
  MiniMap,
  BackgroundVariant,
  ReactFlowProvider,
  useReactFlow,
} from "@xyflow/react";

import { PipelineNodeRenderer } from "./pipeline-node-renderer";
import { AnimatedEdge } from "./edges/animated-edge";
import { StatusEdge } from "./edges/status-edge";
import { CanvasToolbar } from "./toolbar/canvas-toolbar";
import { NodePalette } from "./toolbar/node-palette";
import { NodeConfigPanel } from "./toolbar/node-config-panel";
import { hasCycle } from "@/lib/pipeline/dag-utils";
import type { PipelineNodeData } from "@/lib/pipeline/pipeline-converter";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const nodeTypes: any = { pipelineNode: PipelineNodeRenderer };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const edgeTypes: any = { animated: AnimatedEdge, status: StatusEdge };

export interface WorkflowCanvasProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  nodes: any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  edges: any[];
  pipelineName: string;
  isDirty: boolean;
  isExecuting: boolean;
  viewMode: "canvas" | "list";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onNodesChange: (changes: any) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onEdgesChange: (changes: any) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onConnect: (connection: any) => void;
  onSave: () => void;
  onExecute: () => void;
  onToggleView: () => void;
  onDeleteNode: (nodeId: string) => void;
  onOpenNodeConfig: (nodeData: PipelineNodeData) => void;
  onNodeLabelChange: (nodeId: string, label: string) => void;
  onDropNode: (type: string, position: { x: number; y: number }) => void;
}

function FlowCanvas({
  nodes,
  edges,
  onNodesChange,
  onEdgesChange,
  onConnect: externalConnect,
  onDropNode,
  onOpenNodeConfig,
  onDeleteNode,
  onNodeLabelChange,
  ...toolbarProps
}: WorkflowCanvasProps) {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const rf = useReactFlow();
  const [selectedNode, setSelectedNode] = useState<PipelineNodeData | null>(null);
  const [draggingType, setDraggingType] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);

  const onMoveEnd = useCallback((_event: unknown, viewport: { zoom: number }) => {
    setZoom(viewport.zoom);
  }, []);

  const handleConnect = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (connection: any) => {
      const allEdges = [...edges, connection];
      if (hasCycle(allEdges)) {
        return;
      }
      externalConnect(connection);
    },
    [edges, externalConnect]
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const onNodeClick = useCallback((_event: React.MouseEvent, node: any) => {
    setSelectedNode(node.data as PipelineNodeData);
  }, []);

  const onPaneClick = useCallback(() => setSelectedNode(null), []);

  const onDragStart = useCallback((type: string, event: React.DragEvent) => {
    setDraggingType(type);
    event.dataTransfer.setData("application/pipeline-node", type);
    event.dataTransfer.effectAllowed = "move";
  }, []);

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      const type = event.dataTransfer.getData("application/pipeline-node");
      if (!type) return;
      if (!rf.screenToFlowPosition) return;
      const position = rf.screenToFlowPosition({ x: event.clientX, y: event.clientY });
      setDraggingType(null);
      onDropNode(type, position);
    },
    [rf, onDropNode]
  );

  const handleZoomIn = () => {
    if (rf.zoomTo) rf.zoomTo(Math.min(zoom + 0.1, 2));
  };
  const handleZoomOut = () => {
    if (rf.zoomTo) rf.zoomTo(Math.max(zoom - 0.1, 0.25));
  };
  const handleFitView = () => {
    if (rf.fitView) rf.fitView({ padding: 0.2 });
  };

  return (
    <div className="flex flex-col h-full">
      <CanvasToolbar
        pipelineName={toolbarProps.pipelineName}
        zoom={zoom}
        isDirty={toolbarProps.isDirty}
        isExecuting={toolbarProps.isExecuting}
        viewMode={toolbarProps.viewMode}
        onSave={toolbarProps.onSave}
        onExecute={toolbarProps.onExecute}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onFitView={handleFitView}
        onToggleView={toolbarProps.onToggleView}
      />

      <div className="flex flex-1 min-h-0">
        <div ref={reactFlowWrapper} className="flex-1 relative">
          {nodes.length === 0 && !draggingType && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
              <div className="text-center bg-white/80 backdrop-blur rounded-lg p-6 shadow-sm border">
                <p className="text-gray-500 text-sm">从右侧面板拖拽组件到此处开始构建工作流</p>
              </div>
            </div>
          )}

          <Suspense fallback={<div className="p-4 text-sm text-gray-400">加载画布...</div>}>
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={handleConnect}
              onNodeClick={onNodeClick}
              onPaneClick={onPaneClick}
              onDragOver={onDragOver}
              onDrop={onDrop}
              onMoveEnd={onMoveEnd}
              nodeTypes={nodeTypes}
              edgeTypes={edgeTypes}
              fitView
              fitViewOptions={{ padding: 0.3 }}
              deleteKeyCode="Delete"
              multiSelectionKeyCode="Shift"
              snapToGrid
              snapGrid={[10, 10]}
              minZoom={0.25}
              maxZoom={2}
              defaultEdgeOptions={{ type: "animated", animated: true }}
            >
              <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#E5E7EB" />
              <Controls showInteractive={false} className="!shadow-sm !border !rounded-lg !overflow-hidden" />
              <MiniMap
                nodeStrokeColor="#6B7280"
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                nodeColor={(n: any) => {
                  const colors: Record<string, string> = {
                    source: "#3B82F6",
                    transform: "#F59E0B",
                    output: "#22C55E",
                    flow: "#A855F7",
                  };
                  return colors[n?.data?.group || ""] || "#6B7280";
                }}
                maskColor="rgba(0,0,0,0.1)"
                className="!shadow-sm !border !rounded-lg"
              />
            </ReactFlow>
          </Suspense>

          {draggingType && <div className="absolute inset-0 bg-blue-50/30 z-20 pointer-events-none" />}
        </div>

        <div className="flex">
          <NodePalette onDragStart={onDragStart} />
          <NodeConfigPanel
            node={selectedNode}
            onOpenConfig={() => selectedNode && onOpenNodeConfig(selectedNode)}
            onDelete={() => selectedNode && onDeleteNode(selectedNode.stepId)}
            onLabelChange={(label) => selectedNode && onNodeLabelChange(selectedNode.stepId, label)}
          />
        </div>
      </div>
    </div>
  );
}

export function WorkflowCanvas(props: WorkflowCanvasProps) {
  return (
    <ReactFlowProvider>
      <FlowCanvas {...props} />
    </ReactFlowProvider>
  );
}

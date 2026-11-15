import {describeGraphNodes, type ProcessGraphProps} from './ProcessGraph'

export function ProcessGraphList({graph, executions, selectedNodeId, onSelectNode}: ProcessGraphProps) {
  return <section className="process-graph-list" aria-label="流程节点和连线">
    {graph.nodes.length ? <ol aria-label="流程节点">
      {describeGraphNodes(graph.nodes, executions).map(({node, icon, kind, name, activity, accessibleName}) =>
        <li key={node.id}>
          <button type="button" className="process-graph-list-node" aria-pressed={selectedNodeId === node.id}
            aria-label={accessibleName} onClick={() => onSelectNode(node.id)}>
            <span aria-hidden="true">{icon} </span><strong>{name}</strong>
            <span> · {kind} · {activity}</span>
          </button>
        </li>)}
    </ol> : <p>暂无流程图节点</p>}
    {graph.edges.length ? <ul aria-label="流程连线">
      {graph.edges.map(edge => <li key={edge.id}>{edge.source} → {edge.target}
        {edge.label === null ? null : <span> · {edge.label}</span>}
      </li>)}
    </ul> : <p>暂无流程连线</p>}
  </section>
}

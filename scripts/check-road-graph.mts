// node --experimental-strip-types scripts/check-road-graph.mts
import assert from "node:assert"
import { buildGraph, clipToTile, splitAtCrossings } from "../lib/osm-fetcher.ts"
import { findPath } from "../lib/pathfinding.ts"

const plus = [[[0, 5], [10, 5]], [[5, 0], [5, 10]]]
splitAtCrossings(plus, [0, 0])
assert.deepEqual(plus, [[[0, 5], [5, 5], [10, 5]], [[5, 0], [5, 5], [5, 10]]])

const bridge = [[[0, 5], [10, 5]], [[5, 0], [5, 10]]]
splitAtCrossings(bridge, [1, 0])
assert.equal(bridge[0].length, 2)

assert.deepEqual(clipToTile([[-50, 10], [100, 10], [5000, 10]]), [[[0, 10], [100, 10], [4096, 10]]])
assert.deepEqual(clipToTile([[-50, -50], [-10, -10]]), [])
// Square with a longer detour: every algorithm must return the same shortest route
const n = (id: number, lat: number, lng: number) => [id, { id, lat, lng }] as const
const graph = buildGraph({
  nodes: new Map([n(1, 0, 0), n(2, 0, 0.001), n(3, 0.001, 0.001), n(4, 0.003, 0), n(5, 0.002, 0.001)]),
  ways: [{ id: 1, nodes: [1, 2, 3, 5] }, { id: 2, nodes: [1, 4, 5] }],
})
for (const algorithm of ["dijkstra", "astar", "bidirectional", "sstar"] as const) {
  const result = findPath(graph, "n1", "n5", algorithm)
  assert.deepEqual(result.path, ["n1", "n2", "n3", "n5"], algorithm)
  assert.ok(Math.abs(result.length - 333.6) < 1, `${algorithm} length ${result.length}`)
}
console.log("road graph checks ok")

// node --experimental-strip-types scripts/check-road-graph.mts
import assert from "node:assert"
import { clipToTile, splitAtCrossings } from "../lib/osm-fetcher.ts"

const plus = [[[0, 5], [10, 5]], [[5, 0], [5, 10]]]
splitAtCrossings(plus, [0, 0])
assert.deepEqual(plus, [[[0, 5], [5, 5], [10, 5]], [[5, 0], [5, 5], [5, 10]]])

const bridge = [[[0, 5], [10, 5]], [[5, 0], [5, 10]]]
splitAtCrossings(bridge, [1, 0])
assert.equal(bridge[0].length, 2)

assert.deepEqual(clipToTile([[-50, 10], [100, 10], [5000, 10]]), [[[0, 10], [100, 10], [4096, 10]]])
assert.deepEqual(clipToTile([[-50, -50], [-10, -10]]), [])
console.log("road graph checks ok")

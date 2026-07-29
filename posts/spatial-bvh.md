# BVH for Ray Casting

Bounding Volume Hierarchies (BVH) are the workhorse acceleration structure for ray casting. Unlike grid-based spatial indexes (uniform grids, octrees), BVHs adapt to the geometry distribution - dense where geometry is dense, sparse where it's sparse.

## BVH Structure

A BVH is a binary tree where each node stores an axis-aligned bounding box (AABB) that encloses all geometry in its subtree:

```rust
struct BVHNode {
    aabb: AABB,               // Bounding box
    left: Option<Box<BVHNode>>,  // Child nodes (or leaf)
    right: Option<Box<BVHNode>>,
    triangles: Vec<Triangle>,   // Only populated for leaves
}

impl BVHNode {
    fn intersect(&self, ray: &Ray) -> Option<Hit> {
        if !self.aabb.hit(ray) {
            return None;  // Miss — skip entire subtree
        }
        // Leaf — test actual triangles
        if self.is_leaf() {
            return self.triangles.iter()
                .filter_map(|t| t.intersect(ray))
                .min_by_key(|h| h.t);
        }
        // Interior — recurse
        let left_hit = self.left?.intersect(ray);
        let right_hit = self.right?.intersect(ray);
        // Return closest hit
        best_hit(left_hit, right_hit)
    }
}
```

## Building the BVH

The Surface Area Heuristic (SAH) guides the split decision:

```rust
fn build_sah(triangles: &[Triangle], depth: usize) -> BVHNode {
    let aabb = union_aabb(triangles);
    if triangles.len() <= 4 || depth > 32 {
        return BVHNode::leaf(aabb, triangles.to_vec());
    }

    // Evaluate split candidates along each axis
    let best_split = (0..3).flat_map(|axis| {
        sort_by_axis(triangles, axis);
        (1..triangles.len()).map(|i| {
            let cost = sah_cost(&triangles[..i], &triangles[i..], aabb);
            (cost, axis, i)
        })
    }).min();

    let (_, axis, mid) = best_split.unwrap();
    sort_by_axis(triangles, axis);
    let (left, right) = triangles.split_at(mid);
    BVHNode::interior(aabb,
        Box::new(build_sah(left, depth + 1)),
        Box::new(build_sah(right, depth + 1)),
    )
}
```

SAH estimates the cost of intersecting a node by weighing the probability of hitting each child against the cost of traversal. A good SAH implementation gives 50-70% fewer ray-box tests compared to median-split builds. The trade-off is build time — SAH is O(n log² n) vs O(n log n) for median split. For static geometry (baked once, ray-cast many times), SAH is always worth it.

## Stackless Traversal

Traditional BVH traversal uses a stack, which is problematic on GPUs where stack space is limited. We implemented a stackless traversal using "rope" pointers — each node stores a pointer to the next node to visit when a miss occurs:

```rust
struct RopeBVHNode {
    aabb: AABB,
    left: u32,      // Index into flat array
    right: u32,
    rope: u32,      // Next node on miss
    tri_start: u32,
    tri_count: u32,
}

fn traverse_ropes(nodes: &[RopeBVHNode], ray: &Ray) -> Option<Hit> {
    let mut idx = 0;
    let mut best_hit = None;
    loop {
        let node = &nodes[idx as usize];
        if node.aabb.hit(ray) {
            if node.tri_count > 0 {
                // Leaf — test triangles
                best_hit = test_triangles(node, ray).or(best_hit);
                idx = node.rope;  // Pop (actually just follow rope)
            } else {
                idx = node.left;  // Push left child
                continue;
            }
        } else {
            idx = node.rope;  // Skip this subtree
        }
        if idx == u32::MAX { break; }
    }
    best_hit
}
```

Rope-based BVH traversal runs about 30% faster on GPU hardware because it eliminates the stack push/pop overhead entirely. The trade-off is increased memory — each node stores one extra pointer. For scenes with millions of triangles, the 8-byte overhead per node adds up to several MB. On modern GPUs with 8-16GB VRAM, this is negligible compared to the traversal speedup.

## When Not to Use BVH

BVHs are not ideal for uniformly distributed geometry (particle systems, uniform point clouds) or dynamic scenes requiring frequent rebuilds. For particle systems, uniform grids are faster to rebuild and query. For dynamic geometry, we use refitting (updating AABBs without rebuilding the tree), which is fast but degrades query performance as the AABBs grow stale — typically 10-20% slower after 100 frames of animation.
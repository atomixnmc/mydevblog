# Lac Capability Model

Lac uses a capability-based security model for compute resources. Instead of user/group permissions (DAC) or security labels (MAC), Lac grants capabilities — unforgeable tokens that authorize specific operations on specific resources.

## Capability Tokens

```rust
struct Capability {
    resource_id: ResourceId,
    operations: OpSet,     // read, write, execute, modify
    delegation: bool,      // Can this be passed to another node?
    expires_at: u64,       // Unix timestamp
    issuer: PublicKey,     // Who granted this
    signature: Signature,  // Signed capability
}
```

A capability grants access to exactly one resource. To read a buffer, you need a capability that includes the `read` operation for that buffer's ID. Capabilities are signed by the resource owner. They're unforgeable because the signature is an Ed25519 signature over the capability content.

## Resource Hierarchy

Resources are organized hierarchically:

```
/lac/node-01/
├── compute/
│   ├── gpu-0            # GPU device
│   │   ├── stream-0     # Compute stream
│   │   ├── buffer-0     # GPU buffer
│   │   └── buffer-1
│   └── gpu-1
│       └── stream-0
├── memory/
│   ├── pool-0           # Heap allocation pool
│   └── pool-1
└── io/
    ├── pcie-0            # PCIe bandwidth allocation
    └── network-0         # Network interface
```

Capabilities on parent resources propagate to children (read on `/compute/gpu-0` grants read on `/compute/gpu-0/buffer-0`). Delegation rights control whether a capability holder can create a more restricted capability and pass it to another process.

## Capability Distribution

When a compute job is submitted, Lac attaches capabilities for the resources it needs:

```rust
struct ComputeJob {
    graph: ComputeGraph,
    capabilities: Vec<Capability>,  // What this job can access
}
```

The runtime checks capabilities at every resource access:

```rust
fn access_resource(
    job: &ComputeJob,
    resource: &Resource,
    operation: Operation,
) -> Result<()> {
    let matching = job.capabilities.iter()
        .find(|cap| cap.resource_id == resource.id());

    match matching {
        Some(cap) if cap.operations.contains(operation)
            && cap.expires_at > now() => Ok(()),
        _ => Err(AcccessError::Unauthorized),
    }
}
```

This check runs every time a kernel reads or writes a buffer. The overhead is 50-100ns per check — negligible for GPU kernels that run for microseconds. For CPU workloads with many small memory accesses, we batch the capability check at the beginning of the job rather than per-access.

## Delegation

A compute node can delegate capabilities to sub-jobs:

```rust
// Node A has capability for GPU-0
let parent_cap = node_a.receive_capability("/lac/node-a/compute/gpu-0");

// Node A delegates a restricted version to node B
let restricted = parent_cap.restrict(OpSet::read_only());
node_b.send_capability(restricted);

// Node B can only read from GPU-0 — no writes, no execution
```

Delegation is transitive up to a configurable depth (default: 3). Beyond that, a capability cannot be further delegated. This prevents runaway delegation chains. In practice, depth-3 covers: GPU-owning process delegates to orchestrator, orchestrator delegates to job runner, job runner delegates to kernel — no further delegation needed.

## Principle of Least Privilege

Lac's capability model enforces least privilege by default. A compute job starts with zero capabilities — every operation must be explicitly authorized. This prevents a compromised job from accessing other jobs' data (memory isolation) or consuming resources it wasn't allocated (DoS prevention). We validated this with a penetration test: a buggy shader that tried to access buffer IDs outside its capability set was caught by the check at runtime and returned an authorization error instead of leaking data. The test confirmed that even if an attacker controlled the shader bytecode, they couldn't access buffers whose resource IDs weren't in the capability set passed at job submission time.
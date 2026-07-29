# Lac Runtime Layer

Lac is a compute runtime for heterogeneous hardware — CPU, GPU, NPU, FPGA — exposed through a unified execution model. The runtime layer abstracts hardware details behind a capability-based interface where work is submitted as compute graphs and the scheduler routes tasks to the best available device.

## Compute Graph

Work in Lac is expressed as a directed acyclic graph of compute nodes:

```rust
struct ComputeGraph {
    nodes: Vec<ComputeNode>,
    edges: Vec<(NodeId, NodeId)>,  // dependencies
}

enum ComputeNode {
    Kernel {
        source: KernelSource,
        dispatch: DispatchConfig,   // grid size, workgroup size
        inputs: Vec<BufferHandle>,
        outputs: Vec<BufferHandle>,
    },
    Transfer {
        source: BufferHandle,
        destination: BufferHandle,
        size: usize,
    },
    Barrier {
        wait: Vec<EventHandle>,
        signal: EventHandle,
    },
}
```

The graph is built declaratively and submitted to the runtime scheduler:

```rust
let mut graph = ComputeGraph::new();

let input = graph.buffer(1024, MemoryType::Device);
let weights = graph.buffer(4096, MemoryType::DeviceMapped);
let output = graph.buffer(1024, MemoryType::Device);

let matmul = graph.kernel(
    "matmul_sparse",
    dispatch_1d(1024, 256),
    &[input, weights],
    &[output],
);
let relu = graph.kernel("relu", dispatch_1d(1024, 256), &[output], &[output]);

graph.depend(matmul, relu);

let runtime = LacRuntime::new();
runtime.submit(graph);
```

## Device Scheduling

The scheduler picks the optimal device for each kernel based on: kernel characteristics (compute-bound vs memory-bound), device capabilities (tensor cores, FP64 support), current device load, and data location (prefer the device where data already resides).

```rust
fn schedule_node(node: &ComputeNode, devices: &[Device]) -> DeviceId {
    devices.iter()
        .map(|d| {
            let compute_capability = d.compute_capability(&node);
            let memory_cost = d.memory_transfer_cost(&node.inputs);
            let current_load = d.current_load();
            let score = compute_capability * 0.5
                       - memory_cost * 0.3
                       - current_load * 0.2;
            (score, d.id)
        })
        .max_by_key(|(score, _)| *score)
        .unwrap()
        .1
}
```

The weights are tuneable — for latency-sensitive workloads (real-time inference), we bias toward compute capability. For throughput workloads (training), we bias away from current load to avoid queueing. The scheduler re-evaluates at submission time, so a kernel that targets GPU can fall back to CPU if the GPU is busy with a higher-priority task.

## Memory Hierarchy

Lac manages a tiered memory hierarchy:

```
Host (RAM) ←→ Device (VRAM) ←→ Scratchpad (shared memory / SRAM)
```

Data can be allocated in any tier, and the runtime handles transfers automatically:

```rust
// Allocate in device memory (GPU VRAM)
let gpu_buf = runtime.alloc(1024, MemoryTier::Device);

// Map for zero-copy access from host
let mapped_buf = runtime.alloc(4096, MemoryTier::DeviceMapped);

// Allocate in shared memory for kernel-local use
let shared_buf = runtime.alloc_local(256, MemoryTier::Scratchpad);
```

`DeviceMapped` buffers use BAR1 mapping (PCIe resizable BAR) on supported GPUs — the buffer is accessible from both CPU and GPU without explicit transfers. This is available on modern GPUs (Nvidia RTX 3000+, AMD RX 6000+). For GPUs without resizable BAR, `DeviceMapped` falls back to a cached transfer strategy.

## Performance Model

Lac's runtime layer adds 1-5μs overhead per kernel submission (depending on graph complexity). For GPU workloads with kernels running 50μs+, this overhead is acceptable. For very short kernels (<10μs), the overhead dominates — we batch these kernels into composite kernels (combining multiple operations into one GPU dispatch) using a fusion pass that runs during graph construction.

The runtime handles scheduling for up to 4 devices concurrently. With 2 GPUs + 1 NPU, we see near-linear scaling for independent workloads. For workloads with cross-device dependencies, PCIe bandwidth becomes the bottleneck — Lac profiles the transfer bandwidth at startup and uses it for scheduling decisions.
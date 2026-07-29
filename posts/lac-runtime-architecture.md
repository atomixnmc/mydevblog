# Lac Runtime Architecture

Lac is a compute runtime for heterogeneous hardware. The architecture is layered — applications talk to a high-level API that abstracts away the GPU/CPU/NPU details.

## Architecture Layers

```
Application
    │
┌───▼───────────────┐
│  Capability Layer   │  ← Security — resource access tokens
├────────────────────┤
│  Compute Graph      │  ← Declarative DAG of compute nodes
├────────────────────┤
│  Scheduler          │  ← Device selection, load balancing
├────────────────────┤
│  Backend Abstraction │  ← CUDA, ROCm, Vulkan, CPU
├────────────────────┤
│  Hardware           │  ← GPU, NPU, CPU, FPGA
└────────────────────┘
```

Each layer communicates with the one below through traits (Rust traits) or interfaces. The layers are in-process — no IPC overhead.

## Capability Layer

Every resource access is gated by a capability token:

```rust
let gpu = runtime.acquire(
    ResourcePath::new("/compute/gpu-0"),
    OperationSet::READ | OperationSet::WRITE,
).await?;

let buffer = gpu.alloc_buffer(1024 * 1024, MemoryType::Device)?;
```

Capabilities are signed by the resource owner and verified at every access. This prevents a compromised compute job from accessing resources it wasn't allocated.

## Compute Graph

Work is expressed as a DAG of compute nodes:

```rust
let graph = ComputeGraph::new()
    .add_kernel("preprocess", shader_1, &[input], &[intermediate])
    .add_kernel("inference", shader_2, &[intermediate], &[output])
    .depend("preprocess", "inference") // preprocess → inference
    .add_transfer(intermediate, cpu_buffer); // Transfer result to CPU
```

The graph is compiled to a backend-specific execution plan. For GPU backends, the kernels are compiled to SPIR-V or PTX and submitted to a single command queue. For CPU backends, they're dispatched to a thread pool.

## Scheduler

The scheduler selects devices for each kernel:

1. Kernel requirements: memory, compute capability, tensor cores
2. Data location: prefer device where inputs already reside
3. Device load: avoid overloaded devices
4. Data transfer cost: PCIe bandwidth, NUMA distance

```rust
fn schedule_kernel(
    kernel: &Kernel,
    available: &[Device],
) -> Result<(Device, SchedulingInfo)> {
    available.iter()
        .filter(|d| d.meets_requirements(kernel))
        .min_by_key(|d| {
            let compute_score = d.compute_fit(kernel);
            let transfer_cost = d.transfer_cost(kernel.input_locations());
            let load_score = d.current_load();
            compute_score + transfer_cost + load_score
        })
        .ok_or(Error::NoSuitableDevice)
        .map(|d| (d, SchedulingInfo::new()))
}
```

The scoring function is weighted: compute fit = 0.5, transfer cost = 0.3, load = 0.2. These weights are tuneable via environment variables. For low-latency workloads, we increase the load weight to prevent queueing. For throughput workloads, we increase the compute fit weight.

## Backend Layer

Each backend implements a common interface:

```rust
trait ComputeBackend {
    fn name(&self) -> &'static str;
    fn capabilities(&self) -> Capabilities;
    fn allocate(&self, size: usize, memory_type: MemoryType) -> Result<Buffer>;
    fn compile_kernel(&self, source: &KernelSource) -> Result<Kernel>;
    fn dispatch(&self, kernel: &Kernel, params: &DispatchParams, buffers: &[&Buffer]) -> Result<()>;
    fn synchronize(&self) -> Result<()>;
}
```

CUDA backend uses cuBLAS/cuDNN. Vulkan backend compiles to SPIR-V. CPU backend compiles via Cranelift or runs bytecode. The abstraction overhead is about 1μs per kernel dispatch — negligible for GPU kernels that run for 10μs+ but noticeable for very short kernels (<5μs).

Lac's architecture is designed for incremental adoption. You can start with a single GPU (CUDA), add Vulkan fallback for integrated GPUs, add CPU fallback for development environments, and add NPU support when your workload requires it — all without changing application code.
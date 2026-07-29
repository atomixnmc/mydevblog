# Lac Engine Swap

Lac's runtime abstraction lets you swap compute backends without changing application code. The same compute graph can run on CUDA, ROCm, Vulkan, or CPU — the runtime selects the best available backend at startup, and the developer doesn't care.

## Backend Interface

Each backend implements a trait:

```rust
#[async_trait]
trait ComputeBackend {
    async fn allocate(&self, size: usize, tier: MemoryTier) -> Result<BufferHandle>;
    async fn submit(&self, graph: &ComputeGraph) -> Result<ComputeStream>;
    async fn sync(&self, stream: &ComputeStream) -> Result<()>;
    fn capabilities(&self) -> BackendCapabilities;
}

struct BackendCapabilities {
    max_workgroup_size: u32,
    shared_memory: usize,
    supports_fp16: bool,
    supports_tensor_cores: bool,
    max_buffers: u32,
}
```

The CUDA backend wraps cuBLAS and cuDNN. The Vulkan backend compiles kernels to SPIR-V. The CPU backend uses Rayon for parallelism. Each exposes the same interface.

## Kernel Dispatch

```rust
// Application code — backend-agnostic
let backend = lac::get_backend().await?;
let matmul = ComputeNode::kernel(
    "matmul",
    dispatch_2d(M, N, 16, 16),  // workgroup size
    &[input, weights],
    &[output],
);

// Translates to:
//   CUDA:   matmul_kernel<<<grid, block>>>(input, weights, output);
//   Vulkan: vkCmdDispatch(command_buffer, grid_x, grid_y, 1);
//   CPU:    rayon::scope(|s| { for chunk in output.chunks(16) { ... }});
```

The `dispatch_2d` parameters map to the backend's threading model — workgroups on GPU, parallel work items on CPU. The kernel source is either WGSL (compiled to SPIR-V for Vulkan, transpiled to CUDA C for CUDA, compiled to ISPC for CPU) or backend-specific (PTX for CUDA, GLSL for Vulkan).

## Auto-Selection

At startup, Lac probes available backends and selects the best one:

```rust
#[derive(PartialEq, PartialOrd)]
enum BackendPriority {
    CPU,        // Fallback — always available
    Vulkan,     // Cross-vendor GPU
    ROCm,       // AMD GPU
    CUDA,       // Nvidia GPU
}

fn select_backend(available: &[ComputeBackend]) -> &ComputeBackend {
    available.iter()
        .max_by_key(|b| match b.backend_type() {
            BackendType::CUDA => {
                let cc = b.compute_capability();
                if cc >= 8.0 { BackendPriority::CUDA }  // Ampere+
                else if cc >= 7.0 { BackendPriority::CUDA }  // Volta+
                else { BackendPriority::Vulkan }
            }
            BackendType::ROCm => BackendPriority::ROCm,
            BackendType::Vulkan => BackendPriority::Vulkan,
            BackendType::CPU => BackendPriority::CPU,
        })
        .unwrap()
}
```

CUDA is preferred on Nvidia hardware (compute capability ≥ 8.0 for tensor core utilization). ROCm on AMD hardware. Vulkan on integrated GPUs and Intel hardware. CPU is always the fallback.

## Hot-Swap

Lac supports runtime backend swap — draining the current backend, migrating in-flight buffers, and resubmitting on the new backend. This is used for fault tolerance (GPU hangs → fall back to CPU) and load balancing (switch to an underutilized GPU):

```rust
let runtime = LacRuntime::new();
runtime.on_device_lost(|old_backend, _error| {
    println!("GPU lost: {}", _error);
    // Auto-fallback to CPU, then try to reconnect to GPU
    runtime.swap_backend(BackendType::CPU);
});
```

The swap completes in 50-500ms depending on memory migration size. In-flight compute streams are drained before the swap — the runtime tracks pending submissions and waits for completion (with a configurable timeout, default 5 seconds). If the wait times out (device hang), in-flight work is lost and must be recomputed. Application code that uses Lac's `submit().await` pattern gets the error propagated as a `BackendLost` error — the application can retry the submission, which transparently runs on the new backend. We've only seen timeouts with GPU hangs from thermal throttling on laptops — desktop GPUs tend to hang rarely but recover cleanly.
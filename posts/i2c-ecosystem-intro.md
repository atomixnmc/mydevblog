# i2c Ecosystem Intro

i2c is not I²C the protocol. i2c (with a lowercase 'c') is a compute ecosystem for building, deploying, and connecting AI models across edge devices. Think Docker for AI workloads — but with native GPU acceleration, model registry, and device-aware scheduling.

## What i2c Solves

Shipping AI models to production involves: packaging the model (ONNX, TensorRT, custom runtimes), configuring the hardware target (CUDA, ROCm, Vulkan, NPU), building the inference server, managing dependencies, and handling versioning. i2c standardizes this into a single image format:

```
model.i2c/
├── model.onnx          # The model
├── i2c.toml            # Manifest
├── preprocessor.py     # Input pipeline
└── requirements.txt    # Dependencies
```

The `i2c.toml` manifest declares hardware requirements, runtime preferences, and exposed endpoints:

```toml
[model]
name = "yolov8-detection"
version = "0.4.2"
framework = "onnx"

[runtime]
min_memory = "2GB"
prefer_gpu = true
targets = ["cuda:11.8", "rocm:5.7", "vulkan"]

[serve]
endpoints.http = "/predict"
endpoints.grpc = ":50051"
batch_size = 8
```

## Building and Running

```bash
# Build an i2c image
i2c build . -t yolov8:0.4.2

# Run on available hardware
i2c run yolov8:0.4.2 --device auto

# Or target specific hardware
i2c run yolov8:0.4.2 --device cuda:0
```

The build process optimizes the model for each target — ONNX Runtime for CUDA, TensorRT for Nvidia, CoreML for Apple Silicon. The image contains multiple optimized variants and i2c selects the best one at runtime.

## Device Mesh

i2c connects devices into a mesh for distributed inference. If a device lacks the compute for a model, i2c can offload to another node:

```bash
# List available mesh nodes
i2c node list
# NAME      TYPE       MEM   GPU       STATUS
# jetson-1  Jetson Orin 16GB  Ampere   online
# rpi-5     RPi 5       8GB   VideoCore offline
# desktop   RTX 4090    24GB  Ada      online

# Run with mesh fallback
i2c run yolov8:0.4.2 --mesh mesh=auto
```

The mesh scheduler considers latency, bandwidth, and available compute. For real-time vision pipelines (<30ms inference), models run on the local device or nearest node. For batch processing, they can run anywhere in the mesh.

## Use Case

We use i2c in our warehouse vision pipeline. Cameras on Jetson Orin nodes detect package labels using YOLOv8 (i2c image, runs at 25ms/inference). When a rare high-resolution scan is needed, the load balancer offloads to a desktop node with a 4090. The mesh handles this transparently — the application sees one inference endpoint, i2c handles routing. This cut our per-scan latency by 60% during peak hours because the Jetson nodes never got overloaded — peak traffic was naturally spilled to the desktop node without any application-level queueing logic.
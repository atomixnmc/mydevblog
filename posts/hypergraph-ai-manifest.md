# HyperGraph AI Manifests

HyperGraph AI Manifests are declarative configuration files for AI pipelines on HyperGraph. A manifest describes the input data sources, processing steps, model references, and output targets — and HyperGraph executes it as a DAG across available compute nodes.

## Manifest Format

```yaml
name: "customer-segmentation-v2"
version: "2.1.0"

inputs:
  - name: "transactions"
    source: "hypergraph://finance/transactions"
    format: "graph"
    filter: "timestamp > '2025-01-01'"

  - name: "customer_profiles"
    source: "hypergraph://crm/customers"
    format: "graph"

pipeline:
  - step: "feature_extraction"
    model: "hypergraph-ml/feature-extractor:1.0"
    inputs: ["transactions", "customer_profiles"]
    outputs: ["features"]

  - step: "embedding"
    model: "hypergraph-ml/graph-bert:2.0"
    inputs: ["features"]
    outputs: ["embeddings"]

  - step: "clustering"
    model: "hypergraph-ml/kmeans:1.5"
    params:
      k: 5
      max_iterations: 100
    inputs: ["embeddings"]
    outputs: ["segments"]

outputs:
  - name: "customer_segments"
    target: "hypergraph://analytics/segments"
    format: "graph"
    overwrite: true
```

## Execution

HyperGraph reads the manifest and compiles it into an execution DAG:

```rust
struct ExecutionDAG {
    steps: Vec<PipelineStep>,
    edges: Vec<(StepId, StepId)>, // Data dependencies
}

impl ExecutionDAG {
    fn schedule(&self, cluster: &ComputeCluster) -> Schedule {
        let mut schedule = Schedule::new();
        for step in &self.steps {
            let preferred_node = cluster.select_node(
                step.model.requirements(),
                step.estimated_runtime(),
            );
            schedule.assign(step.id, preferred_node);
        }
        schedule
    }
}
```

The scheduler assigns steps to compute nodes based on: model requirements (GPU memory, CUDA capability), data locality (prefer the node where input data resides), current node load, and estimated runtime (short steps scheduled on available nodes, long steps planned for dedicated allocation).

## Model Registry

Manifests reference models from a registry:

```yaml
models:
  - name: "graph-bert"
    version: "2.0"
    source: "hypergraph-ml/models/graph-bert-v2.onnx"
    runtime: "onnxruntime"
    requirements:
      gpu_memory: "4GB"
      cuda_capability: "7.0+"
    input_schema:
      node_features: "float32[batch, 768]"
      edge_index: "int64[batch, 2, edges]"
    output_schema:
      embeddings: "float32[batch, 256]"
```

The registry stores model artifacts (ONNX, TensorRT, custom), their schemas, and hardware requirements. HyperGraph pulls the model to the compute node and launches it with the specified runtime. Model caching eliminates redundant downloads — once a model version is cached on a node, subsequent pipelines reuse it.

## Pipeline Composition

Manifests can reference other manifests as sub-pipelines:

```yaml
name: "recommendation-engine"
version: "3.0.0"

pipeline:
  - step: "customer_segmentation"
    pipeline: "./customer-segmentation-v2.yaml"  # Sub-pipeline
    inputs: ["transactions", "profiles"]
    outputs: ["segments"]

  - step: "product_embedding"
    pipeline: "./product-embedding-v1.yaml"
    inputs: ["catalog"]
    outputs: ["product_vectors"]

  - step: "recommend"
    model: "hypergraph-ml/gnn-recommender:2.0"
    inputs: ["segments", "product_vectors"]
    outputs: ["recommendations"]
```

Composition enables modular AI pipelines. The customer segmentation pipeline is maintained separately from the recommendation engine. Version bumps to the segmentation model flow through automatically when the sub-pipeline version constraint matches.

## Lineage Tracking

Every manifest execution records lineage — which input data, model version, and parameters produced each output:

```rust
struct LineageRecord {
    manifest: String,              // Manifest name
    manifest_version: String,      // Version
    execution_id: Uuid,            // Unique execution
    input_snapshots: Vec<DataSnapshot>,  // Input data hashes
    model_versions: Vec<String>,   // Model versions used
    parameters: HashMap<String, Value>, // Overridden params
    output_snapshot: DataSnapshot, // Output data hash
    timestamp: DateTime<Utc>,
}
```

The lineage record is stored in HyperGraph alongside the output data. Any consumer of the output can trace back to the inputs, models, and parameters that produced it. This is essential for audit trails and reproducibility — if a customer segment looks wrong, the lineage tells you exactly which model version and input data produced it.
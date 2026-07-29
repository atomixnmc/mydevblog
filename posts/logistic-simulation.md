# Logistic Discrete Event Simulation

Discrete Event Simulation (DES) models a system as a sequence of events over time. For logistics — warehouses, supply chains, order fulfillment — DES is the standard tool for capacity planning and bottleneck analysis.

## The Event Loop

DES advances time by jumping from event to event, not by fixed timesteps:

```python
from heapq import heappush, heappop

class Simulation:
    def __init__(self):
        self.time = 0.0
        self.event_queue = []

    def schedule(self, delay, event_fn, *args):
        heappush(self.event_queue, (self.time + delay, event_fn, args))

    def run(self, until):
        while self.event_queue and self.event_queue[0][0] <= until:
            self.time, event_fn, args = heappop(self.event_queue)
            event_fn(*args)
```

Each event can schedule future events — a "package arrives" event schedules a "package processed" event at (current_time + processing_time). This is the core mechanism. The simulation is just events triggering events, with time jumps between them.

## Modeling a Fulfillment Center

```python
class FulfillmentCenter(Simulation):
    def __init__(self, num_pickers=10):
        super().__init__()
        self.pickers = Resource(num_pickers)
        self.packers = Resource(4)
        self.order_queue = Queue()
        self.orders_completed = 0

    def order_arrives(self, order):
        self.order_queue.put(order)
        if self.pickers.available():
            self.schedule(0, self.pick_order)
        # Schedule next arrival
        self.schedule(expovariate(1/30), self.order_arrives, Order())

    def pick_order(self):
        order = self.order_queue.get()
        pick_time = triangular(60, 180, 120)  # seconds
        self.schedule(pick_time, self.pick_complete, order)

    def pick_complete(self, order):
        self.pickers.release()
        self.packers.acquire()
        pack_time = normalvariate(45, 10)
        self.schedule(pack_time, self.pack_complete, order)

    def pack_complete(self, order):
        self.packers.release()
        self.orders_completed += 1
        if not self.order_queue.empty():
            self.schedule(0, self.pick_order)
```

The `Resource` class tracks capacity — pickers can handle at most `num_pickers` concurrent picks. When all pickers are busy, orders wait in the queue. The processing times are drawn from distributions (triangular for picking, normal for packing) based on historical data.

## Analyzing Results

Run the simulation 1000 times and collect statistics:

```python
def analyze_scenario(pickers, packers):
    results = []
    for _ in range(1000):
        sim = FulfillmentCenter(num_pickers=pickers, num_packers=packers)
        sim.schedule(0, sim.order_arrives, Order())
        sim.run(until=28800)  # 8-hour shift
        results.append(sim.orders_completed)
    return {
        'mean': statistics.mean(results),
        'p95': sorted(results)[950],
        'utilization': sim.pickers.utilization(),
        'queue_depth': sim.order_queue.max_depth(),
    }
```

We use this to answer "do we need another picker?" Adding the 11th picker increased throughput by 5%. Adding the 12th by only 1% — the bottleneck shifted to packing. The simulation revealed this before we hired anyone.

## Stochastic vs Deterministic

Using deterministic processing times (always 120 seconds per pick) gives misleading results — it suggests you can handle exactly (8 * 3600 / 120) * 10 = 2400 orders per shift. Real-world variance reduces this to ~1800. DES accounts for this variance through stochastic processing times and queueing dynamics. The difference between the deterministic estimate and the stochastic simulation is typically 20-30% in throughput — that's the cost of variance. If you're planning capacity, simulate with real distributions, not averages.
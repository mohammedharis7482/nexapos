# Initial performance targets

These are targets, not measured claims. Record staging and production results
separately with dataset size, concurrency, browser/device, network, percentile,
and timestamp.

| Operation | Initial target | Measured local | Production |
| --- | --- | --- | --- |
| Login response | p95 ≤ 800ms excluding deliberate throttle delay | Pending controlled measurement | Pending |
| Product name search | p95 ≤ 500ms for pilot catalogue | Pending | Pending |
| Exact barcode lookup | p95 ≤ 250ms | Pending | Pending |
| Add/update cart item | p95 ≤ 500ms | Pending | Pending |
| Sale completion | p95 ≤ 1,000ms under normal till concurrency | Pending contention test | Pending |
| Dashboard load | p95 ≤ 1,500ms | Pending | Pending |
| Sales page | p95 ≤ 750ms at page size 25 | Pending | Pending |
| Reports, default seven days | p95 ≤ 2,000ms | Pending | Pending |
| Reports, maximum 367 days | p95 ≤ 5,000ms or explicit operational limit | Pending | Pending |
| UI input response | ≤ 100ms for primary billing interactions | Pending browser profile | Pending |
| Route usable content | ≤ 2.5s on agreed pilot device/network | Pending | Pending |

Performance acceptance requires repeatable measurements; a single development
request is not sufficient evidence.


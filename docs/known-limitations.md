# Known limitations

NexaPOS v1.0 excludes online payment gateways, supplier/purchasing,
subscription checkout/billing, multi-branch, loyalty, payroll, and advanced
accounting. Card payments record an external-terminal result; NexaPOS does not
handle sensitive card credentials.

Email invitation foundations exist in backend code but are hidden in the v1 UI;
direct staff creation is supported. The account maximum is a fixed safety limit,
not a purchasable seat.

An enforcing CSP awaits report-only host telemetry. Edge throttling, SMTP,
managed backups/restore rehearsal, physical scanner/printer testing, and live
cross-origin cookie validation must be completed by deployment operations.

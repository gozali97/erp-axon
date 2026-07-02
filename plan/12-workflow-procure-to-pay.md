# 5. Complete Business Workflow — Procure to Pay

This is the end-to-end flow tying together every module delivered in Phase 2
(`07` through `11`). Individual module documents contain the detailed
per-module workflow; this view shows how they chain together and where
control/approval gates sit.

```mermaid
flowchart TD
    subgraph Demand
        A[Reorder alert / MRP output / manual need] --> B[Purchase Request]
        B --> C{PR approval threshold?}
        C -- Yes --> D[Director/Owner approves PR]
        C -- No --> E[PR auto-approved]
        D --> E
    end

    subgraph Commitment
        E --> F[Purchasing selects Supplier, creates PO]
        F --> G{Supplier blacklisted?}
        G -- Yes --> F2[Blocked - select different supplier]
        F2 --> F
        G -- No --> H{PO approval threshold?}
        H -- Yes --> I[Director/Owner approves PO]
        H -- No --> J[PO auto-approved]
        I --> J
        J --> K[PO sent to supplier, confirmed]
    end

    subgraph Fulfillment
        K --> L[Warehouse posts Goods Receipt]
        L --> M{QC enabled?}
        M -- Yes --> N[QC disposition: pass/fail/partial]
        N --> O{Any failed qty?}
        O -- Yes --> P[Purchase Return created]
        O -- No --> Q[Stock available]
        M -- No --> Q
        Q --> R{Accounting enabled?}
        R -- Yes --> S[GR/IR accrual journal entry]
        R -- No --> T[GR complete]
        S --> T
    end

    subgraph Settlement
        T --> U[Supplier sends invoice/bill]
        U --> V[Accounting creates Supplier Bill, 3-way match vs PO+GR]
        V --> W{Match OK?}
        W -- No --> X[Resolve discrepancy with Purchasing/Supplier]
        X --> V
        W -- Yes --> Y{Bill approval threshold?}
        Y -- Yes --> Z[Finance approves Bill]
        Y -- No --> AA[Bill auto-approved]
        Z --> AA
        AA --> AB[Bill posted: AP liability created, GR/IR cleared]
        AB --> AC[Payment scheduled against Bill]
        AC --> AD{Payment approval threshold?}
        AD -- Yes --> AE[Finance approves - segregation of duties enforced]
        AD -- No --> AF[Payment auto-approved]
        AE --> AF
        AF --> AG[Payment posted: AP reduced, Bank/Cash reduced]
    end

    P -.feeds AP credit.-> AB
```

## Control Points Summary

| Gate | Enforced In | Rule Reference |
|---|---|---|
| PR approval threshold | Purchase Request module | PR-F2 |
| Blacklisted supplier block | Purchase Order module | PO Business Rule #1 |
| PO approval threshold + no self-approval | Purchase Order module | PO Business Rule #5 |
| Over-receipt tolerance | Goods Receipt module | GR-F3 |
| QC disposition gate | Goods Receipt module | GR-F5 |
| 3-way match tolerance | Payment (AP) module | PAY-F2, Business Rule #1 |
| Bill approval threshold | Payment (AP) module | PAY-F4 |
| Payment segregation of duties | Payment (AP) module | PAY-F7, Business Rule #3 |
| Fiscal period lock | Accounting Core module | GL-F8 |

Every gate above is independently configurable per company (thresholds,
tolerances, strict vs. lenient segregation-of-duties) via Settings, but the
*existence* of each gate in the flow is not optional — it can be set to a
zero threshold (effectively always-approve) but not removed from the
architecture, since downstream reporting (audit trail, AP aging, GL
integrity) assumes these checkpoints exist.

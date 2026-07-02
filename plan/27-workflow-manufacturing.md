# 5. Complete Business Workflow — Manufacturing

End-to-end flow tying together every module delivered in Phase 5 (`23`
through `26`). Individual module documents contain the detailed per-module
workflow; this view shows how they chain together.

```mermaid
flowchart TD
    subgraph Planning
        A[Confirmed Sales Order demand + forecast] --> B[MRP run: net demand vs supply]
        B --> C[Explode BOM recursively for shortages]
        C --> D[MRP Suggestions: Production Orders + Purchase Requests]
        D --> E[Planner reviews and converts accepted suggestions]
    end

    subgraph Execution
        E --> F[Production Order created/released]
        F --> G{Component stock sufficient?}
        G -- No, block policy --> H[Held, PR suggested for shortfall]
        G -- Yes / allowed with flag --> I[Materials issued - backflush or progressive]
        I --> J[Operations executed per routing]
        J --> K{QC in-process checkpoint?}
        K -- Yes --> L[Inspection: pass/fail/rework]
        L -- Fail --> M[Scrap or rework loop back to J]
        L -- Pass --> N
        K -- No --> N[Report output quantity]
        N --> O[Finished goods received into inventory at rolled-up cost]
    end

    subgraph Equipment_Reliability
        P[PM schedule due / breakdown occurs] --> Q[Maintenance Work Order]
        Q --> R[Execute: parts + labor]
        R --> S[Close, recalc next PM]
        S -.affects capacity/availability.-> F
    end

    O --> T[Stock available for Sales/Delivery per 18-workflow-lead-to-cash.md]
```

## Control Points Summary

| Gate | Enforced In | Rule Reference |
|---|---|---|
| Human review before binding PR/Production Order creation | MRP module | MRP Business Rule #1 |
| Component shortage policy (block/allow-with-flag) | Production Order module | PROD-F3 |
| Negative-stock prevention on material issue | Production Order + Inventory | PROD Business Rule #2 |
| Circular BOM prevention | BOM module | BOM Business Rule #7 |
| Over-production tolerance | Production Order module | PROD Business Rule #3 |
| QC in-process disposition gate | Quality Control module | QC Business Rule #1–2 |
| NCR permanence / mandatory root cause | Quality Control module | QC Business Rule #5 |
| PM schedule cannot silently lapse | Maintenance module | MAINT Business Rule #1 |
| Mandatory findings on corrective Work Order closure | Maintenance module | MAINT Business Rule #4 |

This phase connects backward into `12-workflow-procure-to-pay.md` (component
shortages become Purchase Requests) and forward into
`18-workflow-lead-to-cash.md` (finished goods become sellable stock),
making Manufacturing the structural bridge between the two core commercial
loops.

# 5. Complete Business Workflow — Lead to Cash (Order to Delivery)

End-to-end flow tying together every module delivered in Phase 3 (`13`
through `17`). Individual module documents contain the detailed per-module
workflow; this view shows how they chain together and where control/approval
gates sit.

```mermaid
flowchart TD
    subgraph Demand
        A[CRM lead/opportunity or direct inquiry] --> B[Sales creates Quotation]
        B --> C[Send Quotation to customer]
        C --> D{Customer accepts?}
        D -- No / Expired --> Z1[SQ declined/expired - end]
        D -- Yes --> E[Convert SQ to Sales Order]
    end

    subgraph Commitment
        E --> F{Customer blacklisted?}
        F -- Yes --> F1[Blocked - resolve status first]
        F -- No --> G{Credit limit exceeded?}
        G -- Yes --> H{Override approved?}
        H -- No --> I[SO held]
        H -- Yes --> J
        G -- No --> J{Discount above threshold?}
        J -- Yes --> K[Sales Manager/Director approves]
        J -- No --> L[SO confirmed]
        K --> L
        L --> M[Reserve stock at warehouse]
    end

    subgraph Fulfillment
        M --> N[Warehouse creates Delivery Order]
        N --> O[Pick/pack - batch/serial allocation]
        O --> P[Ship / hand over, capture Proof of Delivery]
        P --> Q{Fully delivered?}
        Q -- No --> N
        Q -- Yes --> R[SO fulfillment = complete]
    end

    subgraph Billing
        R --> S{Billing policy}
        S -- bill_on_order --> T1[Invoice created at SO confirmation]
        S -- bill_on_delivery --> T2[Invoice created per Delivery Order]
        S -- bill_on_milestone --> T3[Invoice created on manual milestone trigger]
        T1 --> U[Invoice posted: AR liability + Revenue recognized]
        T2 --> U
        T3 --> U
        U --> V[Invoice appears in AR Aging as open]
    end

    subgraph Settlement
        V --> W[Customer pays - full/partial/batch]
        W --> X{Payment > approval threshold?}
        X -- Yes --> Y[Finance approves]
        X -- No --> AA[Auto-approved]
        Y --> AA
        AA --> AB[Payment posted: AR reduced, Bank/Cash increased]
        AB --> AC[Invoice status: partially_paid / paid]
    end
```

## Alternate Path — Point of Sale (Retail/Restaurant)

For retail, restaurant, and walk-in scenarios, POS collapses Quotation →
Order → Delivery → Invoice → Payment into a single synchronous transaction:

```mermaid
flowchart LR
    A[Customer selects items at POS] --> B[Cashier scans/adds to cart]
    B --> C[Apply discount within limit / loyalty]
    C --> D[Select payment method]
    D --> E[Tender payment]
    E --> F[Stock issued immediately, Invoice + Payment posted atomically]
    F --> G[Receipt printed/emailed]
```

## Control Points Summary

| Gate | Enforced In | Rule Reference |
|---|---|---|
| Blacklisted customer block | Sales Order module | SO Business Rule (Customer BR #2) |
| Credit limit check | Customer / Sales Order modules | CUST-F2, SO Business Rule #2 |
| Discount approval threshold | Sales Quotation / Sales Order | SQ-F6, SO-F3 |
| No self-approval | Sales Order module | SO Business Rule #5 |
| Stock reservation / backorder policy | Sales Order module | SO-F4, SO Business Rule #3 |
| Batch/serial allocation at delivery | Delivery Order module | (see `15-module-delivery-order.md`) |
| Billing policy trigger | Sales Order / Invoice modules | SO-F6 |
| Invoice approval threshold | Invoice/Payment (AR) module | (see `16-module-invoice-payment-ar.md`) |
| Payment approval + segregation of duties | Invoice/Payment (AR) module | (see `16-module-invoice-payment-ar.md`) |
| POS shift/cash-drawer reconciliation | POS module | (see `17-module-pos.md`) |
| POS supervisor override (discount/refund) | POS module | (see `17-module-pos.md`) |

As with Procure-to-Pay, every gate is configurable (thresholds can be set to
zero for effectively-always-approve) but architecturally always present,
since AR Aging, revenue recognition, and audit trail all assume these
checkpoints exist in the data model.

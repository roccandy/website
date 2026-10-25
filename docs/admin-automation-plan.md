# Admin Automation and Operations Autopilot Plan

Status: future roadmap — not implemented

Created: 2026-08-26

This document records a possible future program to reduce Roc Candy administration, email handling, production planning, purchasing, packing, and dispatch work. It describes desired behavior only. It must not be treated as documentation of the current application.

Current behavior remains documented in:

- `docs/architecture-notes.md`
- `docs/launch-steps.md`

## Objective

Move the business toward exception-based administration:

- Routine work happens automatically from structured rules.
- AI reads, classifies, summarises, and drafts unstructured material.
- Staff see one prioritised list of decisions and exceptions.
- Money, customer commitments, supplier orders, and destructive actions retain appropriate approval.
- Every automated decision is explainable, retryable, reversible where possible, and audited.

The target is not an autonomous agent with unrestricted access. The target is a reliable operations system that removes repetitive work while keeping staff in control of consequential decisions.

## Existing Foundation

The current application already has useful building blocks:

- Supabase as the operational source of truth.
- Structured website and admin-created orders.
- Square and PayPal payment state.
- Square admin invoices and webhook updates.
- Customer profiles, historical orders, enquiries, notes, and identities.
- Batch weights and large-order pricing.
- Production slots, blocked dates, day notes, and manual drag/drop assignment.
- Production, pre-made, invoice, archived, and customer admin views.
- Order/customer emails and an admin activity log.

The principal gaps are orchestration, inbound mailbox integration, automatic scheduling, inventory requirements, purchasing, fulfilment scanning, and exception monitoring.

## Guiding Design

```text
Order / email / payment / stock event
                  |
            durable job queue
                  |
        deterministic business rules
          + optional AI analysis
                  |
       proposed or automatic action
                  |
        approval when consequential
                  |
       database update + audit event
                  |
      customer/staff/supplier output
```

### Use deterministic rules for

- Prices, totals, discounts, refunds, and tax.
- Ingredient, packaging, label, and stock quantities.
- Production capacity and shipping buffers.
- Payment and invoice state.
- Permission and approval requirements.
- Idempotency and duplicate prevention.

### Use AI for

- Email classification and summarisation.
- Extracting order references, requested dates, quantities, artwork requests, and proposed changes.
- Drafting replies from approved templates and business rules.
- Explaining scheduling conflicts in plain language.
- Summarising a customer/order history for staff.
- Turning unstructured supplier/customer messages into proposed structured actions.

AI output should conform to a strict schema and include confidence, evidence, and a recommended next action. AI must not be the source of truth for quantities, money, permissions, or production feasibility.

## Priority 1: Unified Operations Inbox

Replace the current admin landing page with a single prioritised work queue. It should be the primary screen staff check during the day.

Example sections:

- Replies awaiting approval.
- New enquiries requiring a quote.
- Missing or unapproved artwork.
- Missing customer/order information.
- Paid orders ready to schedule.
- Orders that cannot meet their required date.
- Stock shortages and purchases due.
- Overdue invoices and payment exceptions.
- Production due today.
- Orders ready to pack, dispatch, or collect.
- Failed emails, webhooks, payments, and automation jobs.

Every work item should show:

- What happened.
- Why action is required.
- Customer/order/supplier context.
- Priority and deadline.
- Recommended action and confidence.
- One-click action where safe.
- Owner and current state.

Proposed work-item states:

```text
open -> acknowledged -> waiting_customer / waiting_supplier / scheduled
     -> resolved
     -> dismissed with reason
```

Proposed data:

- `work_items`
- `work_item_events`
- `approval_requests`
- `automation_runs`
- `automation_failures`

Initial completion criteria:

- Staff can understand all outstanding operational work from one screen.
- Every work item links directly to the affected order, customer, email, stock item, or automation run.
- Staff no longer need to scan several admin pages to discover urgent work.

## Priority 2: Mailbox Integration and Email Copilot

Connect the operational mailbox to the admin rather than treating email as a separate system.

### Inbound flow

1. Receive a mailbox change notification or inbound-provider webhook.
2. Save message/thread metadata and permitted content.
3. Match the sender, subject, order number, invoice number, and thread to a customer/order.
4. Classify the message.
5. Extract requested actions into structured fields.
6. Update the customer timeline.
7. Create or update a work item.
8. Generate a draft reply using approved business context.
9. Auto-send only if the message matches an explicitly approved low-risk rule.

Suggested classifications:

- New enquiry.
- Artwork supplied or replacement artwork.
- Quote or price question.
- Order change request.
- Due-date or delivery question.
- Payment/invoice question.
- Complaint or refund request.
- Supplier quote, confirmation, delay, or invoice.
- Spam/unrelated.

Proposed data:

- `email_threads`
- `email_messages`
- `email_attachments`
- `email_classifications`
- `email_drafts`

### Approval policy

May eventually auto-send:

- Receipt acknowledgements.
- Artwork-received confirmations.
- Standard payment reminders.
- Standard production/dispatch status messages.
- Tracking notifications.

Requires approval initially:

- Quotes and custom pricing.
- Promises or changes to production/delivery dates.
- Changes to an accepted order.
- Discounts, credits, refunds, and complaints.
- Messages containing unusual legal, safety, allergen, or commercial commitments.

If Google Workspace is used, Gmail supports mailbox push watches, but the watch has an expiry and must be renewed. Other mail providers should use their inbound webhook/event equivalent.

Reference: https://developers.google.com/workspace/gmail/api/reference/rest/v1/users/watch

## Priority 3: Automatic Production Planning

Build a proposed-schedule generator on top of the current order, batch, slot, blocked-date, and settings data.

### Hard constraints

- Required date and configurable shipping/packing buffer.
- Production days and blocked dates.
- Slots and capacity per day.
- Planned batch count and weight.
- Payment/order readiness rules.
- Artwork approval where required.
- Material availability.
- Locked/manual assignments.
- No duplicate slot assignment.

### Optimisation preferences

- Schedule work early enough to absorb disruption without making it unnecessarily early.
- Group compatible flavours, colours, jacket styles, or packaging where this reduces setup/cleaning work.
- Minimise unnecessary split days.
- Preserve published/locked work.
- Prioritise urgent orders and genuine customer commitments.
- Leave sensible spare capacity for remakes or urgent work.
- Minimise movement when re-planning an existing schedule.

### Admin experience

- `Generate recommended schedule` button.
- Dry-run result with no immediate writes.
- Proposed placements highlighted against the existing calendar.
- Clear reasons for every conflict/unplaced batch.
- Lock order/date controls.
- One-click approval of all or selected changes.
- Before/after summary and audit record.

This is a constraint-optimisation problem. Evaluate an open-source solver such as Google OR-Tools CP-SAT rather than asking an LLM to guess a valid schedule.

Reference: https://developers.google.com/optimization/cp

## Priority 4: Inventory, Requirements, and Purchasing

Introduce an operational bill of materials and stock ledger.

### Required master data

- Inventory item/SKU.
- Category: ingredient, flavour, colour, packaging, lid, label, carton, dispatch supply, or other.
- Unit of measure and conversion rules.
- Current stock and stocktake date.
- Reserved and available stock.
- Supplier, supplier SKU, lead time, minimum order, pack size, and current unit cost.
- Reorder threshold and preferred safety stock.
- Active/inactive state and substitutions.

### Bill of materials

- Recipe quantities per kilogram/batch.
- Flavour/colour requirements.
- Packaging and lids per customer quantity.
- Custom and ingredient labels.
- Packing and dispatch materials.
- Expected wastage where appropriate.

### Automated flow

1. Accepted/paid orders create dated material requirements.
2. Requirements reserve available stock.
3. Scheduled dates determine when materials must be available.
4. The system nets required stock against on-hand, reserved, and already-ordered quantities.
5. Shortfalls create purchasing work items.
6. Suggested purchases are consolidated by supplier, lead time, pack size, and minimum order.
7. Admin reviews and approves a purchase-order draft.
8. Receiving goods updates stock and resolves shortages.

Proposed data:

- `inventory_items`
- `inventory_balances`
- `inventory_movements`
- `bill_of_materials`
- `order_material_requirements`
- `suppliers`
- `supplier_items`
- `purchase_orders`
- `purchase_order_lines`
- `goods_receipts`

Do not auto-send purchase orders initially. After a reliable operating history exists, consider auto-approval only for whitelisted repeat items under explicit quantity and spending limits.

## Priority 5: Production, Packing, and Dispatch Execution

Generate daily work rather than requiring staff to reconstruct it from order records.

### Production output

- Ordered daily batch/run sheet.
- Recipe/material quantities.
- Flavour, colour, design, and jacket information.
- Logo/artwork download.
- Batch and total order weights.
- Quality checks and remake reporting.

### Packing output

- Orders ready to pack.
- Required package/lid/label counts.
- Customer/order packing list.
- Pickup versus delivery separation.
- Combined pre-made/custom sibling handling.
- Missing-component warnings.

### Scanning flow

Add a QR/barcode to each order or batch:

```text
ready -> started -> made -> quality checked -> packed -> dispatched/collected
```

Each scan should:

- Record staff member, time, and device/action.
- Move the work item/state forward.
- Reveal the next required instruction.
- Trigger approved customer communication.
- Preserve a correction/reversal path with audit history.

### Shipping integration

Evaluate the currently used carrier or shipping platform for:

- Address validation.
- Rate/service selection.
- Shipment and label creation.
- Manifesting.
- Tracking events.
- Automatic customer tracking emails.

Do not select a carrier integration until the actual shipping accounts, rates, workflow, and volume are documented.

## Priority 6: Customer Self-Service

Provide a secure, expiring customer link for routine order interactions:

- Review order details.
- Confirm contact and address details.
- Upload or replace artwork.
- Approve artwork.
- View invoice/payment status.
- Pay an outstanding Square invoice.
- View order stage and tracking.
- Submit a structured change request before a configurable cutoff.
- Download invoices and relevant documents.

The portal should reduce email volume without exposing internal production details or allowing uncontrolled edits to accepted/paid orders.

## Background Processing Infrastructure

Use the current Supabase/Vercel architecture rather than introducing many unrelated automation platforms.

Recommended components:

- Database outbox/event table so business writes and automation requests are recorded atomically.
- Supabase Queues or an equivalent durable queue for background work.
- Supabase Cron or an equivalent scheduler for reminders, deadlines, mailbox-watch renewal, and reconciliation.
- Small idempotent worker functions for email, classification, schedule proposals, reminders, stock requirements, and provider reconciliation.
- Dead-letter/failed-job view inside admin.
- Permanent `automation_runs` audit records.

Supabase references:

- Queues: https://supabase.com/docs/guides/queues
- Cron: https://supabase.com/docs/guides/cron

### Reliability requirements

Every job must have:

- Stable idempotency key.
- Input schema/version.
- Attempt count and retry schedule.
- Timeout.
- Success/failure timestamps.
- Safe retry behavior.
- Dead-letter or manual-recovery state.
- Links to affected business records.
- Non-secret diagnostic information.

## Permission and Safety Matrix

| Action | Automatic | Approval required | Never autonomous initially |
| --- | --- | --- | --- |
| Classify/summarise email | Yes | Low-confidence review | — |
| Create internal work item | Yes | — | — |
| Draft customer reply | Yes | Send approval | — |
| Send standard acknowledgement/status | After rule validation | New template/rule | — |
| Propose production schedule | Yes | Publish changes | — |
| Re-plan locked/published work | No | Yes | — |
| Calculate stock requirements | Yes | Stock corrections | — |
| Draft purchase order | Yes | Send/commit order | — |
| Change promised date | No | Yes | — |
| Change price/discount | No | Yes | — |
| Refund/credit customer | No | Yes | — |
| Delete orders/customers/history | No | — | Yes |
| Change users/permissions/secrets | No | — | Yes |

## Delivery Sequence

### Stage 0: Observe and measure

- [ ] Record one or two representative weeks of admin work categories and approximate time.
- [ ] Identify the actual mailbox/provider, suppliers, shipping platform, and staff roles.
- [ ] List recurring email templates and business rules.
- [ ] Define current operational states and the conditions for moving between them.
- [ ] Choose baseline measures below.

### Stage 1: Foundation and operations inbox

- [ ] Add automation/outbox, work-item, approval, and run-history schemas.
- [ ] Implement deterministic work-item rules from existing order/payment/schedule state.
- [ ] Replace/extend admin home with prioritised exception queues.
- [ ] Add owner, deadline, acknowledge, resolve, dismiss, and audit behavior.
- [ ] Add dry-run, kill-switch, retry, and failed-job controls.

### Stage 2: Mailbox and drafting

- [ ] Connect the operational mailbox read-only first.
- [ ] Match threads to customers/orders.
- [ ] Store inbound events in the current customer timeline.
- [ ] Add structured classification and draft replies.
- [ ] Run in suggestion-only mode and measure corrections.
- [ ] Enable explicitly approved acknowledgements/status templates individually.

### Stage 3: Schedule proposals

- [ ] Formalise production constraints and preferences.
- [ ] Implement deterministic feasibility tests.
- [ ] Generate dry-run schedule proposals.
- [ ] Add locks, explanations, conflict reporting, and selective approval.
- [ ] Compare proposals with real admin schedules before permitting writes.

### Stage 4: Inventory and purchasing

- [ ] Establish item, supplier, unit, BOM, and stock data.
- [ ] Validate BOM calculations against real historical orders.
- [ ] Add reservations and dated requirements.
- [ ] Add shortage/reorder work items.
- [ ] Add purchase-order drafting and goods receiving.

### Stage 5: Production, packing, shipping, and portal

- [ ] Generate daily run/packing documents.
- [ ] Add QR/barcode state updates.
- [ ] Add carrier labels/tracking after provider discovery.
- [ ] Add customer portal with artwork/address/status/payment actions.
- [ ] Automate approved communications from verified state changes.

## Success Measures

Measure before and after each stage:

- Admin minutes per new enquiry.
- Admin minutes per accepted order.
- Number of manual email touches per order.
- Percentage of messages correctly linked to a customer/order.
- Draft acceptance/edit/rejection rate by email category.
- Time spent scheduling per week.
- Number of schedule conflicts or late-risk orders found manually versus automatically.
- Emergency material purchases and production delays caused by shortages.
- Time from `made` to `dispatched`.
- Number of places staff must check to understand today’s work.
- Automation failure and manual-recovery rate.

Do not claim time savings without these measurements. Remove or redesign automations that create more review work than they eliminate.

## Decisions Needed Before Implementation

- Which mailbox/provider contains operational email?
- Should all messages be imported, or only selected labels/addresses?
- Which staff member owns each category of exception?
- Which standard emails may be sent without approval?
- What exactly makes an order ready for production?
- What shipping/packing buffer applies by location/service?
- Which production attributes reduce or increase changeover time?
- How much spare production capacity should be protected?
- Which ingredients/materials are actually stock constrained?
- Which suppliers, lead times, pack sizes, and minimum orders apply?
- Which shipping platform/carriers are currently used?
- What customer changes are allowed after payment and after production starts?
- Which AI/data-processing provider and retention/privacy settings are acceptable for customer email and artwork?

## Restart Point for Future Work

When returning to this plan:

1. Read `README.md`, `docs/architecture-notes.md`, and `docs/launch-steps.md` for current behavior.
2. Re-audit the code and live admin because the implementation may have changed since this plan was written.
3. Complete Stage 0 before selecting tools or changing the schema.
4. Implement only one stage at a time behind a feature flag and in suggestion/dry-run mode first.
5. Update this roadmap and the two authoritative documents as decisions are made.

No feature in this roadmap should be assumed active until it is implemented, tested, deployed, and moved into the authoritative system guide.

# CCRegister Product Requirements

**Date:** October 9, 2026  
**Status:** Requirements draft. Not proof of completed implementation.

## Users and product scope

A multi-tenant child care registration service supporting different jurisdictions across Canada and the United States. Primary users are childcare business administrators and guardians. Completed registrations should be printable and exportable as inspector-friendly PDFs.

## Administrative registration workflow

The admin begins a registration with the following fields:

1. Prime Guardian name and contact details.
2. Child details.
3. Type of Care Program.
4. Program Age Group.
5. Assigned Classroom Name.
6. **Select Program Schedule** with Days, Mornings, Afternoons, Custom, and Before School / After School (when offered).
7. For Custom, an interactive **four-week grid** allowing combinations of Days, Mornings, Afternoons, Before School, and After School, where available.

The guardian receives the partly completed registration and completes the remaining relevant information. Admin navigation labels should use **Registration Form Setup** rather than **Admin Forms and Links**. Admin setup should allow full-form PDF viewing and printing.

## Programs, classrooms and groups

- A Program Age Group can contain multiple individually named actual classroom groups; e.g. three infant groups, ten children each, total 30 full-day spaces.
- The dashboard should show both aggregated age-range capacity and individual named-group status, with click-through disclosure.
- The administrative dashboard must retain **Add A Program Group**.
- Include Scheduling as a dedicated admin navigation area; all left navigation sections require implemented destinations.

## Capacity model

- Track spaces and allocatable sections of spaces rather than treating a registration as one undifferentiated slot.
- A full-day space includes a morning and afternoon component; optional before-school and after-school sections can also be tracked.
- If ten full-day spaces are approved, model ten morning and ten afternoon segments. A full-day booking occupies both segments; an AM-only booking occupies AM; a PM-only booking occupies PM.
- Display full-day open capacity first, then leftover fragmented AM and PM availability, taking into account which segments actually line up within the same named classroom and date.
- Calculate utilization independently per group, colour-code utilization at the summary level, and permit drilldown.
- Avoid incorrectly adding AM and PM leftover seats to claim additional full-day spaces. Capacity must be time-, group-, and schedule-specific, including custom four-week arrangements.

## Dashboard design

- Compact Open Capacity dashboard without redundant oversized summary blocks.
- Columns showing full-day openings first, then AM-only and PM-only remaining capacity, with group-level utilization indicators.
- Minimize scrolling for the primary dashboard view.
- Multiple groups under one age range should be expandable to see each group's registration status.

## Outstanding engineering work

This repository does not yet contain source code, tests, migrations, data models, authentication, email delivery, PDF generation, guardian signatures, or jurisdiction-specific field rules. Those require implementation and verification before production use.

## Integration consideration

An optional integration with the shared CC SAS Supplier Advertising System may be designed separately, subject to requirements and safeguards for guardian-facing experiences.

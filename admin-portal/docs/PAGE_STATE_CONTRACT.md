# Page State Contract

Every data-backed page in the Admin Portal must explicitly handle five states.
This contract ensures consistent UX across the entire application.

## States

| State       | When                                                    | UI                                            |
|-------------|----------------------------------------------------------|-----------------------------------------------|
| `loading`   | Initial fetch in progress                                | Spinner or skeleton                           |
| `error`     | True failure: network, 5xx, malformed response           | Red card with message + Retry button          |
| `blocked`   | Known business-rule or readiness issue (structured code)  | Setup card with explanation + CTA button      |
| `empty`     | Request succeeded but returned no data                   | Neutral message, optional action              |
| `ready`     | Data loaded and available                                | Full data view                                |

## Usage

### 1. Store the raw error, not a string

```tsx
const [loadError, setLoadError] = useState<any>(null);

// In your catch block:
} catch (err) {
  setLoadError(err);
}
```

### 2. Classify at render time

```tsx
import { classifyPageState } from '../utils/pageState';
import { PageStateView } from '../ui/PageStateViews';

const pageState = classifyPageState({ loading, error: loadError, data: items });
```

### 3. Render with the shared component

```tsx
{pageState.kind === 'loading' ? (
  <Spinner />
) : pageState.kind !== 'ready' ? (
  <PageStateView
    state={pageState}
    onRetry={load}
    emptyTitle="No items found"
  />
) : (
  <DataView items={items} />
)}
```

### 4. For early-return patterns (pages that are unusable when blocked)

```tsx
const loadState = loadError ? classifyError(loadError) : null;
if (loadState && loadState.kind === 'blocked') {
  return (
    <Page title="Feature">
      <PageBlockedView code={loadState.code} message={loadState.message} />
    </Page>
  );
}
```

## Separate load errors from action errors

Load failures affect the entire page state.
Action failures (create, update, delete) are inline banners that don't hide the page.

```tsx
const [loadError, setLoadError] = useState<any>(null);       // → drives page state
const [actionError, setActionError] = useState<string | null>(null); // → inline Banner

// Load function:
} catch (err) {
  setLoadError(err);     // classified by classifyPageState
}

// Action function:
} catch (err: any) {
  setActionError(err?.response?.data?.message ?? 'Action failed');  // inline string
}
```

## Adding a new blocked code

1. Backend: throw with a structured code in `ForbiddenException({ code: 'MY_CODE', message: '...' })`
2. Frontend: add one entry to `BLOCKED_CODES` in `admin-portal/src/utils/pageState.ts`

```ts
MY_NEW_CODE: {
  icon: 'setup',     // 'setup' | 'lock' | 'unavailable'
  message: 'Human-readable guidance for the user.',
  cta: { label: 'Button text', path: '/admin/target' },
},
```

All pages using `classifyPageState` or `classifyError` will immediately render the correct UX.

## What counts as what

| Scenario                                          | State     |
|----------------------------------------------------|-----------|
| Backend down / network failure                     | `error`   |
| Unhandled 500                                      | `error`   |
| 403 with code `FORBIDDEN`                          | `blocked` |
| 403 with code `PAYROLL_LEGAL_ENTITY_REQUIRED`      | `blocked` |
| 501 Not Implemented (tenant feature not enabled)   | `blocked` |
| 200 with empty array                               | `empty`   |
| 200 with data                                      | `ready`   |

## Which actions remain visible in each state

| State     | Page title | Action buttons     | Filters | Data view |
|-----------|------------|---------------------|---------|-----------|
| `loading` | Yes        | Disabled            | Hidden  | Hidden    |
| `error`   | Yes        | Hidden              | Hidden  | Hidden    |
| `blocked` | Yes        | Hidden              | Hidden  | Hidden    |
| `empty`   | Yes        | Visible (e.g. Create) | Visible | Empty msg |
| `ready`   | Yes        | Visible             | Visible | Visible   |

## Telemetry

Page-state telemetry fires automatically when using `PageStateView` with `page` and `module` props.
For early-return patterns, call `usePageStateTelemetry(page, module, state)` directly.

Events are deduped per state transition — no noisy re-render tracking.

See `src/utils/pageStateTelemetry.ts` for the event model and sink API.

## Visual fixtures

Navigate to `/dev/page-states` in local dev to see canonical examples of every
state variant: error (retryable, non-retryable, network), blocked (setup, lock,
unavailable), empty, and loading.

## Creating a new data-backed page

Copy `docs/examples/DATA_PAGE_TEMPLATE.tsx` and adapt it.  It includes the full
pattern: load/action error separation, classification, telemetry, and shared
component rendering.

## PR review

Use the checklist in `docs/PR_CHECKLIST_PAGE_STATE.md` when reviewing any PR that
adds or modifies a data-backed page.

## Files

| File | Role |
|------|------|
| `src/utils/pageState.ts` | Types, `BLOCKED_CODES` registry, classifier functions |
| `src/utils/pageStateTelemetry.ts` | Telemetry event helpers and deduplication hook |
| `src/ui/PageStateViews.tsx` | Shared state UI components (instrumented) |
| `src/utils/pageState.test.ts` | Unit tests for classifier logic |
| `src/pages/DevPageStates.tsx` | Visual fixtures dev route |
| `docs/examples/DATA_PAGE_TEMPLATE.tsx` | Canonical new-page reference |
| `docs/PR_CHECKLIST_PAGE_STATE.md` | PR review checklist |

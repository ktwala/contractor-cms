## Summary

<!-- 1-3 bullet points describing the change -->

## Type of change

- [ ] Bug fix
- [ ] New feature
- [ ] Enhancement
- [ ] Refactoring
- [ ] Documentation

## Data-backed page checklist

> If this PR adds or modifies a page that loads remote data, complete this section.
> Skip if not applicable.

- [ ] Uses `classifyPageState()` or `classifyError()`
- [ ] Handles loading, error, blocked, empty, ready
- [ ] Separates load errors from action errors
- [ ] Uses `PageStateView` shared components
- [ ] Avoids string-matching backend messages
- [ ] Uses structured error code mapping
- [ ] Passes `page` / `module` to state views for telemetry

See [PR_CHECKLIST_PAGE_STATE.md](admin-portal/docs/PR_CHECKLIST_PAGE_STATE.md) for details.

## Test plan

<!-- Checklist of testing steps -->

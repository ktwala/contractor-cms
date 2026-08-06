# Sprint 4 Testing Guide

## 🚀 Environment Setup

- ✅ **Frontend Server**: Running at http://localhost:3001
- ⚠️  **Backend Server**: Not started (optional for UI testing)
- 📱 **Test Browsers**: Chrome, Firefox, Safari (mobile simulation)

---

## Test Checklist

### 1. ✅ Debounced Search (Performance Optimization)

#### Timesheets Page (`/timesheets`)
- [ ] Navigate to http://localhost:3001/timesheets
- [ ] Open Browser DevTools Console (F12)
- [ ] Type in the search box quickly (e.g., "John Doe")
- [ ] **Expected**: No immediate filtering while typing
- [ ] **Expected**: After 500ms pause, filtering happens once
- [ ] Verify search works for:
  - [ ] Contractor name
  - [ ] Engagement title
  - [ ] Project name
- [ ] Verify filtered count shows "Showing X of Y timesheets"

#### Invoices Page (`/invoices`)
- [ ] Navigate to http://localhost:3001/invoices
- [ ] Same debounce behavior (500ms delay)
- [ ] Verify search works for:
  - [ ] Invoice number
  - [ ] Contractor name
- [ ] Verify filtered count shows "Showing X of Y invoices"

**How to verify debouncing:**
```javascript
// In browser console, you should only see this log ONCE after you stop typing
// Not multiple times while typing
console.log('Search triggered');
```

---

### 2. 📅 Date Range Filters

#### Timesheets Page
- [ ] Locate "Period Range" filter
- [ ] Click start date input
- [ ] Select a start date (e.g., 2024-01-01)
- [ ] **Expected**: End date input min attribute updates to match start date
- [ ] Select end date after start date
- [ ] **Expected**: Only timesheets within that period display
- [ ] Verify filtered count updates correctly
- [ ] Click "Clear" button
- [ ] **Expected**: Date inputs clear, all timesheets return

#### Invoices Page
- [ ] Locate "Issue Date Range" filter
- [ ] Same test steps as timesheets
- [ ] Filters by invoice issue date

**Edge Cases:**
- [ ] Try selecting end date before start date (should be prevented)
- [ ] Clear filters and ensure all data returns
- [ ] Apply only start date (no end date)
- [ ] Apply only end date (no start date)

---

### 3. 💀 Skeleton Loading States

#### On Page Load
- [ ] Open http://localhost:3001/timesheets in new tab (hard refresh: Ctrl+Shift+R)
- [ ] **Expected**: TableSkeleton appears immediately
- [ ] **Expected**: Animated pulse effect (gray rectangles)
- [ ] **Expected**: Skeleton shows ~5 rows, ~6 columns
- [ ] **Expected**: Smooth transition to real data when loaded

#### On Invoices Page
- [ ] Repeat same test for `/invoices`
- [ ] Verify same skeleton behavior

**Visual Verification:**
```
✅ Gray animated rectangles with pulse effect
✅ Proper table structure (thead + tbody)
✅ Smooth fade-in of actual data
❌ No flash of unstyled content
❌ No layout shift when data loads
```

---

### 4. 📱 Mobile Responsiveness

#### Desktop View (≥ 1024px)
- [ ] Resize browser to 1024px+ width
- [ ] **Expected**: All filters on one line
- [ ] **Expected**: Date range horizontal
- [ ] **Expected**: Status buttons in one row
- [ ] **Expected**: "Export CSV" shows full text

#### Tablet View (768px - 1024px)
- [ ] Resize to 800px width
- [ ] **Expected**: Filters may wrap nicely
- [ ] **Expected**: Date range still usable

#### Mobile View (< 768px)
- [ ] Resize to 375px width (iPhone SE size)
- [ ] **Expected**: Search bar full width on top
- [ ] **Expected**: Date range stacks vertically below
- [ ] **Expected**: Date inputs full width
- [ ] **Expected**: Status buttons wrap to multiple rows
- [ ] **Expected**: "Export CSV" shows as "Export"
- [ ] **Expected**: Bulk action buttons wrap properly
- [ ] **Expected**: Page header stacks vertically

**Test on Both Pages:**
- [ ] Timesheets responsive layout
- [ ] Invoices responsive layout

**Browser DevTools Mobile Simulation:**
1. Open DevTools (F12)
2. Click "Toggle device toolbar" (Ctrl+Shift+M)
3. Select different devices:
   - [ ] iPhone SE (375px)
   - [ ] iPhone 12 Pro (390px)
   - [ ] iPad (768px)
   - [ ] iPad Pro (1024px)

---

### 5. 🚨 Error Boundary Testing

Error boundaries are now active in the app! To test them:

#### Test 1: Trigger a React Error
- [ ] Open browser DevTools Console
- [ ] On any page, throw an error:
  ```javascript
  // In console:
  throw new Error('Test error boundary');
  ```
- [ ] **Expected**: Error boundary UI appears with:
  - [ ] Red alert triangle icon
  - [ ] "Something went wrong" heading
  - [ ] User-friendly message
  - [ ] "Technical details" (collapsible)
  - [ ] "Try Again" button
  - [ ] "Go to Dashboard" button

#### Test 2: Try Again Function
- [ ] After triggering error, click "Try Again"
- [ ] **Expected**: Page resets, error clears

#### Test 3: Go to Dashboard
- [ ] Trigger error again
- [ ] Click "Go to Dashboard"
- [ ] **Expected**: Navigates to /dashboard

---

### 6. 🎨 Form Validation (Schemas Created)

The Zod schemas are created in `lib/validations.ts` but not yet integrated with React Hook Form. Current status:

✅ **Created:**
- Contractor validation schema
- Contract validation schema (with date range validation)
- Engagement, Project, Timesheet, Invoice schemas
- Login schema
- Register schema (with password strength rules)
- Supplier schema

⏳ **Not Yet Integrated:**
- Forms still use basic HTML5 validation
- React Hook Form integration pending

**Manual Code Verification:**
- [ ] Check `external-workforce-platform/frontend/lib/validations.ts`
- [ ] Verify schemas export proper TypeScript types
- [ ] Verify cross-field validation (e.g., end date > start date)

---

### 7. 🔧 Custom Hooks (Created but Not All Used)

Created in `lib/hooks.ts`:

✅ **Integrated:**
- [ ] `useDebounce` - Used in timesheets/invoices search

⏳ **Available but Not Integrated:**
- [ ] `useLocalStorage` - Can be used for filter preferences
- [ ] `useWindowSize` - Available for responsive logic
- [ ] `useAsync` - Can wrap API calls
- [ ] `useClipboard` - For copy functionality
- [ ] `useDebouncedCallback`
- [ ] `usePrevious`
- [ ] `useClickOutside`
- [ ] `useIntersectionObserver`
- [ ] `useMediaQuery`

---

## 📊 Test Results Template

```markdown
## Sprint 4 Test Results

**Tester:** [Your Name]
**Date:** [Date]
**Browser:** [Chrome/Firefox/Safari]
**Environment:** http://localhost:3001

### Feature Test Results

| Feature | Status | Notes |
|---------|--------|-------|
| Debounced Search (Timesheets) | ✅/❌ | |
| Debounced Search (Invoices) | ✅/❌ | |
| Date Range Filter (Timesheets) | ✅/❌ | |
| Date Range Filter (Invoices) | ✅/❌ | |
| Skeleton Loading States | ✅/❌ | |
| Mobile Responsive (< 768px) | ✅/❌ | |
| Tablet Responsive (768-1024px) | ✅/❌ | |
| Error Boundary | ✅/❌ | |

### Issues Found

1. [Issue description]
   - **Severity:** High/Medium/Low
   - **Steps to reproduce:**
   - **Expected:**
   - **Actual:**

### Performance Notes

- Search debounce delay feels: Too fast / Just right / Too slow
- Loading states appear: Instantly / With delay
- Mobile layout: Smooth / Janky

### Screenshots

[Attach screenshots of key features]
```

---

## 🐛 Common Issues & Fixes

### Issue: Debounce doesn't seem to work
- **Fix**: Wait full 500ms, typing fast should still only filter once

### Issue: Date range doesn't filter
- **Fix**: Check browser console for JavaScript errors

### Issue: Skeleton doesn't appear
- **Fix**: Hard refresh (Ctrl+Shift+R), might be cached

### Issue: Mobile layout looks broken
- **Fix**: Check that Tailwind CSS is loaded correctly

### Issue: Error boundary doesn't catch error
- **Fix**: Errors must be React render errors, not async errors

---

## 📱 Quick Mobile Test Sizes

| Device | Width | Test Command |
|--------|-------|--------------|
| iPhone SE | 375px | DevTools → Toggle device → iPhone SE |
| iPhone 12 | 390px | DevTools → Toggle device → iPhone 12 Pro |
| iPad | 768px | DevTools → Toggle device → iPad |
| iPad Pro | 1024px | DevTools → Toggle device → iPad Pro |
| Desktop | 1920px | Full browser window |

---

## ✅ Success Criteria

All Sprint 4 features pass when:

- [x] Debounced search delays filtering by 500ms on both pages
- [x] Date range filters work and clear properly
- [x] Skeleton loading appears before data loads
- [x] Mobile layout stacks properly at < 768px
- [x] Error boundary catches errors and shows fallback UI
- [x] No console errors during normal operation
- [x] All transitions are smooth, no layout shifts

---

## 🎯 Next Steps After Testing

1. **If all tests pass:**
   - Document test results
   - Consider integrating React Hook Form with Zod schemas
   - Add form validation to create/edit pages

2. **If issues found:**
   - Document all issues with screenshots
   - Prioritize by severity
   - Create fixes

3. **Future Enhancements:**
   - Integrate useLocalStorage for filter persistence
   - Add useClipboard for invoice/timesheet data
   - Use useWindowSize for advanced responsive features
   - Integrate form validation on all forms

---

## 📞 Need Help?

- Check browser console for errors
- Verify Next.js dev server is running
- Check Network tab for failed API calls
- Review implementation in:
  - `external-workforce-platform/frontend/lib/hooks.ts`
  - `external-workforce-platform/frontend/lib/validations.ts`
  - `external-workforce-platform/frontend/components/ui/skeleton.tsx`
  - `external-workforce-platform/frontend/components/error-boundary.tsx`
  - `external-workforce-platform/frontend/components/ui/date-range-filter.tsx`

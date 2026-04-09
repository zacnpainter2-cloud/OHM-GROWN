# Hydroponics Dashboard - Testing Plan

## Overview
This document outlines comprehensive testing procedures for the Hydroponics System Dashboard. Test each feature systematically and document any issues found.

---

## 1. Authentication Testing

### Test Cases
- [ ] **1.1** Enter correct password "greenhouse" → Should grant access to dashboard
- [ ] **1.2** Enter incorrect password → Should show error message
- [ ] **1.3** Leave password field empty → Should show validation error
- [ ] **1.4** Refresh page after login → Should remain logged in (session persistence)
- [ ] **1.5** Logout functionality (if implemented) → Should return to login screen

**Expected Behavior:** Only correct password grants access, invalid attempts show appropriate error messages.

---

## 2. Navigation & UI Testing

### Test Cases
- [ ] **2.1** Click each parameter tab (EC, pH, Temperature, O2, Water Level, Transpiration)
- [ ] **2.2** Click Controls tab → Should display ThresholdPage
- [ ] **2.3** Click Export tab → Should display ExportPage
- [ ] **2.4** Click Dosing History tab → Should display dosing events
- [ ] **2.5** Click Alert History tab → Should display alert events
- [ ] **2.6** Click Correlation Analysis tab → Should display correlation matrix
- [ ] **2.7** Click User Manual tab → Should display manual/documentation
- [ ] **2.8** Toggle Dark Mode → UI should switch themes smoothly
- [ ] **2.9** Test responsive design on mobile/tablet/desktop
- [ ] **2.10** Sidebar collapse/expand functionality

**Expected Behavior:** All navigation links work, UI is responsive and visually consistent.

---

## 3. Parameter Pages Testing (EC, pH, Temp, O2, Water Level, Transpiration)

### Test Cases for Each Parameter
- [ ] **3.1** Current reading displays correctly
- [ ] **3.2** Status badge shows appropriate state (Normal/Warning/Critical)
- [ ] **3.3** Line chart renders with data
- [ ] **3.4** Time range controls work (1h, 6h, 12h, 24h, 3d, 7d, 14d, 30d)
- [ ] **3.5** Chart updates when time range changes
- [ ] **3.6** Statistics show correct min/max/average values
- [ ] **3.7** Threshold lines display on chart (if implemented)
- [ ] **3.8** Tooltips show on chart hover
- [ ] **3.9** Units display correctly (EC: μS/cm, pH: unitless, Temp: °F, O2: mg/L, Water: inches, Transpiration: rate)
- [ ] **3.10** Handle no data gracefully (empty state)

**Test with:**
- Recent data (last 24 hours)
- Historical data (7+ days)
- No data scenarios

**Expected Behavior:** Charts render correctly, data updates reflect time range selection, status indicators match threshold values.

---

## 4. Controls/Thresholds Page Testing

### Test Cases
- [ ] **4.1** All parameter threshold cards display
- [ ] **4.2** Input fields show current threshold values
- [ ] **4.3** Min/Max threshold validation (min < max)
- [ ] **4.4** Save button saves values to localStorage
- [ ] **4.5** Saved values persist after page refresh
- [ ] **4.6** Reset to defaults button works
- [ ] **4.7** Invalid input shows error message
- [ ] **4.8** Toast notification on successful save
- [ ] **4.9** Setpoint controls (if implemented) work correctly
- [ ] **4.10** LoRa downlink controls send correct 9-byte commands

**Test Data:**
- Valid ranges: EC (800-1200), pH (5.5-6.5), Temp (65-75°F), O2 (6-8 mg/L)
- Invalid ranges: Min > Max, negative values, non-numeric input
- Boundary values: Min = Max, extreme values

**Expected Behavior:** Thresholds save correctly, validation prevents invalid input, changes reflect across dashboard.

---

## 5. Export Page Testing

### 5.1 Quick Export Presets
- [ ] **5.1.1** Click "Daily Report" → Exports last 24 hours, all parameters
- [ ] **5.1.2** Click "Weekly Report" → Exports last 7 days, all parameters
- [ ] **5.1.3** Click "Monthly Report" → Exports last 30 days, all parameters
- [ ] **5.1.4** Loading spinner shows during export
- [ ] **5.1.5** Success toast appears after export
- [ ] **5.1.6** CSV file downloads with correct filename format
- [ ] **5.1.7** CSV contains all 6 parameters with correct data

### 5.2 Custom Export
- [ ] **5.2.1** Select individual parameters (EC, pH, Temp, O2, Water Level, Transpiration)
- [ ] **5.2.2** Select custom date range (from/to)
- [ ] **5.2.3** Export button disabled when no parameters selected
- [ ] **5.2.4** Export button disabled when date range invalid
- [ ] **5.2.5** Date validation: "from" must be before "to"
- [ ] **5.2.6** Calendar prevents selecting future dates
- [ ] **5.2.7** Unit toggle works (Fahrenheit/Celsius, Inches/Centimeters)
- [ ] **5.2.8** Export preview shows correct summary
- [ ] **5.2.9** CSV exports with selected units
- [ ] **5.2.10** Handle empty data range gracefully

### 5.3 Dosing History Export
- [ ] **5.3.1** Shows count of available dosing events
- [ ] **5.3.2** Time range dropdown works (1h, 3h, 6h, 12h, 24h, 3d, 7d, 14d, 30d, All Time, Custom)
- [ ] **5.3.3** Custom date range picker works
- [ ] **5.3.4** Export includes Date, Time, Type, Action, Value columns
- [ ] **5.3.5** Filtered export matches selected date range
- [ ] **5.3.6** Shows warning if no events in date range

### 5.4 Alert History Export
- [ ] **5.4.1** Shows count of available alert events
- [ ] **5.4.2** Time range dropdown works
- [ ] **5.4.3** Custom date range picker works
- [ ] **5.4.4** Export includes Start Date/Time, End Date/Time, Duration, Type, Severity, Message
- [ ] **5.4.5** Filtered export matches selected date range
- [ ] **5.4.6** Shows warning if no alerts in date range

**CSV Validation:**
- Open exported CSV in Excel/Google Sheets
- Verify column headers are correct
- Check data formatting (dates, decimals, units)
- Verify no data corruption or missing values

**Expected Behavior:** Exports download correctly, contain accurate data, respect filters and unit settings.

---

## 6. Dosing History Page Testing

### Test Cases
- [ ] **6.1** Dosing events display in chronological order
- [ ] **6.2** Each event shows timestamp, type (EC/pH), action (increase/decrease), value
- [ ] **6.3** Events persist after page refresh (localStorage)
- [ ] **6.4** Maximum 10,000 events stored (older events pruned)
- [ ] **6.5** Filter by date range works
- [ ] **6.6** Filter by type (EC/pH) works
- [ ] **6.7** Clear history button works with confirmation
- [ ] **6.8** Empty state displays when no history
- [ ] **6.9** Pagination works for large datasets (if implemented)
- [ ] **6.10** Event details expand/collapse (if implemented)

**Test with:**
- Small dataset (10 events)
- Large dataset (1000+ events)
- Empty state (no events)

**Expected Behavior:** History displays correctly, localStorage limits enforced, filters work accurately.

---

## 7. Alert History Page Testing

### Test Cases
- [ ] **7.1** Alert events display in chronological order
- [ ] **7.2** Each alert shows start time, end time, duration, type, severity, message
- [ ] **7.3** Ongoing alerts show "Ongoing" status
- [ ] **7.4** Resolved alerts show duration in minutes
- [ ] **7.5** Severity badges color-coded (Critical/Warning/Info)
- [ ] **7.6** Events persist after page refresh (localStorage)
- [ ] **7.7** Maximum 10,000 events stored
- [ ] **7.8** Filter by severity works
- [ ] **7.9** Filter by date range works
- [ ] **7.10** Clear history button works with confirmation

**Test Scenarios:**
- Trigger alert by setting threshold and simulating out-of-range data
- Verify alert appears in history
- Verify alert resolves when data returns to normal

**Expected Behavior:** Alerts log correctly, show accurate durations, filters work, storage limits enforced.

---

## 8. Correlation Analysis Page Testing

### 8.1 Correlation Matrix
- [ ] **8.1.1** 6x6 matrix displays all parameter combinations
- [ ] **8.1.2** Diagonal cells show 1.00 (perfect correlation)
- [ ] **8.1.3** Color coding matches correlation strength
- [ ] **8.1.4** Click cell updates scatter plot below
- [ ] **8.1.5** Hover shows correlation value
- [ ] **8.1.6** Legend displays correlation strength ranges

### 8.2 Scatter Plot
- [ ] **8.2.1** Scatter plot updates when matrix cell clicked
- [ ] **8.2.2** Axis labels show correct parameters and units
- [ ] **8.2.3** Data points render correctly
- [ ] **8.2.4** Tooltip shows X/Y values on hover
- [ ] **8.2.5** Lag control slider works (0-60 minutes)
- [ ] **8.2.6** Correlation coefficient updates with lag

### 8.3 Time Range Controls
- [ ] **8.3.1** Preset time ranges work (1h, 6h, 12h, 24h, 3d, 7d, 14d, 30d)
- [ ] **8.3.2** Custom date range picker works
- [ ] **8.3.3** Date validation prevents invalid ranges
- [ ] **8.3.4** Matrix recalculates when time range changes
- [ ] **8.3.5** Comparison period dropdown works
- [ ] **8.3.6** Custom comparison date range works

### 8.4 Key Insights
- [ ] **8.4.1** Insights section displays relevant findings
- [ ] **8.4.2** Temp/O2 correlation insight (should be negative)
- [ ] **8.4.3** EC/pH correlation insight (typically negative)
- [ ] **8.4.4** Temp/Transpiration insight (should be positive)
- [ ] **8.4.5** Icons match insight type (positive/negative/anomaly)

### 8.5 Export Functions
- [ ] **8.5.1** "Export Analysis" button downloads CSV
- [ ] **8.5.2** CSV includes correlation matrix, scatter data, insights, statistics
- [ ] **8.5.3** "Export Image" button downloads PNG
- [ ] **8.5.4** Image export includes visible chart area
- [ ] **8.5.5** Filename includes timestamp

**Expected Behavior:** Correlations calculate correctly, visualizations update dynamically, exports work properly.

---

## 9. Data Integration Testing

### Test Cases
- [ ] **9.1** Data fetches from AWS API Gateway
- [ ] **9.2** DynamoDB query returns expected format
- [ ] **9.3** Data updates every 5 minutes (polling interval)
- [ ] **9.4** Handle API errors gracefully (timeout, 404, 500)
- [ ] **9.5** Show loading states during data fetch
- [ ] **9.6** Cache data appropriately
- [ ] **9.7** Handle malformed data responses
- [ ] **9.8** Handle empty dataset from API
- [ ] **9.9** Offline mode fallback (if implemented)
- [ ] **9.10** WebSocket connection (if real-time updates implemented)

**Test Scenarios:**
- Normal operation with live data
- API endpoint unavailable
- Slow network connection (throttle to 3G)
- Corrupted response data
- Missing data fields

**Expected Behavior:** Dashboard handles all API states gracefully, shows appropriate loading/error states.

---

## 10. LoRa Downlink Testing

### Test Cases
- [ ] **10.1** Downlink command builds correct 9-byte payload
- [ ] **10.2** Command includes device ID, parameter type, action, value
- [ ] **10.3** Checksum calculation correct
- [ ] **10.4** Command sends to AWS IoT Core
- [ ] **10.5** Confirmation toast appears after send
- [ ] **10.6** Error handling for failed transmission
- [ ] **10.7** Dosing event logs to history after successful command
- [ ] **10.8** Rate limiting prevents spam (if implemented)
- [ ] **10.9** Command preview shows before sending (if implemented)
- [ ] **10.10** Raspberry Pi receives and executes command

**Test Commands:**
- Increase EC to 1000 μS/cm
- Decrease pH to 6.0
- Set temperature setpoint to 70°F
- Increase O2

**Expected Behavior:** Commands format correctly, transmit successfully, log to history, execute on device.

---

## 11. Calibration Reminders Testing

### Test Cases
- [ ] **11.1** Calibration due dates display correctly
- [ ] **11.2** Countdown shows days until next calibration
- [ ] **11.3** Overdue calibrations show warning indicator
- [ ] **11.4** "Mark as Calibrated" button updates date
- [ ] **11.5** Next due date calculates based on interval
- [ ] **11.6** Calibration history persists in localStorage
- [ ] **11.7** Notification badge shows overdue count
- [ ] **11.8** Export calibration history works

**Test Intervals:**
- pH sensor: Every 7 days
- EC sensor: Every 30 days
- O2 sensor: Every 60 days
- Temperature sensor: Every 90 days

**Expected Behavior:** Reminders trigger on schedule, updates persist, notifications visible.

---

## 12. Dark Mode Testing

### Test Cases
- [ ] **12.1** Toggle switches between light/dark themes
- [ ] **12.2** All pages render correctly in dark mode
- [ ] **12.3** Charts and graphs visible in dark mode
- [ ] **12.4** Text contrast meets accessibility standards (WCAG AA)
- [ ] **12.5** Icons and badges adjust colors appropriately
- [ ] **12.6** Preference saves to localStorage
- [ ] **12.7** Theme persists after page refresh
- [ ] **12.8** System preference detection works (if implemented)
- [ ] **12.9** No flashing during theme transition
- [ ] **12.10** All UI components support dark mode

**Expected Behavior:** Dark mode works consistently across entire dashboard, no visual glitches.

---

## 13. Performance Testing

### Test Cases
- [ ] **13.1** Page load time < 3 seconds
- [ ] **13.2** Chart rendering smooth with 1000+ data points
- [ ] **13.3** No memory leaks during extended use
- [ ] **13.4** Smooth scrolling with large datasets
- [ ] **13.5** Export completes in reasonable time (< 10s for 1 month data)
- [ ] **13.6** localStorage doesn't exceed browser limits
- [ ] **13.7** Responsive on mobile devices (no lag)
- [ ] **13.8** CPU usage acceptable during data updates
- [ ] **13.9** Network requests optimized (minimal redundant calls)
- [ ] **13.10** Bundle size optimized (< 5MB)

**Tools:**
- Chrome DevTools Performance tab
- Lighthouse audit
- Network throttling

**Expected Behavior:** Dashboard performs well even with large datasets, no performance degradation over time.

---

## 14. Edge Cases & Error Handling

### Test Cases
- [ ] **14.1** No data available → Show empty state message
- [ ] **14.2** Data gaps in timeline → Handle gracefully in charts
- [ ] **14.3** Extreme sensor values (99999) → Display appropriately
- [ ] **14.4** Negative values → Validate and reject/handle
- [ ] **14.5** Very old data (years ago) → Export/display correctly
- [ ] **14.6** localStorage full → Show warning, prune old data
- [ ] **14.7** Browser doesn't support localStorage → Fallback behavior
- [ ] **14.8** User switches tabs during export → Handle state correctly
- [ ] **14.9** Multiple tabs open → Data sync issues
- [ ] **14.10** Invalid date selections → Show validation errors
- [ ] **14.11** CSV export with special characters → Escape properly
- [ ] **14.12** Image export on small screen → Render correctly
- [ ] **14.13** Rapid clicking export button → Prevent duplicate exports
- [ ] **14.14** Browser back button → Navigation state correct
- [ ] **14.15** Page reload during data fetch → Resume gracefully

**Expected Behavior:** All edge cases handled gracefully with appropriate user feedback.

---

## 15. Browser Compatibility Testing

### Test Browsers
- [ ] **15.1** Chrome (latest)
- [ ] **15.2** Firefox (latest)
- [ ] **15.3** Safari (latest)
- [ ] **15.4** Edge (latest)
- [ ] **15.5** Mobile Safari (iOS)
- [ ] **15.6** Chrome Mobile (Android)

### Test in Each Browser
- Authentication flow
- All navigation tabs
- Chart rendering
- Export functionality
- Dark mode toggle
- localStorage features

**Expected Behavior:** Dashboard works consistently across all major browsers.

---

## 16. User Manual Testing

### Test Cases
- [ ] **16.1** User Manual page loads
- [ ] **16.2** All sections display correctly
- [ ] **16.3** Accordion expand/collapse works
- [ ] **16.4** Content is accurate and helpful
- [ ] **16.5** Links work (if any)
- [ ] **16.6** Code examples formatted correctly
- [ ] **16.7** Images/diagrams load (if any)
- [ ] **16.8** Searchable content (if implemented)
- [ ] **16.9** Print-friendly format (if needed)
- [ ] **16.10** Mobile-friendly layout

**Expected Behavior:** Manual provides clear guidance for all dashboard features.

---

## 17. Security Testing

### Test Cases
- [ ] **17.1** Password not visible in URL or console
- [ ] **17.2** Session expires after timeout (if implemented)
- [ ] **17.3** XSS prevention (test with `<script>alert(1)</script>` in inputs)
- [ ] **17.4** API keys not exposed in client code
- [ ] **17.5** HTTPS enforced (if deployed)
- [ ] **17.6** CORS properly configured
- [ ] **17.7** No sensitive data in localStorage (passwords, API keys)
- [ ] **17.8** SQL injection prevention (if database queries in frontend)
- [ ] **17.9** Rate limiting on API calls (if implemented)
- [ ] **17.10** Proper error messages (don't expose system details)

**Expected Behavior:** Dashboard follows security best practices, no data leaks.

---

## 18. Accessibility Testing

### Test Cases
- [ ] **18.1** Keyboard navigation works (Tab, Enter, Esc)
- [ ] **18.2** Screen reader compatible (test with NVDA/JAWS)
- [ ] **18.3** Alt text on images
- [ ] **18.4** ARIA labels on interactive elements
- [ ] **18.5** Color contrast ratios meet WCAG AA (4.5:1 for text)
- [ ] **18.6** Focus indicators visible
- [ ] **18.7** Forms have proper labels
- [ ] **18.8** Error messages announced to screen readers
- [ ] **18.9** No keyboard traps
- [ ] **18.10** Text resizable up to 200% without breaking layout

**Tools:**
- WAVE browser extension
- axe DevTools
- Chrome Lighthouse accessibility audit

**Expected Behavior:** Dashboard usable by people with disabilities.

---

## Testing Checklist Summary

### Critical Path Tests (Must Pass)
1. ✅ Login with correct password
2. ✅ View real-time sensor data on all parameter pages
3. ✅ Update thresholds and save
4. ✅ Export data to CSV (quick presets and custom)
5. ✅ View dosing and alert history
6. ✅ Toggle dark mode

### High Priority Tests
7. ✅ Correlation analysis displays correctly
8. ✅ Time range controls work on all pages
9. ✅ LoRa downlink commands send successfully
10. ✅ Data persists in localStorage

### Medium Priority Tests
11. ✅ Calibration reminders display and update
12. ✅ Image export from correlation page
13. ✅ Empty states and error handling
14. ✅ Mobile responsive design

### Low Priority Tests
15. ✅ User manual page content
16. ✅ Advanced filtering options
17. ✅ Performance optimization
18. ✅ Browser compatibility

---

## Bug Report Template

When you find an issue, document it using this format:

**Bug ID:** [Unique identifier]  
**Title:** [Short description]  
**Severity:** Critical / High / Medium / Low  
**Priority:** P0 / P1 / P2 / P3  

**Steps to Reproduce:**
1. Step one
2. Step two
3. Step three

**Expected Result:**  
[What should happen]

**Actual Result:**  
[What actually happened]

**Environment:**
- Browser: [Chrome 120.0]
- OS: [Windows 11 / macOS / iOS]
- Screen size: [1920x1080 / Mobile]
- Date/Time: [2026-02-20 14:30]

**Screenshots/Videos:**  
[Attach if applicable]

**Console Errors:**  
[Copy any error messages]

**Additional Notes:**  
[Any other relevant information]

---

## Testing Sign-Off

**Tester Name:** ___________________________  
**Date:** ___________________________  
**Test Environment:** Production / Staging / Local  

**Test Results:**
- Total Tests: _____
- Passed: _____
- Failed: _____
- Blocked: _____
- Pass Rate: _____%

**Critical Issues Found:** _____  
**Recommendation:** Approve for release / Needs fixes / Major revisions

**Signature:** ___________________________

---

## Automated Testing Recommendations

For future improvements, consider implementing:

1. **Unit Tests** - Test individual functions and components
   - Jest + React Testing Library
   - Test utilities, data transformations, calculations

2. **Integration Tests** - Test component interactions
   - Test API calls with mock data
   - Test context providers
   - Test routing

3. **End-to-End Tests** - Test complete user workflows
   - Playwright or Cypress
   - Login → Navigate → Export workflow
   - Threshold update → Alert trigger workflow

4. **Visual Regression Tests** - Detect UI changes
   - Percy or Chromatic
   - Catch unintended styling changes

5. **Performance Tests** - Monitor performance metrics
   - Lighthouse CI
   - Bundle size monitoring
   - Core Web Vitals

---

## Notes

- Perform regression testing after any code changes
- Test on actual Raspberry Pi hardware when possible
- Document all test results and keep this plan updated
- Prioritize tests based on user impact and feature criticality
- Schedule regular testing cycles (weekly/monthly)

**Last Updated:** February 20, 2026

// ============================================================
// routes/filingTrackerRoutes.js
// ============================================================
const ft = require("../../controller/filingTracker/filingTracker");
const fm = require("../../controller/filingTracker/filingMonitor"); // ← add this

module.exports.routes = {
  post: [
    ["/postfilingtracker",   ft.postfilingtracker],
    ["/updatefilingtracker", ft.updatefilingtracker],
    ["/postmonitor",         fm.postmonitor],        // ← add
    ["/updatemonitordtl",    fm.updatemonitordtl],   // ← add
  ],
  get: [
    ["/selectfilingtracker",       ft.selectfilingtracker],
    ["/selectfilingtrackerbyid",   ft.selectfilingtrackerbyid],
    ["/selectbirforms",            fm.selectbirforms],   // ← swap to fm
    ["/get-filingtracker-summary", ft.getfilingtrackersummary],
    ["/selectmonitors",            fm.selectmonitors],   // ← add
  ],
  remove: [
    ["/deletefilingtracker", ft.deletefilingtracker],
    ["/deletemonitor",       fm.deletemonitor],   // ← add
  ],
};
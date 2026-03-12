// ============================================================
// routes/filingTrackerRoutes.js
// ============================================================
const ft = require("../../controller/filingTracker/filingTracker");

module.exports.routes = {
  post: [
    ["/postfilingtracker",   ft.postfilingtracker],   // assign forms to a client
    ["/updatefilingtracker", ft.updatefilingtracker], // toggle IsFiled
  ],
  get: [
    ["/selectfilingtracker",       ft.selectfilingtracker],       // all clients + progress
    ["/selectfilingtrackerbyid",   ft.selectfilingtrackerbyid],   // ?id=
    ["/selectbirforms",            ft.selectbirforms],            // BIR form master list
    ["/get-filingtracker-summary", ft.getfilingtrackersummary],   // summary stats
  ],
  remove: [
    ["/deletefilingtracker", ft.deletefilingtracker], // remove form from client
  ],
};
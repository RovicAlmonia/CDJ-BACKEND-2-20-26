// ============================================================
// routes/monitorRoutes.js
// ============================================================
const monitor = require("../../controller/monitor/monitor");

module.exports.routes = {
  post: [
    ["/postmonitor",      monitor.postmonitor],      // create header + auto detail rows
    ["/updatemonitorhdr", monitor.updatemonitorhdr], // update header status/remarks
    ["/updatemonitordtl", monitor.updatemonitordtl], // mark form filed / unfiled
  ],
  get: [
    ["/selectmonitors",         monitor.selectmonitors],         // all monitors with details
    ["/selectmonitorsbyclient", monitor.selectmonitorsbyclient], // ?clientid=
    ["/getnotifications",       monitor.getnotifications],       // ?days=7
    ["/getmonitorsummary",      monitor.getmonitorsummary],      // quick stats
  ],
  remove: [
    ["/deletemonitor", monitor.deletemonitor], // cascades to tblmonitordtl
  ],
};
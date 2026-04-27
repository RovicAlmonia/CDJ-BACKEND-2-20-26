const monitor = require("../../controller/monitor/monitor"); // only this line

module.exports.routes = {
  post: [
    ["/postmonitor",      monitor.postmonitor],
    ["/updatemonitorhdr", monitor.updatemonitorhdr],
    ["/updatemonitordtl", monitor.updatemonitordtl],
  ],
  get: [
    ["/selectmonitors",         monitor.selectmonitors],
    ["/selectmonitorsbyclient", monitor.selectmonitorsbyclient],
    ["/getnotifications",       monitor.getnotifications],
    ["/getmonitorsummary",      monitor.getmonitorsummary],
    ["/selectbirforms",         monitor.selectbirforms],  // ← same controller
  ],
  remove: [
    ["/deletemonitor", monitor.deletemonitor],
  ],
};
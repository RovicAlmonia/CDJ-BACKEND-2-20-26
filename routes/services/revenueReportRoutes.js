const ctrl = require("../../controller/reports/revenueReport");

module.exports = {
  routes: {
    get: {
      selectrevenuemonthly:   ["/revenue-monthly",        ctrl.selectrevenuemonthly],
      selectrevenuebyservice: ["/revenue-by-service",     ctrl.selectrevenuebyservice],
      selectrevenuebyclient:  ["/revenue-by-client",      ctrl.selectrevenuebyclient],
      selectrevenuesummary:   ["/revenue-summary-totals", ctrl.selectrevenuesummary],
      selectrevenueyears:     ["/revenue-available-years",ctrl.selectrevenueyears],
    },
  },
};
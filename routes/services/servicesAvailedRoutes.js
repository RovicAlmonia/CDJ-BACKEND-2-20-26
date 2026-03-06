const ctrl = require("../../controller/transactions/servicesAvailed");

module.exports = {
  routes: {
    get: {
      selectservicesavailed:        ["/selectservicesavailed",        ctrl.selectservicesavailed],
      selectservicesavailedbyclient:["/selectservicesavailedbyclient",ctrl.selectservicesavailedbyclient],
      selectservicesavailedsummary: ["/selectservicesavailedsummary", ctrl.selectservicesavailedsummary],
      // ── NEW: used by ClientInt popup ──
      selectclientservices:         ["/selectclientservices",         ctrl.selectclientservices],
      selecttransactionledger:      ["/selecttransactionledger",      ctrl.selecttransactionledger],
    },
  },
};
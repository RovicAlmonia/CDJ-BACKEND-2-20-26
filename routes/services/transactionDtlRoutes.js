const ctrl = require("../../controller/transactions/transactionDtl");

module.exports = {
  routes: {
    get: {
      selecttransactiondtl:      ["/selecttransactiondtl",      ctrl.selecttransactiondtl],
      selecttransactiondtlbyhdr: ["/selecttransactiondtlbyhdr", ctrl.selecttransactiondtlbyhdr],
    },
    post: {
      posttransactiondtl:   ["/posttransactiondtl",   ctrl.posttransactiondtl],
      updatetransactiondtl: ["/updatetransactiondtl", ctrl.updatetransactiondtl],
    },
    remove: {
      deletetransactiondtl:      ["/deletetransactiondtl",      ctrl.deletetransactiondtl],
      deletetransactiondtlbyhdr: ["/deletetransactiondtlbyhdr", ctrl.deletetransactiondtlbyhdr],
    },
  },
};
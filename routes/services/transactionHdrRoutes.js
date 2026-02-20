const ctrl = require("../../controller/transactions/transactionHdr");

module.exports = {
  routes: {
    get: {
      selecttransactionhdr:    ["/selecttransactionhdr",    ctrl.selecttransactionhdr],
      selecttransactionhdrbyid:["/selecttransactionhdrbyid",ctrl.selecttransactionhdrbyid],
    },
    post: {
      posttransactionhdr:   ["/posttransactionhdr",   ctrl.posttransactionhdr],
      updatetransactionhdr: ["/updatetransactionhdr", ctrl.updatetransactionhdr],
    },
    remove: {
      deletetransactionhdr: ["/deletetransactionhdr", ctrl.deletetransactionhdr],
    },
  },
};
// services/transactionHdrRoutes.js
const transactionhdr = require("../../controller/transactions/transactionhdr");

module.exports = {
  routes: {
    post: {
      posttransactionhdr:       ["/posttransactionhdr",       transactionhdr.posttransactionhdr],
      updatetransactionhdr:     ["/updatetransactionhdr",     transactionhdr.updatetransactionhdr],
      updatetransactionstatus:  ["/updatetransactionstatus",  transactionhdr.updatetransactionstatus],  // ← ADD THIS
    },
    get: {
      selecttransactionhdr:     ["/selecttransactionhdr",     transactionhdr.selecttransactionhdr],
      selecttransactionhdrbyid: ["/selecttransactionhdrbyid", transactionhdr.selecttransactionhdrbyid],
    },
    remove: {
      deletetransactionhdr:     ["/deletetransactionhdr",     transactionhdr.deletetransactionhdr],
    },
  },
};
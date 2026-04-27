


// ============================================================
// services/transactionHdrRoutes.js
// ============================================================
const transactionhdr = require("../../controller/transactions/transactionhdr");
 
module.exports = {
  routes: {
    post: {
      posttransactionhdr:      ["/posttransactionhdr",      transactionhdr.posttransactionhdr],
      updatetransactionhdr:    ["/updatetransactionhdr",    transactionhdr.updatetransactionhdr],
      updatetransactionstatus: ["/updatetransactionstatus", transactionhdr.updatetransactionstatus],
    },
    get: {
      selecttransactionhdr:      ["/selecttransactionhdr",      transactionhdr.selecttransactionhdr],
      selecttransactionhdrbyid:  ["/selecttransactionhdrbyid",  transactionhdr.selecttransactionhdrbyid],
      selectclientservices:      ["/selectclientservices",      transactionhdr.selectclientservices],
      // ── NEW: full transaction history per client ──
      selecttransactionledger:   ["/selecttransactionledger",   transactionhdr.selecttransactionledger],
    },
    remove: {
      deletetransactionhdr: ["/deletetransactionhdr", transactionhdr.deletetransactionhdr],
    },
  },
};
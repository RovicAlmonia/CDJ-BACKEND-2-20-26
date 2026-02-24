const ctrl = require("../../controller/transactions/paymentLedger");

module.exports = {
  routes: {
    get: {
      selectpaymentledger:        ["/selectpaymentledger",        ctrl.selectpaymentledger],
      selectpaymentledgersummary: ["/selectpaymentledgersummary", ctrl.selectpaymentledgersummary],
    },
  },
};
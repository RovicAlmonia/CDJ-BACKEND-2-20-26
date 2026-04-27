const ctrl = require("../../controller/transactions/paymentLedger");

module.exports = {
  routes: {
    get: {
      selectpaymentledger:          ["/selectpaymentledger",          ctrl.selectpaymentledger],
      selectpaymentledgersummary:   ["/selectpaymentledgersummary",   ctrl.selectpaymentledgersummary],
      // ── NEW: used by ClientInt popup ──
      selectpaymentledgerbyclient:  ["/selectpaymentledgerbyclient",  ctrl.selectpaymentledgerbyclient],
    },
    post: {
      // ── NEW: used by ClientInt Add Payment button ──
      postpayment: ["/postpayment", ctrl.postpayment],
    },
  },
};
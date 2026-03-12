const ctrl = require("../../controller/clientss/clientLedger");

module.exports = {
  routes: {
    get: {
      selectclientservices:   ["/selectclientservices",   ctrl.selectclientservices],
      selecttransactionledger:["/selecttransactionledger",ctrl.selecttransactionledger],
      selectpaymentledger:    ["/selectpaymentledger",    ctrl.selectpaymentledger],
    },
    post: {
      postpayment: ["/postpayment", ctrl.postpayment],
    },
    remove: {},
  },
};
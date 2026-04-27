const { getSingleReceipt, getCombinedReceipt } = require("../../controller/reportControllers/reportController");

module.exports = {
  routes: {
    get: {
      combinedReceipt: ["/reports/receipt/combined/:clientId", getCombinedReceipt],
      singleReceipt:   ["/reports/receipt/:hdrId",             getSingleReceipt],
    },
  },
};
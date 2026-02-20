const ctrl = require("../../controller/transactions/billingHdr");

module.exports = {
  routes: {
    get: {
      selectbillinghdr:          ["/selectbillinghdr",          ctrl.selectbillinghdr],
      selectbillinghdrbyid:      ["/selectbillinghdrbyid",      ctrl.selectbillinghdrbyid],
      selectbillinghdrbyclient:  ["/selectbillinghdrbyclient",  ctrl.selectbillinghdrbyclient],
    },
    post: {
      postbillinghdr:   ["/postbillinghdr",   ctrl.postbillinghdr],
      updatebillinghdr: ["/updatebillinghdr", ctrl.updatebillinghdr],
    },
    remove: {
      deletebillinghdr: ["/deletebillinghdr", ctrl.deletebillinghdr],
    },
  },
};
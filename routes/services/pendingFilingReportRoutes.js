// ============================================================
// services/pendingFilingReportRoutes.js
// Register under arrayRoutesSvc in your main router file
// ============================================================
'use strict';

const { getPendingFilingReport } = require('../../controller/reportControllers/pendingFilingReportController');

module.exports = {
  routes: {
    get: {
      pendingFilingReport: ['/reports/pending-filing', getPendingFilingReport],
    },
  },
};

// ── How to wire it in (add one line to your arrayRoutesSvc) ──
//
//  const arrayRoutesSvc = [
//    require('./services/authSvc'),
//    require('./services/monitorRoutes'),
//    require('./services/reportRoutes'),
//    require('./services/pendingFilingReportRoutes'),   // ← add this
//  ];
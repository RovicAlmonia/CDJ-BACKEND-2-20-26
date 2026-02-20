const express = require('express');
const router = express.Router();

const arrayRoutesSvc = [
    require('./services/authSvc'),
    require('./services/administrative'),
    require('./services/test'),
    require('./services/clientssRoutes'),
    require('./services/servicesListRoutes'),
    require('./services/transactionHdrRoutes'),
    require('./services/transactionDtlRoutes'),
    require('./services/billingHdrRoutes'),
];

arrayRoutesSvc.forEach(routeSvc => {
    if(routeSvc.routes.post){
        Object.entries(routeSvc.routes.post).forEach(([key]) => {
            router.post(routeSvc.routes.post[key][0], routeSvc.routes.post[key][1]);
        });
    }
    if(routeSvc.routes.get){
        Object.entries(routeSvc.routes.get).forEach(([key]) => {
            router.get(routeSvc.routes.get[key][0], routeSvc.routes.get[key][1]);
        });
    }
    if (routeSvc.routes.remove) {
        Object.entries(routeSvc.routes.remove).forEach(([key]) => {
            router.delete(routeSvc.routes.remove[key][0], routeSvc.routes.remove[key][1]);
        });
    }
});

module.exports = router;
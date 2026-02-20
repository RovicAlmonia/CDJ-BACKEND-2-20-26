var route_api = require('./api');

module.exports = function(app) {
    // 🛠️ Add custom body parser middleware specifically for /release-soa-view-lock
    app.use('/api/release-soa-view-lock', require('express').text({ type: 'application/json' }), (req, res, next) => {
        try {
            if (typeof req.body === 'string') {
                req.body = JSON.parse(req.body); // convert text body to JSON
            }
            next();
        } catch (error) {
            console.error('Invalid JSON from beacon:', error);
            res.status(400).json({ success: false, message: 'Invalid JSON' });
        }
    });

    // ✅ Mount all other API routes
    app.use('/api', route_api);
};

// originally: 

// var route_api = require('./api');
// module.exports = function(app){
//     app.use('/api', route_api);
// }
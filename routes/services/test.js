const { update } = require("lodash")
const test=require("../../controller/test/test")


module.exports.routes = {
    post: [
        ['/poststudents', test.poststudents],
        ['/updatestudents', test.updatestudents],
       
    ],
    get: [
       ['/selectstudents', test.selectstudents],
        
    ],
    remove: [
        ['/deletestudents', test.deletestudents],
        
        
    ]
}
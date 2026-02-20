const AdminCtrl = require('../../controller/administrative/UserListController');

module.exports.routes = {
    post: [
        ['/save-salary-grade', AdminCtrl.saveSalaryGrade],
        ['/save-employee-rate-group', AdminCtrl.postEmpRate],
        [ '/add-access-rights', AdminCtrl.addAccessRights],
        [ '/user_registration', AdminCtrl.UserRegistration ],
        ['/log', AdminCtrl.postLog]
    ],
    get: [
        ['/get-emp-salary-grade', AdminCtrl.getEmpSalaryGrade],
        ['/get-formlist', AdminCtrl.getFormList ],
        ['/access-rights', AdminCtrl.getAccessRights],
        ['/get-log', AdminCtrl.getLog],
        
    ],
    remove: [     
        [ '/remove-access-rights', AdminCtrl.removeAccessRights]
    ]
}
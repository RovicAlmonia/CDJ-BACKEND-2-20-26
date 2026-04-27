const Ctrl = require('../../controller/auth/authController');
const UserCtrl = require('../../controller/administrative/UserListController');

module.exports.routes = {
    post: [
        ['/login', Ctrl.LogIn],
        ['/register', UserCtrl.UserRegistration],
        ['/upload-profile', UserCtrl.uploadProfilePicture],
        ['/change-password', UserCtrl.changePassword],

    ],
    get: [
        ['/get-users', UserCtrl.getUsers],
        
    ],
    remove: [
        ['/logout', Ctrl.userLogout],
       
        
    ]
}
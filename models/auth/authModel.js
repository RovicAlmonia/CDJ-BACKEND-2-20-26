const db = require('../../config/dbConnection')

const AuthModel = {
	findAll: function (refresh_token) {
		return new Promise((resolve, reject) => {
			const query = 'SELECT * FROM tbllogin WHERE access_token = ?';
			db.query(query, [refresh_token], function (err, results) {
				if (err) {
					reject(err);
				} else {
					if (results.length === 0) {
						resolve(null);
					} else {
						const user = results[0];
						resolve(user);
					}
				}
			});
		});
	},

	UsernameVerify: function (Username, callback) {
		const query = 'SELECT * FROM tbllogin WHERE Username = ?';
		db.query(query, [Username], function (err, results) {
			if (err) {
				return callback(err, null)
			}
			if (results.length === 0) {
				return callback(null, null);
			}
			const user = results[0];
			callback(null, user);
		})
	},


	findUserName: function (Username) {
		const query = 'SELECT * FROM tbllogin WHERE Username = ?';
		return new Promise((resolve, reject) => {
			db.query(query, [Username], function (err, results) {
				if (err) {
					return reject(err);
				}
				if (results.length === 0) {
					return resolve(null);
				}
				const user = results[0];
				resolve(user);
			});
		});
	},


	VerifyPersonalKey: function (id, personalkey) {
		const query = 'SELECT * FROM tbllogin WHERE LoginID = ? AND personal_key = ?';
		return new Promise((resolve, reject) => {
			db.query(query, [id, personalkey], function (err, results) {
				if (err) {
					return reject(err);
				}
				if (results.length === 0) {
					return resolve(null);
				}
				const user = results[0];
				resolve(user);
			});
		});
	},

	register: function (user, callback) {
		const query = 'INSERT INTO tbllogin SET ?';
		db.query(query, user, function (err, results) {
			if (err) {
				return callback(err, null)
			}
			callback(null, results.insertId)
		});
	},

	incrementFailedAttempts: function (user_id) {
		const query = 'UPDATE tbllogin SET failed_login_attempts = failed_login_attempts + 1 WHERE LoginID = ?'
		return new Promise((resolve, reject) => {
			db.query(query, [user_id], function (err, results) {
				if (err) {
					return reject(err);
				}
				if (results.length === 0) {
					return resolve(null);
				}
				const user = results[0];
				resolve(user);
			});
		});
	},

	isDisable: function (user_id) {
		const query = 'UPDATE tbllogin SET is_disable = 1 WHERE LoginID = ?'
		return new Promise((resolve, reject) => {
			db.query(query, [user_id], function (err, results) {
				if (err) {
					return reject(err);
				}
				if (results.length === 0) {
					return resolve(null);
				}
				const user = results[0];
				resolve(user);
			});
		});
	},

	resetFailedAttempts: function (user_id) {
		const query = 'UPDATE tbllogin SET failed_login_attempts = 0 WHERE LoginID = ?'
		return new Promise((resolve, reject) => {
			db.query(query, [user_id], function (err, results) {
				if (err) {
					return reject(err);
				}
				if (results.length === 0) {
					return resolve(null);
				}
				const user = results[0];
				resolve(user);
			});
		});
	},

}

module.exports = AuthModel;
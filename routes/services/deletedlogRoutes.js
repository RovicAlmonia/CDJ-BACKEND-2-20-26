const {
  selectDeletedLog,
  postDeletedLog,
  restoreDeletedLog,
  permanentDeleteLog,
  selectDeletedLogSummary,
} = require("../../controller/deletedlog/deletedlog");

module.exports = {
  routes: {
    get: {
      selectdeletedlog:        ["/selectdeletedlog",        selectDeletedLog],
      selectdeletedlogsummary: ["/selectdeletedlogsummary", selectDeletedLogSummary],
    },
    post: {
      postdeletedlog:    ["/postdeletedlog",    postDeletedLog],
      restoredeletedlog: ["/restoredeletedlog", restoreDeletedLog],
    },
    remove: {
      permanentdeletelog: ["/permanentdeletelog", permanentDeleteLog],
    },
  },
};
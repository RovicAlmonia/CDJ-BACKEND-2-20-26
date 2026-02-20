const servicesList = require("../../controller/clientss/servicesList");

module.exports.routes = {
  post: [
    ["/postserviceslist", servicesList.postserviceslist],
    ["/updateserviceslist", servicesList.updateserviceslist],
  ],
  get: [
    ["/selectserviceslist", servicesList.selectserviceslist],
    ["/selectserviceslistbyid", servicesList.selectserviceslistbyid],
  ],
  remove: [
    ["/deleteserviceslist", servicesList.deleteserviceslist],
  ],
};
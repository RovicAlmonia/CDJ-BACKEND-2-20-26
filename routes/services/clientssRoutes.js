const clients = require("../../controller/clientss/clientss");

module.exports.routes = {
  post: [
    ["/postclientss", clients.postclients],
    ["/updateclientss", clients.updateclients],
  ],
  get: [
    ["/selectclientss", clients.selectclients],
    ["/selectclientsbyid", clients.selectclientbyid],
    ["/get-clients-summary", clients.getclientssummary], // ADD THIS
  ],
  remove: [
    ["/deleteclientss", clients.deleteclients],
  ],
};
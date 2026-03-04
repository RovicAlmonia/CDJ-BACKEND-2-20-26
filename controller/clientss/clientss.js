// ============================================================
// clients.js — with deletion logging
// ============================================================
const { select, insert, update, remove } = require("../../models/mainModel");
const { logDeletion } = require("../deletedlog/deletedlog");

module.exports.selectclients = async function (req, res) {
  const result = await select({ tableName: "tblclients", fields: ["*"] });
  const data = Array.isArray(result?.data) ? result.data : [];
  res.status(200).json({ success: true, data });
};

module.exports.selectclientbyid = async function (req, res) {
  const { id } = req.query;
  const result = await select({ tableName: "tblclients", fields: ["*"], where: ["ID = ?"], whereValue: [id] });
  const data = Array.isArray(result?.data) ? result.data : [];
  res.status(200).json({ success: true, data });
};

module.exports.postclients = async function (req, res) {
  const {
    clientid, lnf, type, tradename, dateregistered, dateexpiration,
    dticertificationno, dtiexpirationdate, secidno, secexpirationdate,
    cdacertno, efpsaccount, taxclearancecertno, taxclearanceexpiration,
    philgeps, philgepscertno, philgepsexpiration, retentiontype, status,
  } = req.body;
  const data = await insert({
    tableName: "tblclients",
    fieldValue: {
      ClientID: clientid, LNF: lnf, Type: type, TradeName: tradename,
      DateRegistered: dateregistered, DateExpiration: dateexpiration,
      DTICertificationNo: dticertificationno, DTIExpirationDate: dtiexpirationdate,
      SECIDNo: secidno, SECExpirationDate: secexpirationdate,
      CDACertNo: cdacertno, EFPSAccount: efpsaccount,
      TaxClearanceCertNo: taxclearancecertno, TaxClearanceExpiration: taxclearanceexpiration,
      PhilGEPS: philgeps, PhilGEPSCertNo: philgepscertno, PhilGEPSExpiration: philgepsexpiration,
      RetentionType: retentiontype, Status: status,
    },
  });
  res.status(200).json({ success: true, data });
};

module.exports.updateclients = async function (req, res) {
  const {
    id, clientid, lnf, type, tradename, dateregistered, dateexpiration,
    dticertificationno, dtiexpirationdate, secidno, secexpirationdate,
    cdacertno, efpsaccount, taxclearancecertno, taxclearanceexpiration,
    philgeps, philgepscertno, philgepsexpiration, retentiontype, status,
  } = req.body;
  const data = await update({
    tableName: "tblclients",
    fieldValue: {
      ID: id, ClientID: clientid, LNF: lnf, Type: type, TradeName: tradename,
      DateRegistered: dateregistered, DateExpiration: dateexpiration,
      DTICertificationNo: dticertificationno, DTIExpirationDate: dtiexpirationdate,
      SECIDNo: secidno, SECExpirationDate: secexpirationdate,
      CDACertNo: cdacertno, EFPSAccount: efpsaccount,
      TaxClearanceCertNo: taxclearancecertno, TaxClearanceExpiration: taxclearanceexpiration,
      PhilGEPS: philgeps, PhilGEPSCertNo: philgepscertno, PhilGEPSExpiration: philgepsexpiration,
      RetentionType: retentiontype, Status: status,
    },
  });
  res.status(200).json({ success: true, data });
};

module.exports.deleteclients = async function (req, res) {
  const { id } = req.query;

  const existing = await select({ tableName: "tblclients", fields: ["*"], where: ["ID = ?"], whereValue: [id] });
  const record = existing?.data?.[0];

  const data = await remove({ tableName: "tblclients", where: ["ID = ?"], whereValue: [id] });

  if (record) {
    const deletedBy = req.body?.deletedBy || req.user?.username || "system";
    await logDeletion(
      "Client",
      record.ID,
      record.TradeName || record.LNF || `Client #${record.ID}`,
      record,
      deletedBy
    );
  }

  res.status(200).json({ success: true, data });
};

module.exports.getclientssummary = async function (req, res) {
  const result = await select({ tableName: "tblclients", fields: ["*"] });
  const list = Array.isArray(result?.data) ? result.data : [];
  const total        = list.length;
  const active       = list.filter((r) => r.Status === "Active").length;
  const inactive     = list.filter((r) => r.Status === "Inactive").length;
  const soleProprietor = list.filter((r) => r.Type === "Sole Proprietorship").length;
  const corporation  = list.filter((r) => r.Type === "Corporation").length;
  const coop         = list.filter((r) => r.Type === "COOP").length;
  res.status(200).json({ success: true, data: { total, active, inactive, soleProprietor, corporation, coop } });
};
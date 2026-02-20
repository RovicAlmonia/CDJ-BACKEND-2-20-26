const { select, insert, update, remove } = require("../../models/mainModel");
const path = require("path");
const bcrypt = require("bcryptjs");
const {
  GetEmpRateInfoBaseOnPayGrade,
} = require("../../models/rawQueryModel/rawQueryModel");
const db = require("../../config/dbConnection");
const AuthModel = require("../../models/auth/authModel");
const dayjs = require("dayjs");
const pdf = require("pdf-creator-node");
const fs = require("fs");
const { orderBy } = require("lodash");

module.exports.uploadProfilePicture = async function (req, res) {
  const multer = require("multer");
  const upload = multer({
    storage: multer.diskStorage({
      destination: function (req, file, cb) {
        cb(null, process.env.PROFILE_PICTURE_PATH);
      },
      filename: function (req, file, cb) {
        const data = req.body;
        cb(null, data.filename);
      },
    }),
  }).single("file");
  try {
    await upload(req, res, function (err) {
      if (err instanceof multer.MulterError) {
        // A Multer error occurred when uploading.
        return res.status(200).json({
          success: false,
          message: "Uploading failed. Please contact administrator.",
        });
      } else if (err) {
        // An unknown error occurred when uploading.
        return res.status(200).json({
          success: false,
          message: "File path not found. Check connection to NAS.",
        });
      } else {
        // Everything went fine and save document in DB here.
        return res
          .status(200)
          .json({ success: true, message: "Successfully upload file." });
      }
    });
  } catch (error) {
    res.status(500).json({ error: error });
  }
};

module.exports.changePassword = async function (req, res) {
  const { LoginID, NewPassword, OldPassword } = req.body;

  try {
    const result = await select({
      tableName: "tbllogin",
      fields: ["*"],
      where: ["LoginID = ?"],
      whereValue: [LoginID],
    });

    if (!result.success || result.data.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    const user = result.data[0];
    const isMatch = await bcrypt.compare(OldPassword, user.Password);

    if (!isMatch) {
      return res.status(401).json({ message: "Old password is incorrect" });
    }

    const hashedPassword = await bcrypt.hash(NewPassword, 10);

    const updateResult = await update({
      tableName: "tbllogin",
      fieldValue: {
        LoginID, // WHERE clause
        Password: hashedPassword, // SET clause
      },
    });

    if (updateResult.success) {
      return res.status(200).json({ message: "Password updated successfully" });
    } else {
      return res.status(500).json({ message: "Failed to update password" });
    }
  } catch (error) {
    console.error("Change password error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

module.exports.getUsers = async function (req, res) {
  var params = {
    fields: ["*"],
    tableName: "tbllogin",
  };
  try {
    await select(params).then(function (response) {
      if (response.success) res.status(200).json(response.data);
      else res.status(200).json(response);
    });
  } catch (error) {
    res.status(400).send({ error: "Server Error" });
    console.error(error);
  }
};

module.exports.UserRegistration_false = async function (req, res) {
  const data = req.body;
  const saltRounds = 10;
  try {
    const hashedPassword = await bcrypt.hash("Default@123", saltRounds);
    let oldProfilePicturePath = null;
    let oldSignaturePath = null;
    if (data.LoginID > 0) {
      const existingUser = await query(
        `SELECT filepath_profilepicture FROM tbllogin WHERE LoginID = ?`,
        [data.LoginID]
      );
      if (existingUser.length > 0) {
        oldProfilePicturePath = existingUser[0].filepath_profilepicture;
        oldSignaturePath = existingUser[0].filepath_esignature;
      }
    }
    const newProfilePicturePath = path.join(
      process.env.PROFILE_PICTURE_PATH,
      data.filepath_profilepicture
    );
    const newSignaturePath = path.join(
      process.env.E_SIGNATURE_PATH,
      data.filepath_esignature
    );
    const params = {
      tableName: "tbllogin",
      fieldValue: {
        LoginID: data.LoginID,
        Username: data.Username,
        Password: hashedPassword,
        Position: data.Position,
        roles: data.roles,
        personal_key: data.personal_key,
        Client_name: data.Client_name,
        FullName: data.FullName,
        filepath_profilepicture: newProfilePicturePath,
        filepath_esignature: newSignaturePath,
      },
    };
    const result = await (data.LoginID > 0 ? update(params) : insert(params));
    if (
      data.LoginID > 0 &&
      oldProfilePicturePath &&
      oldProfilePicturePath !== newProfilePicturePath
    ) {
      fs.unlink(oldProfilePicturePath, (err) => {
        if (err) {
          console.error("Failed to delete old profile picture:", err);
        } else {
          console.log("Old profile picture deleted successfully.");
        }
      });
    } else if (
      data.LoginID > 0 &&
      oldSignaturePath &&
      oldSignaturePath !== newSignaturePath
    ) {
      fs.unlink(oldSignaturePath, (err) => {
        if (err) {
          console.error("Failed to delete old signature:", err);
        } else {
          console.log("Old signature deleted successfully.");
        }
      });
    }
    res.status(200).json(result);
  } catch (error) {
    res.status(400).json({ error: "Server Error" });
    console.error(error);
  }
};

module.exports.UserRegistration = async function (req, res) {
  const { LoginID, Username, UserLevel, FullName, Description, form_id } =
    req.body;
  const defaultPassword = "Default@123";
  const saltRounds = 10;
  try {
    const hashedPassword = await bcrypt.hash(defaultPassword, saltRounds);
    const checkUserQuery = "SELECT * FROM tbllogin WHERE LoginID = ?";
    await db.query(checkUserQuery, [LoginID], (err, results) => {
      if (err) {
        res.status(400).json({ error: "Server error" });
        console.error(err);
        return;
      }
      if (results.length > 0) {
        const updateUserQuery =
          "UPDATE tbllogin SET Username = ?, Password = ?, UserLevel = ?, FullName = ?, Position = ? WHERE LoginID = ?";
        db.query(
          updateUserQuery,
          [Username, hashedPassword, UserLevel, FullName, Description, LoginID],
          (err) => {
            if (err) {
              res.status(400).json({ error: "Server error" });
              console.error(err);
              return;
            }
            res.status(200).json({ message: "User updated successfully" });
          }
        );
      } else {
        const insertUserQuery =
          "INSERT INTO tbllogin (Username, Password, UserLevel, FullName, Position) VALUES (?, ?, ?, ?, ?)";
        db.query(
          insertUserQuery,
          [Username, hashedPassword, UserLevel, FullName, Description],
          (err, result) => {
            if (err) {
              res.status(400).json({ error: "Server error" });
              console.error(err);
              return;
            }
            const userId = result.insertId;
            if (Array.isArray(form_id) && form_id.length > 0) {
              const insertAccessRightsQuery =
                "INSERT INTO tbl_user_access_rights (user_id, form_id) VALUES ?";
              const values = form_id.map((fid) => [userId, fid]);
              db.query(insertAccessRightsQuery, [values], (err) => {
                if (err) {
                  res.status(400).json({ error: "Server error" });
                  console.error(err);
                  return;
                }
                res.status(200).json({
                  message: "User registered successfully with access rights",
                });
              });
            } else {
              res.status(200).json({ message: "User registered successfully" });
            }
          }
        );
      }
    });
  } catch (error) {
    res.status(400).json({ error: "Server error" });
    console.error(error);
  }
};

//get
module.exports.getEmpSalaryGrade = async function (req, res) {
  const { id } = req.query;

  try {
    const response = await GetEmpRateInfoBaseOnPayGrade(id);
    res.status(200).json({
      success: true,
      data: response.data,
    });
  } catch (error) {
    console.error(error);
    res.status(400).send({ error: "Server Error" });
  }
};

module.exports.getAccessRights = async function (req, res) {
  const { user_id } = req.query;
  if (!user_id) {
    return res.status(400).json({ error: "Bad Request: Missing user_id" });
  }
  try {
    const query = `SELECT id, form_id FROM tbl_user_access_rights WHERE user_id = ${user_id}`;
    await db.query(query, [], async (err, results) => {
      if (err) throw err;
      res.json(results);
    });
  } catch (error) {
    console.error(error);
  }
};

module.exports.getFormList = async function (req, res) {
  var params = {
    fields: ["*"],
    tableName: "tblform_list",
    orderBy: ["form_type ASC", "id ASC"],
  };
  try {
    await select(params).then(function (response) {
      if (response.success) res.status(200).json(response.data);
      else res.status(200).json(response);
    });
  } catch (error) {
    res.status(400).send({ error: "Server Error" });
    console.error(error);
  }
};

//post

module.exports.addAccessRights = async function (req, res) {
  const data = req.body;
  try {
    const query = `INSERT INTO tbl_user_access_rights (form_id, user_id) VALUES (${data.form_id},${data.user_id})`;
    await db.query(query, [], async (err, results) => {
      if (err) throw err;
      res.json(results);
    });
  } catch (error) {
    console.error(error);
  }
};

module.exports.removeAccessRights = async function (req, res) {
  const data = req.query;
  var params = {
    tableName: "tbl_user_access_rights",
    where: ["id = ?"],
    whereValue: [data.id],
  };
  try {
    var result = remove(params);
    result.then(function (response) {
      res.status(200).json(response);
    });
  } catch (error) {
    res.status(400).send({ error: "Server Error" });
    console.error(error);
  }
};

module.exports.saveSalaryGrade = async function (req, res) {
  const data = req.body.dataVariable;
  var params = {
    tableName: "tblsalarygrade",
    fieldValue: {
      SGName: data.SGName || "",
      MonthlyRate: data.MonthlyRate || "",
      DailyRate: data.DailyRate || "",
      HourlyRate: data.HourlyRate || "",
    },
  };
  try {
    var result = insert(params);
    result.then(function (response) {
      res.status(200).json({
        success: true,
        data: result.data,
      });
    });
  } catch (error) {
    res.status(400).send({ error: "Server Error" });
    console.error(error);
  }
};

module.exports.postEmpRate = async function (req, res) {
  const data = req.body.dataVariable;
  const empID = req.body.empID;
  const ERID = req.body.ERID;
  const paramsInsert = {
    tableName: "tblemployeerate_cr",
    fieldValue: {
      ERID: "",
      SGID_link: data.SGID || "",
      SGName: data.SGName || "",
      MonthlyBasic: data.MonthlyRate || "",
      DailyRate: data.DailyRate || "",
      HourlyRate: data.HourlyRate || "",
      RDHR: data.RDHR || "",
      RDOT: data.RDOT || "",
      RDND: data.RDND || "",
      SHHR: data.SHHR || "",
      SHOT: data.SHOT || "",
      SHND: data.SHND || "",
      RegHr: data.RegHr || "",
      RegOt: data.RegOt || "",
      RegHND: data.RegHND || "",
      EmpIDLink: empID || "",
      updated_by: data.updated_by || "",
    },
  };

  try {
    // Only update if ERID is provided
    if (ERID) {
      const paramsUpdate = {
        tableName: "tblemployeerate_cr",
        fieldValue: {
          ERID: ERID,
          status: "PREVIOUS",
        },
      };

      const updateResponse = await update(paramsUpdate);
      if (!updateResponse.success) {
        return res.status(200).json(updateResponse);
      }
    }

    // Always insert the new record
    const insertResponse = await insert(paramsInsert);
    if (insertResponse.success) {
      res.status(200).json({
        success: true,
        data: insertResponse.data,
      });
    } else {
      res.status(200).json(insertResponse);
    }
  } catch (error) {
    console.error(error);
    res.status(400).send({ error: "Server Error" });
  }
};

module.exports.postLog = async function (req, res) {
  try {
    const data = req.body.dataVariable;

    if (!data) {
      return res
        .status(400)
        .json({ error: "Missing dataVariable in request body" });
    }

    const paramsInsert = {
      tableName: "tbllog",
      fieldValue: {
        event: data.event,
        doctype: data.doctype,
        referenceno: data.referenceno,
        remarks: data.remarks,
        loggedby: data.loggedby,
      },
    };

    const insertLogs = await insert(paramsInsert);

    if (!insertLogs.success) {
      return res.status(500).json({ error: "Failed to insert log" });
    }

    return res.status(201).json({
      success: true,
      message: "Log inserted successfully",
      data: insertLogs.data || null,
    });
  } catch (error) {
    console.error("postLog error:", error);
    return res.status(400).json({ error: "Server Error" });
  }
};

module.exports.getLog = async function (req, res) {
  try {
    const params = {
      tableName: "tbllog",
      fields: ["*"], // fetch all columns
      orderBy:['id DESC']
    };

    const logs = await select(params);

    if (!logs.success) {
      return res.status(500).json({ error: "Failed to fetch logs" });
    }

    return res.status(200).json(logs.data || []);
  } catch (error) {
    console.error("getLog error:", error);
    return res.status(400).json({ error: "Server Error" });
  }
};

//remove

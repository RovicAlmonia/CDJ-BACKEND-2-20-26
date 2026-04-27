const { select, insert, update, remove } = require("../../models/mainModel");
module.exports.selectstudents = async function (req, res) {
    const test = await select ( {
        tableName : "tbltest",
        fields: [
            "*"
        ],
    })
    
    res.status(200).json({success: true, data: test});



}


module.exports.poststudents = async function (req, res) {
    const { firstname, lastname, school } = req.body;
    const test = await insert({
        tableName : "tbltest",
        fieldValue : {
            Firstname: firstname,
            Lastname: lastname,
            School: school
        }
    })
    res.status(200).json({success: true, data: test});
}

module.exports.deletestudents = async function (req, res) {
    const { id } = req.query;
    const test = await remove({
        tableName : "tbltest",
        where: ["ID = ?"],
        whereValue: [id]
    })
    res.status(200).json({success: true, data: test});
}

module.exports.updatestudents = async function (req, res) {
    const { id, firstname, lastname, school } = req.body;
    const test = await update({
        tableName : "tbltest",
        fieldValue : {
            ID:id,
            Firstname: firstname,
            Lastname: lastname,
            School: school
        },
    })
    res.status(200).json({success: true, data: test});

}
    
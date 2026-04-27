const CommonSettings = {

    getDateNow: async function (type) {
        const date = new Date();
        let day = date.getDate();
        let month = date.getMonth() + 1;
        let year = date.getFullYear();
        let hour = date.getHours();
        let minute = date.getMinutes();
        let second = date.getSeconds();
        if (type == "date") return `${year}-${month}-${day}`;
        if (type == "datetime") return `${year}-${month}-${day} ${hour}:${minute}`;
        if (type == "year") return `${year}`;
        if (type == "day") return `${day}`;
        if (type == "month") return `${month}`;
        if (type == "hour") return `${hour}`;
        if (type == "minute") return `${minute}`;
        if (type == "second") return `${second}`;
        return false;
    },
}

module.exports = CommonSettings;
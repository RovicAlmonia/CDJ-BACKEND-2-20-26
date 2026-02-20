require('dotenv').config(); // Add this line at the very top

const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const app = express();
const http = require('http').Server(app);
const db = require('./config/dbConnection');
const socketServer = require('socket.io')(http, {
    cors: {
        origin: [
            "http://localhost:3100", 
            "http://192.168.56.1:3100", 
            "http://192.168.1.130:3100",
        ]
    }
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('user_profile_picture'));
app.use(cookieParser()); 

app.use(cors({
    origin: (origin, callback) => {
        const allowedOrigins = [
            "http://localhost:3100", 
            "http://192.168.56.1:3100", 
            "http://192.168.1.130:3100",
        ];
        if (allowedOrigins.includes(origin) || !origin) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE'],
    credentials: true,
    optionsSuccessStatus: 204
}));

require('./routes/routerManager')(app);

socketServer.on('connection', (socket) => {
    console.log('🔌 Socket client connected');

    socket.on('triggerNewNotification', () => {
        socketServer.emit('openNewNotification');
    });

    socket.on("trigger_query", (data) => {
        const { id } = data;
        db.query(
            'UPDATE tbllogin SET notification_unread = "0" WHERE LoginID = ?',
            [id],
            (err, result) => {
                if (err) {
                    console.error('❌ Socket query error:', err);
                    return;
                }
                socket.to(id).emit("unread_notification", data);
            }
        );
    });

    socket.on('disconnect', () => {
        console.log('🔌 Socket client disconnected');
    });
});

const PORT = process.env.PORT || 8100;

http.listen(PORT, "0.0.0.0", () => {
    console.log(`\n🚀 Server running on http://localhost:${PORT}`);
    console.log(`📡 Socket.IO ready\n`);
});
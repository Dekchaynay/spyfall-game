const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { locations } = require('./gameData');

const app = express();
// Allow CORS from the client URL (deployed) or localhost (dev)
let CLIENT_URL = process.env.CLIENT_URL || "http://localhost:5173";
// Strip trailing slash if present
if (CLIENT_URL.endsWith('/')) {
    CLIENT_URL = CLIENT_URL.slice(0, -1);
}

const corsOptions = {
    origin: function (origin, callback) {
        // Allow requests with no origin (like mobile apps or curl requests)
        if (!origin) return callback(null, true);

        // Allow any vercel.app domain
        if (origin.endsWith('.vercel.app')) {
            return callback(null, true);
        }

        // Allow localhost and local network IPs
        if (origin.includes('localhost') ||
            origin.includes('127.0.0.1') ||
            origin.startsWith('http://192.168.') ||
            origin.startsWith('http://10.')) {
            return callback(null, true);
        }

        // Check against specific CLIENT_URL if set
        if (CLIENT_URL && origin === CLIENT_URL) {
            return callback(null, true);
        }

        console.log('Blocked by CORS:', origin);
        callback(new Error('Not allowed by CORS'));
    },
    methods: ["GET", "POST"],
    credentials: true
};

app.use(cors(corsOptions));

const server = http.createServer(app);
const io = new Server(server, {
    cors: corsOptions
});

// State
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

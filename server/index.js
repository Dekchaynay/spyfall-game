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

        // Allow localhost
        if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
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
const rooms = new Map(); // roomId -> { players: [], status: 'waiting'|'playing', location: null, startTime: null, gameLength: 8 }

function generateRoomId() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
}

io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    socket.on('create_room', (playerName) => {
        const roomId = generateRoomId();
        rooms.set(roomId, {
            id: roomId,
            players: [{ id: socket.id, name: playerName, isHost: true }],
            status: 'waiting',
            gameLength: 5, // minutes
            location: null,
            startTime: null,
            votes: {}, // voterId -> suspectId
            spyId: null,
            timer: null
        });
        socket.join(roomId);
        socket.emit('room_joined', { roomId, players: rooms.get(roomId).players, isHost: true, gameLength: 5 });
        console.log(`Room ${roomId} created by ${playerName}`);
    });

    socket.on('join_room', ({ roomId, playerName }) => {
        const room = rooms.get(roomId);
        if (!room) {
            socket.emit('error', 'ไม่พบห้องนี้');
            return;
        }
        if (room.status === 'playing') {
            socket.emit('error', 'เกมเริ่มไปแล้ว');
            return;
        }

        room.players.push({ id: socket.id, name: playerName, isHost: false });
        socket.join(roomId);

        io.to(roomId).emit('player_update', room.players);
        socket.emit('room_joined', { roomId, players: room.players, isHost: false, gameLength: room.gameLength });
        console.log(`${playerName} joined room ${roomId}`);
    });

    socket.on('update_game_settings', ({ roomId, gameLength }) => {
        const room = rooms.get(roomId);
        if (!room) return;
        // Verify host
        const player = room.players.find(p => p.id === socket.id);
        if (!player || !player.isHost) return;

        room.gameLength = gameLength;
        io.to(roomId).emit('game_settings_updated', { gameLength });
    });

    socket.on('start_game', (roomId) => {
        const room = rooms.get(roomId);
        if (!room) return;

        // Pick random location
        const location = locations[Math.floor(Math.random() * locations.length)];
        room.location = location;
        room.status = 'playing';
        room.startTime = Date.now();
        room.votes = {};

        // Pick random spy
        const spyIndex = Math.floor(Math.random() * room.players.length);
        const spyPlayer = room.players[spyIndex];
        room.spyId = spyPlayer.id;

        // Assign roles
        const roles = [...location.roles];
        // Shuffle roles
        for (let i = roles.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [roles[i], roles[j]] = [roles[j], roles[i]];
        }

        room.players.forEach((player, index) => {
            const isSpy = index === spyIndex;
            const role = isSpy ? 'Spy' : roles[index % roles.length];

            io.to(player.id).emit('game_started', {
                location: isSpy ? '???' : location.name,
                role: role,
                isSpy: isSpy,
                gameLength: room.gameLength * 60, // seconds
                allLocations: locations.map(l => l.name)
            });
        });

        // Start server timer
        if (room.timer) clearTimeout(room.timer);
        room.timer = setTimeout(() => {
            io.to(roomId).emit('start_voting');
            room.status = 'voting';
        }, room.gameLength * 60 * 1000);

        console.log(`Game started in room ${roomId}`);
    });

    socket.on('vote_player', ({ roomId, suspectId }) => {
        const room = rooms.get(roomId);
        if (!room || room.status !== 'voting') return;

        room.votes[socket.id] = suspectId;

        // Check if all players voted
        if (Object.keys(room.votes).length === room.players.length) {
            // Count votes
            const voteCounts = {};
            Object.values(room.votes).forEach(id => {
                voteCounts[id] = (voteCounts[id] || 0) + 1;
            });

            // Find player with max votes
            let maxVotes = 0;
            let suspectId = null;
            for (const [id, count] of Object.entries(voteCounts)) {
                if (count > maxVotes) {
                    maxVotes = count;
                    suspectId = id;
                }
            }

            // Simple majority logic: if suspect is Spy, Spy gets a chance to guess.
            // If suspect is NOT Spy, Spy wins.
            if (suspectId === room.spyId) {
                io.to(roomId).emit('spy_guess_phase');
                room.status = 'guessing';
            } else {
                io.to(roomId).emit('game_over', { winner: 'spy', reason: 'Citizens voted for the wrong person!' });
                room.status = 'finished';
            }
        }
    });

    socket.on('spy_guess_location', ({ roomId, locationName }) => {
        const room = rooms.get(roomId);
        if (!room) return;

        // Verify it's the spy guessing
        if (socket.id !== room.spyId) return;

        if (locationName === room.location.name) {
            io.to(roomId).emit('game_over', { winner: 'spy', reason: 'Spy guessed the location correctly!' });
        } else {
            io.to(roomId).emit('game_over', { winner: 'citizens', reason: `Spy guessed wrong! Location was ${room.location.name}` });
        }
        room.status = 'finished';
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
        // Find room user was in
        rooms.forEach((room, roomId) => {
            const playerIndex = room.players.findIndex(p => p.id === socket.id);
            if (playerIndex !== -1) {
                room.players.splice(playerIndex, 1);
                if (room.players.length === 0) {
                    if (room.timer) clearTimeout(room.timer);
                    rooms.delete(roomId);
                } else {
                    io.to(roomId).emit('player_update', room.players);
                }
            }
        });
    });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

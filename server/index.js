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
            players: [{ id: socket.id, name: playerName, isHost: true, connected: true }],
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

        // Check for reconnection
        const existingPlayer = room.players.find(p => p.name === playerName);
        if (existingPlayer) {
            if (existingPlayer.connected) {
                socket.emit('error', 'ชื่อนี้มีคนใช้แล้วในห้องนี้');
                return;
            }

            // Reconnect logic
            console.log(`Player ${playerName} reconnecting to room ${roomId}`);
            existingPlayer.id = socket.id;
            existingPlayer.connected = true;
            if (existingPlayer.disconnectTimeout) {
                clearTimeout(existingPlayer.disconnectTimeout);
                delete existingPlayer.disconnectTimeout;
            }

            socket.join(roomId);

            // Send current state
            socket.emit('room_joined', {
                roomId,
                players: room.players,
                isHost: existingPlayer.isHost,
                gameLength: room.gameLength,
                // If game is in progress, send game data
                gameState: room.status === 'waiting' ? null : {
                    status: room.status,
                    location: (existingPlayer.id === room.spyId) ? '???' : room.location?.name,
                    role: (existingPlayer.id === room.spyId) ? 'Spy' : room.location?.roles.find((_, i) => {
                        // Re-calculate role based on index... wait, we didn't store roles permanently on player object.
                        // We need to store roles on players to support reconnection properly.
                        // For now, let's just send what we can.
                        // Actually, let's fix the start_game to store roles on players.
                        return false; // Placeholder, fixed in start_game below
                    }),
                    isSpy: existingPlayer.id === room.spyId,
                    startTime: room.startTime,
                    gameLength: room.gameLength * 60,
                    allLocations: locations.map(l => l.name)
                }
            });

            // If game is running, we need to re-send game_started data properly.
            // Let's modify start_game to store roles on the player object so we can retrieve them here.
            if (room.status !== 'waiting') {
                const isSpy = existingPlayer.id === room.spyId;
                socket.emit('game_started', {
                    location: isSpy ? '???' : room.location.name,
                    role: existingPlayer.role, // We will add this property in start_game
                    isSpy: isSpy,
                    gameLength: room.gameLength * 60,
                    allLocations: locations.map(l => l.name),
                    startTime: room.startTime // Send start time for timer sync
                });

                if (room.status === 'voting') socket.emit('start_voting');
                if (room.status === 'guessing') socket.emit('spy_guess_phase');
            }

            io.to(roomId).emit('player_update', room.players);
            return;
        }

        if (room.status === 'playing') {
            socket.emit('error', 'เกมเริ่มไปแล้ว');
            return;
        }

        room.players.push({ id: socket.id, name: playerName, isHost: false, connected: true });
        socket.join(roomId);

        io.to(roomId).emit('player_update', room.players);
        socket.emit('room_joined', { roomId, players: room.players, isHost: false, gameLength: room.gameLength });
        console.log(`${playerName} joined room ${roomId}`);
    });

    socket.on('update_game_settings', ({ roomId, gameLength }) => {
        const room = rooms.get(roomId);
        if (!room) return;
        const player = room.players.find(p => p.id === socket.id);
        if (!player || !player.isHost) return;

        room.gameLength = gameLength;
        io.to(roomId).emit('game_settings_updated', { gameLength });
    });

    socket.on('start_game', (roomId) => {
        const room = rooms.get(roomId);
        if (!room) return;

        const location = locations[Math.floor(Math.random() * locations.length)];
        room.location = location;
        room.status = 'playing';
        room.startTime = Date.now();
        room.votes = {};

        const spyIndex = Math.floor(Math.random() * room.players.length);
        const spyPlayer = room.players[spyIndex];
        room.spyId = spyPlayer.id;

        const roles = [...location.roles];
        for (let i = roles.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [roles[i], roles[j]] = [roles[j], roles[i]];
        }

        room.players.forEach((player, index) => {
            const isSpy = index === spyIndex;
            const role = isSpy ? 'Spy' : roles[index % roles.length];

            // Store role for reconnection
            player.role = role;

            io.to(player.id).emit('game_started', {
                location: isSpy ? '???' : location.name,
                role: role,
                isSpy: isSpy,
                gameLength: room.gameLength * 60,
                allLocations: locations.map(l => l.name),
                startTime: room.startTime
            });
        });

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

        // Count only connected players for voting requirement? 
        // Or just wait for all *active* players.
        // Let's stick to all players for now, but maybe we should filter by connected.
        // If a player is disconnected during voting, the game might get stuck.
        // Improvement: Check only connected players.
        const connectedPlayers = room.players.filter(p => p.connected);

        if (Object.keys(room.votes).length >= connectedPlayers.length) {
            const voteCounts = {};
            Object.values(room.votes).forEach(id => {
                voteCounts[id] = (voteCounts[id] || 0) + 1;
            });

            let maxVotes = 0;
            let suspectId = null;
            for (const [id, count] of Object.entries(voteCounts)) {
                if (count > maxVotes) {
                    maxVotes = count;
                    suspectId = id;
                }
            }

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

        if (socket.id !== room.spyId) return;

        // Check time restriction if status is 'playing' (active guess)
        if (room.status === 'playing') {
            const elapsedTime = Date.now() - room.startTime;
            const totalTime = room.gameLength * 60 * 1000;
            const remainingTime = totalTime - elapsedTime;

            // Allow guess only if remaining time <= 60 seconds (plus a small buffer)
            if (remainingTime > 61000) {
                socket.emit('error', 'Spy can only guess in the last 1 minute!');
                return;
            }
        }

        if (locationName === room.location.name) {
            io.to(roomId).emit('game_over', { winner: 'spy', reason: 'Spy guessed the location correctly!' });
        } else {
            io.to(roomId).emit('game_over', { winner: 'citizens', reason: `Spy guessed wrong! Location was ${room.location.name}` });
        }
        room.status = 'finished';
        if (room.timer) clearTimeout(room.timer);
    });

    socket.on('reset_game', (roomId) => {
        const room = rooms.get(roomId);
        if (!room) return;

        const player = room.players.find(p => p.id === socket.id);
        if (!player || !player.isHost) return;

        room.status = 'waiting';
        room.location = null;
        room.startTime = null;
        room.votes = {};
        room.spyId = null;
        if (room.timer) clearTimeout(room.timer);

        // Clear roles
        room.players.forEach(p => delete p.role);

        io.to(roomId).emit('room_reset');
        io.to(roomId).emit('player_update', room.players);
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
        rooms.forEach((room, roomId) => {
            const player = room.players.find(p => p.id === socket.id);
            if (player) {
                player.connected = false;

                // Set timeout to remove player after 2 minutes
                player.disconnectTimeout = setTimeout(() => {
                    const index = room.players.indexOf(player);
                    if (index !== -1) {
                        room.players.splice(index, 1);
                        if (room.players.length === 0) {
                            if (room.timer) clearTimeout(room.timer);
                            rooms.delete(roomId);
                        } else {
                            io.to(roomId).emit('player_update', room.players);
                        }
                    }
                }, 2 * 60 * 1000); // 2 minutes

                io.to(roomId).emit('player_update', room.players);
            }
        });
    });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

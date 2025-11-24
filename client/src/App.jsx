import React, { useState, useEffect } from 'react';
import io from 'socket.io-client';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from './components/Button';
import { Input } from './components/Input';
import { Card } from './components/Card';
import { Timer } from './components/Timer';

// Connect to backend
const API_URL = import.meta.env.VITE_API_URL || (window.location.hostname === 'localhost' ? 'http://localhost:3001' : 'https://spyfall-server-xan1.onrender.com');
const socket = io(API_URL);

function App() {
  const [view, setView] = useState('home'); // home, lobby, game
  const [playerName, setPlayerName] = useState('');
  const [roomId, setRoomId] = useState('');
  const [players, setPlayers] = useState([]);
  const [isHost, setIsHost] = useState(false);
  const [gameData, setGameData] = useState(null);
  const [error, setError] = useState('');

  const [isConnected, setIsConnected] = useState(socket.connected);

  useEffect(() => {
    function onConnect() {
      setIsConnected(true);
      setError('');
    }

    function onDisconnect() {
      setIsConnected(false);
      setError('Connection lost. Reconnecting...');
    }

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('connect_error', (err) => {
      console.error("Connection error:", err);
      setError(`Connection error: ${err.message}`);
    });

    socket.on('room_joined', (data) => {
      setRoomId(data.roomId);
      setPlayers(data.players);
      setIsHost(data.isHost);
      setView('lobby');
      setError('');
    });

    socket.on('player_update', (updatedPlayers) => {
      setPlayers(updatedPlayers);
    });

    socket.on('game_started', (data) => {
      setGameData(data);
      setView('game');
    });

    socket.on('error', (msg) => {
      setError(msg);
    });

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('connect_error');
      socket.off('room_joined');
      socket.off('player_update');
      socket.off('game_started');
      socket.off('error');
    };
  }, []);

  const createRoom = () => {
    if (!playerName) return setError('กรุณาใส่ชื่อ');
    socket.emit('create_room', playerName);
  };

  const joinRoom = () => {
    if (!playerName || !roomId) return setError('กรุณาใส่ชื่อและรหัสห้อง');
    socket.emit('join_room', { roomId, playerName });
  };

  const startGame = () => {
    socket.emit('start_game', roomId);
  };

  const leaveGame = () => {
    setView('home');
    setRoomId('');
    setPlayers([]);
    setGameData(null);
    // Optional: emit leave event if needed, but disconnect handles it mostly
    window.location.reload();
  }

  return (
    <div className="min-h-screen bg-slate-900 text-slate-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <AnimatePresence mode="wait">
          {view === 'home' && (
            <motion.div
              key="home"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              <div className="text-center mb-8">
                <h1 className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-rose-500 to-orange-500 mb-2">SPYFALL</h1>
                <p className="text-slate-400">จับผิดสายลับ หรือ เนียนให้รอด</p>
                {!isConnected && (
                  <div className="text-xs text-rose-500 animate-pulse mt-2">
                    Connecting to server... ({API_URL})
                  </div>
                )}
              </div>

              <Card className="space-y-4">
                <Input
                  placeholder="ชื่อของคุณ"
                  value={playerName}
                  onChange={(e) => setPlayerName(e.target.value)}
                />

                <div className="relative my-4">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-slate-700"></div>
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="px-2 bg-slate-800 text-slate-500">สร้างห้องใหม่</span>
                  </div>
                </div>

                <Button onClick={createRoom} className="w-full">สร้างห้อง</Button>

                <div className="relative my-4">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-slate-700"></div>
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="px-2 bg-slate-800 text-slate-500">หรือเข้าร่วม</span>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Input
                    placeholder="รหัสห้อง"
                    value={roomId}
                    onChange={(e) => setRoomId(e.target.value.toUpperCase())}
                    className="text-center tracking-widest uppercase font-mono"
                  />
                  <Button onClick={joinRoom} variant="secondary">เข้าร่วม</Button>
                </div>

                {error && <p className="text-rose-500 text-center text-sm">{error}</p>}
              </Card>
            </motion.div>
          )}

          {view === 'lobby' && (
            <motion.div
              key="lobby"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.05 }}
              className="space-y-6"
            >
              <div className="text-center">
                <p className="text-slate-400 mb-2">รหัสห้อง</p>
                <div className="text-4xl font-mono font-bold text-rose-500 tracking-widest bg-slate-800/50 py-2 rounded-xl border border-slate-700/50">
                  {roomId}
                </div>
              </div>

              <Card>
                <h3 className="text-xl font-bold mb-4 flex items-center justify-between">
                  <span>ผู้เล่น ({players.length})</span>
                  {isHost && <span className="text-xs bg-rose-500/20 text-rose-500 px-2 py-1 rounded">Host</span>}
                </h3>
                <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
                  {players.map((p) => (
                    <div key={p.id} className="flex items-center gap-3 p-3 bg-slate-700/30 rounded-lg border border-slate-700/50">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-rose-500 to-orange-500 flex items-center justify-center font-bold text-sm">
                        {p.name[0].toUpperCase()}
                      </div>
                      <span className="font-medium">{p.name}</span>
                      {p.isHost && <span className="ml-auto text-xs text-slate-400">หัวหน้าห้อง</span>}
                    </div>
                  ))}
                </div>
              </Card>

              {isHost ? (
                <Button onClick={startGame} className="w-full py-4 text-lg shadow-rose-500/25">
                  เริ่มเกม
                </Button>
              ) : (
                <div className="text-center text-slate-400 animate-pulse">
                  รอหัวหน้าห้องเริ่มเกม...
                </div>
              )}
            </motion.div>
          )}

          {view === 'game' && gameData && (
            <motion.div
              key="game"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-6"
            >
              <div className="text-center">
                <Timer initialTime={gameData.gameLength} />
              </div>

              <Card className="text-center py-8 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-rose-500 via-orange-500 to-rose-500"></div>

                <h2 className="text-slate-400 text-sm uppercase tracking-wider mb-2">บทบาทของคุณ</h2>
                <div className="text-3xl font-bold text-white mb-6">
                  {gameData.role}
                </div>

                <div className="w-full h-px bg-slate-700/50 my-6"></div>

                <h2 className="text-slate-400 text-sm uppercase tracking-wider mb-2">สถานที่</h2>
                <div className={`text-4xl font-black ${gameData.isSpy ? 'text-rose-500' : 'text-emerald-400'}`}>
                  {gameData.location}
                </div>

                {gameData.isSpy && (
                  <p className="mt-4 text-sm text-slate-400">
                    เนียนให้รอด! พยายามทายว่าสถานที่คือที่ไหน
                  </p>
                )}
              </Card>

              <Card>
                <h3 className="text-sm font-bold text-slate-400 mb-3 uppercase tracking-wider">สถานที่ทั้งหมด</h3>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  {gameData.allLocations.map((loc) => (
                    <div key={loc} className={`p-2 rounded border ${gameData.location === loc && !gameData.isSpy ? 'bg-emerald-500/10 border-emerald-500/50 text-emerald-400' : 'bg-slate-800 border-slate-700 text-slate-300'}`}>
                      {loc}
                    </div>
                  ))}
                </div>
              </Card>

              <Button onClick={leaveGame} variant="outline" className="w-full">
                ออกจากเกม
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

export default App;

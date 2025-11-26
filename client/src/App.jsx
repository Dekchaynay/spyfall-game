import React, { useState, useEffect } from 'react';
import io from 'socket.io-client';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from './components/Button';
import { Input } from './components/Input';
import { Card } from './components/Card';
import { Timer } from './components/Timer';

// Connect to backend
const isLocalNetwork = window.location.hostname === 'localhost' ||
  window.location.hostname === '127.0.0.1' ||
  window.location.hostname.startsWith('192.168.') ||
  window.location.hostname.startsWith('10.');

const API_URL = import.meta.env.VITE_API_URL || (isLocalNetwork
  ? `http://${window.location.hostname}:3001`
  : 'https://spyfall-server-xan1.onrender.com');
const socket = io(API_URL);

function App() {
  const [view, setView] = useState('home'); // home, lobby, game, voting, guessing, finished, server_list
  const [playerName, setPlayerName] = useState('');
  const [roomId, setRoomId] = useState('');
  const [isPublic, setIsPublic] = useState(false); // Default to Private
  const [publicRooms, setPublicRooms] = useState([]);

  // Refs for auto-rejoin logic (since event listeners close over state)
  const playerNameRef = React.useRef(playerName);
  const roomIdRef = React.useRef(roomId);

  useEffect(() => {
    playerNameRef.current = playerName;
  }, [playerName]);

  useEffect(() => {
    roomIdRef.current = roomId;
  }, [roomId]);

  // Load session from localStorage on mount
  useEffect(() => {
    const savedRoomId = localStorage.getItem('spyfall_roomId');
    const savedPlayerName = localStorage.getItem('spyfall_playerName');

    if (savedRoomId && savedPlayerName) {
      setRoomId(savedRoomId);
      setPlayerName(savedPlayerName);
      // We don't auto-emit here because the socket might not be connected yet.
      // The onConnect handler will take care of it, OR if already connected:
      if (socket.connected) {
        socket.emit('join_room', { roomId: savedRoomId, playerName: savedPlayerName });
      }
    }
  }, []);

  // Save session to localStorage
  useEffect(() => {
    if (roomId && playerName) {
      localStorage.setItem('spyfall_roomId', roomId);
      localStorage.setItem('spyfall_playerName', playerName);
    }
  }, [roomId, playerName]);
  const [players, setPlayers] = useState([]);
  const [isHost, setIsHost] = useState(false);
  const [gameData, setGameData] = useState(null);
  const [gameLength, setGameLength] = useState(5);
  const [error, setError] = useState('');
  const [winner, setWinner] = useState(null);
  const [winReason, setWinReason] = useState('');
  const [hasVoted, setHasVoted] = useState(false);
  const [isSpyGuessing, setIsSpyGuessing] = useState(false); // Local state for spy toggling guess UI
  const [remainingTime, setRemainingTime] = useState(null);

  const [isConnected, setIsConnected] = useState(socket.connected);

  useEffect(() => {
    function onConnect() {
      setIsConnected(true);
      setError('');

      // Auto-rejoin if we have state
      // Use the ref values to ensure we have the latest
      if (roomIdRef.current && playerNameRef.current) {
        console.log("Auto-rejoining room...", roomIdRef.current);
        socket.emit('join_room', { roomId: roomIdRef.current, playerName: playerNameRef.current });
      }
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
      if (data.gameLength) setGameLength(data.gameLength);
      if (typeof data.isPublic === 'boolean') setIsPublic(data.isPublic);

      // Handle reconnection state
      if (data.gameState) {
        const { status, location, role, isSpy, startTime, gameLength: totalSeconds, remainingTime, allLocations } = data.gameState;

        // Use server-provided remaining time to avoid clock skew
        const currentRemainingTime = remainingTime !== undefined ? remainingTime : totalSeconds;

        setGameData({
          location,
          role,
          isSpy,
          gameLength: currentRemainingTime,
          allLocations
        });

        setView(status === 'playing' ? 'game' : status);
      } else {
        setView('lobby');
      }

      setError('');
      setWinner(null);
      setWinReason('');
      setHasVoted(false);
      setIsSpyGuessing(false);
    });

    socket.on('player_update', (updatedPlayers) => {
      setPlayers(updatedPlayers);
    });

    socket.on('game_settings_updated', (data) => {
      if (data.gameLength) setGameLength(data.gameLength);
      if (typeof data.isPublic === 'boolean') setIsPublic(data.isPublic);
    });

    socket.on('game_started', (data) => {
      setGameData(data);
      setView('game');
      setHasVoted(false);
      setIsSpyGuessing(false);
      setRemainingTime(data.gameLength);
    });

    socket.on('start_voting', () => {
      setView('voting');
    });

    socket.on('spy_guess_phase', () => {
      setView('guessing');
    });

    socket.on('game_over', ({ winner, reason }) => {
      setWinner(winner);
      setWinReason(reason);
      setView('finished');
    });

    socket.on('room_reset', () => {
      setView('lobby');
      setGameData(null);
      setWinner(null);
      setWinReason('');
      setHasVoted(false);
      setIsSpyGuessing(false);
    });

    socket.on('public_rooms_list', (rooms) => {
      setPublicRooms(rooms);
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
      socket.off('game_settings_updated');
      socket.off('game_started');
      socket.off('start_voting');
      socket.off('spy_guess_phase');
      socket.off('game_over');
      socket.off('room_reset');
      socket.off('public_rooms_list');
      socket.off('error');
    };
  }, []);

  const createRoom = () => {
    if (!playerName) return setError('กรุณาใส่ชื่อ');
    // Default to private (isPublic: false)
    socket.emit('create_room', { playerName, isPublic: false });
  };

  const fetchPublicRooms = () => {
    socket.emit('get_public_rooms');
    setView('server_list');
  };

  const joinPublicRoom = (id) => {
    if (!playerName) return setError('กรุณาใส่ชื่อก่อนเข้าร่วม');
    socket.emit('join_room', { roomId: id, playerName });
  };

  const joinRoom = () => {
    if (!playerName || !roomId) return setError('กรุณาใส่ชื่อและรหัสห้อง');
    socket.emit('join_room', { roomId, playerName });
  };

  const updateGameLength = (length) => {
    if (!isHost) return;
    socket.emit('update_game_settings', { roomId, gameLength: length });
  };

  const togglePrivacy = (publicStatus) => {
    if (!isHost) return;
    socket.emit('update_game_settings', { roomId, isPublic: publicStatus });
  };

  const startGame = () => {
    socket.emit('start_game', roomId);
  };

  const votePlayer = (suspectId) => {
    if (hasVoted) return;
    socket.emit('vote_player', { roomId, suspectId });
    setHasVoted(true);
  };

  const guessLocation = (locationName) => {
    socket.emit('spy_guess_location', { roomId, locationName });
  };

  const resetGame = () => {
    socket.emit('reset_game', roomId);
  };

  const leaveGame = () => {
    localStorage.removeItem('spyfall_roomId');
    localStorage.removeItem('spyfall_playerName');
    setView('home');
    setRoomId('');
    setPlayers([]);
    setGameData(null);
    setWinner(null);
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
                <p className="text-xs text-slate-600 mt-2">v1.2 (Reconnection & Play Again)</p>
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

                <div className="flex items-center justify-center gap-4 mb-4">
                  {/* Privacy toggle removed from here */}
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
                  <Button
                    onClick={joinRoom}
                    variant="secondary"
                    className={roomId ? "bg-rose-500 hover:bg-rose-600 text-white" : ""}
                  >
                    เข้าร่วม
                  </Button>
                </div>

                <div className="mt-4">
                  <Button onClick={fetchPublicRooms} variant="outline" className="w-full border-slate-700 hover:bg-slate-800">
                    🔍 ค้นหาห้อง (Server Browser)
                  </Button>
                </div>

                {error && <p className="text-rose-500 text-center text-sm">{error}</p>}
              </Card>
            </motion.div>
          )}

          {view === 'server_list' && (
            <motion.div
              key="server_list"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <div className="text-center mb-6">
                <h2 className="text-3xl font-bold text-white">ค้นหาห้อง</h2>
                <p className="text-slate-400">เลือกห้องที่ต้องการเข้าร่วม</p>
              </div>

              <Card className="space-y-4">
                <Input
                  placeholder="ชื่อของคุณ"
                  value={playerName}
                  onChange={(e) => setPlayerName(e.target.value)}
                />

                <div className="max-h-[50vh] overflow-y-auto space-y-3 pr-2">
                  {publicRooms.length === 0 ? (
                    <div className="text-center py-8 text-slate-500">
                      ไม่พบห้องสาธารณะในขณะนี้
                    </div>
                  ) : (
                    publicRooms.map((room) => (
                      <div key={room.roomId} className="bg-slate-800 p-4 rounded-lg border border-slate-700 flex justify-between items-center">
                        <div>
                          <div className="font-bold text-lg text-rose-500 tracking-widest">{room.roomId}</div>
                          <div className="text-sm text-slate-400">Host: {room.hostName}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm text-slate-300 mb-2">ผู้เล่น: {room.playerCount} คน</div>
                          <Button
                            onClick={() => joinPublicRoom(room.roomId)}
                            className="text-sm py-1 px-3"
                          >
                            เข้าร่วม
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {error && <p className="text-rose-500 text-center text-sm">{error}</p>}
              </Card>

              <Button onClick={() => setView('home')} variant="secondary" className="w-full">
                กลับหน้าหลัก
              </Button>
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
                    <div key={p.id} className={`flex items-center gap-3 p-3 rounded-lg border ${p.connected ? 'bg-slate-700/30 border-slate-700/50' : 'bg-slate-800/30 border-slate-800/50 opacity-50'}`}>
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-rose-500 to-orange-500 flex items-center justify-center font-bold text-sm">
                        {p.name[0].toUpperCase()}
                      </div>
                      <span className="font-medium">{p.name}</span>
                      {!p.connected && <span className="text-xs text-rose-500">(หลุดการเชื่อมต่อ)</span>}
                      {p.isHost && <span className="ml-auto text-xs text-slate-400">หัวหน้าห้อง</span>}
                    </div>
                  ))}
                </div>
              </Card>

              <Card>
                <h3 className="text-sm font-bold text-slate-400 mb-3 uppercase tracking-wider">ตั้งค่าห้อง</h3>

                <div className="mb-4">
                  <div className="text-xs text-slate-500 mb-2">สถานะห้อง</div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => togglePrivacy(false)}
                      disabled={!isHost}
                      className={`flex-1 py-2 rounded-lg border transition-all text-sm font-bold ${!isPublic
                        ? 'bg-rose-500/20 border-rose-500 text-rose-400'
                        : 'bg-slate-800 border-slate-700 text-slate-500'
                        } ${!isHost && 'cursor-default opacity-80'}`}
                    >
                      🔒 ส่วนตัว (Private)
                    </button>
                    <button
                      onClick={() => togglePrivacy(true)}
                      disabled={!isHost}
                      className={`flex-1 py-2 rounded-lg border transition-all text-sm font-bold ${isPublic
                        ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400'
                        : 'bg-slate-800 border-slate-700 text-slate-500'
                        } ${!isHost && 'cursor-default opacity-80'}`}
                    >
                      🌍 สาธารณะ (Public)
                    </button>
                  </div>
                </div>

                <div className="text-xs text-slate-500 mb-2">เวลาเล่น (นาที)</div>
                <div className="flex gap-2 justify-center">
                  {[3, 5, 8, 10].map(time => (
                    <button
                      key={time}
                      onClick={() => updateGameLength(time)}
                      disabled={!isHost}
                      className={`w-12 h-12 rounded-lg font-bold transition-all ${gameLength === time
                        ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/25 scale-110'
                        : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                        } ${!isHost && 'cursor-default opacity-80'}`}
                    >
                      {time}
                    </button>
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

              <Button onClick={leaveGame} variant="outline" className="w-full border-slate-700 hover:bg-slate-800 text-slate-400">
                ออกจากห้อง
              </Button>
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
                <Timer
                  initialTime={gameData.gameLength}
                  onTick={(time) => setRemainingTime(time)}
                />
              </div>

              {!isSpyGuessing ? (
                <>
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
                      <div className="mt-6">
                        <p className="text-sm text-slate-400 mb-4">
                          เนียนให้รอด! พยายามทายว่าสถานที่คือที่ไหน
                        </p>
                        <Button
                          onClick={() => setIsSpyGuessing(true)}
                          disabled={remainingTime > 60}
                          className={`w-full ${remainingTime > 60 ? 'bg-slate-700 text-slate-400 cursor-not-allowed' : 'bg-rose-500 hover:bg-rose-600'}`}
                        >
                          {remainingTime > 60
                            ? `ทายได้ในอีก ${Math.floor((remainingTime - 60) / 60)}:${String((remainingTime - 60) % 60).padStart(2, '0')}`
                            : '🕵️‍♂️ ทายสถานที่ (เสี่ยงดวง)'}
                        </Button>
                      </div>
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
                </>
              ) : (
                <Card>
                  <h3 className="text-xl font-bold mb-4 text-rose-500">ทายสถานที่</h3>
                  <p className="text-slate-400 mb-4 text-sm">ถ้าทายถูกชนะทันที ถ้าผิดแพ้ทันที!</p>
                  <div className="grid grid-cols-2 gap-2">
                    {gameData.allLocations.map((loc) => (
                      <button
                        key={loc}
                        onClick={() => guessLocation(loc)}
                        className="p-3 rounded bg-slate-800 hover:bg-rose-500/20 hover:border-rose-500 border border-slate-700 transition-colors text-left"
                      >
                        {loc}
                      </button>
                    ))}
                  </div>
                  <Button
                    onClick={() => setIsSpyGuessing(false)}
                    variant="secondary"
                    className="w-full mt-4"
                  >
                    ยกเลิก
                  </Button>
                </Card>
              )}

              <Button onClick={leaveGame} variant="outline" className="w-full">
                ออกจากเกม
              </Button>
            </motion.div>
          )}

          {view === 'voting' && (
            <motion.div
              key="voting"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-6"
            >
              <div className="text-center">
                <h2 className="text-3xl font-bold text-rose-500 mb-2">หมดเวลา!</h2>
                <p className="text-slate-400">โหวตหาคนที่เป็น Spy</p>
              </div>

              <Card>
                {!hasVoted ? (
                  <div className="space-y-2">
                    {players.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => votePlayer(p.id)}
                        className={`w-full flex items-center gap-3 p-4 rounded-lg border transition-all ${p.connected ? 'bg-slate-700/30 hover:bg-rose-500/20 hover:border-rose-500 border-slate-700/50' : 'bg-slate-800/30 border-slate-800/50 opacity-50 cursor-not-allowed'}`}
                        disabled={!p.connected}
                      >
                        <div className="w-10 h-10 rounded-full bg-slate-600 flex items-center justify-center font-bold">
                          {p.name[0].toUpperCase()}
                        </div>
                        <span className="font-medium text-lg">{p.name}</span>
                        {!p.connected && <span className="text-xs text-rose-500">(หลุด)</span>}
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <div className="text-4xl mb-4">🗳️</div>
                    <h3 className="text-xl font-bold mb-2">โหวตเรียบร้อย</h3>
                    <p className="text-slate-400 animate-pulse">รอผลโหวตจากคนอื่น...</p>
                  </div>
                )}
              </Card>
            </motion.div>
          )}

          {view === 'guessing' && (
            <motion.div
              key="guessing"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-6"
            >
              <div className="text-center">
                <h2 className="text-3xl font-bold text-orange-500 mb-2">Spy ถูกจับได้!</h2>
                <p className="text-slate-400">Spy มีโอกาสทายสถานที่ครั้งสุดท้าย</p>
              </div>

              {gameData?.isSpy ? (
                <Card>
                  <h3 className="text-xl font-bold mb-4 text-rose-500">เลือกสถานที่</h3>
                  <div className="grid grid-cols-2 gap-2">
                    {gameData.allLocations.map((loc) => (
                      <button
                        key={loc}
                        onClick={() => guessLocation(loc)}
                        className="p-3 rounded bg-slate-800 hover:bg-rose-500/20 hover:border-rose-500 border border-slate-700 transition-colors text-left"
                      >
                        {loc}
                      </button>
                    ))}
                  </div>
                </Card>
              ) : (
                <Card className="text-center py-12">
                  <div className="text-4xl mb-4">🕵️‍♂️</div>
                  <p className="text-slate-400 animate-pulse">รอ Spy ทายสถานที่...</p>
                </Card>
              )}
            </motion.div>
          )}

          {view === 'finished' && (
            <motion.div
              key="finished"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="space-y-6 text-center"
            >
              <div className="py-8">
                <h2 className="text-6xl mb-4">
                  {winner === 'spy' ? '🕵️‍♂️' : '👥'}
                </h2>
                <h1 className={`text-4xl font-black mb-2 ${winner === 'spy' ? 'text-rose-500' : 'text-emerald-500'}`}>
                  {winner === 'spy' ? 'SPY ชนะ!' : 'ชาวบ้าน ชนะ!'}
                </h1>
                <p className="text-xl text-slate-300">{winReason}</p>
              </div>

              <Card className="bg-slate-800/50">
                <p className="text-slate-400 mb-2">สถานที่คือ</p>
                <p className="text-2xl font-bold text-white">{gameData?.location}</p>
              </Card>

              {isHost ? (
                <Button onClick={resetGame} className="w-full py-4 text-lg shadow-emerald-500/25 bg-emerald-500 hover:bg-emerald-600">
                  เล่นอีกครั้ง
                </Button>
              ) : (
                <div className="text-slate-400 animate-pulse">
                  รอหัวหน้าห้องเริ่มเกมใหม่...
                </div>
              )}

              <Button onClick={leaveGame} variant="outline" className="w-full mt-4">
                ออกจากห้อง
              </Button>
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </div>
  );
}

export default App;

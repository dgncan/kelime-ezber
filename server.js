const WebSocket = require('ws');
const http = require('http');
const express = require('express');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Statik dosyaları serve et
app.use(express.static('./'));

// Oda yönetimi
const rooms = new Map();

// Benzersiz oda kodu oluştur
function generateRoomCode() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
}

wss.on('connection', (ws) => {
    console.log('Yeni bağlantı');

    ws.on('message', (message) => {
        const data = JSON.parse(message);
        
        switch (data.type) {
            case 'create_room':
                const roomCode = generateRoomCode();
                rooms.set(roomCode, {
                    host: ws,
                    players: new Map([[ws.id, { name: data.playerName, score: 0 }]])
                });
                ws.id = roomCode;
                ws.send(JSON.stringify({
                    type: 'room_created',
                    roomCode: roomCode
                }));
                break;

            case 'join_room':
                const room = rooms.get(data.roomCode);
                if (room) {
                    room.players.set(ws.id, { name: data.playerName, score: 0 });
                    ws.id = data.roomCode;
                    
                    // Tüm oyunculara yeni oyuncuyu bildir
                    room.players.forEach((player, playerId) => {
                        const playerWs = Array.from(wss.clients).find(client => client.id === playerId);
                        if (playerWs) {
                            playerWs.send(JSON.stringify({
                                type: 'player_joined',
                                playerId: ws.id,
                                playerName: data.playerName
                            }));
                        }
                    });
                }
                break;

            case 'start_game':
                const gameRoom = rooms.get(ws.id);
                if (gameRoom) {
                    gameRoom.players.forEach((player, playerId) => {
                        const playerWs = Array.from(wss.clients).find(client => client.id === playerId);
                        if (playerWs) {
                            playerWs.send(JSON.stringify({
                                type: 'game_started'
                            }));
                        }
                    });
                }
                break;

            case 'answer':
                const answerRoom = rooms.get(ws.id);
                if (answerRoom) {
                    answerRoom.players.forEach((player, playerId) => {
                        const playerWs = Array.from(wss.clients).find(client => client.id === playerId);
                        if (playerWs) {
                            playerWs.send(JSON.stringify({
                                type: 'answer_result',
                                playerId: ws.id,
                                isCorrect: data.isCorrect
                            }));
                        }
                    });
                }
                break;
        }
    });

    ws.on('close', () => {
        console.log('Bağlantı kapandı');
        // Oyuncuyu odadan çıkar
        rooms.forEach((room, roomCode) => {
            if (room.players.has(ws.id)) {
                room.players.delete(ws.id);
                
                // Diğer oyunculara bildir
                room.players.forEach((player, playerId) => {
                    const playerWs = Array.from(wss.clients).find(client => client.id === playerId);
                    if (playerWs) {
                        playerWs.send(JSON.stringify({
                            type: 'player_left',
                            playerId: ws.id
                        }));
                    }
                });

                // Oda boşsa odayı sil
                if (room.players.size === 0) {
                    rooms.delete(roomCode);
                }
            }
        });
    });
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
    console.log(`Sunucu ${PORT} portunda çalışıyor`);
}); 
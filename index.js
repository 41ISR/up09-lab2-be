const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "*", // Allow requests from this origin
        methods: ["GET", "POST"],
        credentials: true
    }
});

const users = {};
const messages = []; // Store messages globally

app.use(cors({
    origin: "*", // Allow requests from this origin
    methods: ["GET", "POST"],
    credentials: true
}));
app.use(express.json());

// Register or authorize user
app.post('/login', (req, res) => {
    const { id } = req.body;
    if (!id) {
        return res.status(400).send('User ID is required');
    }
    if (!users[id]) {
        users[id] = { id };
        console.log(`New user registered: ${id}`);
    } else {
        console.log(`User authorized: ${id}`);
    }
    res.status(200).send(users[id]);
});

// Get message history for a user
app.get('/messages/:id', (req, res) => {
    const { id } = req.params;
    const userMessages = messages.filter(msg => msg.from === id || msg.to === id);
    res.status(200).send(userMessages);
});

// WebSocket connection
io.on('connection', (socket) => {
    console.log('New client connected');

    socket.on('register', (id) => {
        socket.userId = id; // Store the user ID in the socket object
        if (!users[id]) {
            users[id] = { id, socketId: socket.id };
            console.log(`User registered with socket: ${id}`);
        } else {
            users[id].socketId = socket.id;
            console.log(`User reconnected with socket: ${id}`);
        }
        io.emit('users', Object.values(users)); // Emit the list of users to all clients
    });

    socket.on('private_message', (data) => {
        const { to, message } = data;
        const recipient = users[to];
        const timestamp = new Date().toISOString();
        if (recipient && recipient.socketId) {
            io.to(recipient.socketId).emit('private_message', { from: socket.userId, to, message, timestamp });
            console.log(`Message from ${socket.userId} to ${recipient.id}: ${message}`);
            // Store message in history
            messages.push({ from: socket.userId, to, message, timestamp });
        }
    });

    socket.on('disconnect', () => {
        console.log('Client disconnected');
        // Remove the user from the list
        for (const id in users) {
            if (users[id].socketId === socket.id) {
                delete users[id];
                break;
            }
        }
        io.emit('users', Object.values(users)); // Emit the updated list of users to all clients
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

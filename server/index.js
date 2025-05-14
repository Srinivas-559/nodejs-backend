const express = require('express');
const http = require('http');
const cors = require('cors');
const mongoose = require('mongoose');
const { Server } = require('socket.io');

const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes'); 
const messageRoutes = require('./routes/messageRoutes');
const invitationRoutes = require('./routes/invitationRoutes');
const eventRoutes = require('./routes/eventRoutes');
const classfiedRoutes = require('./routes/classifiedRoutes');
const groupRoutes = require('./routes/groupRoutes');

  
// Socket handlers
const authSocket = require('./sockets/authSocket');
const chatSocket = require('./sockets/chatSocket');
const invitationSocket = require('./sockets/invitationSocket');
const eventSockets = require('./sockets/eventSocket');
const groupSockets = require('./sockets/groupSocket')

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  }
});

app.use(cors());
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/invitations', invitationRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/classifieds', classfiedRoutes);
app.use('/api/groups', groupRoutes);

app.set('io', io);

// Socket connection handler
io.on('connection', (socket) => {
  console.log('New client connected:', socket.id);
  
  // Initialize all socket handlers
  authSocket(socket);
  chatSocket(socket);
  invitationSocket(socket);
  eventSockets(socket);
   groupSockets(socket);
});

// MongoDB connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb+srv://ganeshyarrampati999:nani@cluster.l7ovb.mongodb.net/?retryWrites=true&w=majority&appName=Cluster', {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
  .then(() => {
    console.log('MongoDB connected');
    const PORT = process.env.PORT || 5001;
    server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  })
  .catch(err => console.error('MongoDB connection error:', err));
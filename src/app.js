const express = require("express");
const dotenv = require("dotenv");
const { connectDB } = require("./config/dbconfig.js");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");
const coursedsctlr = require("./controllers/coursedsctlr.js");

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE"]
  }
});

const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(cors());

// ======================
// API ENDPOINTS
// ======================

// Authentication
app.post("/api/v2/loginuser", coursedsctlr.loginuser);

// Course Management
app.post("/api/v2/createcourse", coursedsctlr.createcourse);
app.get("/api/v2/getcoursebyfaculty", coursedsctlr.getcoursebyfaculty);
app.get("/api/v2/getcoursesbystudent", coursedsctlr.getcoursesbystudent);

// Assignment Management
app.post("/api/v2/createassignment", coursedsctlr.createassignment);
app.get("/api/v2/getassignmentsbycourse", coursedsctlr.getassignmentsbycourse);
app.get("/api/v2/getassignmentsfirstudent", coursedsctlr.getassignmentsfirstudent);
app.post("/api/v2/submitassignment", coursedsctlr.submitassignment);
app.get("/api/v2/getassignmentsubmissions/:assignmentid", coursedsctlr.getassignmentsubmissions);

// Syllabus Management
app.post("/api/v2/createsyllabus", coursedsctlr.createsyllabus);
app.get("/api/v2/getsyllabusbycourse", coursedsctlr.getsyllabusbycourse);
app.put("/api/v2/marksyllabuscomplete/:id", coursedsctlr.marksyllabuscomplete);

// Course Material Management
app.post("/api/v2/createcoursematerial", coursedsctlr.createcoursematerial);
app.get("/api/v2/getcoursematerialsbycourse", coursedsctlr.getcoursematerialsbycourse);

// Message Management
app.post("/api/v2/savemessage", coursedsctlr.savemessage);
app.get("/api/v2/getmessagesbyroom/:room", coursedsctlr.getmessagesbyroom);

app.get("/api/v2/getawsconfigbycolid", coursedsctlr.getawsconfigbycolid);

// ======================
// SOCKET.IO HANDLERS
// ======================
io.on('connection', (socket) => {

  socket.on('join_room', (data) => {
    const { room, userEmail, userName, userRole } = data;
    socket.join(room);
  });

  socket.on('leave_room', (data) => {
    const { room, userName } = data;
    socket.leave(room);
  });

  socket.on('send_message', (messageData) => {
    const { room } = messageData;
    io.to(room).emit('receive_message', messageData);
  });

  socket.on('file_uploaded', (fileData) => {
    const { room } = fileData;
    io.to(room).emit('file_received', fileData);
  });

  socket.on('assignment_posted', (assignmentData) => {
    const { room } = assignmentData;
    io.to(room).emit('new_assignment', assignmentData);
  });

  socket.on('assignment_submitted', (submissionData) => {
    const { room } = submissionData;
    io.to(room).emit('assignment_response', submissionData);
  });

  socket.on('syllabus_updated', (syllabusData) => {
    const { room } = syllabusData;
    io.to(room).emit('syllabus_changed', syllabusData);
  });

  socket.on('syllabus_completed', (completionData) => {
    const { room } = completionData;
    io.to(room).emit('module_completed', completionData);
  });

  socket.on('material_uploaded', (materialData) => {
    const { room } = materialData;
    io.to(room).emit('new_material', materialData);
  });

  socket.on('test_room', (data) => {
    const room = io.sockets.adapter.rooms.get(data.room);
    io.to(data.room).emit('test_response', { 
      message: 'Room test successful!', 
      userCount: room ? room.size : 0 
    });
  });

  socket.on('disconnect', () => {
    // Connection closed
  });
});

async function startServer() {
  await connectDB();
  server.listen(PORT, () => {
    // Server started
  });
}

startServer().catch((error) => {
  process.exit(1);
});

module.exports = { app, server, io };

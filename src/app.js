const express = require("express");
const dotenv = require("dotenv");
const { connectDB } = require("./config/dbconfig.js");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");
const coursedsctlr = require("./controllers/coursedsctlr.js");
const patentctlr = require("./controllers/patentctlr");
const projectctlr = require("./controllers/projectctlr");
const publicationctlr = require("./controllers/publicationctlr");
const seminarctlr = require("./controllers/seminarctlr.js");
const consultancyctlr = require("./controllers/consultancyctlr.js");
const attendancectlr = require("./controllers/attendancectlr.js");
const testdsctlr = require("./controllers/testdsctlr.js");
const testsubmissiondsctlr = require("./controllers/testsubmissiondsctlr.js");
const collaborationctlr = require("./controllers/collaborationctlr.js");
const userctlr = require("./controllers/userctlr.js");

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

// Patent Management
app.post("/api/v2/createpatent", patentctlr.createpatent);
app.get("/api/v2/getpatentsbyuser", patentctlr.getpatentsbyuser);
app.put("/api/v2/updatepatent/:id", patentctlr.updatepatent);
app.delete("/api/v2/deletepatent/:id", patentctlr.deletepatent);
// Project Management
app.post("/api/v2/createproject", projectctlr.createproject);
app.get("/api/v2/getprojectsbyuser", projectctlr.getprojectsbyuser);
app.post("/api/v2/updateproject", projectctlr.updateproject); // POST method
app.get("/api/v2/deleteproject", projectctlr.deleteproject);   // GET method

// Publication Management
app.post("/api/v2/createpublication", publicationctlr.createpublication);
app.get("/api/v2/getpublicationsbyuser", publicationctlr.getpublicationsbyuser);
app.post("/api/v2/updatepublication", publicationctlr.updatepublication); // POST method
app.get("/api/v2/deletepublication", publicationctlr.deletepublication);   // GET method

// Seminar Management - Add these routes
app.post("/api/v2/createseminar", seminarctlr.createseminar);
app.get("/api/v2/getseminarsbyuser", seminarctlr.getseminarsbyuser);
app.post("/api/v2/updateseminar", seminarctlr.updateseminar); // POST method
app.get("/api/v2/deleteseminar", seminarctlr.deleteseminar);   // GET method

// Consultancy Management - Add these routes
app.post("/api/v2/createconsultancy", consultancyctlr.createconsultancy);
app.get("/api/v2/getconsultanciesbyuser", consultancyctlr.getconsultanciesbyuser);
app.post("/api/v2/updateconsultancy", consultancyctlr.updateconsultancy); // POST method
app.get("/api/v2/deleteconsultancy", consultancyctlr.deleteconsultancy);   // GET method

// Attendance Management Routes
app.post("/api/v2/createclass", attendancectlr.createclass);
app.get("/api/v2/getclassesbyuser", attendancectlr.getclassesbyuser);
app.get("/api/v2/searchusers", attendancectlr.searchusers);
app.post("/api/v2/enrollstudent", attendancectlr.enrollstudent);
app.get("/api/v2/getenrolledstudents", attendancectlr.getenrolledstudents);
app.post("/api/v2/markattendance", attendancectlr.markattendance);

// Advanced Report routes with aggregation
app.get("/api/v2/getclassreportaggregate", attendancectlr.getclassreportaggregate);
app.get("/api/v2/getstudentreportaggregate", attendancectlr.getstudentreportaggregate);
app.get("/api/v2/getattendancesummarybydate", attendancectlr.getattendancesummarybydate);
app.get('/api/v2/getsinglestudentreport', attendancectlr.getsinglestudentrport);

// Test Management Routes
app.post("/api/v2/createtestds", testdsctlr.createtestds);
app.get("/api/v2/gettestsbyuser", testdsctlr.gettestsbyuser);
app.post("/api/v2/updatetestds", testdsctlr.updatetestds);
app.get("/api/v2/deletetestds", testdsctlr.deletetestds);
app.post("/api/v2/generatequestionsds", testdsctlr.generatequestionsds);
app.post("/api/v2/publishtestds", testdsctlr.publishtestds);
app.get("/api/v2/getavailabletestsds", testdsctlr.getavailabletestsds);

// API Key Management Routes
app.post("/api/v2/createapikeyds", testdsctlr.createapikeyds);
app.get("/api/v2/getapikeyds", testdsctlr.getapikeyds);
app.get("/api/v2/getactiveapikeyds", testdsctlr.getactiveapikeyds);
app.post("/api/v2/updateusageds", testdsctlr.updateusageds);

// Test Submission Management Routes
// app.post("/api/v2/createtestsubmissionds", testsubmissiondsctlr.createtestsubmissionds);
// app.get("/api/v2/gettestsubmissionsbyuser", testsubmissiondsctlr.gettestsubmissionsbyuser);
// app.get("/api/v2/gettestsubmissionsbytest", testsubmissiondsctlr.gettestsubmissionsbytest);
// app.post("/api/v2/starttestds", testsubmissiondsctlr.starttestds);
// app.post("/api/v2/submitanswerds", testsubmissiondsctlr.submitanswerds);
// app.post("/api/v2/submittestds", testsubmissiondsctlr.submittestds);

app.post("/api/v2/createtestsubmissionds", testsubmissiondsctlr.createtestsubmissionds);
app.get("/api/v2/gettestsubmissionsbyuser", testsubmissiondsctlr.gettestsubmissionsbyuser);
app.get("/api/v2/gettestsubmissionsbytest", testsubmissiondsctlr.gettestsubmissionsbytest);
app.post("/api/v2/starttestds", testsubmissiondsctlr.starttestds);
app.post("/api/v2/submitanswerds", testsubmissiondsctlr.submitanswerds);
app.post("/api/v2/submittestds", testsubmissiondsctlr.submittestds);

//student setting
app.get("/api/v2/gettesteliiblestudents/:testid", testdsctlr.gettesteliiblestudents);
app.post("/api/v2/allowstudentretake", testdsctlr.allowstudentretake);
app.get("/api/v2/checkstudenteligibility/:testid/:studentid", testdsctlr.checkstudenteligibility);

// Collaboration Post Management
app.post("/api/v2/createcollaborationpost", collaborationctlr.createcollaborationpost);
app.get("/api/v2/getcollaborationposts", collaborationctlr.getcollaborationposts);
app.get("/api/v2/getcollaborationpostsbyuser", collaborationctlr.getcollaborationpostsbyuser);
app.post("/api/v2/updatecollaborationpost", collaborationctlr.updatecollaborationpost);
app.get("/api/v2/deletecollaborationpost", collaborationctlr.deletecollaborationpost);

// Collaboration Request Management
app.post("/api/v2/sendcollaborationrequest", collaborationctlr.sendcollaborationrequest);
app.get("/api/v2/getcollaborationrequests", collaborationctlr.getcollaborationrequests);
app.get("/api/v2/getsentcollaborationrequests", collaborationctlr.getsentcollaborationrequests);
app.post("/api/v2/acceptcollaborationrequest", collaborationctlr.acceptcollaborationrequest);
app.post("/api/v2/rejectcollaborationrequest", collaborationctlr.rejectcollaborationrequest);

// Active Collaboration Management
app.get("/api/v2/getactivecollaborations", collaborationctlr.getactivecollaborations);
app.post("/api/v2/updatecollaborationactivity", collaborationctlr.updatecollaborationactivity);

// Notification Management
app.get("/api/v2/getnotifications", collaborationctlr.getnotifications);
app.get("/api/v2/getunreadnotificationscount", collaborationctlr.getunreadnotificationscount);
app.post("/api/v2/marknotificationread", collaborationctlr.marknotificationread);
app.post("/api/v2/markallnotificationsread", collaborationctlr.markallnotificationsread);

// Enhanced Profile Routes
app.get("/api/v2/getfacultyprofilestats", collaborationctlr.getfacultyprofilestats);
app.get("/api/v2/getrecentactivities", collaborationctlr.getrecentactivities);
app.get("/api/v2/getfacultyprofile", collaborationctlr.getfacultyprofile);
app.get("/api/v2/getfacultyprofilewithworks", collaborationctlr.getfacultyprofilewithworks);
app.post("/api/v2/createfacultyprofile", collaborationctlr.createfacultyprofile);
app.post("/api/v2/addworkexperience", collaborationctlr.addworkexperience);


//user photo update
app.post("/api/v2/updateuserphoto", userctlr.updateuserphoto)


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

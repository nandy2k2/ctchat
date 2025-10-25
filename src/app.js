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
const testdsctlr1 = require("./controllers/testdsctlr1.js");
const testsubmissiondsctlr1 = require("./controllers/testsubmissiondsctlr1.js");
const authctlr = require("./controllers/authctlr.js");
const enrollmentlinkdsctlr = require("./controllers/enrollmentlinkdsctlr.js");
const aivideoanalysisctlr = require('./controllers/aivideoanalysisctlr.js');
const generateclassctlr = require('./controllers/generateclassctlr');
const schedule = require('node-schedule');
const classnew = require('./Models/classnew.js');
const classenr1 = require('./Models/classenr1.js');
const bookctlr = require("./controllers/bookctlr.js");
const attendanceadvancectlr = require("./controllers/attendanceadvancectlr.js");
const attendanceremedialctlr = require("./controllers/attendanceremedialctlr.js");
const coursedsadvancectlr = require("./controllers/coursedsadvancectlr.js");
const coursedsremedialctlr = require("./controllers/coursedsremedialctlr.js");
const aivideoanalysisremedialctlr = require("./controllers/aivideoanalysisremedialctlr.js");
const aivideoanalysisadvancectlr = require("./controllers/aivideoanalysisadvancectlr.js");
const enrollmentlinkdsadvancectlr = require("./controllers/enrollmentlinkdsadvancectlr.js");
const enrollmentlinkdsremedialctlr = require("./controllers/enrollmentlinkdsremedialctlr");
const generatedclassadvancectlr = require("./controllers/generateclassadvancectlr");
const generatedclassremedialctlr = require("./controllers/generateclassremedialctlr");
const studentprofilectlr = require('./controllers/studentprofilectlr');
const contactdsctlr = require('./controllers/contactdsctlr.js');

const reportsctlr = require("./controllers/reportsctlr.js");

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
const autoTriggeredClasses = new Map();
const classRoomMapping = new Map();

app.use(express.json());
app.use(cors());

// ✅ AUTO-TRIGGER: Utility functions
const generateAIChatRoom = (coursecode) => {
  if (!coursecode) return null;
  return `ai-chat-${coursecode.toLowerCase().replace(/[^a-z0-9]/g, '')}`;
};

const isWithinClassWindow = (classDate, classTime) => {
  if (!classDate || !classTime) return false;
  
  const now = new Date();
  const classDateTime = new Date(classDate);
  const [hours, minutes] = classTime.split(':').map(Number);
  classDateTime.setHours(hours, minutes, 0, 0);
  
  const windowStart = new Date(classDateTime.getTime() - 15 * 60 * 1000);
  const windowEnd = new Date(classDateTime.getTime() + 45 * 60 * 1000);
  
  return now >= windowStart && now <= windowEnd;
};

const autoTriggerAIAnalysis = async (classItem) => {
  try {
    if (autoTriggeredClasses.has(classItem._id.toString())) {
      return;
    }
    
    const existingAnalysis = await aivideoanalysisds.findOne({
      classid: classItem._id,
      user: classItem.user,
      colid: classItem.colid
    });
    
    if (existingAnalysis && ['completed', 'searching', 'analyzing', 'generating'].includes(existingAnalysis.status)) {
      return;
    }
    
    const roomId = generateAIChatRoom(classItem.coursecode);
    classRoomMapping.set(roomId, classItem._id.toString());
    
    autoTriggeredClasses.set(classItem._id.toString(), {
      triggeredAt: new Date(),
      status: 'auto-triggered',
      roomId: roomId,
      topic: classItem.topic,
      coursecode: classItem.coursecode
    });
    
    const mockReq = {
      body: {
        classid: classItem._id,
        user: classItem.user,
        colid: classItem.colid
      },
      app: { get: () => io }
    };
    
    const mockRes = {
      json: () => {},
      status: () => ({ json: () => {} })
    };
    
    await aivideoanalysisctlr.processaivideoanalysis(mockReq, mockRes);
    
  } catch (error) {
    autoTriggeredClasses.delete(classItem._id.toString());
  }
};


// ✅ AUTO-TRIGGER: Scheduled job (runs every minute) - WHOLE DAY analysis
schedule.scheduleJob('*/1 * * * *', async () => {
  try {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);
    
    const todaysClasses = await classnew.find({
      classdate: { $gte: today, $lt: tomorrow },
      topic: { $exists: true, $ne: '', $ne: null },
      classtime: { $exists: true, $ne: '', $ne: null }
    });
    
    for (const classItem of todaysClasses) {
      const hasEnrollments = await classenr1.findOne({
        coursecode: classItem.coursecode,
        colid: classItem.colid,
        active: 'Yes'
      });
      
      if (hasEnrollments) {
        const roomId = generateAIChatRoom(classItem.coursecode);
        if (!classRoomMapping.has(roomId)) {
          classRoomMapping.set(roomId, classItem._id.toString());
        }
      }
    }
    
    const validRoomIds = new Set();
    for (const classItem of todaysClasses) {
      const roomId = generateAIChatRoom(classItem.coursecode);
      validRoomIds.add(roomId);
    }
    
    for (const [roomId] of classRoomMapping) {
      if (!validRoomIds.has(roomId)) {
        classRoomMapping.delete(roomId);
        const classId = classRoomMapping.get(roomId);
        if (classId && autoTriggeredClasses.has(classId)) {
          autoTriggeredClasses.delete(classId);
        }
      }
    }
    
  } catch (error) {
    // Handle error silently
  }
});


// ======================
// API ENDPOINTS
// ======================

// Authentication
// app.post("/api/v2/loginuser", coursedsctlr.loginuser);
app.post("/api/v2/loginuser", authctlr.loginuser);
app.post("/api/v2/register", authctlr.registeruser);

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

// checking route for student enrollment
app.get('/api/v2/checkexistingenrollment', coursedsctlr.checkexistingenrollment);

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

// Test Management Routes (Updated)
app.post("/api/v2/createtestds1", testdsctlr1.createtestds1);
app.get("/api/v2/gettestsbyuser1", testdsctlr1.gettestsbyuser1);
app.post("/api/v2/updatetestds1", testdsctlr1.updatetestds1);
app.get("/api/v2/deletetestds1", testdsctlr1.deletetestds1);
app.post("/api/v2/generatequestionsds1", testdsctlr1.generatequestionsds1);
app.post("/api/v2/publishtestds1", testdsctlr1.publishtestds1);
app.get("/api/v2/getavailabletestsds1", testdsctlr1.getavailabletestsds1);
app.get("/api/v2/gettesteliiblestudents1/:testid", testdsctlr1.gettesteliiblestudents1);
app.post("/api/v2/allowstudentretake1", testdsctlr1.allowstudentretake1);
app.get("/api/v2/checkstudenteligibility1/:testid/:studentid", testdsctlr1.checkstudenteligibility1);

// API Key Management Routes
app.post("/api/v2/createapikeyds1", testdsctlr1.createapikeyds1);
app.get("/api/v2/getapikeyds1", testdsctlr1.getapikeyds1);
app.get("/api/v2/getactiveapikeyds1", testdsctlr1.getactiveapikeyds1);
app.post("/api/v2/updateusageds1", testdsctlr1.updateusageds1);

// Test Submission Management Routes (Updated)
app.post("/api/v2/createtestsubmissionds1", testsubmissiondsctlr1.createtestsubmissionds1);
app.get("/api/v2/gettestsubmissionsbyuser1", testsubmissiondsctlr1.gettestsubmissionsbyuser1);
app.get("/api/v2/gettestsubmissionsbytest1", testsubmissiondsctlr1.gettestsubmissionsbytest1);
app.post("/api/v2/starttestds1", testsubmissiondsctlr1.starttestds1);
app.post("/api/v2/submitanswerds1", testsubmissiondsctlr1.submitanswerds1);
app.post("/api/v2/submittestds1", testsubmissiondsctlr1.submittestds1);
app.post("/api/v2/getstudentattemptscount", testsubmissiondsctlr1.getstudentattemptscount);

// Enrollment link APIs
app.post("/api/v2/create-enrollment-link", enrollmentlinkdsctlr.createenrollmentlink);
app.get("/api/v2/enrollment-links", enrollmentlinkdsctlr.getenrollmentlinksbycreator);
app.get("/api/v2/enrollment-link/:token", enrollmentlinkdsctlr.resolveenrollmenttoken);
app.put("/api/v2/enrollment-link/:token/revoke", enrollmentlinkdsctlr.revokeenrollmentlink);

// Enrollment listing + status change
app.get("/api/v2/getenrollments", attendancectlr.getenrollments);
app.put("/api/v2/update-enrollment-status/:id", attendancectlr.updateenrollmentstatus);

// AI Video Analysis Routes
app.get("/api/v2/monitorscheduledclasses", aivideoanalysisctlr.monitorscheduledclasses);
app.post("/api/v2/processaivideoanalysis", aivideoanalysisctlr.processaivideoanalysis);
app.get("/api/v2/getaivideoanalysisbyuser", aivideoanalysisctlr.getaivideoanalysisbyuser);
app.get("/api/v2/getaichatmessages/:chatRoomId", aivideoanalysisctlr.getaichatmessages);
app.delete("/api/v2/deleteaivideoanalysis/:id", aivideoanalysisctlr.deleteaivideoanalysis);

// Ai generated classes and assesment
app.post("/api/v2/generateclassschedule", generateclassctlr.generateclassschedule);
app.post("/api/v2/saveClassesAndAssessments", generateclassctlr.saveClassesAndAssessments);
app.get("/api/v2/getTopicsCoveredUpToDate", generateclassctlr.getTopicsCoveredUpToDate);
app.post("/api/v2/confirmclassschedule", generateclassctlr.confirmclassschedule);
app.put("/api/v2/updateclass/:id", attendancectlr.updateclass);
app.delete("/api/v2/deleteclass/:id", attendancectlr.deleteclass);

// book management
app.post("/api/v2/createbook", bookctlr.createbook);
app.get("/api/v2/getbooksbyuser", bookctlr.getbooksbyuser);
app.post("/api/v2/updatebook", bookctlr.updatebook);
app.get("/api/v2/deletebook", bookctlr.deletebook);



// Attendance Advance Management Routes
app.post("/api/v2/createclassadvance", attendanceadvancectlr.createclassadvance);
app.get("/api/v2/getclassesbyuseradvance", attendanceadvancectlr.getclassesbyuseradvance);
app.get("/api/v2/searchusersadvance", attendanceadvancectlr.searchusersadvance);
app.post("/api/v2/enrollstudentadvance", attendanceadvancectlr.enrollstudentadvance);
app.get("/api/v2/getenrolledstudentsadvance", attendanceadvancectlr.getenrolledstudentsadvance);
app.post("/api/v2/markattendanceadvance", attendanceadvancectlr.markattendanceadvance);

// Advanced Report routes with aggregation
app.get("/api/v2/getclassreportaggregateadvance", attendanceadvancectlr.getclassreportaggregateadvance);
app.get("/api/v2/getstudentreportaggregateadvance", attendanceadvancectlr.getstudentreportaggregateadvance);
app.get("/api/v2/getattendancesummarybydateadvance", attendanceadvancectlr.getattendancesummarybydateadvance);
app.get('/api/v2/getsinglestudentreportadvance', attendanceadvancectlr.getsinglestudentrportadvance);
app.get("/api/v2/getclassreportbycourseadvance", attendanceadvancectlr.getclassreportbycourseadvance);
app.get("/api/v2/getfacultycoursesadvance", attendanceadvancectlr.getfacultycoursesadvance);

// Enrollment listing + status change
app.get("/api/v2/getenrollmentsadvance", attendanceadvancectlr.getenrollmentsadvance);
app.put("/api/v2/update-enrollment-statusadvance/:id", attendanceadvancectlr.updateenrollmentstatusadvance);
app.put("/api/v2/updateclassadvance/:id", attendanceadvancectlr.updateclassadvance);
app.delete("/api/v2/deleteclassadvance/:id", attendanceadvancectlr.deleteclassadvance);

// Attendance Management Routes
app.post("/api/v2/createclassremedial", attendanceremedialctlr.createclassremedial);
app.get("/api/v2/getclassesbyuserremedial", attendanceremedialctlr.getclassesbyuserremedial);
app.get("/api/v2/searchusersremedial", attendanceremedialctlr.searchusersremedial);
app.post("/api/v2/enrollstudentremedial", attendanceremedialctlr.enrollstudentremedial);
app.get("/api/v2/getenrolledstudentsremedial", attendanceremedialctlr.getenrolledstudentsremedial);
app.post("/api/v2/markattendanceremedial", attendanceremedialctlr.markattendanceremedial);

// Advanced Report routes with aggregation
app.get("/api/v2/getclassreportaggregateremedial", attendanceremedialctlr.getclassreportaggregateremedial);
app.get("/api/v2/getstudentreportaggregateremedial", attendanceremedialctlr.getstudentreportaggregateremedial);
app.get("/api/v2/getattendancesummarybydateremedial", attendanceremedialctlr.getattendancesummarybydateremedial);
app.get('/api/v2/getsinglestudentreportremedial', attendanceremedialctlr.getsinglestudentrportremedial);
app.put("/api/v2/updateclassremedial/:id", attendanceremedialctlr.updateclassremedial);
app.delete("/api/v2/deleteclassremedial/:id", attendanceremedialctlr.deleteclassremedial);
app.get("/api/v2/getclassreportbycourseremedial", attendanceremedialctlr.getclassreportbycourseremedial);
app.get("/api/v2/getfacultycoursesremedial", attendanceremedialctlr.getfacultycoursesremedial)

// Enrollment listing + status change
app.get("/api/v2/getenrollmentsremedial", attendanceremedialctlr.getenrollmentsremedial);
app.put("/api/v2/update-enrollment-statusremedial/:id", attendanceremedialctlr.updateenrollmentstatusremedial);

// Course Management
app.post("/api/v2/createcourseadvance", coursedsadvancectlr.createcourseadvance);
app.get("/api/v2/getcoursebyfacultyadvance", coursedsadvancectlr.getcoursebyfacultyadvance);
app.get("/api/v2/getcoursesbystudentadvance", coursedsadvancectlr.getcoursesbystudentadvance);

// Assignment Management
app.post("/api/v2/createassignmentadvance", coursedsadvancectlr.createassignmentadvance);
app.get("/api/v2/getassignmentsbycourseadvance", coursedsadvancectlr.getassignmentsbycourseadvance);
app.get("/api/v2/getassignmentsfirstudentadvance", coursedsadvancectlr.getassignmentsfirstudentadvance);
app.post("/api/v2/submitassignmentadvance", coursedsadvancectlr.submitassignmentadvance);
app.get("/api/v2/getassignmentsubmissionsadvance/:assignmentid", coursedsadvancectlr.getassignmentsubmissionsadvance);

// Syllabus Management
app.post("/api/v2/createsyllabusadvance", coursedsadvancectlr.createsyllabusadvance);
app.get("/api/v2/getsyllabusbycourseadvance", coursedsadvancectlr.getsyllabusbycourseadvance);
app.put("/api/v2/marksyllabuscompleteadvance/:id", coursedsadvancectlr.marksyllabuscompleteadvance);

// Course Material Management
app.post("/api/v2/createcoursematerialadvance", coursedsadvancectlr.createcoursematerialadvance);
app.get("/api/v2/getcoursematerialsbycourseadvance", coursedsadvancectlr.getcoursematerialsbycourseadvance);

// checking route for student enrollment
app.get('/api/v2/checkexistingenrollmentadvance', coursedsadvancectlr.checkexistingenrollmentadvance);


// Message Management
app.post("/api/v2/savemessageadvance", coursedsadvancectlr.savemessageadvance);
app.get("/api/v2/getmessagesbyroomadvance/:room", coursedsadvancectlr.getmessagesbyroomadvance);

app.get("/api/v2/getawsconfigbycolidadvance", coursedsadvancectlr.getawsconfigbycolidadvance);

// Course Management
app.post("/api/v2/createcourseremedial", coursedsremedialctlr.createcourseremedial);
app.get("/api/v2/getcoursebyfacultyremedial", coursedsremedialctlr.getcoursebyfacultyremedial);
app.get("/api/v2/getcoursesbystudentremedial", coursedsremedialctlr.getcoursesbystudentremedial);

// Assignment Management
app.post("/api/v2/createassignmentremedial", coursedsremedialctlr.createassignmentremedial);
app.get("/api/v2/getassignmentsbycourseremedial", coursedsremedialctlr.getassignmentsbycourseremedial);
app.get("/api/v2/getassignmentsfirstudentremedial", coursedsremedialctlr.getassignmentsfirstudentremedial);
app.post("/api/v2/submitassignmentremedial", coursedsremedialctlr.submitassignmentremedial);
app.get("/api/v2/getassignmentsubmissionsremedial/:assignmentid", coursedsremedialctlr.getassignmentsubmissionsremedial);

// Syllabus Management
app.post("/api/v2/createsyllabusremedial", coursedsremedialctlr.createsyllabusremedial);
app.get("/api/v2/getsyllabusbycourseremedial", coursedsremedialctlr.getsyllabusbycourseremedial);
app.put("/api/v2/marksyllabuscompleteremedial/:id", coursedsremedialctlr.marksyllabuscompleteremedial);

// Course Material Management
app.post("/api/v2/createcoursematerialremedial", coursedsremedialctlr.createcoursematerialremedial);
app.get("/api/v2/getcoursematerialsbycourseremedial", coursedsremedialctlr.getcoursematerialsbycourseremedial);

// checking route for student enrollment
app.get('/api/v2/checkexistingenrollmentremedial', coursedsremedialctlr.checkexistingenrollmentremedial);


// Message Management
app.post("/api/v2/savemessageremedial", coursedsremedialctlr.savemessageremedial);
app.get("/api/v2/getmessagesbyroomremedial/:room", coursedsremedialctlr.getmessagesbyroomremedial);

app.get("/api/v2/getawsconfigbycolidremedial", coursedsremedialctlr.getawsconfigbycolidremedial);

// AI Video Analysis Routes
app.get("/api/v2/monitorscheduledclassesremedial", aivideoanalysisremedialctlr.monitorscheduledclassesremedial);
app.post("/api/v2/processaivideoanalysisremedial", aivideoanalysisremedialctlr.processaivideoanalysisremedial);
app.get("/api/v2/getaivideoanalysisbyuserremedial", aivideoanalysisremedialctlr.getaivideoanalysisbyuserremedial);
app.get("/api/v2/getaichatmessagesremedial/:chatRoomId", aivideoanalysisremedialctlr.getaichatmessagesremedial);
app.delete("/api/v2/deleteaivideoanalysisremedial/:id", aivideoanalysisremedialctlr.deleteaivideoanalysisremedial);

// AI Video Analysis Routes
app.get("/api/v2/monitorscheduledclassesadvance", aivideoanalysisadvancectlr.monitorscheduledclassesadvance);
app.post("/api/v2/processaivideoanalysisadvance", aivideoanalysisadvancectlr.processaivideoanalysisadvance);
app.get("/api/v2/getaivideoanalysisbyuseradvance", aivideoanalysisadvancectlr.getaivideoanalysisbyuseradvance);
app.get("/api/v2/getaichatmessagesadvance/:chatRoomId", aivideoanalysisadvancectlr.getaichatmessagesadvance);
app.delete("/api/v2/deleteaivideoanalysisadvance/:id", aivideoanalysisadvancectlr.deleteaivideoanalysisadvance);

// Enrollment link APIs
app.post("/api/v2/create-enrollment-linkadvance", enrollmentlinkdsadvancectlr.createenrollmentlinkadvance);
app.get("/api/v2/enrollment-linksadvance", enrollmentlinkdsadvancectlr.getenrollmentlinksbycreatoradvance);
app.get("/api/v2/enrollment-linkadvance/:token", enrollmentlinkdsadvancectlr.resolveenrollmenttokenadvance);
app.put("/api/v2/enrollment-linkadvance/:token/revoke", enrollmentlinkdsadvancectlr.revokeenrollmentlinkadvance);

// Enrollment link APIs
app.post("/api/v2/create-enrollment-linkremedial", enrollmentlinkdsremedialctlr.createenrollmentlinkremedial);
app.get("/api/v2/enrollment-linksremedial", enrollmentlinkdsremedialctlr.getenrollmentlinksbycreatorremedial);
app.get("/api/v2/enrollment-linkremedial/:token", enrollmentlinkdsremedialctlr.resolveenrollmenttokenremedial);
app.put("/api/v2/enrollment-linkremedial/:token/revoke", enrollmentlinkdsremedialctlr.revokeenrollmentlinkremedial);

// Ai generated classes and assesment
app.post("/api/v2/generateclassscheduleadvance", generatedclassadvancectlr.generateclassscheduleadvance);
app.post("/api/v2/saveClassesAndAssessmentsadvance", generatedclassadvancectlr.saveClassesAndAssessmentsadvance);
app.get("/api/v2/getTopicsCoveredUpToDateadvance", generatedclassadvancectlr.getTopicsCoveredUpToDateadvance);
app.post("/api/v2/confirmclassscheduleadvance", generatedclassadvancectlr.confirmclassscheduleadvance);

// Ai generated classes and assesment
app.post("/api/v2/generateclassscheduleremedial", generatedclassremedialctlr.generateclassscheduleremedial);
app.post("/api/v2/saveClassesAndAssessmentsremedial", generatedclassremedialctlr.saveClassesAndAssessmentsremedial);
app.get("/api/v2/getTopicsCoveredUpToDateremedial", generatedclassremedialctlr.getTopicsCoveredUpToDateremedial);
app.post("/api/v2/confirmclassscheduleremedial", generatedclassremedialctlr.confirmclassscheduleremedial);

//Extra report Route
app.get("/api/v2/getfacultycourses", attendancectlr.getfacultycourses);
app.get("/api/v2/getclassreportbycourse", attendancectlr.getclassreportbycourse);

// Student Class Route
app.get("/api/v2/getclassesbycourse", attendancectlr.getclassesbycourse);
app.get("/api/v2/getclassesbycourseadvance", attendanceadvancectlr.getclassesbycourseadvance);
app.get("/api/v2/getclassesbycourseremedial", attendanceremedialctlr.getclassesbycourseremedial);

// Student Profile Routes
app.get("/api/v2/getstudentprofile", studentprofilectlr.getstudentprofile);
app.get("/api/v2/getstudentprofilestats", studentprofilectlr.getstudentprofilestats);
app.get("/api/v2/getstudentrecentactivities", studentprofilectlr.getstudentrecentactivities);
app.get("/api/v2/getstudentupcomingassignments", studentprofilectlr.getstudentupcomingassignments);
app.get("/api/v2/getstudentpcomingtests", studentprofilectlr.getstudentpcomingtests);
app.get("/api/v2/getstudentcoursesdetails", studentprofilectlr.getstudentcoursesdetails);


// Regular Course Edit/Delete
app.put("/api/v2/updatecourse/:id", coursedsctlr.updatecourse);
app.delete("/api/v2/deletecourse/:id", coursedsctlr.deletecourse);

// Advance Course Edit/Delete
app.put("/api/v2/updatecourseadvance/:id", coursedsadvancectlr.updatecourseadvance);
app.delete("/api/v2/deletecourseadvance/:id", coursedsadvancectlr.deletecourseadvance);

// Remedial Course Edit/Delete
app.put("/api/v2/updatecourseremedial/:id", coursedsremedialctlr.updatecourseremedial);
app.delete("/api/v2/deletecourseremedial/:id", coursedsremedialctlr.deletecourseremedial);

// Contact Management
app.post("/api/v2/createcontact", contactdsctlr.createcontact);
app.get("/api/v2/getallcontacts", contactdsctlr.getallcontacts);

// ======================
// REPORTS ROUTES
// ======================

// Attendance Reports
app.get("/api/v2/getattendancereport", reportsctlr.getattendancereport);
app.get("/api/v2/getattendancesummary", reportsctlr.getattendancesummary);
app.get("/api/v2/getcoursewiseattendance", reportsctlr.getcoursewiseattendance);
app.get("/api/v2/getattendancetrend", reportsctlr.getattendancetrend);

// Enrollment Reports
app.get("/api/v2/getenrollmentreport", reportsctlr.getenrollmentreport);
app.get("/api/v2/getprogramenrollmentsummary", reportsctlr.getprogramenrollmentsummary);
app.get("/api/v2/getcoursetypedistribution", reportsctlr.getcoursetypedistribution);

// Student Reports
app.get("/api/v2/getstudentcompletereport", reportsctlr.getstudentcompletereport);

// Assignment Reports
app.get("/api/v2/getassignmentreport", reportsctlr.getassignmentreport);
app.get("/api/v2/getassignmentsubmissions", reportsctlr.getassignmentsubmissions);
app.get("/api/v2/getassignmentsummary", reportsctlr.getassignmentsummary);

// Test Reports
app.get("/api/v2/gettestreport", reportsctlr.gettestreport);
app.get("/api/v2/gettestsubmissions", reportsctlr.gettestsubmissions);
app.get("/api/v2/gettestsummary", reportsctlr.gettestsummary);




// ✅ NEW: Auto-trigger status API
app.get('/api/v2/autotrigger/status', (req, res) => {
  const { coursecode, colid } = req.query;
  
  if (coursecode) {
    const roomId = generateAIChatRoom(coursecode);
    const classId = classRoomMapping.get(roomId);
    const triggerInfo = classId ? autoTriggeredClasses.get(classId) : null;
    
    res.json({
      success: true,
      roomId,
      classId,
      autoTriggered: !!triggerInfo,
      triggerInfo
    });
  } else {
    res.json({
      success: true,
      totalAutoTriggered: autoTriggeredClasses.size,
      triggeredClasses: Array.from(autoTriggeredClasses.entries()).map(([id, info]) => ({
        classId: id,
        ...info
      }))
    });
  }
});



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


  // ✅ ENHANCED: AI Chat handlers with better debugging
  socket.on('join_ai_chat', (data) => {
    const { chatRoomId, userRole, user, colid } = data;
    
    // if (!chatRoomId) {
    //   console.error('❌ No chatRoomId provided for AI chat join');
    //   return;
    // }
    
    if (userRole === 'Faculty') {
      socket.join(chatRoomId);
    } else if (userRole === 'Student') {
      socket.join(`${chatRoomId}_view`);
    }
  });

  socket.on('send_ai_message', (messageData) => {
    const { chatRoomId, senderRole } = messageData;
    
    if (senderRole === 'Faculty' || senderRole === 'ai') {
      // Broadcast to both faculty and student rooms
      io.to(chatRoomId).emit('receive_ai_message', messageData);
      io.to(`${chatRoomId}_view`).emit('receive_ai_message', messageData);
      
    }
  });

  // ✅ NEW: Room connection test handler
  socket.on('test_room_connection', (data) => {
    const { room, userRole } = data;
    
    const targetRoom = userRole === 'Student' ? `${room}_view` : room;
    const roomClients = io.sockets.adapter.rooms.get(targetRoom);
    
    const response = {
      room: targetRoom,
      userCount: roomClients ? roomClients.size : 0,
      success: roomClients ? roomClients.has(socket.id) : false,
      allRooms: Array.from(socket.rooms)
    };
    socket.emit('room_test_response', response);
  });

  socket.on('leave_ai_chat', (data) => {
    const { chatRoomId, userRole, userName } = data;
    
    if (userRole === 'Student') {
      socket.leave(`${chatRoomId}_view`);
    } else {
      socket.leave(chatRoomId);
    }
  });

  socket.on('disconnect', () => {
    // Connection closed
  });
});

app.set('io', io);

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

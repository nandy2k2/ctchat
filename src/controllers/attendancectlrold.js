const classnew = require('../Models/classnew');
const attendancenew = require('../Models/attendancenew');
const classenr1 = require('../Models/classenr1');
const User = require('../Models/user');

// ======================
// CLASS CONTROLLERS
// ======================

// Create Class
exports.createclass = async (req, res) => {
    try {
        const { 
            name, user, colid, year, program, programcode, course, 
            coursecode, semester, section, classdate, classtime, 
            topic, module, link, classtype, status1, comments 
        } = req.body;

        const newClass = await classnew.create({
            name, user, colid, year, program, programcode, course,
            coursecode, semester, section, classdate, classtime,
            topic, module, link, classtype, status1, comments
        });

        res.status(201).json({
            success: true,
            message: 'Class created successfully',
            data: newClass
        });
    } catch (error) {
        // res.status(500).json({
        //     success: false,
        //     message: 'Failed to create class',
        //     error: error.message
        // });
    }
};

// Get Classes by User
exports.getclassesbyuser = async (req, res) => {
    try {
        const { user, colid } = req.query;

        const classes = await classnew.find({ 
            user, 
            colid: parseInt(colid) 
        }).sort({ classdate: -1, classtime: -1 });

        res.json({
            success: true,
            message: 'Classes retrieved successfully',
            data: classes
        });
    } catch (error) {
        // res.status(500).json({
        //     success: false,
        //     message: 'Failed to retrieve classes',
        //     error: error.message
        // });
    }
};

// ======================
// STUDENT SEARCH CONTROLLER
// ======================

// Search Users (Students)
exports.searchusers = async (req, res) => {
    try {
        const { query, colid } = req.query;

        if (!colid) {
            return res.status(400).json({
                success: false,
                message: 'colid is required'
            });
        }

        const searchRegex = new RegExp(query, 'i');

        const users = await User.find({ 
            colid: parseInt(colid),
            $or: [
                { name: { $regex: searchRegex } },
                { regno: { $regex: searchRegex } },
                {email: {$regex: searchRegex}}
            ],
            status: 1
        }).limit(20);

        res.json({
            success: true,
            message: 'Users retrieved successfully',
            data: users
        });
    } catch (error) {
        // res.status(500).json({
        //     success: false,
        //     message: 'Failed to search users',
        //     error: error.message
        // });
    }
};

// ======================
// ENROLLMENT CONTROLLERS
// ======================

// Enroll Student to Class
exports.enrollstudent = async (req, res) => {
    try {
        const { 
            name, user, colid, year, program, programcode, course, 
            coursecode, student, regno, learning, gender, classgroup, 
            coursetype, semester, active, status1, comments 
        } = req.body;

        const enrollment = await classenr1.create({
            name, user, colid, year, program, programcode, course,
            coursecode, student, regno, learning, gender, classgroup,
            coursetype, semester, active, status1, comments
        });

        res.status(201).json({
            success: true,
            message: 'Student enrolled successfully',
            data: enrollment
        });
    } catch (error) {
        // res.status(500).json({
        //     success: false,
        //     message: 'Failed to enroll student',
        //     error: error.message
        // });
    }
};

// Get Enrolled Students for Class
exports.getenrolledstudents = async (req, res) => {
    try {
        const { coursecode, colid, semester, section } = req.query;

        const enrollments = await classenr1.find({
            coursecode,
            colid: parseInt(colid),
            semester,
        }).sort({ student: 1 });

        return res.json({
            success: true,
            message: 'Enrolled students retrieved successfully',
            data: enrollments
        });
    } catch (error) {
        // res.status(500).json({
        //     success: false,
        //     message: 'Failed to retrieve enrolled students',
        //     error: error.message
        // });
    }
};

// ======================
// ATTENDANCE CONTROLLERS
// ======================

// Mark Attendance (Bulk)
exports.markattendance = async (req, res) => {
    try {
        const { attendanceRecords } = req.body;

        // Delete existing attendance for same class date
        const { classid, classdate } = attendanceRecords[0];
        await attendancenew.deleteMany({ classid, classdate });

        // Insert new attendance records
        const attendance = await attendancenew.insertMany(attendanceRecords);

        res.status(201).json({
            success: true,
            message: 'Attendance marked successfully',
            data: attendance
        });
    } catch (error) {
        // res.status(500).json({
        //     success: false,
        //     message: 'Failed to mark attendance',
        //     error: error.message
        // });
    }
};

exports.getclassreportaggregate = async (req, res) => {
    try {
        const { user, coursecode, colid, semester, section } = req.query;

        // First check if documents exist for this faculty user
        const documentCount = await attendancenew.countDocuments({
            user: user, // Faculty user filter
            coursecode: coursecode,
            colid: parseInt(colid),
            semester: semester,
            section: section
        });

        if (documentCount === 0) {
            return res.json({
                success: true,
                message: 'No attendance data found for this class',
                data: {
                    students: [],
                    summary: {
                        totalStudents: 0,
                        totalClasses: 0,
                        totalAttendanceRecords: 0,
                        totalPresent: 0,
                        overallAttendanceRate: 0
                    }
                }
            });
        }

        // Student-wise attendance aggregation for specific faculty user
        const report = await attendancenew.aggregate([
            {
                $match: {
                    user: user, // Faculty user filter
                    coursecode: coursecode,
                    colid: parseInt(colid),
                    semester: semester,
                    section: section
                }
            },
            {
                $group: {
                    _id: {
                        student: "$student",
                        regno: "$regno"
                    },
                    totalClasses: { $sum: 1 },
                    presentCount: {
                        $sum: {
                            $cond: [{ $eq: ["$att", 1] }, 1, 0]
                        }
                    },
                    absentCount: {
                        $sum: {
                            $cond: [{ $eq: ["$att", 0] }, 1, 0]
                        }
                    }
                }
            },
            {
                $addFields: {
                    attendancePercentage: {
                        $cond: [
                            { $eq: ["$totalClasses", 0] },
                            0,
                            {
                                $round: [
                                    {
                                        $multiply: [
                                            { $divide: ["$presentCount", "$totalClasses"] },
                                            100
                                        ]
                                    },
                                    2
                                ]
                            }
                        ]
                    }
                }
            },
            {
                $project: {
                    _id: 0,
                    student: "$_id.student",
                    regno: "$_id.regno",
                    totalClasses: 1,
                    presentCount: 1,
                    absentCount: 1,
                    attendancePercentage: 1
                }
            },
            {
                $sort: { student: 1 }
            }
        ]);

        // Calculate overall class statistics for this faculty user
        const classStats = await attendancenew.aggregate([
            {
                $match: {
                    user: user, // Faculty user filter
                    coursecode: coursecode,
                    colid: parseInt(colid),
                    semester: semester,
                    section: section
                }
            },
            {
                $group: {
                    _id: null,
                    totalStudents: { $addToSet: "$regno" },
                    totalClasses: { $addToSet: { $dateToString: { format: "%Y-%m-%d", date: "$classdate" } } },
                    totalAttendanceRecords: { $sum: 1 },
                    totalPresent: {
                        $sum: {
                            $cond: [{ $eq: ["$att", 1] }, 1, 0]
                        }
                    }
                }
            },
            {
                $project: {
                    _id: 0,
                    totalStudents: { $size: "$totalStudents" },
                    totalClasses: { $size: "$totalClasses" },
                    totalAttendanceRecords: 1,
                    totalPresent: 1,
                    overallAttendanceRate: {
                        $cond: [
                            { $eq: ["$totalAttendanceRecords", 0] },
                            0,
                            {
                                $round: [
                                    {
                                        $multiply: [
                                            { $divide: ["$totalPresent", "$totalAttendanceRecords"] },
                                            100
                                        ]
                                    },
                                    2
                                ]
                            }
                        ]
                    }
                }
            }
        ]);

        res.json({
            success: true,
            message: 'Class report generated successfully',
            data: {
                students: report,
                summary: classStats[0] || {
                    totalStudents: 0,
                    totalClasses: 0,
                    totalAttendanceRecords: 0,
                    totalPresent: 0,
                    overallAttendanceRate: 0
                }
            }
        });
    } catch (error) {
        // console.error('Class report error:', error);
        // res.status(500).json({
        //     success: false,
        //     message: 'Failed to generate class report',
        //     error: error.message
        // });
    }
};

exports.getattendancesummarybydate = async (req, res) => {
    try {
        const { user, colid, startDate, endDate } = req.query;

        const report = await attendancenew.aggregate([
            {
                $match: {
                    user: user, // Faculty user filter - this is the key fix
                    colid: parseInt(colid),
                    classdate: {
                        $gte: new Date(startDate),
                        $lte: new Date(endDate)
                    }
                }
            },
            {
                $group: {
                    _id: {
                        $dateToString: {
                            format: "%Y-%m-%d",
                            date: "$classdate"
                        }
                    },
                    totalStudents: { $addToSet: "$regno" },
                    totalClasses: { $sum: 1 },
                    totalPresent: {
                        $sum: {
                            $cond: [{ $eq: ["$att", 1] }, 1, 0]
                        }
                    },
                    totalAbsent: {
                        $sum: {
                            $cond: [{ $eq: ["$att", 0] }, 1, 0]
                        }
                    },
                    courses: {
                        $addToSet: {
                            course: "$course",
                            coursecode: "$coursecode"
                        }
                    }
                }
            },
            {
                $addFields: {
                    attendanceRate: {
                        $cond: [
                            { $eq: ["$totalClasses", 0] },
                            0,
                            {
                                $round: [
                                    {
                                        $multiply: [
                                            { $divide: ["$totalPresent", "$totalClasses"] },
                                            100
                                        ]
                                    },
                                    2
                                ]
                            }
                        ]
                    }
                }
            },
            {
                $project: {
                    _id: 0,
                    date: "$_id",
                    totalStudents: { $size: "$totalStudents" },
                    totalCourses: { $size: "$courses" },
                    totalClasses: 1,
                    totalPresent: 1,
                    totalAbsent: 1,
                    attendanceRate: 1
                }
            },
            {
                $sort: { date: 1 }
            }
        ]);

        res.json({
            success: true,
            message: 'Attendance summary by date generated successfully',
            data: report
        });
    } catch (error) {
        // console.error('Attendance summary error:', error);
        // res.status(500).json({
        //     success: false,
        //     message: 'Failed to generate attendance summary',
        //     error: error.message
        // });
    }
};


// MODIFY your existing getstudentreportaggregate controller function
exports.getstudentreportaggregate = async (req, res) => {
    try {
        const { user, colid } = req.query;

        // Calculate last 30 days
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - 30);

        const report = await attendancenew.aggregate([
            {
                $match: {
                    user: user,
                    colid: parseInt(colid)
                }
            },
            {
                $group: {
                    _id: {
                        student: "$student",
                        regno: "$regno"
                    },
                    courses: {
                        $addToSet: {
                            course: "$course",
                            coursecode: "$coursecode"
                        }
                    },
                    totalClasses: { $sum: 1 },
                    totalPresent: {
                        $sum: {
                            $cond: [{ $eq: ["$att", 1] }, 1, 0]
                        }
                    },
                    // NEW: Count unique days present in last 30 days
                    lastMonthDaysPresent: {
                        $addToSet: {
                            $cond: [
                                {
                                    $and: [
                                        { $eq: ["$att", 1] },
                                        { $gte: ["$classdate", startDate] },
                                        { $lte: ["$classdate", endDate] }
                                    ]
                                },
                                { $dateToString: { format: "%Y-%m-%d", date: "$classdate" } },
                                null
                            ]
                        }
                    }
                }
            },
            {
                $project: {
                    _id: 0,
                    student: "$_id.student",
                    regno: "$_id.regno",
                    totalCourses: { $size: "$courses" },
                    totalClasses: 1,
                    totalPresent: 1,
                    // NEW: Calculate actual days count
                    lastMonthDaysPresent: {
                        $size: {
                            $filter: {
                                input: "$lastMonthDaysPresent",
                                cond: { $ne: ["$$this", null] }
                            }
                        }
                    },
                    overallAttendancePercentage: {
                        $cond: [
                            { $eq: ["$totalClasses", 0] },
                            0,
                            {
                                $round: [
                                    {
                                        $multiply: [
                                            { $divide: ["$totalPresent", "$totalClasses"] },
                                            100
                                        ]
                                    },
                                    2
                                ]
                            }
                        ]
                    }
                }
            },
            {
                $sort: { student: 1 }
            }
        ]);

        res.json({
            success: true,
            message: 'Student report generated successfully',
            data: {
                students: report,
                summary: {
                    totalStudents: report.length,
                    reportPeriod: "Last 30 days"
                }
            }
        });
    } catch (error) {
        console.error('Student report error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to generate student report',
            error: error.message
        });
    }
};

// Add this NEW controller function
exports.getsinglestudentrport = async (req, res) => {
    try {
        const { user, colid, coursecode, regno } = req.query;

        // Calculate last 30 days
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - 30);

        // Get detailed attendance for this specific student
        const studentReport = await attendancenew.aggregate([
            {
                $match: {
                    user: user, // Faculty user
                    colid: parseInt(colid),
                    coursecode: coursecode,
                    regno: regno, // Specific student
                    classdate: {
                        $gte: startDate,
                        $lte: endDate
                    }
                }
            },
            {
                $group: {
                    _id: {
                        student: "$student",
                        regno: "$regno",
                        course: "$course",
                        coursecode: "$coursecode"
                    },
                    // Count unique days present
                    uniqueDaysPresent: {
                        $addToSet: {
                            $cond: [
                                { $eq: ["$att", 1] },
                                { $dateToString: { format: "%Y-%m-%d", date: "$classdate" } },
                                null
                            ]
                        }
                    },
                    totalClasses: { $sum: 1 },
                    totalPresent: {
                        $sum: {
                            $cond: [{ $eq: ["$att", 1] }, 1, 0]
                        }
                    },
                    totalAbsent: {
                        $sum: {
                            $cond: [{ $eq: ["$att", 0] }, 1, 0]
                        }
                    },
                    // Daily attendance details
                    dailyAttendance: {
                        $push: {
                            date: { $dateToString: { format: "%Y-%m-%d", date: "$classdate" } },
                            attendance: {
                                $cond: [{ $eq: ["$att", 1] }, "Present", "Absent"]
                            }
                        }
                    }
                }
            },
            {
                $project: {
                    _id: 0,
                    student: "$_id.student",
                    regno: "$_id.regno",
                    course: "$_id.course",
                    coursecode: "$_id.coursecode",
                    totalClasses: 1,
                    totalPresent: 1,
                    totalAbsent: 1,
                    // Count days present (filter out null values)
                    daysPresent: {
                        $size: {
                            $filter: {
                                input: "$uniqueDaysPresent",
                                cond: { $ne: ["$$this", null] }
                            }
                        }
                    },
                    attendancePercentage: {
                        $round: [
                            {
                                $multiply: [
                                    { $divide: ["$totalPresent", "$totalClasses"] },
                                    100
                                ]
                            },
                            2
                        ]
                    },
                    dailyAttendance: 1
                }
            }
        ]);

        if (studentReport.length === 0) {
            return res.json({
                success: false,
                message: 'No attendance data found for this student in the specified course and time period'
            });
        }

        res.json({
            success: true,
            message: 'Single student report generated successfully',
            data: {
                student: studentReport[0],
                period: {
                    startDate: startDate.toLocaleDateString(),
                    endDate: endDate.toLocaleDateString()
                }
            }
        });
    } catch (error) {
        // console.error('Single student report error:', error);
        // res.status(500).json({
        //     success: false,
        //     message: 'Failed to generate single student report',
        //     error: error.message
        // });
    }
};


const Attendancenew = require('../Models/attendancenew');
const Classenr1 = require('../Models/classenr1');
const Mfaccourses = require('../Models/mfaccourses');

const Testsubmissionds1 = require('../Models/testsubmissionds1');
const Testsessionds = require('../Models/testsessionds');
const Massignments = require('../Models/massignments');
const Massignsubmit = require('../Models/massignsubmit');


// Get Attendance Report - 75% threshold analysis
exports.getattendancereport = async (req, res) => {
  try {
    const { colid, user, year, coursecode } = req.query;

    if (!colid || !user) {
      return res.status(400).json({
        success: false,
        message: 'colid and user are required parameters'
      });
    }

    let matchCriteria = { 
      colid: parseInt(colid),
      user: user
    };
    
    if (year) matchCriteria.year = year;
    if (coursecode) matchCriteria.coursecode = coursecode;

    const attendanceReport = await Attendancenew.aggregate([
      { $match: matchCriteria },
      {
        $group: {
          _id: {
            regno: '$regno',
            student: '$student',
            course: '$course',
            coursecode: '$coursecode',
            program: '$program',
            year: '$year'
          },
          totalClasses: { $sum: 1 },
          classesAttended: { $sum: '$att' }
        }
      },
      {
        $project: {
          _id: 0,
          regno: '$_id.regno',
          student: '$_id.student',
          course: '$_id.course',
          coursecode: '$_id.coursecode',
          program: '$_id.program',
          year: '$_id.year',
          totalClasses: 1,
          classesAttended: 1,
          attendancePercentage: {
            $cond: [
              { $eq: ['$totalClasses', 0] },
              0,
              {
                $multiply: [
                  { $divide: ['$classesAttended', '$totalClasses'] },
                  100
                ]
              }
            ]
          }
        }
      },
      {
        $addFields: {
          status: {
            $cond: [
              { $gte: ['$attendancePercentage', 75] },
              'Above 75%',
              'Below 75%'
            ]
          },
          statusFlag: {
            $cond: [
              { $gte: ['$attendancePercentage', 75] },
              'pass',
              'fail'
            ]
          }
        }
      },
      { $sort: { attendancePercentage: -1 } }
    ]);

    res.status(200).json({
      success: true,
      count: attendanceReport.length,
      data: attendanceReport
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error generating attendance report',
      error: error.message
    });
  }
};

// Get Attendance Summary Statistics
exports.getattendancesummary = async (req, res) => {
  try {
    const { colid, user, year, coursecode } = req.query;

    if (!colid || !user) {
      return res.status(400).json({
        success: false,
        message: 'colid and user are required parameters'
      });
    }

    let matchCriteria = { 
      colid: parseInt(colid),
      user: user
    };
    
    if (year) matchCriteria.year = year;
    if (coursecode) matchCriteria.coursecode = coursecode;

    const summary = await Attendancenew.aggregate([
      { $match: matchCriteria },
      {
        $group: {
          _id: {
            regno: '$regno',
            student: '$student'
          },
          totalClasses: { $sum: 1 },
          classesAttended: { $sum: '$att' }
        }
      },
      {
        $project: {
          attendancePercentage: {
            $cond: [
              { $eq: ['$totalClasses', 0] },
              0,
              {
                $multiply: [
                  { $divide: ['$classesAttended', '$totalClasses'] },
                  100
                ]
              }
            ]
          }
        }
      },
      {
        $facet: {
          above75: [
            { $match: { attendancePercentage: { $gte: 75 } } },
            { $count: 'count' }
          ],
          below75: [
            { $match: { attendancePercentage: { $lt: 75 } } },
            { $count: 'count' }
          ],
          rangeDistribution: [
            {
              $bucket: {
                groupBy: '$attendancePercentage',
                boundaries: [0, 25, 50, 75, 90, 100],
                default: 'Other',
                output: {
                  count: { $sum: 1 },
                  students: { $push: '$_id' }
                }
              }
            }
          ],
          averageAttendance: [
            {
              $group: {
                _id: null,
                avgPercentage: { $avg: '$attendancePercentage' }
              }
            }
          ]
        }
      }
    ]);

    const result = {
      above75Count: summary[0].above75[0]?.count || 0,
      below75Count: summary[0].below75[0]?.count || 0,
      rangeDistribution: summary[0].rangeDistribution,
      averageAttendance: summary[0].averageAttendance[0]?.avgPercentage || 0
    };

    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error generating attendance summary',
      error: error.message
    });
  }
};

// Get Course-wise Attendance Report
exports.getcoursewiseattendance = async (req, res) => {
  try {
    const { colid, user, year, coursecode } = req.query;

    if (!colid || !user) {
      return res.status(400).json({
        success: false,
        message: 'colid and user are required parameters'
      });
    }

    let matchCriteria = { 
      colid: parseInt(colid),
      user: user
    };
    
    if (year) matchCriteria.year = year;
    if (coursecode) matchCriteria.coursecode = coursecode;

    const courseReport = await Attendancenew.aggregate([
      { $match: matchCriteria },
      {
        $group: {
          _id: {
            course: '$course',
            coursecode: '$coursecode',
            regno: '$regno'
          },
          totalClasses: { $sum: 1 },
          classesAttended: { $sum: '$att' }
        }
      },
      {
        $project: {
          attendancePercentage: {
            $cond: [
              { $eq: ['$totalClasses', 0] },
              0,
              {
                $multiply: [
                  { $divide: ['$classesAttended', '$totalClasses'] },
                  100
                ]
              }
            ]
          }
        }
      },
      {
        $group: {
          _id: {
            course: '$_id.course',
            coursecode: '$_id.coursecode'
          },
          totalStudents: { $sum: 1 },
          avgAttendance: { $avg: '$attendancePercentage' },
          above75: {
            $sum: {
              $cond: [{ $gte: ['$attendancePercentage', 75] }, 1, 0]
            }
          },
          below75: {
            $sum: {
              $cond: [{ $lt: ['$attendancePercentage', 75] }, 1, 0]
            }
          }
        }
      },
      {
        $project: {
          _id: 0,
          course: '$_id.course',
          coursecode: '$_id.coursecode',
          totalStudents: 1,
          avgAttendance: { $round: ['$avgAttendance', 2] },
          above75Count: '$above75',
          below75Count: '$below75',
          above75Percentage: {
            $round: [
              {
                $multiply: [
                  { $divide: ['$above75', '$totalStudents'] },
                  100
                ]
              },
              2
            ]
          }
        }
      },
      { $sort: { avgAttendance: -1 } }
    ]);

    res.status(200).json({
      success: true,
      count: courseReport.length,
      data: courseReport
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error generating course-wise attendance report',
      error: error.message
    });
  }
};

// Get Enrollment Report
exports.getenrollmentreport = async (req, res) => {
  try {
    const { colid, user, year, coursecode, coursetype } = req.query;

    if (!colid || !user) {
      return res.status(400).json({
        success: false,
        message: 'colid and user are required parameters'
      });
    }

    let matchCriteria = { 
      colid: parseInt(colid),
      user: user
    };
    
    if (year) matchCriteria.year = year;
    if (coursecode) matchCriteria.coursecode = coursecode;
    if (coursetype) matchCriteria.coursetype = coursetype;

    const enrollmentReport = await Classenr1.aggregate([
      { $match: matchCriteria },
      {
        $group: {
          _id: {
            course: '$course',
            coursecode: '$coursecode',
            coursetype: '$coursetype',
            program: '$program'
          },
          totalEnrolled: { $sum: 1 },
          activeStudents: {
            $sum: { $cond: [{ $eq: ['$active', 'Yes'] }, 1, 0] }
          },
          inactiveStudents: {
            $sum: { $cond: [{ $eq: ['$active', 'No'] }, 1, 0] }
          },
          maleCount: {
            $sum: { $cond: [{ $eq: ['$gender', 'Male'] }, 1, 0] }
          },
          femaleCount: {
            $sum: { $cond: [{ $eq: ['$gender', 'Female'] }, 1, 0] }
          },
          students: {
            $push: {
              student: '$student',
              regno: '$regno',
              gender: '$gender',
              learning: '$learning',
              active: '$active'
            }
          }
        }
      },
      {
        $project: {
          _id: 0,
          course: '$_id.course',
          coursecode: '$_id.coursecode',
          coursetype: '$_id.coursetype',
          program: '$_id.program',
          totalEnrolled: 1,
          activeStudents: 1,
          inactiveStudents: 1,
          maleCount: 1,
          femaleCount: 1,
          students: 1
        }
      },
      { $sort: { totalEnrolled: -1 } }
    ]);

    res.status(200).json({
      success: true,
      count: enrollmentReport.length,
      data: enrollmentReport
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error generating enrollment report',
      error: error.message
    });
  }
};

// Get Program-wise Enrollment Summary
exports.getprogramenrollmentsummary = async (req, res) => {
  try {
    const { colid, user, year } = req.query;

    if (!colid || !user) {
      return res.status(400).json({
        success: false,
        message: 'colid and user are required parameters'
      });
    }

    let matchCriteria = { 
      colid: parseInt(colid),
      user: user
    };
    
    if (year) matchCriteria.year = year;

    const programSummary = await Classenr1.aggregate([
      { $match: matchCriteria },
      {
        $group: {
          _id: {
            program: '$program',
            programcode: '$programcode',
            coursetype: '$coursetype'
          },
          totalStudents: { $sum: 1 },
          uniqueStudents: { $addToSet: '$regno' }
        }
      },
      {
        $project: {
          _id: 0,
          program: '$_id.program',
          programcode: '$_id.programcode',
          coursetype: '$_id.coursetype',
          totalEnrollments: '$totalStudents',
          uniqueStudentCount: { $size: '$uniqueStudents' }
        }
      },
      { $sort: { totalEnrollments: -1 } }
    ]);

    res.status(200).json({
      success: true,
      count: programSummary.length,
      data: programSummary
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error generating program enrollment summary',
      error: error.message
    });
  }
};

// Get Student-wise Complete Report
exports.getstudentcompletereport = async (req, res) => {
  try {
    const { colid, user, regno, year } = req.query;

    if (!colid || !user || !regno) {
      return res.status(400).json({
        success: false,
        message: 'colid, user, and regno are required parameters'
      });
    }

    let matchCriteria = { 
      colid: parseInt(colid), 
      user: user,
      regno: regno
    };
    
    if (year) matchCriteria.year = year;

    const enrollments = await Classenr1.find(matchCriteria).lean();

    const attendanceData = await Attendancenew.aggregate([
      { $match: matchCriteria },
      {
        $group: {
          _id: {
            course: '$course',
            coursecode: '$coursecode'
          },
          totalClasses: { $sum: 1 },
          classesAttended: { $sum: '$att' }
        }
      },
      {
        $project: {
          _id: 0,
          course: '$_id.course',
          coursecode: '$_id.coursecode',
          totalClasses: 1,
          classesAttended: 1,
          attendancePercentage: {
            $round: [
              {
                $multiply: [
                  { $divide: ['$classesAttended', '$totalClasses'] },
                  100
                ]
              },
              2
            ]
          },
          status: {
            $cond: [
              {
                $gte: [
                  {
                    $multiply: [
                      { $divide: ['$classesAttended', '$totalClasses'] },
                      100
                    ]
                  },
                  75
                ]
              },
              'Above 75%',
              'Below 75%'
            ]
          }
        }
      }
    ]);

    res.status(200).json({
      success: true,
      data: {
        studentInfo: enrollments[0] || {},
        enrollments: enrollments,
        attendance: attendanceData
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error generating student report',
      error: error.message
    });
  }
};

// Get Coursetype Distribution Report (Regular, Advance, Remedial)
exports.getcoursetypedistribution = async (req, res) => {
  try {
    const { colid, user, year } = req.query;

    if (!colid || !user) {
      return res.status(400).json({
        success: false,
        message: 'colid and user are required parameters'
      });
    }

    let matchCriteria = { 
      colid: parseInt(colid),
      user: user
    };
    
    if (year) matchCriteria.year = year;

    const distribution = await Classenr1.aggregate([
      { $match: matchCriteria },
      {
        $group: {
          _id: '$coursetype',
          totalEnrollments: { $sum: 1 },
          uniqueStudents: { $addToSet: '$regno' },
          courses: { $addToSet: '$course' }
        }
      },
      {
        $project: {
          _id: 0,
          coursetype: '$_id',
          totalEnrollments: 1,
          uniqueStudentCount: { $size: '$uniqueStudents' },
          courseCount: { $size: '$courses' }
        }
      },
      { $sort: { totalEnrollments: -1 } }
    ]);

    res.status(200).json({
      success: true,
      data: distribution
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error generating coursetype distribution',
      error: error.message
    });
  }
};

// Get Date-wise Attendance Trend
exports.getattendancetrend = async (req, res) => {
  try {
    const { colid, user, year, coursecode, startDate, endDate } = req.query;

    if (!colid || !user) {
      return res.status(400).json({
        success: false,
        message: 'colid and user are required parameters'
      });
    }

    let matchCriteria = { 
      colid: parseInt(colid),
      user: user
    };
    
    if (year) matchCriteria.year = year;
    if (coursecode) matchCriteria.coursecode = coursecode;
    if (startDate && endDate) {
      matchCriteria.classdate = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }

    const trend = await Attendancenew.aggregate([
      { $match: matchCriteria },
      {
        $group: {
          _id: {
            date: {
              $dateToString: { format: '%Y-%m-%d', date: '$classdate' }
            },
            course: '$course'
          },
          totalStudents: { $sum: 1 },
          presentCount: { $sum: '$att' }
        }
      },
      {
        $project: {
          _id: 0,
          date: '$_id.date',
          course: '$_id.course',
          totalStudents: 1,
          presentCount: 1,
          absentCount: { $subtract: ['$totalStudents', '$presentCount'] },
          attendanceRate: {
            $round: [
              {
                $multiply: [
                  { $divide: ['$presentCount', '$totalStudents'] },
                  100
                ]
              },
              2
            ]
          }
        }
      },
      { $sort: { date: 1 } }
    ]);

    res.status(200).json({
      success: true,
      count: trend.length,
      data: trend
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error generating attendance trend',
      error: error.message
    });
  }
};

// Get Assignment Report
exports.getassignmentreport = async (req, res) => {
  try {
    const { colid, user, year, coursecode } = req.query;

    if (!colid || !user) {
      return res.status(400).json({
        success: false,
        message: 'colid and user are required parameters'
      });
    }

    let matchCriteria = { 
      colid: parseInt(colid),
      user: user
    };
    
    if (year) matchCriteria.year = year;
    if (coursecode) matchCriteria.coursecode = coursecode;

    const assignmentReport = await Massignments.aggregate([
      { $match: matchCriteria },
      {
        $lookup: {
          from: 'massignsubmits',
          let: { assignmentName: '$assignment', assignmentYear: '$year', assignmentCourse: '$coursecode' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$assignment', '$$assignmentName'] },
                    { $eq: ['$year', '$$assignmentYear'] },
                    { $eq: ['$coursecode', '$$assignmentCourse'] },
                    { $eq: ['$colid', parseInt(colid)] }
                  ]
                }
              }
            }
          ],
          as: 'submissions'
        }
      },
      {
        $addFields: {
          totalSubmissions: { $size: '$submissions' },
          submittedStudents: { $size: { $setUnion: ['$submissions.regno', []] } }
        }
      },
      {
        $lookup: {
          from: 'classenr1s',
          let: { courseCode: '$coursecode', courseYear: '$year' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$coursecode', '$$courseCode'] },
                    { $eq: ['$year', '$$courseYear'] },
                    { $eq: ['$colid', parseInt(colid)] }
                  ]
                }
              }
            },
            { $group: { _id: null, totalEnrolled: { $sum: 1 } } }
          ],
          as: 'enrollmentData'
        }
      },
      {
        $addFields: {
          totalEnrolled: { $ifNull: [{ $arrayElemAt: ['$enrollmentData.totalEnrolled', 0] }, 0] },
          pendingSubmissions: {
            $subtract: [
              { $ifNull: [{ $arrayElemAt: ['$enrollmentData.totalEnrolled', 0] }, 0] },
              '$submittedStudents'
            ]
          },
          submissionRate: {
            $cond: [
              { $gt: [{ $arrayElemAt: ['$enrollmentData.totalEnrolled', 0] }, 0] },
              {
                $multiply: [
                  {
                    $divide: [
                      '$submittedStudents',
                      { $arrayElemAt: ['$enrollmentData.totalEnrolled', 0] }
                    ]
                  },
                  100
                ]
              },
              0
            ]
          }
        }
      },
      {
        $project: {
          _id: 0,
          assignment: 1,
          course: 1,
          coursecode: 1,
          year: 1,
          description: 1,
          duedate: 1,
          type: 1,
          totalEnrolled: 1,
          totalSubmissions: 1,
          submittedStudents: 1,
          pendingSubmissions: 1,
          submissionRate: { $round: ['$submissionRate', 2] },
          status1: 1
        }
      },
      { $sort: { duedate: -1 } }
    ]);

    res.status(200).json({
      success: true,
      count: assignmentReport.length,
      data: assignmentReport
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error generating assignment report',
      error: error.message
    });
  }
};

// Get Assignment Submission Details
exports.getassignmentsubmissions = async (req, res) => {
  try {
    const { colid, user, year, coursecode, assignment } = req.query;

    if (!colid || !user) {
      return res.status(400).json({
        success: false,
        message: 'colid and user are required parameters'
      });
    }

    let matchCriteria = { 
      colid: parseInt(colid),
      user: user
    };
    
    if (year) matchCriteria.year = year;
    if (coursecode) matchCriteria.coursecode = coursecode;
    if (assignment) matchCriteria.assignment = assignment;

    const submissions = await Massignsubmit.aggregate([
      { $match: matchCriteria },
      {
        $project: {
          _id: 0,
          student: 1,
          regno: 1,
          assignment: 1,
          course: 1,
          coursecode: 1,
          year: 1,
          submitdate: 1,
          description: 1,
          doclink: 1,
          ascomments: 1,
          status1: 1
        }
      },
      { $sort: { submitdate: -1 } }
    ]);

    res.status(200).json({
      success: true,
      count: submissions.length,
      data: submissions
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching assignment submissions',
      error: error.message
    });
  }
};

// Get Assignment Summary Statistics
exports.getassignmentsummary = async (req, res) => {
  try {
    const { colid, user, year, coursecode } = req.query;

    if (!colid || !user) {
      return res.status(400).json({
        success: false,
        message: 'colid and user are required parameters'
      });
    }

    let matchCriteria = { 
      colid: parseInt(colid),
      user: user
    };
    
    if (year) matchCriteria.year = year;
    if (coursecode) matchCriteria.coursecode = coursecode;

    const summary = await Massignments.aggregate([
      { $match: matchCriteria },
      {
        $facet: {
          totalAssignments: [{ $count: 'count' }],
          byType: [
            {
              $group: {
                _id: '$type',
                count: { $sum: 1 }
              }
            }
          ],
          upcomingDeadlines: [
            {
              $match: {
                duedate: { $gte: new Date() }
              }
            },
            { $count: 'count' }
          ],
          overdueAssignments: [
            {
              $match: {
                duedate: { $lt: new Date() }
              }
            },
            { $count: 'count' }
          ]
        }
      }
    ]);

    const result = {
      totalAssignments: summary[0].totalAssignments[0]?.count || 0,
      byType: summary[0].byType,
      upcomingDeadlines: summary[0].upcomingDeadlines[0]?.count || 0,
      overdueAssignments: summary[0].overdueAssignments[0]?.count || 0
    };

    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error generating assignment summary',
      error: error.message
    });
  }
};

// ==================== TEST REPORTS ====================

// Get Test Report
exports.gettestreport = async (req, res) => {
  try {
    const { colid, user, year, coursecode } = req.query;

    if (!colid || !user) {
      return res.status(400).json({
        success: false,
        message: 'colid and user are required parameters'
      });
    }

    let matchCriteria = { 
      colid: parseInt(colid)
    };
    
    // Note: testsubmissionds1 doesn't have year/coursecode directly
    // We need to match via classid which should contain this info
    // or we can filter after aggregation

    const testReport = await Testsubmissionds1.aggregate([
      { $match: matchCriteria },
      {
        $group: {
          _id: {
            testid: '$testid',
            testtitle: '$testtitle',
            classid: '$classid'
          },
          totalSubmissions: { $sum: 1 },
          avgScore: { $avg: '$totalscore' },
          avgPercentage: { $avg: '$percentage' },
          passedCount: {
            $sum: { $cond: ['$passed', 1, 0] }
          },
          failedCount: {
            $sum: { $cond: ['$passed', 0, 1] }
          },
          highestScore: { $max: '$totalscore' },
          lowestScore: { $min: '$totalscore' },
          submittedCount: {
            $sum: {
              $cond: [
                { $in: ['$status', ['submitted', 'auto-submitted', 'graded']] },
                1,
                0
              ]
            }
          },
          inProgressCount: {
            $sum: {
              $cond: [
                { $in: ['$status', ['started', 'in-progress']] },
                1,
                0
              ]
            }
          }
        }
      },
      {
        $project: {
          _id: 0,
          testid: '$_id.testid',
          testtitle: '$_id.testtitle',
          classid: '$_id.classid',
          totalSubmissions: 1,
          avgScore: { $round: ['$avgScore', 2] },
          avgPercentage: { $round: ['$avgPercentage', 2] },
          passedCount: 1,
          failedCount: 1,
          passRate: {
            $round: [
              {
                $multiply: [
                  { $divide: ['$passedCount', '$totalSubmissions'] },
                  100
                ]
              },
              2
            ]
          },
          highestScore: 1,
          lowestScore: 1,
          submittedCount: 1,
          inProgressCount: 1
        }
      },
      { $sort: { avgPercentage: -1 } }
    ]);

    res.status(200).json({
      success: true,
      count: testReport.length,
      data: testReport
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error generating test report',
      error: error.message
    });
  }
};

// Get Test Submission Details by Test ID
exports.gettestsubmissions = async (req, res) => {
  try {
    const { colid, user, testid } = req.query;

    if (!colid || !user) {
      return res.status(400).json({
        success: false,
        message: 'colid and user are required parameters'
      });
    }

    let matchCriteria = { 
      colid: parseInt(colid)
    };
    
    if (testid) matchCriteria.testid = testid;

    const submissions = await Testsubmissionds1.aggregate([
      { $match: matchCriteria },
      {
        $project: {
          _id: 0,
          name: 1,
          studentid: 1,
          testtitle: 1,
          testid: 1,
          starttime: 1,
          endtime: 1,
          totalscore: 1,
          percentage: 1,
          grade: 1,
          passed: 1,
          status: 1,
          tabswitches: 1,
          suspiciousactivity: 1,
          submissiondate: 1
        }
      },
      { $sort: { percentage: -1 } }
    ]);

    res.status(200).json({
      success: true,
      count: submissions.length,
      data: submissions
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching test submissions',
      error: error.message
    });
  }
};

// Get Test Summary Statistics
exports.gettestsummary = async (req, res) => {
  try {
    const { colid, user } = req.query;

    if (!colid || !user) {
      return res.status(400).json({
        success: false,
        message: 'colid and user are required parameters'
      });
    }

    const matchCriteria = { colid: parseInt(colid) };

    const summary = await Testsubmissionds1.aggregate([
      { $match: matchCriteria },
      {
        $facet: {
          totalTests: [
            { $group: { _id: '$testid' } },
            { $count: 'count' }
          ],
          totalSubmissions: [{ $count: 'count' }],
          averagePerformance: [
            {
              $group: {
                _id: null,
                avgPercentage: { $avg: '$percentage' },
                avgScore: { $avg: '$totalscore' }
              }
            }
          ],
          passFailDistribution: [
            {
              $group: {
                _id: '$passed',
                count: { $sum: 1 }
              }
            }
          ],
          statusDistribution: [
            {
              $group: {
                _id: '$status',
                count: { $sum: 1 }
              }
            }
          ],
          suspiciousActivity: [
            {
              $match: { suspiciousactivity: true }
            },
            { $count: 'count' }
          ]
        }
      }
    ]);

    const result = {
      totalTests: summary[0].totalTests[0]?.count || 0,
      totalSubmissions: summary[0].totalSubmissions[0]?.count || 0,
      avgPercentage: summary[0].averagePerformance[0]?.avgPercentage || 0,
      avgScore: summary[0].averagePerformance[0]?.avgScore || 0,
      passFailDistribution: summary[0].passFailDistribution,
      statusDistribution: summary[0].statusDistribution,
      suspiciousActivityCount: summary[0].suspiciousActivity[0]?.count || 0
    };

    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error generating test summary',
      error: error.message
    });
  }
};

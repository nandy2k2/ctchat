const mongoose = require('mongoose');

// Answer schema
const answerschema = new mongoose.Schema({
    questionnumber: {
        type: Number,
        required: [true, 'Please enter question number']
    },
    selectedanswer: {
        type: String
    },
    iscorrect: {
        type: Boolean,
        default: false
    },
    points: {
        type: Number,
        default: 0
    },
    timespent: {
        type: Number,
        default: 0
    }
});

// Test submission schema
const testsubmissionschema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Please enter student name']
    },
    user: {
        type: String,
        required: [true, 'Please enter student user'],
        unique: false
    },
    testid: {
        type: String,
        required: [true, 'Please enter test id']
    },
    studentid: {
        type: String,
        required: [true, 'Please enter student id']
    },
    classid: {
        type: String,
        required: [true, 'Please enter class id']
    },
    colid: {
        type: Number,
        required: [true, 'Please enter colid']
    },
    testtitle: {
        type: String,
        required: [true, 'Please enter test title']
    },
    starttime: {
        type: Date,
        required: [true, 'Please enter start time']
    },
    endtime: {
        type: Date
    },
    timeremaining: {
        type: Number,
        default: 0
    },
    answers: [answerschema],
    totalscore: {
        type: Number,
        default: 0
    },
    percentage: {
        type: Number,
        default: 0
    },
    grade: {
        type: String
    },
    passed: {
        type: Boolean,
        default: false
    },
    status: {
        type: String,
        enum: ['started', 'in-progress', 'submitted', 'auto-submitted', 'graded'],
        default: 'started'
    },
    tabswitches: {
        type: Number,
        default: 0
    },
    warnings: [String],
    suspiciousactivity: {
        type: Boolean,
        default: false
    },
    submissiondate: {
        type: Date
    },
    createdat: {
        type: Date,
        default: Date.now
    },
    updatedat: {
        type: Date,
        default: Date.now
    }
});

const testsubmissionds = mongoose.model('testsubmissionds', testsubmissionschema);
module.exports = testsubmissionds;

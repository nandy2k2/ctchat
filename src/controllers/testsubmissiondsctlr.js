const testsubmissionds = require('../Models/testsubmissionds');
const testds = require('../Models/testds');

// Create or Update Test Submission
exports.createtestsubmissionds = async (req, res) => {
    try {
        const {
            name, user, testid, studentid, classid, colid, testtitle,
            starttime, endtime, timeremaining, answers, totalscore,
            percentage, grade, passed, status, tabswitches, warnings,
            suspiciousactivity, submissiondate
        } = req.body;

        const filter = { testid, studentid, colid };
        const update = {
            name, user, testid, studentid, classid, colid, testtitle,
            starttime, endtime, timeremaining, answers, totalscore,
            percentage, grade, passed, status, tabswitches, warnings,
            suspiciousactivity, submissiondate,
            updatedat: new Date()
        };

        const submission = await testsubmissionds.findOneAndUpdate(filter, update, {
            new: true,
            upsert: true,
            setDefaultsOnInsert: true
        });

        res.status(200).json({
            success: true,
            data: submission,
            message: "Test submission created/updated successfully"
        });
    } catch (error) {
        // res.status(400).json({
        //     success: false,
        //     message: error.message
        // });
    }
};

// Get Test Submissions by user
exports.gettestsubmissionsbyuser = async (req, res) => {
    try {
        const { colid, user } = req.query;
        const submissions = await testsubmissionds.find({ 
            colid: parseInt(colid),
            user: user
        }).sort({ createdat: -1 });
        
        res.status(200).json({
            success: true,
            count: submissions.length,
            data: submissions
        });
    } catch (error) {
        // res.status(400).json({
        //     success: false,
        //     message: error.message
        // });
    }
};

// Get Test Submissions by testid
exports.gettestsubmissionsbytest = async (req, res) => {
    try {
        const { testid, colid } = req.query;
        const submissions = await testsubmissionds.find({ 
            testid: testid, 
            colid: parseInt(colid) 
        }).sort({ createdat: -1 });
        
        res.status(200).json({
            success: true,
            count: submissions.length,
            data: submissions
        });
    } catch (error) {
        // res.status(400).json({
        //     success: false,
        //     message: error.message
        // });
    }
};

// Start Test Session
exports.starttestds = async (req, res) => {
    try {
        const { testid, studentid, colid, name, user, classid } = req.body;
        
        // Check if test exists and is published
        const test = await testds.findOne({ 
            _id: testid, 
            colid: parseInt(colid),
            ispublished: true 
        });
        
        if (!test) {
            return res.status(404).json({
                success: false,
                message: "Test not found or not published"
            });
        }
        
        // Check if test is within time limits
        const now = new Date();
        if (now < test.starttime || now > test.endtime) {
            return res.status(400).json({
                success: false,
                message: "Test is not available at this time"
            });
        }
        
        // Check if student has already attempted
        const existingSubmission = await testsubmissionds.findOne({ 
            testid, 
            studentid, 
            colid: parseInt(colid) 
        });
        
        if (existingSubmission && !test.allowretake) {
            return res.status(400).json({
                success: false,
                message: "Test already attempted"
            });
        }
        
        const filter = { testid, studentid, colid: parseInt(colid) };
        const update = {
            name, user, testid, studentid, classid, colid: parseInt(colid),
            testtitle: test.testtitle,
            starttime: new Date(),
            status: 'started',
            timeremaining: test.duration * 60, // convert to seconds
            createdat: new Date(),
            updatedat: new Date()
        };

        const submission = await testsubmissionds.findOneAndUpdate(filter, update, {
            new: true,
            upsert: true,
            setDefaultsOnInsert: true
        });

        res.status(200).json({
            success: true,
            data: submission,
            test: test,
            message: "Test session started successfully"
        });
    } catch (error) {
        // res.status(400).json({
        //     success: false,
        //     message: error.message
        // });
    }
};

// Submit Answer
exports.submitanswerds = async (req, res) => {
    try {
        const { testid, studentid, colid, questionnumber, selectedanswer, timespent } = req.body;
        
        const submission = await testsubmissionds.findOne({ 
            testid, 
            studentid, 
            colid: parseInt(colid) 
        });
        
        if (!submission) {
            return res.status(404).json({
                success: false,
                message: "Test session not found"
            });
        }
        
        // Find and update the specific answer
        const answerIndex = submission.answers.findIndex(a => a.questionnumber === questionnumber);
        const answerData = {
            questionnumber,
            selectedanswer,
            timespent,
            iscorrect: false, // Will be calculated during grading
            points: 0
        };
        
        if (answerIndex >= 0) {
            submission.answers[answerIndex] = answerData;
        } else {
            submission.answers.push(answerData);
        }
        
        submission.status = 'in-progress';
        submission.updatedat = new Date();
        await submission.save();

        res.status(200).json({
            success: true,
            data: submission,
            message: "Answer submitted successfully"
        });
    } catch (error) {
        // res.status(400).json({
        //     success: false,
        //     message: error.message
        // });
    }
};

// Submit Complete Test
exports.submittestds = async (req, res) => {
    try {
        const { testid, studentid, colid } = req.body;
        
        const submission = await testsubmissionds.findOne({ 
            testid, 
            studentid, 
            colid: parseInt(colid) 
        });
        
        if (!submission) {
            return res.status(404).json({
                success: false,
                message: "Test session not found"
            });
        }
        
        const test = await testds.findById(testid);
        if (!test) {
            return res.status(404).json({
                success: false,
                message: "Test not found"
            });
        }
        
        // Grade the test
        let totalscore = 0;
        submission.answers.forEach(answer => {
            const question = test.questions.find(q => q.questionnumber === answer.questionnumber);
            if (question && question.correctanswer === answer.selectedanswer) {
                answer.iscorrect = true;
                answer.points = question.points || 1;
                totalscore += answer.points;
            }
        });
        
        const maxscore = test.questions.reduce((sum, q) => sum + (q.points || 1), 0);
        const percentage = (totalscore / maxscore) * 100;
        
        submission.totalscore = totalscore;
        submission.percentage = percentage;
        submission.passed = percentage >= test.passingscore;
        submission.grade = percentage >= 90 ? 'A' : 
                          percentage >= 80 ? 'B' : 
                          percentage >= 70 ? 'C' : 
                          percentage >= 60 ? 'D' : 'F';
        submission.status = 'submitted';
        submission.endtime = new Date();
        submission.submissiondate = new Date();
        submission.updatedat = new Date();
        
        await submission.save();
        
        // Update test statistics
        test.totalattempts += 1;
        const allSubmissions = await testsubmissionds.find({ testid });
        const scores = allSubmissions.map(s => s.totalscore);
        test.averagescore = scores.reduce((a, b) => a + b, 0) / scores.length;
        test.maxscore = Math.max(...scores);
        test.minscore = Math.min(...scores);
        await test.save();

        res.status(200).json({
            success: true,
            data: submission,
            message: "Test submitted successfully"
        });
    } catch (error) {
        
    }
};

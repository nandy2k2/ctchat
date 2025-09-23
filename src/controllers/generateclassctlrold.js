const classnew = require('../Models/classnew');
const testds1 = require('../Models/testds1');
const gptapikeyds = require('../Models/gptapikeyds');
const mongoose = require('mongoose');

// ✅ SIMPLE: Call Gemini AI with retry
async function callAI(prompt, retries = 2) {
  const apiKeyData = await gptapikeyds.findOne({ isactive: true }).sort({ createdat: -1 });
  if (!apiKeyData) throw new Error('No API key found');

  const { GoogleGenerativeAI } = require('@google/generative-ai');
  const genAI = new GoogleGenerativeAI(apiKeyData.personalapikey || apiKeyData.defaultapikey);
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

  for (let i = 0; i <= retries; i++) {
    try {
      const result = await model.generateContent(prompt);
      await gptapikeyds.findByIdAndUpdate(apiKeyData._id, { $inc: { currentusage: 20 } });
      return result.response.text();
    } catch (error) {
      if (i === retries || ![503, 429, 500].includes(error.status)) throw error;
      await new Promise(r => setTimeout(r, 2000 * Math.pow(2, i)));
    }
  }
}

// ✅ SIMPLE: Generate topics only
async function generateTopics(course, totalClasses) {
  const prompt = `Generate exactly ${totalClasses} topics for "${course}". Format as numbered list:
1. Topic 1
2. Topic 2
...`;
  
  const response = await callAI(prompt);
  return response.split('\n')
    .filter(line => line.match(/^\d+\./))
    .map(line => line.replace(/^\d+\.\s*/, '').trim())
    .slice(0, totalClasses);
}

// ✅ SIMPLE: Generate questions for specific topics
async function generateQuestions(course, topics, count) {
  const prompt = `Generate ${count} multiple choice questions for "${course}" covering: ${topics.join(', ')}.
Return only JSON array:
[{"question":"...","optiona":"...","optionb":"...","optionc":"...","optiond":"...","correctanswer":"A","difficulty":"medium","coverTopic":"..."}]`;

  const response = await callAI(prompt);
  const jsonMatch = response.match(/\[.*\]/s);
  if (!jsonMatch) return [];
  
  try {
    const questions = JSON.parse(jsonMatch[0]);
    return questions.map((q, i) => ({
      questionnumber: i + 1,
      question: q.question,
      questiontype: 'multiple-choice',
      optiona: q.optiona,
      optionb: q.optionb,
      optionc: q.optionc,
      optiond: q.optiond,
      correctanswer: q.correctanswer || 'A',
      explanation: q.explanation || '',
      difficulty: q.difficulty || 'medium',
      points: 1,
      isgenerated: true,
      coverTopic: q.coverTopic || topics[0]
    }));
  } catch {
    return [];
  }
}

// ✅ MAIN: Generate class schedule (simplified)
exports.generateclassschedule = async (req, res) => {
  try {
    const { course, coursecode, startDate, totalHours, selectedDays, user, colid, name, program, programcode, semester, section } = req.body;

    if (!course || !totalHours || !selectedDays?.length || !startDate) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields'
      });
    }

    // ✅ STEP 1: Generate topics with AI
    const topics = await generateTopics(course, parseInt(totalHours));
    if (topics.length === 0) {
      return res.status(422).json({
        success: false,
        message: 'AI failed to generate topics',
        cannotComplete: true
      });
    }

    // ✅ STEP 2: Send data to frontend for processing
    res.json({
      success: true,
      message: 'Topics generated successfully',
      data: {
        course,
        coursecode,
        topics,
        startDate,
        totalHours: parseInt(totalHours),
        selectedDays,
        user,
        colid,
        name,
        program,
        programcode,
        semester,
        section
      },
      nextStep: 'frontend_processing'
    });

  } catch (error) {
    // console.error('Topic generation error:', error);
    // res.status(422).json({
    //   success: false,
    //   message: 'Cannot generate topics',
    //   error: error.message,
    //   cannotComplete: true
    // });
  }
};

// ✅ NEW: Save classes and generate assessments (called from frontend)
exports.saveClassesAndAssessments = async (req, res) => {
  try {
    const { classes, assessmentRequests } = req.body;

    // ✅ STEP 1: Bulk insert classes
    const savedClasses = await classnew.insertMany(classes);

    // ✅ STEP 2: Generate assessments using aggregation
    const assessments = [];
    
    for (const request of assessmentRequests) {
      const { topics, questionCount, testDate, course, coursecode, user, colid, name } = request;
      
      if (topics.length === 0) continue;

      try {
        const questions = await generateQuestions(course, topics, questionCount);
        if (questions.length === 0) continue;

        assessments.push({
          name: name,
          user,
          colid: parseInt(colid),
          classid: new mongoose.Types.ObjectId(),
          course,
          coursecode,
          testtitle: `${course} - AI Assessment (${new Date(testDate).toLocaleDateString()})`,
          description: `AI assessment with ${questions.length} questions`,
          topic: course,
          scheduleddate: new Date(testDate),
          starttime: new Date(new Date(testDate).getTime() + (9 * 60 * 60 * 1000)),
          endtime: new Date(new Date(testDate).getTime() + (11 * 60 * 60 * 1000)),
          duration: Math.max(60, questions.length * 2),
          totalnoofquestion: questions.length,
          questions,
          sectionBased: false,
          sections: [],
          shufflequestions: true,
          showresultsimmediately: false,
          allowretake: false,
          passingscore: 50,
          timelimit: true,
          proctoringmode: false,
          calculatorallowed: false,
          formulasheetallowed: false,
          instructions: `${questions.length} AI-generated questions`,
          rules: ["Complete within time limit", "One correct answer per question"],
          status: 'draft',
          ispublished: false,
          createdat: new Date(),
        });
      } catch (error) {
        console.error('Assessment generation error:', error);
        continue;
      }
    }

    // ✅ STEP 3: Save assessments
    let savedAssessments = [];
    if (assessments.length > 0) {
      savedAssessments = await testds1.insertMany(assessments);
    }

    res.json({
      success: true,
      message: 'Classes and assessments created successfully',
      totalClasses: savedClasses.length,
      totalAssessments: savedAssessments.length,
      data: {
        classes: savedClasses,
        assessments: savedAssessments
      }
    });

  } catch (error) {
    // console.error('Save error:', error);
    // res.status(500).json({
    //   success: false,
    //   message: 'Failed to save classes and assessments',
    //   error: error.message
    // });
  }
};

// ✅ AGGREGATION: Get topics covered up to date (used by frontend)
exports.getTopicsCoveredUpToDate = async (req, res) => {
  try {
    const { course, coursecode, testDate, user, colid } = req.query;

    const pipeline = [
      {
        $match: {
          user,
          colid: parseInt(colid),
          classdate: { $lte: new Date(testDate) },
          topic: { $exists: true, $ne: '', $ne: null },
          $or: [
            { course },
            { coursecode },
            { course: { $regex: course, $options: 'i' } },
            { coursecode: { $regex: coursecode, $options: 'i' } }
          ]
        }
      },
      {
        $group: {
          _id: null,
          topics: { $addToSet: '$topic' },
          totalClasses: { $sum: 1 }
        }
      },
      {
        $project: {
          _id: 0,
          topics: 1,
          totalClasses: 1
        }
      }
    ];

    const result = await classnew.aggregate(pipeline);
    const topics = result[0]?.topics || [];

    res.json({
      success: true,
      data: {
        topics,
        totalClasses: result[0]?.totalClasses || 0,
        upToDate: new Date(testDate).toLocaleDateString()
      }
    });

  } catch (error) {
    // console.error('Topics aggregation error:', error);
    // res.status(500).json({
    //   success: false,
    //   message: 'Failed to get topics',
    //   error: error.message
    // });
  }
};

// ✅ SIMPLE: Confirm schedule (no changes needed)
exports.confirmclassschedule = async (req, res) => {
  try {
    const { confirmed, classes, assessments } = req.body;

    if (!confirmed) {
      return res.json({ success: true, message: 'Cancelled' });
    }

    const savedClasses = await classnew.insertMany(classes);
    const savedAssessments = await testds1.insertMany(assessments);

    res.json({
      success: true,
      message: 'Schedule confirmed',
      data: { classes: savedClasses, assessments: savedAssessments }
    });

  } catch (error) {
    // res.status(500).json({
    //   success: false,
    //   message: 'Failed to confirm schedule',
    //   error: error.message
    // });
  }
};

const aivideoanalysisds = require('../Models/aivideoanalysisds');
const classnew = require('../Models/classnew');
const classenr1 = require('../Models/classenr1');
const massignments = require('../Models/massignments');
const messageds = require('../Models/messageds');
const gptapikeyds = require('../Models/gptapikeyds');
const YouTubeService = require('../services/youtubeService');
const GeminiVideoService = require('../services/geminiVideoService');

// ✅ FIXED: Room generation using coursecode only
const generateAIChatRoom = (coursecode) => {
  if (!coursecode || typeof coursecode !== 'string') {
    throw new Error('Invalid coursecode provided');
  }
  const safeCourseCode = coursecode.toLowerCase().replace(/[^a-z0-9]/g, '');
  return `ai-chat-${safeCourseCode}`;
};

// Monitor scheduled classes for AI analysis
exports.monitorscheduledclasses = async (req, res) => {
  try {
    const { colid, user } = req.query;
    
    if (!colid || !user) {
      return res.status(400).json({
        success: false,
        message: 'colid and user are required'
      });
    }

    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

    const scheduledClasses = await classnew.find({
      user: user,
      colid: parseInt(colid),
      classdate: { 
        $gte: new Date(),
        $lte: thirtyDaysFromNow
      },
      topic: { $exists: true, $ne: '', $ne: null }
    }).sort({ classdate: 1 });

    const classesWithEnrollments = await Promise.all(
      scheduledClasses.map(async (classItem) => {
        const hasEnrollments = await classenr1.findOne({
          coursecode: classItem.coursecode,
          colid: parseInt(colid),
          active: 'Yes'
        });
        
        return hasEnrollments ? classItem : null;
      })
    );

    const validClasses = classesWithEnrollments.filter(Boolean);

    res.json({
      success: true,
      message: 'Scheduled classes monitored successfully',
      data: validClasses,
      count: validClasses.length,
      triggerAI: validClasses.length > 0
    });

  } catch (error) {
    console.error('Monitor classes error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to monitor scheduled classes',
      error: error.message
    });
  }
};

// ✅ FIXED: Complete processaivideoanalysis function
exports.processaivideoanalysis = async (req, res) => {
  try {
    const { classid, user, colid } = req.body;
    
    if (!classid || !user || !colid) {
      return res.status(400).json({
        success: false,
        message: 'classid, user, and colid are required'
      });
    }

    const classData = await classnew.findById(classid);
    if (!classData) {
      return res.status(404).json({ 
        success: false, 
        message: 'Class not found' 
      });
    }

    // ✅ FIXED: Generate room using coursecode only
    const chatRoomId = generateAIChatRoom(classData.coursecode);

    const existingAnalysis = await aivideoanalysisds.findOne({
      classid: classid,
      user: user,
      colid: parseInt(colid),
      status: 'completed'
    });

    if (existingAnalysis) {
      return res.json({
        success: true,
        message: 'AI analysis already completed for this class',
        data: {
          analysisId: existingAnalysis._id,
          chatRoomId: existingAnalysis.chatRoomId,
          status: 'completed'
        }
      });
    }

    const apiKeyData = await gptapikeyds.findOne({
      user: user,
      colid: parseInt(colid),
      isactive: true
    });

    if (!apiKeyData) {
      return res.status(404).json({ 
        success: false, 
        message: 'API keys not configured. Please set up your Gemini and YouTube API keys first.' 
      });
    }

    const geminiKey = apiKeyData.usepersonalkey ? apiKeyData.personalapikey : apiKeyData.defaultapikey;
    if (!geminiKey || !apiKeyData.youtubeapikey) {
      return res.status(400).json({
        success: false,
        message: 'Both Gemini AI and YouTube API keys are required'
      });
    }
    
    let aiAnalysis = await aivideoanalysisds.findOne({
      classid: classid,
      user: user,
      colid: parseInt(colid)
    });

    if (aiAnalysis) {
      aiAnalysis.status = 'searching';
      aiAnalysis.chatRoomId = chatRoomId; // ✅ Use coursecode-based room ID
      aiAnalysis.processingLog = ['Restarting AI analysis with stable room ID'];
      await aiAnalysis.save();
    } else {
      aiAnalysis = await aivideoanalysisds.create({
        name: classData.name,
        user: user,
        colid: parseInt(colid),
        classid: classid,
        coursecode: classData.coursecode,
        coursename: classData.course,
        topic: classData.topic,
        status: 'searching',
        chatRoomId: chatRoomId, // ✅ Use coursecode-based room ID
        processingLog: ['AI analysis started with stable room ID']
      });
    }

    // Start background processing with improved error handling
    processVideoAnalysisBackgroundWithRetry(aiAnalysis._id, apiKeyData, req.app.get('io'));

    res.json({
      success: true,
      message: 'AI video analysis started successfully',
      data: {
        analysisId: aiAnalysis._id,
        chatRoomId: aiAnalysis.chatRoomId,
        status: 'searching',
        topic: classData.topic
      }
    });

  } catch (error) {
    console.error('Process AI analysis error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to start AI video analysis',
      error: error.message
    });
  }
};

// ✅ COMPLETE: Enhanced background processing function
async function processVideoAnalysisBackgroundWithRetry(analysisId, apiKeyData, io) {
  let analysis;
  
  try {
    analysis = await aivideoanalysisds.findById(analysisId);
    if (!analysis) {
      console.error('Analysis record not found:', analysisId);
      return;
    }

    // Step 1: Search YouTube videos
    await aivideoanalysisds.findByIdAndUpdate(analysisId, {
      status: 'searching',
      $push: { processingLog: `Searching YouTube for videos about: ${analysis.topic}` }
    });

    const youtubeService = new YouTubeService(apiKeyData.youtubeapikey);
    const videos = await youtubeService.searchEducationalVideos(analysis.topic, {
      maxResults: 5,
      courseLevel: 'undergraduate'
    });

    if (videos.length === 0) {
      throw new Error('No educational videos found for this topic');
    }

    await aivideoanalysisds.findByIdAndUpdate(analysisId, {
      youtubeVideos: videos,
      status: 'analyzing',
      $push: { processingLog: `Found ${videos.length} educational videos` }
    });

    // Step 2: Analyze video with retry logic
    const selectedVideo = videos[0];
    const geminiService = new GeminiVideoService();
    const geminiKey = apiKeyData.usepersonalkey ? apiKeyData.personalapikey : apiKeyData.defaultapikey;
    geminiService.initialize(geminiKey);
    let videoAnalysis;
    try {
      videoAnalysis = await geminiService.analyzeEducationalVideo(
        selectedVideo.url,
        selectedVideo.title,
        analysis.topic,
        'undergraduate'
      );
    } catch (error) {
      console.error('Gemini video analysis error:', error);
      
      if (error.message.includes('quota exceeded') || error.message.includes('service overloaded')) {
        videoAnalysis = geminiService.createFallbackAnalysis(analysis.topic, 'undergraduate');
      } else {
        throw error;
      }
    }

    await aivideoanalysisds.findByIdAndUpdate(analysisId, {
      selectedVideoUrl: selectedVideo.url,
      selectedVideoTitle: selectedVideo.title,
      aiSummary: videoAnalysis.summary,
      learningObjectives: videoAnalysis.learningObjectives,
      difficultyLevel: videoAnalysis.difficultyLevel,
      keyTimestamps: videoAnalysis.keyTimestamps,
      relevanceScore: videoAnalysis.relevanceScore,
      status: 'generating',
      $push: { processingLog: 'Video analysis completed, generating assignment...' }
    });
    
    let assignmentData;
    try {
      assignmentData = await geminiService.generateAssignment(
        videoAnalysis,
        analysis.topic,
        'undergraduate'
      );
    } catch (error) {
      console.error('Gemini assignment generation error:', error);
      
      if (error.message.includes('quota exceeded') || error.message.includes('service overloaded')) {
        assignmentData = geminiService.createFallbackAssignment(analysis.topic, 'undergraduate');
      } else {
        assignmentData = geminiService.createFallbackAssignment(analysis.topic, 'undergraduate');
      }
    }

    // Step 4: Create actual assignment in your existing system
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 7);

    const newAssignment = await massignments.create({
      name: analysis.name,
      user: analysis.user,
      colid: analysis.colid,
      year: new Date().getFullYear().toString(),
      course: analysis.coursename || analysis.coursecode,
      coursecode: analysis.coursecode,
      assignment: assignmentData.assignmentTitle,
      description: assignmentData.description,
      duedate: dueDate,
      type: 'AI Generated',
      methodology: 'Video-based Learning',
      learning: videoAnalysis.learningObjectives.join(', '),
      doclink: selectedVideo.url
    });

    // Step 5: Update analysis record as completed
    await aivideoanalysisds.findByIdAndUpdate(analysisId, {
      generatedAssignmentId: newAssignment._id,
      assignmentData: assignmentData,
      status: 'completed',
      completedAt: new Date(),
      $push: { processingLog: 'AI analysis completed successfully!' }
    });

    // Step 6: Update quota usage
    await gptapikeyds.findOneAndUpdate(
      { user: analysis.user, colid: analysis.colid },
      { 
        $inc: { 
          currentusage: 25,
          youtubequotaused: 100
        },
        lastusagedate: new Date(),
        youtubelastusage: new Date()
      }
    );

    // Step 7: Send results to AI chat
    await sendAIChatMessageWithStatus(analysis, videoAnalysis, selectedVideo, assignmentData, 'completed', io);

  } catch (error) {
    console.error('Background processing error:', error);
    
    if (analysis) {
      let errorMessage = error.message;
      
      if (error.message.includes('quota exceeded')) {
        errorMessage = '⚠️ Gemini API quota exceeded. Please try again later or check your API quota limits.';
      } else if (error.message.includes('No educational videos found')) {
        errorMessage = 'No suitable educational videos found for this topic. Try a different topic or check your YouTube API quota.';
      }
      
      await aivideoanalysisds.findByIdAndUpdate(analysisId, {
        status: 'failed',
        $push: { processingLog: `Error: ${errorMessage}` }
      });

      await sendErrorMessage(analysis, errorMessage, io);
    }
  }
}

// ✅ FIXED: Enhanced AI message broadcasting with coursecode-based rooms
async function sendAIChatMessageWithStatus(analysis, videoAnalysis, selectedVideo, assignmentData, status, io) {
  try {
    let statusEmoji = '✅';
    let statusMessage = 'AI Analysis Complete!';
    
    if (status === 'fallback') {
      statusEmoji = '⚠️';
      statusMessage = 'AI Analysis Complete (Fallback Mode)';
    }

    const aiMessage = {
      room: analysis.chatRoomId,
      sender: 'ai@system.com',
      sendername: 'AI Assistant',
      role: 'ai',
      message: `${statusEmoji} **${statusMessage}**\n\n` +
               `📚 **Topic**: ${analysis.topic}\n\n` +
               `🎥 **Video Found**: ${selectedVideo?.title || 'Educational content'}\n` +
               (selectedVideo?.url ? `🔗 **Link**: ${selectedVideo.url}\n\n` : '') +
               `📝 **Summary**:\n${videoAnalysis.summary}\n\n` +
               `🎯 **Learning Objectives**:\n${videoAnalysis.learningObjectives.map(obj => `• ${obj}`).join('\n')}\n\n` +
               `📊 **Difficulty Level**: ${videoAnalysis.difficultyLevel}\n` +
               `📋 **Assignment Created**: ${assignmentData.assignmentTitle}\n` +
               `⏱️ **Estimated Time**: ${assignmentData.estimatedTime || '2-3 hours'}`,
      msgtype: 'ai_analysis',
      colid: analysis.colid,
      course: analysis.coursename || analysis.coursecode,
      coursecode: analysis.coursecode,
      timestamp: new Date()
    };
    await messageds.create(aiMessage);

    // ✅ ENHANCED: Broadcasting with comprehensive debugging
    if (io) {
      const facultyRoom = analysis.chatRoomId;
      const studentRoom = `${analysis.chatRoomId}_view`;
      
      // Check current room occupancy
      const facultyClients = io.sockets.adapter.rooms.get(facultyRoom);
      const studentClients = io.sockets.adapter.rooms.get(studentRoom);

      for (const [room, sockets] of io.sockets.adapter.rooms) {
      }
      
      // Broadcast to both rooms
      io.to(facultyRoom).emit('receive_ai_message', aiMessage);
      io.to(studentRoom).emit('receive_ai_message', aiMessage);
      
      // Also emit content ready event
      const contentData = {
        analysis: analysis,
        video: selectedVideo,
        assignment: assignmentData,
        status: status
      };
      
      io.to(facultyRoom).emit('ai_content_ready', contentData);
      io.to(studentRoom).emit('ai_content_ready', contentData);
    }

  } catch (error) {
  }
}

// Enhanced error message
async function sendErrorMessage(analysis, errorMessage, io) {
  try {
    const errorMsg = {
      room: analysis.chatRoomId,
      sender: 'ai@system.com',
      sendername: 'AI Assistant',
      role: 'ai',
      message: `❌ **AI Analysis Failed**\n\n` +
               `**Topic**: ${analysis.topic}\n` +
               `**Error**: ${errorMessage}\n\n` +
               `💡 **Next Steps:**\n` +
               `• Check your API key quotas in the AI Settings\n` +
               `• Try again in a few minutes if quota exceeded\n` +
               `• Contact support if the problem persists`,
      msgtype: 'ai_error',
      colid: analysis.colid,
      course: analysis.coursename || analysis.coursecode,
      coursecode: analysis.coursecode,
      timestamp: new Date()
    };

    await messageds.create(errorMsg);

    if (io) {
      io.to(analysis.chatRoomId).emit('ai_error', { error: errorMessage });
      io.to(`${analysis.chatRoomId}_view`).emit('ai_error', { error: errorMessage });
    }
  } catch (error) {
    console.error('Failed to send error message:', error);
  }
}

// Get AI video analyses by user
exports.getaivideoanalysisbyuser = async (req, res) => {
  try {
    const { colid, user } = req.query;
    
    if (!colid || !user) {
      return res.status(400).json({
        success: false,
        message: 'colid and user are required'
      });
    }

    const analyses = await aivideoanalysisds.find({
      user: user,
      colid: parseInt(colid)
    }).sort({ createdAt: -1 });

    res.json({
      success: true,
      message: 'AI video analyses retrieved successfully',
      data: analyses,
      count: analyses.length
    });

  } catch (error) {
    console.error('Get AI analyses error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve AI video analyses',
      error: error.message
    });
  }
};

// Get AI chat messages for a specific room
exports.getaichatmessages = async (req, res) => {
  try {
    const { chatRoomId } = req.params;
    const { colid, coursecode } = req.query;
    
    if (!chatRoomId) {
      return res.status(400).json({
        success: false,
        message: 'Chat room ID is required'
      });
    }

    let query = { room: chatRoomId };
    
    if (colid) {
      query.colid = parseInt(colid);
    }
    
    if (coursecode) {
      query.coursecode = coursecode;
    }

    const messages = await messageds.find(query)
      .sort({ timestamp: 1 })
      .limit(100);

    res.json({
      success: true,
      message: 'AI chat messages retrieved successfully',
      data: messages,
      count: messages.length
    });

  } catch (error) {
    console.error('Get AI chat messages error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve AI chat messages',
      error: error.message
    });
  }
};

// Delete AI analysis
exports.deleteaivideoanalysis = async (req, res) => {
  try {
    const { id } = req.params;
    const { colid, user } = req.query;
    
    const deleted = await aivideoanalysisds.findOneAndDelete({
      _id: id,
      colid: parseInt(colid),
      user: user
    });

    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: 'AI analysis not found'
      });
    }

    res.json({
      success: true,
      message: 'AI analysis deleted successfully'
    });

  } catch (error) {
    console.error('Delete AI analysis error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete AI analysis',
      error: error.message
    });
  }
};

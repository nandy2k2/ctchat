const { GoogleGenerativeAI } = require('@google/generative-ai');

class GeminiVideoService {
  constructor() {
    this.genAI = null;
    this.model = null;
  }

  // Initialize with API key from your existing system
  initialize(apiKey) {
    if (!apiKey) {
      throw new Error('Gemini API key is required');
    }
    
    this.genAI = new GoogleGenerativeAI(apiKey);
    this.model = this.genAI.getGenerativeModel({ 
      model: "gemini-1.5-flash", // Changed from gemini-1.5-pro (uses less quota)
      generationConfig: {
        temperature: 0.7,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 1024, // Reduced from 2048 to save quota
      }
    });
  }

  async generateContentWithRetries(prompt, maxRetries = 3) {
  let retryCount = 0;
  
  while (retryCount < maxRetries) {
    try {
      // ✅ FIXED: Add longer delay for 503 errors
      if (retryCount > 0) {
        const waitTime = Math.min(Math.pow(2, retryCount) * 30000, 300000); // Max 5 minutes
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
      
      const result = await this.model.generateContent(prompt);
      return result;
    } catch (error) {
      console.error(`❌ Gemini API attempt ${retryCount + 1} failed:`, error.message);
      
      if (error.status === 503) { // Service Unavailable
        retryCount++;
        if (retryCount < maxRetries) {
          continue;
        } else {
          throw new Error('Gemini API service overloaded after maximum retries');
        }
      } else {
        // Non-503 error, don't retry
        throw error;
      }
    }
  }
  
  throw new Error('Maximum retries reached');
}

  async analyzeEducationalVideo(videoUrl, videoTitle, topic, courseLevel = 'undergraduate') {
    try {
      // Shorter, more efficient prompt to save tokens
      const prompt = `Analyze this educational video about "${topic}" for ${courseLevel} students:
      
Title: "${videoTitle}"
URL: ${videoUrl}

Provide analysis in JSON format:
{
  "summary": "150-word summary of key educational concepts",
  "learningObjectives": ["objective1", "objective2", "objective3"],
  "difficultyLevel": "beginner|intermediate|advanced",
  "keyTimestamps": [{"time": "2:30", "concept": "Key concept"}],
  "relevanceScore": 0.85,
  "recommendedUse": "How to use in curriculum"
}`;
      
      const result = await this.generateContentWithRetries(prompt, 3);
      const responseText = result.response.text().trim();
      
      // Clean up the response to ensure valid JSON
      const cleanResponse = responseText.replace(/``````\n?/g, '').trim();
      
      try {
        const analysis = JSON.parse(cleanResponse);
        return analysis;
      } catch (parseError) {
        console.error('JSON Parse Error:', parseError);
        return this.createFallbackAnalysis(topic, courseLevel);
      }

    } catch (error) {
      console.error('Gemini video analysis error:', error);
      
      if (error.message.includes('quota exceeded')) {
        return this.createFallbackAnalysis(topic, courseLevel);
      } else if (error.message.includes('API_KEY')) {
        throw new Error('Invalid Gemini API key');
      }
      
      return this.createFallbackAnalysis(topic, courseLevel);
    }
  }

  async generateAssignment(videoAnalysis, topic, courseLevel = 'undergraduate') {
    try {
      // Shorter prompt to save tokens
      const prompt = `Create assignment for "${topic}" (${courseLevel} level):

Video Analysis: ${JSON.stringify(videoAnalysis, null, 1)}

Generate JSON:
{
  "assignmentTitle": "Assignment title",
  "description": "Assignment description",
  "questions": ["Question 1", "Question 2", "Question 3"],
  "practicalExercises": ["Exercise 1", "Exercise 2"],
  "deliverables": ["What to submit"],
  "gradingRubric": "Grading criteria",
  "estimatedTime": "2-3 hours",
  "learningOutcomes": ["Outcome 1", "Outcome 2"]
}`;
      
      const result = await this.generateContentWithRetries(prompt, 3);
      const responseText = result.response.text().trim();
      
      const cleanResponse = responseText.replace(/``````\n?/g, '').trim();
      
      try {
        const assignment = JSON.parse(cleanResponse);
        return assignment;
      } catch (parseError) {
        console.error('Assignment JSON Parse Error:', parseError);
        return this.createFallbackAssignment(topic, courseLevel);
      }

    } catch (error) {
      console.error('Gemini assignment generation error:', error);
      
      if (error.message.includes('quota exceeded')) {
        return this.createFallbackAssignment(topic, courseLevel);
      }
      
      return this.createFallbackAssignment(topic, courseLevel);
    }
  }

  // Fallback analysis when API fails
  createFallbackAnalysis(topic, courseLevel) {
    return {
      summary: `Educational content about ${topic}. This video covers fundamental concepts and provides practical examples suitable for ${courseLevel} students. The content includes theoretical explanations and real-world applications to help students understand the topic better.`,
      learningObjectives: [
        `Understand the core concepts of ${topic}`,
        `Apply ${topic} principles in practical scenarios`,
        `Analyze and evaluate examples related to ${topic}`
      ],
      difficultyLevel: courseLevel === 'graduate' ? 'advanced' : 'intermediate',
      keyTimestamps: [
        {"time": "0:00", "concept": "Introduction and overview"},
        {"time": "5:00", "concept": "Main concepts explained"},
        {"time": "10:00", "concept": "Practical examples"}
      ],
      relevanceScore: 0.75,
      recommendedUse: `This video can be used to introduce students to ${topic} concepts and provide foundational understanding`
    };
  }

  // Fallback assignment when API fails
  createFallbackAssignment(topic, courseLevel) {
    return {
      assignmentTitle: `Understanding ${topic} - Video Analysis Assignment`,
      description: `Complete this assignment based on the educational video about ${topic}. Demonstrate your understanding of the key concepts and their practical applications.`,
      questions: [
        `Explain the main concepts covered in the ${topic} video`,
        `How can you apply the principles of ${topic} in real-world scenarios?`,
        `What are the most important takeaways from this educational content?`
      ],
      practicalExercises: [
        `Create a summary presentation about ${topic}`,
        `Find and analyze a real-world example related to ${topic}`
      ],
      deliverables: [
        'Written analysis report (2-3 pages)',
        'Summary presentation or infographic'
      ],
      gradingRubric: 'Assignments will be evaluated based on understanding of concepts (40%), application of knowledge (40%), and clarity of presentation (20%)',
      estimatedTime: '2-3 hours',
      learningOutcomes: [
        `Demonstrate understanding of key concepts in ${topic}`,
        'Develop analytical and critical thinking skills',
        'Improve presentation and communication abilities'
      ]
    };
  }
}

module.exports = GeminiVideoService;

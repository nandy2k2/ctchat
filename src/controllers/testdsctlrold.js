const testsubmissionds = require('../Models/testsubmissionds');
const aigenerationlogds = require('../Models/aigeneratedlogds');
const gptapikeyds = require('../Models/gptapikeyds');
const testds = require('../Models/testds');

// Create or Update Test
exports.createtestds = async (req, res) => {
    try {
        const {
            name, user, colid, classid, course, coursecode, testtitle, description,
            topic, scheduleddate, starttime, endtime, duration, totalnoofquestion,
            questions, shufflequestions, showresultsimmediately, allowretake,
            passingscore, timelimit, proctoringmode, calculatorallowed,
            formulasheetallowed, instructions, rules, status, ispublished
        } = req.body;

        const filter = { testtitle, colid, user };
        const update = {
            name, user, colid, classid, course, coursecode, testtitle, description,
            topic, scheduleddate, starttime, endtime, duration, totalnoofquestion,
            questions, shufflequestions, showresultsimmediately, allowretake,
            passingscore, timelimit, proctoringmode, calculatorallowed,
            formulasheetallowed, instructions, rules, status, ispublished,
            updatedat: new Date()
        };

        const testdsnew = await testds.findOneAndUpdate(filter, update, {
            new: true,
            upsert: true,
            setDefaultsOnInsert: true
        });

        res.status(200).json({
            success: true,
            data: testdsnew,
            message: "Test created/updated successfully"
        });
    } catch (error) {
        // res.status(400).json({
        //     success: false,
        //     message: error.message
        // });
    }
};

// Get Tests by user and colid
exports.gettestsbyuser = async (req, res) => {
    try {
        const { colid, user } = req.query;
        const testdsget = await testds.find({ 
            colid: parseInt(colid), 
            user: user 
        }).sort({ createdat: -1 });
        
        res.status(200).json({
            success: true,
            count: testdsget.length,
            data: testdsget
        });
    } catch (error) {
        // res.status(400).json({
        //     success: false,
        //     message: error.message
        // });
    }
};

// Update Test
exports.updatetestds = async (req, res) => {
    try {
        const {
            id, name, user, colid, classid, course, coursecode, testtitle, description,
            topic, scheduleddate, starttime, endtime, duration, totalnoofquestion,
            questions, shufflequestions, showresultsimmediately, allowretake,
            passingscore, timelimit, proctoringmode, calculatorallowed,
            formulasheetallowed, instructions, rules, status, ispublished
        } = req.body;

        const testdsupdated = await testds.findOneAndUpdate(
            { _id: id, colid: parseInt(colid), user: user },
            {
                name, user, colid, classid, course, coursecode, testtitle, description,
                topic, scheduleddate, starttime, endtime, duration, totalnoofquestion,
                questions, shufflequestions, showresultsimmediately, allowretake,
                passingscore, timelimit, proctoringmode, calculatorallowed,
                formulasheetallowed, instructions, rules, status, ispublished,
                updatedat: new Date()
            },
            { new: true }
        );
        
        if (!testdsupdated) {
            return res.status(404).json({
                success: false,
                message: "Test not found"
            });
        }
        
        res.status(200).json({
            success: true,
            data: testdsupdated,
            message: "Test updated successfully"
        });
    } catch (error) {
        // res.status(400).json({
        //     success: false,
        //     message: error.message
        // });
    }
};

// Delete Test
exports.deletetestds = async (req, res) => {
    try {
        const { id, colid, user } = req.query;
        await testds.findOneAndDelete({ 
            _id: id, 
            colid: parseInt(colid), 
            user: user 
        });
        
        res.status(200).json({
            success: true,
            message: "Test deleted successfully"
        });
    } catch (error) {
        // res.status(400).json({
        //     success: false,
        //     message: error.message
        // });
    }
};

// Generate Questions Log (Frontend will handle actual generation)
exports.generatequestionsds = async (req, res) => {
    try {
        const { 
            name, user, colid, testid, generatedquestions, 
            topic, difficulty, questioncount, prompt, tokensused, cost
        } = req.body;

        const logFilter = { testid, colid, user };
        const logUpdate = {
            name, user, testid, facultyid: user, colid,
            prompt, topic, difficulty, questioncount,
            tokensused: tokensused || 0,
            cost: cost || 0,
            success: true,
            generatedat: new Date(),
            createdat: new Date()
        };

        await aigenerationlogds.findOneAndUpdate(logFilter, logUpdate, {
            new: true,
            upsert: true,
            setDefaultsOnInsert: true
        });

        res.status(200).json({
            success: true,
            data: generatedquestions,
            message: "Questions generation logged successfully"
        });

    } catch (error) {
        // res.status(400).json({
        //     success: false,
        //     message: error.message
        // });
    }
};

// Publish Test
exports.publishtestds = async (req, res) => {
    try {
        const { id, colid, user } = req.body;
        const testdspublish = await testds.findOneAndUpdate(
            { _id: id, colid: parseInt(colid), user: user },
            { 
                ispublished: true, 
                status: 'scheduled',
                publishedat: new Date(),
                updatedat: new Date()
            },
            { new: true }
        );
        
        if (!testdspublish) {
            return res.status(404).json({
                success: false,
                message: "Test not found"
            });
        }
        
        res.status(200).json({
            success: true,
            data: testdspublish,
            message: "Test published successfully"
        });
    } catch (error) {
        // res.status(400).json({
        //     success: false,
        //     message: error.message
        // });
    }
};

// Get Available Tests for Students
exports.getavailabletestsds = async (req, res) => {
    try {
        const { colid, classid } = req.query;
        const currentTime = new Date();
        
        const testdsavai = await testds.find({ 
            colid: parseInt(colid),
            classid: classid,
            ispublished: true,
            starttime: { $lte: currentTime },
            endtime: { $gte: currentTime },
            status: { $in: ['scheduled', 'active'] }
        }).sort({ starttime: 1 });
        
        res.status(200).json({
            success: true,
            count: testdsavai.length,
            data: testdsavai
        });
    } catch (error) {
        // res.status(400).json({
        //     success: false,
        //     message: error.message
        // });
    }
};

// Create or Update API Key Settings
exports.createapikeyds = async (req, res) => {
    try {
        const {
            name, user, colid, facultyid, defaultapikey, personalapikey,
            usepersonalkey, apikeyname, personalapikeyname, monthlylimit,
            currentusage, isactive
        } = req.body;

        const filter = { facultyid, colid, user };
        const update = {
            name, user, colid, facultyid, defaultapikey, personalapikey,
            usepersonalkey, apikeyname, personalapikeyname, monthlylimit,
            currentusage, isactive,
            updatedat: new Date()
        };

        const apikey = await gptapikeyds.findOneAndUpdate(filter, update, {
            new: true,
            upsert: true,
            setDefaultsOnInsert: true
        });

        res.status(200).json({
            success: true,
            data: apikey,
            message: "API key settings saved successfully"
        });
    } catch (error) {
        // res.status(400).json({
        //     success: false,
        //     message: error.message
        // });
    }
};

// Get API Key Settings
exports.getapikeyds = async (req, res) => {
  try {
    const { colid, facultyid, includekeys } = req.query;
    const apikey = await gptapikeyds.findOne({ 
      colid: parseInt(colid), 
      facultyid: facultyid 
    });
    
    if (!apikey) {
      return res.status(404).json({
        success: false,
        message: "API key settings not found"
      });
    }
    
    let response;
    if (includekeys === 'true') {
      // Return actual keys for API usage
      response = apikey.toObject();
    } else {
      // Hide keys for UI display
      response = {
        ...apikey.toObject(),
        defaultapikey: apikey.defaultapikey ? '***HIDDEN***' : '',
        personalapikey: apikey.personalapikey ? '***HIDDEN***' : ''
      };
    }
    
    res.status(200).json({
      success: true,
      data: response
    });
  } catch (error) {
    // res.status(400).json({
    //   success: false,
    //   message: error.message
    // });
  }
};


// Get Active API Key
exports.getactiveapikeyds = async (req, res) => {
    try {
        const { colid, facultyid } = req.query;
        const apikey = await gptapikeyds.findOne({ 
            colid: parseInt(colid), 
            facultyid: facultyid
        });
        
        if (!apikey) {
            return res.status(404).json({
                success: false,
                message: "No active API key found"
            });
        }
        
        // Return the actual API key to use
        const activeKey = apikey.usepersonalkey && apikey.personalapikey 
            ? apikey.personalapikey 
            : apikey.defaultapikey;
            
        const keyName = apikey.usepersonalkey && apikey.personalapikey 
            ? apikey.personalapikeyname 
            : apikey.apikeyname;

        res.status(200).json({
            success: true,
            data: {
                apikey: activeKey,
                keyname: keyName,
                usepersonalkey: apikey.usepersonalkey,
                monthlylimit: apikey.monthlylimit,
                currentusage: apikey.currentusage
            }
        });
    } catch (error) {
        // res.status(400).json({
        //     success: false,
        //     message: error.message
        // });
    }
};

// Update Usage
exports.updateusageds = async (req, res) => {
    try {
        const { colid, facultyid, tokensused } = req.body;
        
        const apikey = await gptapikeyds.findOneAndUpdate(
            { colid: parseInt(colid), facultyid: facultyid },
            { 
                $inc: { currentusage: tokensused },
                lastusagedate: new Date(),
                updatedat: new Date()
            },
            { new: true }
        );
        
        if (!apikey) {
            return res.status(404).json({
                success: false,
                message: "API key settings not found"
            });
        }
        
        res.status(200).json({
            success: true,
            data: {
                currentusage: apikey.currentusage,
                monthlylimit: apikey.monthlylimit,
                remaining: apikey.monthlylimit - apikey.currentusage
            },
            message: "Usage updated successfully"
        });
    } catch (error) {
        // res.status(400).json({
        //     success: false,
        //     message: error.message
        // });
    }
};

import express from 'express';
import cors from 'cors'; // Import cors
import db, { sql } from './database_config.js';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import multer from "multer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: '.env.local' });
const frontend_host = process.env.frontend_host;

import { getme, loginUser, logoutUser, registerUser } from './routes_functions/auth.js';
import { admin_deletequestion, admin_deleteuser, admin_getquestion, admin_getuser, admin_postquestion, admin_putquestion, admin_putuser, changeUserPassword } from './routes_functions/admin.js';
import { createmodule, deletemodule, updatemodule } from './routes_functions/module.js';
import { getNextQuestionLanguage, submitAnswerLanguage, language_result } from './routes_functions/language_assessment.js';
import { getNextQuestionListening, listening_result, submitAnswerListening } from './routes_functions/listening_assessment.js';
import { etiquette_result, getNextQuestionetiquette, submitAnsweretiquette } from './routes_functions/etiquette_assessment.js';
import { getNextQuestiontime_management, submitAnswertime_management, time_management_result } from './routes_functions/time-management_assessment.js';
import { getNextQuestionteam_leadership, submitAnswerteam_leadership, team_leadership_result } from './routes_functions/team-leadership_assessment.js';
import { getNextQuestion, result_general, submitAnswer } from './routes_functions/general_assessment.js';
import { Evaluation, Evaluation2 } from './routes_functions/evaluation.js';
import { deleteleadershipquestions, getleadershipquestions, postleadershipquestions, putleadershipquestions } from './routes_functions/admin_custommodules.js';


const app = express();

// Use CORS middleware
app.use(cors({
    origin: frontend_host, // ✅ Allow only your frontend
    credentials: true,               // ✅ Allow cookies  
}));
app.use(cookieParser());
app.use(express.json());




// auth things
app.post('/register', registerUser);
app.post('/login', loginUser);
app.post('/logout', logoutUser);
app.get('/me', getme);




// for communication
// Endpoint to fetch the next question
app.get('/communication/question', async (req, res) => {
    try {
        const { standard } = req.query; // Get standard from query params
        const pool = await db; // Ensure connection is established

        const result = await pool
            .request()
            .input('standard', sql.NVarChar, standard) // Set parameter with type
            .query(
                `SELECT TOP 1 question_text 
                 FROM hunar_database.communication_questions
                 WHERE standard = @standard 
                 ORDER BY NEWID()` // MSSQL uses NEWID() instead of RAND()
            );

        if (result.recordset.length === 0) {
            return res.status(404).json({ error: "No question found" });
        }

        res.json(result.recordset[0]); // Send first result
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Internal Server Error" });
    }
});





// for langauge test
// Endpoint to fetch the next question
app.get('/language/next-question', async (req, res) => {
    const { user_id, level, standard } = req.query; // Get user_id and level from query params
    const question = await getNextQuestionLanguage(user_id, level, standard);
    if (question.error) {
        return res.status(500).json({ error: question.error });
    }
    res.json(question);
});

app.post('/language/submit-answer', async (req, res) => {
    const { user_id, question_id, answer } = req.body;

    try {
        // Validate input
        if (!user_id || !question_id === undefined) {
            return res.status(400).json({ message: "Missing required fields" });
        }

        // Call the service function to handle the answer
        const result = await submitAnswerLanguage(user_id, question_id, answer);

        if (result.message) {
            return res.status(404).json({ message: result.message });
        }
        return res.status(200).json({ is_correct: result.isCorrect });
    } catch (error) {
        console.error("Error in /language/submit-answer:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
});
// endpoint to print result
app.get('/language/result', async (req, res) => {
    const { user_id } = req.query; // Get user_id and level from query params
    try {

        const result = await language_result(user_id);

        return res.status(200).json(result);
    } catch (error) {
        return res.status(500).json({ message: "Internal server error" });
    }
});







// for listeing test

const AUDIO_FOLDER = path.join(__dirname, "listening_audios");

// Serve static files from the 'audios' directory
app.use("/listening_audios", express.static(AUDIO_FOLDER));

app.get('/listening/get-audio', async (req, res) => {
    fs.readdir(AUDIO_FOLDER, (err, files) => {
        if (err) {
            return res.status(500).json({ error: "Failed to read audio directory" });
        }

        const mp3Files = files.filter(file => file.endsWith(".mp3"));

        if (mp3Files.length === 0) {
            return res.status(404).json({ error: "No audio files found" });
        }

        // Pick a random audio file
        const randomFile = mp3Files[Math.floor(Math.random() * mp3Files.length)];
        const audioId = path.parse(randomFile).name;

        // Construct the file URL
        const audioUrl = `listening_audios/${randomFile}`;

        res.json({ audioUrl, audioId });
    });
});

app.get('/listening/next-question', async (req, res) => {
    const { user_id, rec_id, standard } = req.query; // Get user_id and level from query params
    const question = await getNextQuestionListening(user_id, rec_id, standard);
    if (question.error) {
        return res.status(500).json({ error: question.error });
    }
    res.json(question);
});

app.post('/listening/submit-answer', async (req, res) => {
    const { user_id, question_id, answer } = req.body;

    try {
        // Validate input
        if (!user_id || !question_id === undefined) {
            return res.status(400).json({ message: "Missing required fields" });
        }

        // Call the service function to handle the answer
        const result = await submitAnswerListening(user_id, question_id, answer);

        if (result.message) {
            return res.status(404).json({ message: result.message });
        }
        return res.status(200).json({ is_correct: result.isCorrect });
    } catch (error) {
        console.error("Error in /listening/submit-answer:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
});

// endpoint to print result
app.get('/listening/result', async (req, res) => {
    const { user_id } = req.query; // Get user_id and level from query params
    try {

        const result = await listening_result(user_id);

        return res.status(200).json(result);
    } catch (error) {
        return res.status(500).json({ message: "Interndfdfdfal server error" });
    }
});







// for etiquette test
app.get('/etiquette/next-question', async (req, res) => {
    const { user_id, standard } = req.query; // Get user_id and level from query params
    const question = await getNextQuestionetiquette(user_id, standard);
    if (question.error) {
        return res.status(500).json({ error: question.error });
    }
    res.json(question);
});

app.post('/etiquette/submit-answer', async (req, res) => {
    const { user_id, question_id, answer } = req.body;

    try {
        // Validate input
        if (!user_id || !question_id === undefined) {
            return res.status(400).json({ message: "Missing required fields" });
        }

        // Call the service function to handle the answer
        const result = await submitAnsweretiquette(user_id, question_id, answer);

        if (result.message) {
            return res.status(404).json({ message: result.message });
        }
        return res.status(200).json({ is_correct: result.isCorrect });
    } catch (error) {
        console.error("Error in /etiquette/submit-answer:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
});

// endpoint to print result
app.get('/etiquette/result', async (req, res) => {
    const { user_id } = req.query; // Get user_id and level from query params
    try {

        const result = await etiquette_result(user_id);

        return res.status(200).json(result);
    } catch (error) {
        return res.status(500).json({ message: "Interndfdfdfal server error" });
    }
});









//TIME MANGAGEMENT
app.get('/time-management/next-question', async (req, res) => {
    const { user_id, standard } = req.query; // Get user_id and level from query params
    const question = await getNextQuestiontime_management(user_id, standard);
    if (question.error) {
        return res.status(500).json({ error: question.error });
    }
    res.json(question);
});

app.post('/time-management/submit-answer', async (req, res) => {
    const { user_id, question_id, answer } = req.body;

    try {
        // Validate input
        if (!user_id || !question_id === undefined) {
            return res.status(400).json({ message: "Missing required fields" });
        }

        // Call the service function to handle the answer
        const result = await submitAnswertime_management(user_id, question_id, answer);

        if (result.message) {
            return res.status(404).json({ message: result.message });
        }
        return res.status(200).json({ is_correct: result.isCorrect });
    } catch (error) {
        console.error("Error in /time management/submit-answer:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
});

// endpoint to print result
app.get('/time-management/result', async (req, res) => {
    const { user_id } = req.query; // Get user_id and level from query params
    try {

        const result = await time_management_result(user_id);

        return res.status(200).json(result);
    } catch (error) {
        return res.status(500).json({ message: "Interndfdfdfal server error" });
    }
});








//TIME MANGAGEMENT
app.get('/team-leadership/next-question', async (req, res) => {
    const { user_id, standard } = req.query; // Get user_id and level from query params
    const question = await getNextQuestionteam_leadership(user_id, standard);
    if (question.error) {
        return res.status(500).json({ error: question.error });
    }
    res.json(question);
});

app.post('/team-leadership/submit-answer', async (req, res) => {
    const { user_id, question_id, answer } = req.body;

    try {
        // Validate input
        if (!user_id || !question_id === undefined) {
            return res.status(400).json({ message: "Missing required fields" });
        }

        // Call the service function to handle the answer
        const result = await submitAnswerteam_leadership(user_id, question_id, answer);
        return res.status(200).json({ is_correct: result.isCorrect });
    } catch (error) {
        console.error("Error in /team_leadership/submit-answer:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
});

// endpoint to print result
app.get('/team-leadership/result', async (req, res) => {
    const { user_id } = req.query; // Get user_id and level from query params
    try {

        const result = await team_leadership_result(user_id);

        return res.status(200).json(result);
    } catch (error) {
        return res.status(500).json({ message: "Interndfdfdfal server error" });
    }
});






//presentation module

// Endpoint to fetch the next presentation question
app.get('/presentation/question', async (req, res) => {
    try {
        const { standard } = req.query;
        const pool = await db; // Ensure connection is established

        const result = await pool
            .request()
            .input('standard', sql.NVarChar, standard)
            .query(
                `SELECT TOP 1 question_text, attempt_time
                 FROM hunar_database.presentation_questions
                 WHERE standard = @standard
                 ORDER BY NEWID()` // MSSQL uses NEWID() instead of RAND()
            );

        if (result.recordset.length === 0) {
            return res.status(404).json({ error: "No question found" });
        }

        res.json(result.recordset[0]);
    } catch (err) {
        console.error("Error fetching question:", err);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// Endpoint to fetch presentation result
app.get('/presentation/result', async (req, res) => {
    try {
        const { user_id } = req.query;
        const pool = await db; // Ensure connection is established

        const result = await pool
            .request()
            .input('user_id', sql.NVarChar, user_id)
            .query(
                "SELECT feedback FROM hunar_database.presentation_result WHERE user_id = @user_id"
            );

        if (result.recordset.length === 0) {
            return res.status(404).json({ error: "User not found" });
        }

        const metrics = result.recordset[0].feedback;
        res.status(200).json({ metrics });
    } catch (err) {
        console.error("Error retrieving data from DB:", err);
        res.status(500).json({ error: "An error occurred while fetching data" });
    }
});







//General skill test
app.get('/general/next-question', async (req, res) => {
    const { user_id, id, standard } = req.query; // Get user_id and level from query params
    const question = await getNextQuestion(user_id, id, standard);
    if (question.error) {
        return res.status(500).json({ error: question.error });
    }
    res.json(question);
});

app.post('/general/submit-answer', async (req, res) => {
    const { user_id, question_id, answer, id } = req.body;

    try {
        // Validate input
        if (!user_id || !question_id === undefined) {
            return res.status(400).json({ message: "Missing required fields" });
        }

        // Call the service function to handle the answer
        const result = await submitAnswer(user_id, question_id, answer, id);
        return res.status(200).json({ is_correct: result.isCorrect });
    } catch (error) {
        console.error("Error in /general/submit-answer:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
});

// endpoint to print result
app.get('/general/result', async (req, res) => {
    const { user_id, id } = req.query; // Get user_id and level from query params
    try {

        const result = await result_general(user_id, id);

        return res.status(200).json(result);
    } catch (error) {
        return res.status(500).json({ message: "Internal server error" });
    }
});










/// extra endpoints
app.post('/eval', Evaluation);
app.post('/eval2', Evaluation2);
// Fetch overall result
app.get('/overall-result', async (req, res) => {
    try {
        const { user_id } = req.query;
        const pool = await db;

        const result = await pool
            .request()
            .input('user_id', sql.NVarChar, user_id)
            .query(
                'SELECT test_name, total_marks, max_marks FROM hunar_database.overall_result WHERE user_id = @user_id'
            );

        if (result.recordset.length === 0) {
            return res.status(403).json({ error: 'No test completed to show result (complete at least one test)' });
        }

        res.status(200).json(result.recordset);
    } catch (error) {
        console.error('Error fetching overall result:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Check if individual test is completed
app.get('/check-completion', async (req, res) => {
    try {
        const { user_id, test_id } = req.query;
        const pool = await db;

        const result = await pool
            .request()
            .input('user_id', sql.NVarChar, user_id)
            .input('test_id', sql.Int, test_id)
            .query(
                'SELECT is_completed FROM hunar_database.test_skill_status WHERE user_id = @user_id AND test_id = @test_id'
            );

        if (result.recordset.length === 0) {
            return res.status(404).json({ error: 'Test status not found for this user and test' });
        }

        res.status(200).json({ is_completed: result.recordset[0].is_completed });
    } catch (error) {
        console.error('Error checking test completion:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get homepage test status
app.get('/get-test-status', async (req, res) => {
    try {
        const { user_id } = req.query;
        const pool = await db;

        const result = await pool
            .request()
            .input('user_id', sql.NVarChar, user_id)
            .query(
                'SELECT test_id, is_completed FROM hunar_database.test_skill_status WHERE user_id = @user_id'
            );
        res.status(200).json(result.recordset);
    } catch (error) {
        console.error('Error fetching test statuses:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Fetch communication result
app.get('/communication/result', async (req, res) => {
    try {
        const { user_id } = req.query;
        const pool = await db;

        const result = await pool
            .request()
            .input('user_id', sql.NVarChar, user_id)
            .query(
                'SELECT metrics FROM hunar_database.user_audio_result WHERE user_id = @user_id'
            );

        if (result.recordset.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.status(200).json({ metrics: result.recordset[0].metrics });
    } catch (error) {
        console.error('Error retrieving communication result:', error);
        res.status(500).json({ error: 'An error occurred while fetching data' });
    }
});

// Get module instructions
app.get('/getinstructions', async (req, res) => {
    try {
        const { id } = req.query;
        const pool = await db;

        const result = await pool
            .request()
            .input('id', sql.Int, id)
            .query(
                'SELECT instruction FROM hunar_database.modules WHERE id = @id'
            );

        if (result.recordset.length === 0) {
            return res.status(404).json({ error: 'Instruction not found' });
        }

        res.status(200).json({ instruction: result.recordset[0].instruction });
    } catch (error) {
        console.error('Error retrieving module instructions:', error);
        res.status(500).json({ error: 'An error occurred while fetching data' });
    }
});















//// admin things

app.get('/admin/modules', async (req, res) => {
    try {
        const pool = await db;
        const result = await pool.request().query('SELECT * FROM hunar_database.modules');

        res.json(result.recordset);
    } catch (error) {
        console.error("Error fetching modules:", error);
        res.status(500).json({ error: 'Failed to fetch modules' });
    }
});

// Fetch a specific module by ID
app.get('/admin/getmodule', async (req, res) => {
    try {
        const { id } = req.query;
        const pool = await db;

        const result = await pool
            .request()
            .input('id', sql.Int, id)
            .query('SELECT name, instruction, no_of_questions FROM hunar_database.modules WHERE id = @id');

        if (result.recordset.length === 0) {
            return res.status(404).json({ error: "Module not found" });
        }

        res.json(result.recordset[0]);
    } catch (error) {
        console.error("Error fetching module:", error);
        res.status(500).json({ error: 'Failed to fetch module' });
    }
});

// admin user edit routes
app.get('/admin/users', admin_getuser);
app.put('/admin/users/:phone', admin_putuser);
app.delete('/admin/users/:phone', admin_deleteuser);

// module routes
app.post('/admin/create-module', createmodule);
app.delete('/admin/delete-module', deletemodule);
app.put('/admin/update-module', updatemodule);

//general skill test question edit routes for admin
app.get('/admin/modules/:id/questions', admin_getquestion);
app.post('/admin/modules/:id/questions', admin_postquestion);
app.put('/admin/modules/:id/questions/:id2', admin_putquestion);
app.delete('/admin/modules/:id/questions/:id2', admin_deletequestion);

// only for leadership admin question edit routes
app.get('/admin/leadership/questions', getleadershipquestions);
app.post('/admin/leadership/questions', postleadershipquestions);
app.put('/admin/leadership/questions/:id2', putleadershipquestions);
app.delete('/admin/leadership/questions/:id2', deleteleadershipquestions);



// Only for Listening Admin Question Edit Routes
app.get("/admin/listening/questions", async (req, res) => {
    try {
        const pool = await db;

        const result = await pool
            .request()
            .query(`
                SELECT 
                    q.id,  
                    q.recording_id, 
                    q.question_text, 
                    q.options, 
                    q.attempt_time,
                    q.standard, 
                    a.answer,  
                    a.weight
                FROM hunar_database.listening_questions q
                JOIN hunar_database.listening_answers a 
                ON q.id = a.id;
            `);

        const rows = result.recordset;

        // Grouping questions by recording_id
        const groupedQuestions = rows.reduce((acc, question) => {
            if (!acc[question.recording_id]) acc[question.recording_id] = [];
            acc[question.recording_id].push(question);
            return acc;
        }, {});

        res.json(groupedQuestions);
    } catch (error) {
        console.error("Error fetching questions:", error);
        res.status(500).json({ error: "Failed to fetch questions" });
    }
});



// Serve audio file for a given recordingId

app.get("/admin/listening/audio/:recordingId", async (req, res) => {
    try {
        const { recordingId } = req.params;
        const audioPath = path.join(__dirname, "./listening_audios", `${recordingId}.mp3`);

        // Check if the file exists
        if (!fs.existsSync(audioPath)) {
            return res.status(404).json({ error: "Audio file not found" });
        }

        // Stream the audio file to the client
        res.setHeader("Content-Type", "audio/mpeg");
        const readStream = fs.createReadStream(audioPath);
        readStream.pipe(res);
    } catch (error) {
        console.error("Error fetching audio:", error);
        res.status(500).json({ error: "Failed to fetch audio file" });
    }
});


// File Storage for Listening Audio Uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadPath = path.join(__dirname, "./listening_audios");
        if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, { recursive: true });
        }
        cb(null, uploadPath);
    },
    filename: async (req, file, cb) => {
        try {
            const pool = await db;

            // Get the next available recording_id
            const result = await pool
                .request()
                .query("SELECT MAX(CAST(recording_id AS INT)) AS maxId FROM hunar_database.listening_questions");

            const nextRecordingId = (result.recordset[0].maxId || 0) + 1;
            cb(null, `${nextRecordingId}.mp3`);
        } catch (error) {
            console.error("Error generating recording ID:", error);
            cb(error);
        }
    },
});

const upload = multer({ storage });

// Upload audio file and create a dummy question
app.post("/admin/listening/upload", upload.single("audio"), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: "No file uploaded" });
        }

        // Extract recording_id from filename
        const recordingId = path.basename(req.file.filename, ".mp3");

        const dummyQuestion = "Sample question for newly uploaded audio";
        const pool = await db;

        // Insert dummy question
        const result = await pool
            .request()
            .input("recordingId", sql.NVarChar, recordingId)
            .input("question_text", sql.NVarChar, dummyQuestion)
            .input("options", sql.NVarChar, JSON.stringify([]))
            .query(`
                INSERT INTO hunar_database.listening_questions (recording_id, question_text, options)
                OUTPUT INSERTED.id
                VALUES (@recordingId, @question_text, @options)
            `);

        const questionId = result.recordset[0].id;

        // Insert a default answer
        await pool
            .request()
            .input("id", sql.Int, questionId)
            .query(`INSERT INTO hunar_database.listening_answers (id, answer, weight) VALUES (@id, 1, 1)`);

        res.status(201).json({ message: "Audio uploaded and dummy question created", recordingId });
    } catch (error) {
        console.error("Error uploading file:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

// Delete audio file and associated questions
app.delete("/admin/listening/audio/:recordingId", async (req, res) => {
    try {
        const { recordingId } = req.params;
        const audioPath = path.join(__dirname, "./listening_audios", `${recordingId}.mp3`);

        // Check if the file exists
        if (!fs.existsSync(audioPath)) {
            return res.status(404).json({ error: "Audio file not found" });
        }

        // Delete file asynchronously
        await fs.promises.unlink(audioPath);

        const pool = await db;

        // Get all question IDs for the recordingId
        const questionResult = await pool
            .request()
            .input("recordingId", sql.NVarChar, recordingId)
            .query("SELECT id FROM hunar_database.listening_questions WHERE recording_id = @recordingId");

        const questionIds = questionResult.recordset.map(q => q.id);

        if (questionIds.length > 0) {
            // Delete related answers
            await pool
                .request()
                .query(`DELETE FROM hunar_database.listening_answers WHERE id IN (${questionIds.join(",")})`);

            // Delete questions
            await pool
                .request()
                .input("recordingId", sql.NVarChar, recordingId)
                .query("DELETE FROM hunar_database.listening_questions WHERE recording_id = @recordingId");
        }

        res.json({ message: "Audio file and related questions & answers deleted successfully" });
    } catch (error) {
        console.error("Error deleting audio and associated data:", error);
        res.status(500).json({ error: "Failed to delete audio file and related data" });
    }
});

// Insert new question
app.post("/admin/listening/questions", async (req, res) => {
    try {
        const { question_text, recordingId, options, attempt_time, standard, answer, weight } = req.body;

        if (!question_text || !options || !answer || weight === undefined) {
            return res.status(400).json({ error: "Question text, options, answer, and weight are required" });
        }

        const pool = await db;

        // Insert question
        const result = await pool
            .request()
            .input("recordingId", sql.NVarChar, recordingId)
            .input("question_text", sql.NVarChar, question_text)
            .input("options", sql.NVarChar, JSON.stringify(options))
            .input("attempt_time", sql.Int, attempt_time || 60)
            .input("standard", sql.NVarChar, standard)
            .query(`
                INSERT INTO hunar_database.listening_questions (recording_id, question_text, options, attempt_time, standard)
                OUTPUT INSERTED.id
                VALUES (@recordingId, @question_text, @options, @attempt_time, @standard)
            `);

        const questionId = result.recordset[0].id;

        // Insert answer
        await pool
            .request()
            .input("id", sql.Int, questionId)
            .input("answer", sql.Int, answer)
            .input("weight", sql.Int, weight)
            .query(`INSERT INTO hunar_database.listening_answers (id, answer, weight) VALUES (@id, @answer, @weight)`);

        res.status(200).json({});
    } catch (error) {
        console.error("Error adding question:", error);
        res.status(500).json({ error: "Failed to add question" });
    }
});

// Update a question
app.put("/admin/listening/questions/:questionId", async (req, res) => {
    try {
        const { questionId } = req.params;
        const { question_text, recording_id, options, attempt_time, standard, answer, weight } = req.body;

        if (!question_text || !options || !answer || weight === undefined) {
            return res.status(400).json({ error: "Question text, options, answer, and weight are required" });
        }

        const pool = await db;

        // Update question
        await pool
            .request()
            .input("questionId", sql.Int, questionId)
            .input("recording_id", sql.NVarChar, recording_id)
            .input("question_text", sql.NVarChar, question_text)
            .input("options", sql.NVarChar, JSON.stringify(options))
            .input("attempt_time", sql.Int, attempt_time)
            .input("standard", sql.NVarChar, standard)
            .query(`
                UPDATE hunar_database.listening_questions
                SET question_text = @question_text, recording_id = @recording_id, options = @options, attempt_time = @attempt_time, standard = @standard
                WHERE id = @questionId
            `);

        // Update answer
        await pool
            .request()
            .input("questionId", sql.Int, questionId)
            .input("answer", sql.Int, answer)
            .input("weight", sql.Int, weight)
            .query(`
                UPDATE hunar_database.listening_answers
                SET answer = @answer, weight = @weight
                WHERE id = @questionId
            `);

        res.status(200).json({ questionId, question_text, options, answer, weight });
    } catch (error) {
        console.error("Error updating question:", error);
        res.status(500).json({ error: "Failed to update question" });
    }
});

// Delete a question
app.delete("/admin/listening/questions/:questionId", async (req, res) => {
    try {
        const { questionId } = req.params;
        const pool = await db;

        const result = await pool
            .request()
            .input("questionId", sql.Int, questionId)
            .query("DELETE FROM hunar_database.listening_questions WHERE id = @questionId");

        if (result.rowsAffected[0] === 0) {
            return res.status(404).json({ error: "Question not found" });
        }

        res.status(200).json({ message: "Question deleted successfully" });
    } catch (error) {
        console.error("Error deleting question:", error);
        res.status(500).json({ error: "Failed to delete question" });
    }
});





app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send('something broke');
});

app.listen(3005, () => {
    console.log('server is running on port 3005');
});

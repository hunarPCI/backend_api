import db from '../database_config.js'; // Import the database instance
import sql from 'mssql';

// Function to fetch the next question for the user
export const getNextQuestion = async (userId, id, standard) => {
    try {
        const pool = await db;

        // Get module name
        const moduleResult = await pool.request()
            .input('id', sql.Int, id)
            .query(`SELECT name FROM hunar_database.modules WHERE id = @id`);

        if (moduleResult.recordset.length === 0) {
            return { error: "Module not found" };
        }

        const table = moduleResult.recordset[0].name.toLowerCase().replace(/\s+/g, '_');

        // Fetch a random unanswered question
        const questionResult = await pool.request()
            .input('standard', sql.NVarChar, standard)
            .input('user_id', sql.NVarChar, userId)
            .query(`
                SELECT TOP 1 * FROM hunar_database.${table}_questions 
                WHERE standard = @standard 
                AND id NOT IN (SELECT question_id FROM hunar_database.${table}_responses WHERE user_id = @user_id)
                ORDER BY NEWID()
            `);

        if (questionResult.recordset.length === 0) {
            return { error: "No more questions available" };
        }

        return questionResult.recordset[0];
    } catch (error) {
        console.error("Error fetching next question:", error);
        return { error: "Failed to fetch next question" };
    }
};

// Function to submit an answer
export const submitAnswer = async (userId, questionId, userAnswer, id) => {
    try {
        const pool = await db;

        // Get module name
        const moduleResult = await pool.request()
            .input('id', sql.Int, id)
            .query(`SELECT name FROM hunar_database.modules WHERE id = @id`);

        if (moduleResult.recordset.length === 0) {
            return { error: "Module not found" };
        }

        const table = moduleResult.recordset[0].name.toLowerCase().replace(/\s+/g, '_');

        // Get correct answer
        const answerResult = await pool.request()
            .input('question_id', sql.Int, questionId)
            .query(`SELECT answer FROM hunar_database.${table}_answers WHERE id = @question_id`);

        if (answerResult.recordset.length === 0) {
            return { isCorrect: false, message: "Question not found" };
        }

        const correctAnswer = answerResult.recordset[0].answer;
        const isCorrect = userAnswer === correctAnswer;

        // Insert response
        await pool.request()
            .input('user_id', sql.NVarChar, userId)
            .input('question_id', sql.Int, questionId)
            .input('is_correct', sql.Bit, isCorrect)
            .query(`
                INSERT INTO hunar_database.${table}_responses (user_id, question_id, is_correct) 
                VALUES (@user_id, @question_id, @is_correct)
            `);

        return { isCorrect };
    } catch (error) {
        console.error("Error in submitAnswer:", error);
        throw new Error("Internal server error");
    }
};

// Function to calculate user's result
export const result_general = async (user_id, id) => {
    try {
        const pool = await db;

        // Get module name
        const moduleResult = await pool.request()
            .input('id', sql.Int, id)
            .query(`SELECT name FROM hunar_database.modules WHERE id = @id`);

        if (moduleResult.recordset.length === 0) {
            return { error: "Module not found" };
        }

        const table = moduleResult.recordset[0].name.toLowerCase().replace(/\s+/g, '_');

        // Fetch total score & correct answers
        const result = await pool.request()
            .input('user_id', sql.NVarChar, user_id)
            .query(`
                SELECT 
                    SUM(a.weight) AS total_score, 
                    COUNT(r.id) AS total_correct_questions
                FROM hunar_database.${table}_responses r
                JOIN hunar_database.${table}_answers a ON r.question_id = a.id
                WHERE r.user_id = @user_id AND r.is_correct = 1
            `);

        // Fetch max possible score
        const maxMarksResult = await pool.request()
            .input('user_id', sql.NVarChar, user_id)
            .query(`
                SELECT 
                    SUM(a.weight) AS max_marks
                FROM hunar_database.${table}_responses r
                JOIN hunar_database.${table}_answers a ON r.question_id = a.id
                WHERE r.user_id = @user_id
            `);

        if (result.recordset.length === 0) {
            return { error: "No responses found for this user." };
        }

        const totalMarks = result.recordset[0].total_score || 0;
        const totalCorrect = result.recordset[0].total_correct_questions || 0;
        const maxMarks = maxMarksResult.recordset[0]?.max_marks || 0;

        return { totalMarks, totalCorrect, maxMarks, name: moduleResult.recordset[0].name };
    } catch (error) {
        console.error("Error fetching result:", error);
        return { error: "Failed to fetch result." };
    }
};

import db from '../database_config.js';
import sql from 'mssql';

// Fetch the next question for a user
export const getNextQuestionListening = async (userId, rec_id, standard) => {
    try {
        const pool = await db;

        // Fetch a random unanswered question for the user
        const result = await pool.request()
            .input('rec_id', sql.NVarChar, rec_id)
            .input('standard', sql.NVarChar, standard)
            .input('userId', sql.NVarChar, userId)
            .query(`
                SELECT TOP 1 * 
                FROM hunar_database.listening_questions 
                WHERE recording_id = @rec_id 
                AND standard = @standard 
                AND id NOT IN (SELECT question_id FROM hunar_database.listening_responses WHERE user_id = @userId) 
                ORDER BY NEWID()
            `);

        if (result.recordset.length === 0) {
            return { error: "No more questions available" };
        }

        return result.recordset[0];
    } catch (error) {
        console.error("Error fetching next question:", error);
        return { error: "Failed to fetch next question" };
    }
};

// Submit an answer for a listening question
export const submitAnswerListening = async (userId, questionId, userAnswer) => {
    try {
        const pool = await db;

        // Fetch the correct answer for the question
        const result = await pool.request()
            .input('questionId', sql.Int, questionId)
            .query(`
                SELECT answer FROM hunar_database.listening_answers WHERE id = @questionId
            `);

        if (result.recordset.length === 0) {
            return { isCorrect: false, message: "Question not found" };
        }

        const correctAnswer = result.recordset[0].answer;
        const isCorrect = userAnswer === correctAnswer ? 1 : 0; // Convert to 1 (true) or 0 (false)

        // Insert response into listening_responses table
        await pool.request()
            .input('userId', sql.NVarChar, userId)
            .input('questionId', sql.Int, questionId)
            .input('isCorrect', sql.Bit, isCorrect)
            .query(`
                INSERT INTO hunar_database.listening_responses (user_id, question_id, is_correct)
                VALUES (@userId, @questionId, @isCorrect)
            `);

        return { isCorrect };
    } catch (error) {
        console.error("Error in submitAnswerListening:", error);
        throw new Error("Internal server error");
    }
};

// Fetch the user's listening test result
export const listening_result = async (user_id) => {
    try {
        const pool = await db;

        // Query to get the total score and total correct answers
        const result = await pool.request()
            .input('user_id', sql.NVarChar, user_id)
            .query(`
                SELECT 
                    SUM(a.weight) AS total_score, 
                    COUNT(r.id) AS total_correct_questions
                FROM hunar_database.listening_responses r
                JOIN hunar_database.listening_answers a ON r.question_id = a.id
                WHERE r.user_id = @user_id AND r.is_correct = 1
            `);

        // Query to get the max marks scorable
        const maxMarksResult = await pool.request()
            .input('user_id', sql.NVarChar, user_id)
            .query(`
                SELECT 
                    SUM(a.weight) AS max_marks
                FROM hunar_database.listening_responses r
                JOIN hunar_database.listening_answers a ON r.question_id = a.id
                WHERE r.user_id = @user_id
            `);

        if (result.recordset.length === 0) {
            return { error: "No responses found for this user." };
        }

        const totalMarks = result.recordset[0].total_score || 0;
        const totalCorrect = result.recordset[0].total_correct_questions || 0;
        const maxMarks = maxMarksResult.recordset[0]?.max_marks || 0;

        return { totalMarks, totalCorrect, maxMarks };
    } catch (error) {
        console.error("Error fetching listening test result:", error);
        return { error: "Failed to fetch listening test result." };
    }
};

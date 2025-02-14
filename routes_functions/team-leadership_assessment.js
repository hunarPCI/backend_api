import db from '../database_config.js';
import sql from 'mssql';

// Fetch the next question for a user
export const getNextQuestionteam_leadership = async (userId, standard) => {
    try {
        const pool = await db;

        // Fetch a random unanswered question for the user
        const result = await pool.request()
            .input('standard', sql.NVarChar, standard)
            .input('userId', sql.NVarChar, userId)
            .query(`
                SELECT TOP 1 * 
                FROM hunar_database.teamwork_and_leadership_questions 
                WHERE standard = @standard 
                AND id NOT IN (SELECT question_id FROM hunar_database.teamwork_and_leadership_responses WHERE user_id = @userId) 
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

// Submit an answer for a teamwork and leadership question
export const submitAnswerteam_leadership = async (userId, questionId, userAnswer) => {
    try {
        const pool = await db;

        // Fetch the weights array for the given question
        const result = await pool.request()
            .input('questionId', sql.Int, questionId)
            .query(`
                SELECT weights FROM hunar_database.teamwork_and_leadership_answers WHERE id = @questionId
            `);

        if (result.recordset.length === 0) {
            return { isCorrect: false, message: "Question not found" };
        }

        const weights = JSON.parse(result.recordset[0].weights); // Convert JSON string to array

        // Ensure userAnswer is between 1 and 5
        if (userAnswer < 1 || userAnswer > 5) {
            return { isCorrect: false, message: "Invalid answer option" };
        }

        // Get the weight corresponding to the user's answer
        const weightScored = weights[userAnswer - 1]; // userAnswer is 1-5, so subtract 1 to match array index

        // Insert the user's response into the teamwork_and_leadership_responses table
        await pool.request()
            .input('userId', sql.NVarChar, userId)
            .input('questionId', sql.Int, questionId)
            .input('weightScored', sql.Int, weightScored)
            .query(`
                INSERT INTO hunar_database.teamwork_and_leadership_responses (user_id, question_id, weight_scored)
                VALUES (@userId, @questionId, @weightScored)
            `);

        return { isCorrect: true, message: "Answer submitted successfully" };
    } catch (error) {
        console.error("Error in submitAnswerteam_leadership:", error);
        throw new Error("Internal server error");
    }
};

// Fetch the user's teamwork and leadership test result
export const team_leadership_result = async (user_id) => {
    try {
        const pool = await db;

        // Query to get the sum of all weight scores and the count of responses for the user
        const result = await pool.request()
            .input('user_id', sql.NVarChar, user_id)
            .query(`
                SELECT 
                    SUM(weight_scored) AS total_score, 
                    COUNT(*) AS response_count 
                FROM hunar_database.teamwork_and_leadership_responses 
                WHERE user_id = @user_id
            `);
        const totalScore = result.recordset[0].total_score || 0;
        const responseCount = result.recordset[0].response_count || 0;

        return { totalScore, responseCount };
    } catch (error) {
        console.error("Error fetching teamwork and leadership result:", error);
        return { error: "Failed to fetch teamwork and leadership result." };
    }
};

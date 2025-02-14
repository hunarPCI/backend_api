import db from '../database_config.js'; // Import the database instance
import sql from 'mssql';

// Function to fetch the next question for the user based on difficulty and answered questions
export const getNextQuestionetiquette = async (userId, standard) => {
    try {
        const pool = await db;

        // Query to fetch a random question the user has not answered yet, filtered by standard
        const result = await pool.request()
            .input('standard', sql.NVarChar, standard)
            .input('userId', sql.NVarChar, userId)
            .query(`
                SELECT TOP 1 * FROM hunar_database.etiquette_questions 
                WHERE standard = @standard 
                AND id NOT IN (SELECT question_id FROM hunar_database.etiquette_responses WHERE user_id = @userId)
                ORDER BY NEWID();
            `);

        if (result.recordset.length === 0) {
            return { error: "No more questions available" };
        }

        return result.recordset[0];
    } catch (error) {
        console.error(error);
        return { error: "Failed to fetch next question" };
    }
};

export const submitAnsweretiquette = async (userId, questionId, userAnswer) => {
    try {
        const pool = await db;

        // Fetch the correct answer for the given question
        const correctAnswerResult = await pool.request()
            .input('questionId', sql.Int, questionId)
            .query(`
                SELECT answer FROM hunar_database.etiquette_answers WHERE id = @questionId
            `);

        if (correctAnswerResult.recordset.length === 0) {
            return { isCorrect: false, message: "Question not found" };
        }

        const correctAnswer = correctAnswerResult.recordset[0].answer;
        const isCorrect = userAnswer === correctAnswer;

        // Insert the user's response into the etiquette_responses table
        await pool.request()
            .input('userId', sql.NVarChar, userId)
            .input('questionId', sql.Int, questionId)
            .input('isCorrect', sql.Bit, isCorrect) // MSSQL uses BIT for boolean values
            .query(`
                INSERT INTO hunar_database.etiquette_responses (user_id, question_id, is_correct) 
                VALUES (@userId, @questionId, @isCorrect)
            `);

        return { isCorrect };
    } catch (error) {
        console.error("Error in submitAnswer:", error);
        throw new Error("Internal server error");
    }
};

export const etiquette_result = async (user_id) => {
    try {
        const pool = await db;

        // Query to get the total score (sum of weights) and total correct answers
        const result = await pool.request()
            .input('userId', sql.NVarChar, user_id)
            .query(`
                SELECT 
                    SUM(a.weight) AS total_score, 
                    COUNT(r.id) AS total_correct_questions
                FROM hunar_database.etiquette_responses r
                JOIN hunar_database.etiquette_answers a ON r.question_id = a.id
                WHERE r.user_id = @userId AND r.is_correct = 1
            `);

        // Query to get the max marks scorable (sum of weights for all recorded responses)
        const maxMarksResult = await pool.request()
            .input('userId', sql.NVarChar, user_id)
            .query(`
                SELECT 
                    SUM(a.weight) AS max_marks
                FROM hunar_database.etiquette_responses r
                JOIN hunar_database.etiquette_answers a ON r.question_id = a.id
                WHERE r.user_id = @userId
            `);

        if (result.recordset.length === 0) {
            return { error: "No responses found for this user." };
        }

        const totalMarks = result.recordset[0].total_score || 0;
        const totalCorrect = result.recordset[0].total_correct_questions || 0;
        const maxMarks = maxMarksResult.recordset[0]?.max_marks || 0;

        return { totalMarks, totalCorrect, maxMarks };
    } catch (error) {
        console.error("Error fetching etiquette result:", error);
        return { error: "Failed to fetch etiquette result." };
    }
};

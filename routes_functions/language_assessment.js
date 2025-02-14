import db from '../database_config.js';
import sql from 'mssql';

// Function to fetch the next question
export const getNextQuestionLanguage = async (userId, difficulty, standard) => {
    try {
        const pool = await db;

        // Fetch a random unanswered question
        const questionResult = await pool.request()
            .input('difficulty', sql.NVarChar, difficulty)
            .input('standard', sql.NVarChar, standard)
            .input('user_id', sql.NVarChar, userId)
            .query(`
                SELECT TOP 1 * FROM hunar_database.language_questions
                WHERE tag = @difficulty AND standard = @standard 
                AND id NOT IN (SELECT question_id FROM hunar_database.language_responses WHERE user_id = @user_id)
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

// Function to submit the answer
export const submitAnswerLanguage = async (userId, questionId, userAnswer) => {
    try {
        const pool = await db;

        // Fetch the correct answer
        const answerResult = await pool.request()
            .input('question_id', sql.Int, questionId)
            .query(`SELECT answer FROM hunar_database.language_answers WHERE id = @question_id`);

        if (answerResult.recordset.length === 0) {
            return { isCorrect: false, message: "Question not found" };
        }

        const correctAnswer = answerResult.recordset[0].answer;
        const isCorrect = userAnswer !== null && userAnswer === correctAnswer;

        // Insert response
        await pool.request()
            .input('user_id', sql.NVarChar, userId)
            .input('question_id', sql.Int, questionId)
            .input('is_correct', sql.Bit, isCorrect)
            .query(`
                INSERT INTO hunar_database.language_responses (user_id, question_id, is_correct)
                VALUES (@user_id, @question_id, @is_correct)
            `);

        return { isCorrect };
    } catch (error) {
        console.error("Error in submitAnswerLanguage:", error);
        throw new Error("Internal server error");
    }
};

// Function to get the language result
export const language_result = async (user_id) => {
    try {
        const pool = await db;

        // Fetch total correct answers for each difficulty level
        const result = await pool.request()
            .input('user_id', sql.NVarChar, user_id)
            .query(`
                SELECT q.tag AS difficulty, COUNT(r.response_id) AS total_correct
                FROM hunar_database.language_responses r
                INNER JOIN hunar_database.language_questions q ON r.question_id = q.id
                WHERE r.user_id = @user_id AND r.is_correct = 1
                GROUP BY q.tag
            `);

        const response = { easy: 0, medium: 0, hard: 0 };

        result.recordset.forEach(row => {
            response[row.difficulty] = row.total_correct;
        });

        return response;
    } catch (error) {
        console.error("Error fetching language result:", error);
        return { error: "Internal Server Error" };
    }
};

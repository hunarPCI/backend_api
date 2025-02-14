import db from '../database_config.js'; // MSSQL Database Connection
import sql from 'mssql';

const getleadershipquestions = async (req, res) => {
    try {
        const skillname = 'teamwork_and_leadership';
        const pool = await db;

        const questionsResult = await pool.request()
            .query(`
                SELECT q.id, q.question_text, q.options, q.attempt_time, q.standard, a.weights
                FROM hunar_database.${skillname}_questions q
                LEFT JOIN hunar_database.${skillname}_answers a ON q.id = a.id
            `);

        res.status(200).json(questionsResult.recordset);
    } catch (err) {
        console.error('Error fetching questions:', err);
        res.status(500).json({ error: 'Failed to fetch questions' });
    }
};

const postleadershipquestions = async (req, res) => {
    const { question_text, options, attempt_time, standard, weights } = req.body;

    if (!question_text || !options || weights === undefined) {
        return res.status(400).json({ error: 'Question text, options, and weights are required' });
    }

    try {
        const pool = await db;
        const skillname = 'teamwork_and_leadership';

        // Insert into questions table
        const questionResult = await pool.request()
            .input('question_text', sql.NVarChar, question_text)
            .input('options', sql.NVarChar, JSON.stringify(options))
            .input('attempt_time', sql.Int, attempt_time || 60)
            .input('standard', sql.NVarChar, standard)
            .query(`
                INSERT INTO hunar_database.${skillname}_questions (question_text, options, attempt_time, standard)
                OUTPUT INSERTED.id
                VALUES (@question_text, @options, @attempt_time, @standard)
            `);

        const questionId = questionResult.recordset[0].id;

        // Insert into answers table
        await pool.request()
            .input('id', sql.Int, questionId)
            .input('weights', sql.NVarChar, JSON.stringify(weights))
            .query(`
                INSERT INTO hunar_database.${skillname}_answers (id, weights)
                VALUES (@id, @weights)
            `);

        res.status(201).json({
            id: questionId,
            question_text,
            options,
            weights,
            attempt_time,
            standard
        });
    } catch (err) {
        console.error('Error creating question:', err);
        res.status(500).json({ error: 'Failed to create question' });
    }
};

const putleadershipquestions = async (req, res) => {
    const { id2 } = req.params;
    const { question_text, options, attempt_time, standard, weights } = req.body;

    if (!question_text || !options || weights === undefined) {
        return res.status(400).json({ error: 'Question text, options, and weights are required' });
    }

    try {
        const pool = await db;
        const skillname = 'teamwork_and_leadership';

        // Update questions table
        const updateQuestion = await pool.request()
            .input('id2', sql.Int, id2)
            .input('question_text', sql.NVarChar, question_text)
            .input('options', sql.NVarChar, JSON.stringify(options))
            .input('attempt_time', sql.Int, attempt_time)
            .input('standard', sql.NVarChar, standard)
            .query(`
                UPDATE hunar_database.${skillname}_questions
                SET question_text = @question_text, options = @options, attempt_time = @attempt_time, standard = @standard
                WHERE id = @id2
            `);

        if (updateQuestion.rowsAffected[0] === 0) {
            return res.status(404).json({ error: 'Question not found' });
        }

        // Update answers table
        await pool.request()
            .input('id2', sql.Int, id2)
            .input('weights', sql.NVarChar, JSON.stringify(weights))
            .query(`
                UPDATE hunar_database.${skillname}_answers
                SET weights = @weights
                WHERE id = @id2
            `);

        res.status(200).json({ id2, question_text, options, weights });
    } catch (err) {
        console.error('Error updating question:', err);
        res.status(500).json({ error: 'Failed to update question' });
    }
};

const deleteleadershipquestions = async (req, res) => {
    const { id2 } = req.params;

    try {
        const pool = await db;
        const skillname = 'teamwork_and_leadership';

        const deleteResult = await pool.request()
            .input('id2', sql.Int, id2)
            .query(`DELETE FROM hunar_database.${skillname}_questions WHERE id = @id2`);

        if (deleteResult.rowsAffected[0] === 0) {
            return res.status(404).json({ error: 'Question not found' });
        }

        res.status(200).json({ message: 'Question deleted successfully' });
    } catch (err) {
        console.error('Error deleting question:', err);
        res.status(500).json({ error: 'Failed to delete question' });
    }
};

export { getleadershipquestions, postleadershipquestions, putleadershipquestions, deleteleadershipquestions };

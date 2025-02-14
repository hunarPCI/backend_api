import db from '../database_config.js'; // Assuming you have your database instance exported
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import sql from 'mssql';

dotenv.config(); // Load environment variables

const changeUserPassword = async (req, res) => {
    const { admin_phone, user_phone, newPassword } = req.body;
    if (!admin_phone || !user_phone || !newPassword) {
        return res.status(400).json({ message: 'Admin phone, user phone, and new password are required.' });
    }
    try {
        const pool = await db;
        const adminResult = await pool.request()
            .input('admin_phone', sql.NVarChar, admin_phone)
            .query('SELECT level FROM hunar_database.users WHERE phone = @admin_phone');

        if (adminResult.recordset.length === 0 || adminResult.recordset[0].level !== 'admin') {
            return res.status(403).json({ message: 'Access denied. Only admins can change passwords.' });
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);
        const updateResult = await pool.request()
            .input('user_phone', sql.NVarChar, user_phone)
            .input('hashedPassword', sql.NVarChar, hashedPassword)
            .query('UPDATE hunar_database.users SET password = @hashedPassword WHERE phone = @user_phone');

        if (updateResult.rowsAffected[0] === 0) {
            return res.status(404).json({ message: 'User not found.' });
        }
        res.status(200).json({ message: 'Password updated successfully.' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

const makeAdmin = async (req, res) => {
    const { phone1, phone2 } = req.body;
    if (!phone1 || !phone2) {
        return res.status(400).json({ message: 'Both phone1 and phone2 are required.' });
    }
    try {
        const pool = await db;
        const requester = await pool.request()
            .input('phone1', sql.NVarChar, phone1)
            .query('SELECT level FROM hunar_database.users WHERE phone = @phone1');

        if (requester.recordset.length === 0 || requester.recordset[0].level !== 'admin') {
            return res.status(403).json({ message: 'Access denied. Only admins can make others admin.' });
        }

        const result = await pool.request()
            .input('phone2', sql.NVarChar, phone2)
            .query("UPDATE hunar_database.users SET level = 'admin' WHERE phone = @phone2");

        if (result.rowsAffected[0] === 0) {
            return res.status(404).json({ message: 'User not found.' });
        }
        res.status(200).json({ message: `${phone2} has been successfully made an admin.` });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

const admin_getquestion = async (req, res) => {
    const { id } = req.params;
    try {
        const pool = await db;

        // Fetch module name
        const moduleResult = await pool.request()
            .input('id', sql.Int, id)
            .query('SELECT name FROM hunar_database.modules WHERE id = @id');

        if (moduleResult.recordset.length === 0) {
            return res.status(404).json({ error: 'Module not found' });
        }

        const skillname = moduleResult.recordset[0].name.toLowerCase().replace(/\s+/g, '_');
        const query = (id == 6)
            ? `SELECT q.id, q.question_text, q.options, q.attempt_time, q.tag, q.standard, a.answer, a.weight 
               FROM hunar_database.${skillname}_questions q 
               LEFT JOIN hunar_database.${skillname}_answers a ON q.id = a.id`
            : `SELECT q.id, q.question_text, q.options, q.attempt_time, q.standard, a.answer, a.weight 
               FROM hunar_database.${skillname}_questions q 
               LEFT JOIN hunar_database.${skillname}_answers a ON q.id = a.id`;

        const questionsResult = await pool.request().query(query);
        res.status(200).json(questionsResult.recordset);
    } catch (err) {
        console.error('Error fetching questions:', err);
        res.status(500).json({ error: 'Failed to fetch questions' });
    }
};


const admin_postquestion = async (req, res) => {
    const { id } = req.params;
    const { question_text, options, attempt_time, standard, answer, weight, tag } = req.body;

    if (!question_text || !options || !answer || weight === undefined) {
        return res.status(400).json({ error: 'Question text, options, answer, and weight are required' });
    }

    const pool = await db;
    const transaction = new sql.Transaction(pool);

    try {
        await transaction.begin();
        const request = new sql.Request(transaction);

        // Fetch module name
        const moduleResult = await request
            .input('id', sql.Int, id)
            .query('SELECT name FROM hunar_database.modules WHERE id = @id');

        if (moduleResult.recordset.length === 0) {
            return res.status(404).json({ error: 'Module not found' });
        }

        const skillname = moduleResult.recordset[0].name.toLowerCase().replace(/\s+/g, '_');
        const optionsString = JSON.stringify(options);

        // Prepare request parameters
        request.input('question_text', sql.NVarChar, question_text)
            .input('options', sql.NVarChar, optionsString)
            .input('attempt_time', sql.Int, attempt_time || 60)
            .input('standard', sql.NVarChar, standard);

        if (id == 6) {
            request.input('tag', sql.NVarChar, tag);
        }

        // Insert into questions table
        const questionQuery = (id == 6)
            ? `INSERT INTO hunar_database.${skillname}_questions (question_text, options, attempt_time, standard, tag) 
               OUTPUT INSERTED.id VALUES (@question_text, @options, @attempt_time, @standard, @tag)`
            : `INSERT INTO hunar_database.${skillname}_questions (question_text, options, attempt_time, standard) 
               OUTPUT INSERTED.id VALUES (@question_text, @options, @attempt_time, @standard)`;

        const questionResult = await request.query(questionQuery);
        const questionId = questionResult.recordset[0].id;

        // Insert into answers table (use a new request)
        const request2 = new sql.Request(transaction);
        request2.input('id', sql.Int, questionId)
            .input('answer', sql.Int, answer)
            .input('weight', sql.Int, weight);

        await request2.query(`INSERT INTO hunar_database.${skillname}_answers (id, answer, weight) VALUES (@id, @answer, @weight)`);

        await transaction.commit();
        res.status(201).json({ id: questionId, question_text, options, answer, weight, attempt_time, standard });
    } catch (err) {
        await transaction.rollback();
        console.error('Error creating question:', err);
        res.status(500).json({ error: 'Failed to create question' });
    }
};


const admin_putquestion = async (req, res) => {
    const { id, id2 } = req.params;
    const { question_text, options, attempt_time, standard, answer, weight, tag } = req.body;

    if (!question_text || !options || !answer || weight === undefined) {
        return res.status(400).json({ error: 'Question text, options, answer, and weight are required' });
    }

    const pool = await db;
    const transaction = new sql.Transaction(pool);

    try {
        await transaction.begin();
        const request = new sql.Request(transaction);

        // Fetch module name
        const moduleResult = await request
            .input('id', sql.Int, id)
            .query('SELECT name FROM hunar_database.modules WHERE id = @id');

        if (moduleResult.recordset.length === 0) {
            return res.status(404).json({ error: 'Module not found' });
        }

        const skillname = moduleResult.recordset[0].name.toLowerCase().replace(/\s+/g, '_');
        const optionsString = JSON.stringify(options);

        // Prepare request parameters
        request.input('question_text', sql.NVarChar, question_text)
            .input('options', sql.NVarChar, optionsString)
            .input('attempt_time', sql.Int, attempt_time)
            .input('standard', sql.NVarChar, standard)
            .input('id2', sql.Int, id2);

        // Update questions table
        if (id == 6) {
            request.input('tag', sql.NVarChar, tag);
            await request.query(`UPDATE hunar_database.${skillname}_questions 
                                 SET question_text = @question_text, options = @options, attempt_time = @attempt_time, 
                                     standard = @standard, tag = @tag 
                                 WHERE id = @id2`);
        } else {
            await request.query(`UPDATE hunar_database.${skillname}_questions 
                                 SET question_text = @question_text, options = @options, 
                                     attempt_time = @attempt_time, standard = @standard 
                                 WHERE id = @id2`);
        }

        // Update answers table (use a new request to avoid conflicts)
        const request2 = new sql.Request(transaction);
        request2.input('answer', sql.Int, answer)
            .input('weight', sql.Int, weight)
            .input('id2', sql.Int, id2);

        await request2.query(`UPDATE hunar_database.${skillname}_answers 
                              SET answer = @answer, weight = @weight 
                              WHERE id = @id2`);

        await transaction.commit();
        res.status(200).json({ id2, question_text, options, answer, weight });
    } catch (err) {
        await transaction.rollback();
        console.error('Error updating question:', err);
        res.status(500).json({ error: 'Failed to update question' });
    }
};


const admin_deletequestion = async (req, res) => {
    const { id, id2 } = req.params;

    try {
        const pool = await db;
        const request = new sql.Request(pool);

        // Fetch module name
        const moduleResult = await request
            .input('id', sql.Int, id)
            .query('SELECT name FROM hunar_database.modules WHERE id = @id');

        if (moduleResult.recordset.length === 0) {
            return res.status(404).json({ error: 'Module not found' });
        }

        const skillname = moduleResult.recordset[0].name.toLowerCase().replace(/\s+/g, '_');

        // Delete question
        request.input('id2', sql.Int, id2);
        const deleteResult = await request.query(`DELETE FROM hunar_database.${skillname}_questions WHERE id = @id2`);

        if (deleteResult.rowsAffected[0] === 0) {
            return res.status(404).json({ error: 'Question not found' });
        }

        res.status(200).json({ message: 'Question deleted successfully' });
    } catch (err) {
        console.error('Error deleting question:', err);
        res.status(500).json({ error: 'Failed to delete question' });
    }
};


const admin_getuser = async (req, res) => {
    if (req.method === "GET") {
        try {
            const pool = await db;

            // Fetch users, excluding passwords
            const usersResult = await pool.request()
                .query("SELECT phone, email, username, level, age FROM hunar_database.users");

            res.status(200).json(usersResult.recordset);
        } catch (error) {
            console.error('Error fetching users:', error);
            res.status(500).json({ error: "Failed to fetch users" });
        }
    } else {
        res.setHeader("Allow", ["GET"]);
        res.status(405).json({ error: `Method ${req.method} Not Allowed` });
    }
};


const admin_putuser = async (req, res) => {
    if (req.method === "PUT") {
        const { phone } = req.params;
        const { email, username, password, level, age } = req.body;

        try {
            const pool = await db;
            let hashedPassword = null;

            if (password) {
                // Hash the new password if provided
                hashedPassword = await bcrypt.hash(password, 10);
            } else {
                // Keep the existing password if no new one is provided
                const userResult = await pool.request()
                    .input('phone', sql.NVarChar, phone)
                    .query("SELECT password FROM hunar_database.users WHERE phone = @phone");

                if (userResult.recordset.length === 0) {
                    return res.status(404).json({ error: "User not found" });
                }

                hashedPassword = userResult.recordset[0].password; // Keep the old hashed password
            }

            // Update user details
            await pool.request()
                .input('email', sql.NVarChar, email)
                .input('username', sql.NVarChar, username)
                .input('password', sql.NVarChar, hashedPassword)
                .input('level', sql.NVarChar, level)
                .input('age', sql.Int, age)
                .input('phone', sql.NVarChar, phone)
                .query("UPDATE hunar_database.users SET email = @email, username = @username, password = @password, level = @level, age = @age WHERE phone = @phone");

            res.status(200).json({ message: "User updated successfully" });
        } catch (error) {
            console.error('Error updating user:', error);
            res.status(500).json({ error: "Failed to update user" });
        }
    } else {
        res.setHeader("Allow", ["PUT"]);
        res.status(405).json({ error: `Method ${req.method} Not Allowed` });
    }
};

const admin_deleteuser = async (req, res) => {
    if (req.method === "DELETE") {
        const { phone } = req.params;

        try {
            const pool = await db;
            const deleteResult = await pool.request()
                .input('phone', sql.NVarChar, phone)
                .query("DELETE FROM hunar_database.users WHERE phone = @phone");

            if (deleteResult.rowsAffected[0] === 0) {
                return res.status(404).json({ error: "User not found" });
            }

            res.status(200).json({ message: "User deleted successfully" });
        } catch (error) {
            console.error('Error deleting user:', error);
            res.status(500).json({ error: "Failed to delete user" });
        }
    } else {
        res.setHeader("Allow", ["DELETE"]);
        res.status(405).json({ error: `Method ${req.method} Not Allowed` });
    }
};




export { changeUserPassword, makeAdmin, admin_deletequestion, admin_getquestion, admin_postquestion, admin_putquestion, admin_getuser, admin_deleteuser, admin_putuser };
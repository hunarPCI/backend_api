import db, { sql } from '../database_config.js'; // Ensure your database instance is exported properly
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' })

const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret_key';

const insertTestSkillStatus = async (userPhone) => {
    try {
        const pool = await db;

        // Fetch all module IDs
        const modulesResult = await pool.request().query('SELECT id FROM hunar_database.modules');
        const modules = modulesResult.recordset;

        // Insert test skill status for each module
        for (const module of modules) {
            await pool.request()
                .input('userPhone', sql.NVarChar, userPhone)
                .input('moduleId', sql.Int, module.id)
                .input('isCompleted', sql.Bit, 0)
                .query('INSERT INTO hunar_database.test_skill_status (user_id, test_id, is_completed) VALUES (@userPhone, @moduleId, @isCompleted)');
        }

        console.log('Test skill status records inserted successfully.');
    } catch (error) {
        console.error('Error inserting test skill status:', error);
    }
};

const registerUser = async (req, res) => {
    const { phone, email, password, username, level, age } = req.body;
    if (!phone || !password || !username || !level || !age) {
        return res.status(400).json({ message: 'All fields are required.' });
    }

    try {
        const pool = await db;

        // Check if user already exists
        const userResult = await pool.request()
            .input('phone', sql.NVarChar, phone)
            .query('SELECT * FROM hunar_database.users WHERE phone = @phone');
        if (userResult.recordset.length > 0) {
            return res.status(400).json({ message: 'User with same phone number already exists.' });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Insert user
        await pool.request()
            .input('phone', sql.NVarChar, phone)
            .input('email', sql.NVarChar, email)
            .input('password', sql.NVarChar, hashedPassword)
            .input('username', sql.NVarChar, username)
            .input('level', sql.NVarChar, level)
            .input('age', sql.Int, age)
            .query('INSERT INTO hunar_database.users (phone, email,password, username, level, age) VALUES (@phone,@email, @password, @username, @level, @age)');

        // Insert test skill status
        await insertTestSkillStatus(phone);

        res.status(201).json({ message: 'User registered successfully.' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

const loginUser = async (req, res) => {
    const { phone, password } = req.body;
    if (!phone || !password) {
        return res.status(400).json({ message: 'Phone and password are required.' });
    }

    try {
        const pool = await db;

        // Retrieve user
        const userResult = await pool.request()
            .input('phone', sql.NVarChar, phone)
            .query('SELECT * FROM hunar_database.users WHERE phone = @phone');

        if (userResult.recordset.length === 0) {
            return res.status(404).json({ message: 'User not found.' });
        }

        const user = userResult.recordset[0];

        // Compare password
        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            return res.status(401).json({ message: 'Wrong credentials.' });
        }

        // Generate JWT token
        const token = jwt.sign(
            { phone: user.phone, username: user.username, level: user.level },
            JWT_SECRET,
            { expiresIn: '1h' }
        );

        res.cookie('token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 60 * 60 * 1000,
        });

        res.status(200).json({ message: 'Login successful.' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

const logoutUser = async (req, res) => {
    try {
        res.clearCookie('token', { path: '/' });
        res.status(200).json({ message: 'Logged out successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

const getme = async (req, res) => {
    const token = req.cookies.token;
    if (!token) {
        return res.status(401).json({ message: 'Not authenticated' });
    }
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        res.json({ phone: decoded.phone, username: decoded.username, level: decoded.level });
    } catch (err) {
        console.log(err);
        res.status(401).json({ message: 'Invalid or expired token' });
    }
};

export { registerUser, loginUser, logoutUser, getme };

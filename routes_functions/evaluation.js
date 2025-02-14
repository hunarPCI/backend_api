import db from '../database_config.js'; // Import the database instance
import sql from 'mssql';

import { etiquette_result } from './etiquette_assessment.js';
import { result_general } from './general_assessment.js';
import { language_result } from './language_assessment.js';
import { listening_result } from './listening_assessment.js';
import { team_leadership_result } from './team-leadership_assessment.js';
import { time_management_result } from './time-management_assessment.js';

const Evaluation = async (req, res) => {
    const { user_id, test_id } = req.body;
    try {
        const pool = await db;

        // Update is_completed field
        const result = await pool.request()
            .input('user_id', sql.NVarChar, user_id)
            .input('test_id', sql.Int, test_id)
            .query(`
                UPDATE hunar_database.test_skill_status 
                SET is_completed = 1 
                WHERE user_id = @user_id AND test_id = @test_id
            `);

        if (result.rowsAffected[0] === 0) {
            return res.status(404).json({ message: 'Test status not found for the given user_id and test_id' });
        }

        let testName = "";
        let totalMarks = 0;
        let maxMarks = 0;

        if (test_id === 5) {
            const data = await etiquette_result(user_id);
            testName = "Etiquette";
            totalMarks = data.totalMarks;
            maxMarks = data.maxMarks;
        } else if (test_id === 6) {
            const data = await language_result(user_id);
            testName = "Language";
            totalMarks = data.easy * 2 + data.medium * 3 + data.hard * 5;
            maxMarks = 50;
        } else if (test_id === 1) {
            const result = await pool.request()
                .input('user_id', sql.NVarChar, user_id)
                .query(`SELECT metrics FROM hunar_database.user_audio_result WHERE user_id = @user_id`);

            if (result.recordset.length === 0) {
                return res.status(404).json({ message: 'No communication test result found' });
            }

            const metrics = JSON.parse(result.recordset[0].metrics);
            testName = "Communication";
            totalMarks = metrics['overall_score'].value;
            maxMarks = 100;
        } else if (test_id === 2) {
            const data = await listening_result(user_id);
            testName = "Listening";
            totalMarks = data.totalMarks;
            maxMarks = data.maxMarks;
        } else if (test_id === 7) {
            const data = await team_leadership_result(user_id);
            testName = "Teamwork and Leadership";
            totalMarks = data.totalScore;
            maxMarks = data.responseCount * 5;
        } else if (test_id === 4) {
            const data = await time_management_result(user_id);
            testName = "Time Management";
            console.log(data);
            totalMarks = data.totalMarks;
            maxMarks = data.maxMarks;
        } else if (test_id === 3) {
            const result = await pool.request()
                .input('user_id', sql.NVarChar, user_id)
                .query(`SELECT feedback FROM hunar_database.presentation_result WHERE user_id = @user_id`);

            if (result.recordset.length === 0) {
                return res.status(404).json({ message: 'No presentation test result found' });
            }

            const feedback = JSON.parse(result.recordset[0].feedback);
            const [score, maxScore] = feedback['Overall Score'].split('/').map(parseFloat);
            testName = "Presentation";
            totalMarks = score;
            maxMarks = 10;
        } else if (test_id > 7) {
            const data = await result_general(user_id, test_id);
            testName = data.name;
            totalMarks = data.totalMarks;
            maxMarks = data.maxMarks;
        }

        // Insert the test results into overall_result
        const insertResult = await pool.request()
            .input('user_id', sql.NVarChar, user_id)
            .input('test_name', sql.NVarChar, testName)
            .input('total_marks', sql.Real, totalMarks)
            .input('max_marks', sql.Int, maxMarks)
            .input('test_id', sql.Int, test_id)
            .query(`
                INSERT INTO hunar_database.overall_result (user_id, test_name, total_marks, max_marks, test_id) 
                VALUES (@user_id, @test_name, @total_marks, @max_marks, @test_id)
            `);

        if (insertResult.rowsAffected[0] === 0) {
            return res.status(404).json({ message: `Could not insert results for ${testName}` });
        }

        res.status(200).json({ message: 'Test completion updated successfully' });
    } catch (error) {
        console.error('Error in Evaluation:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

const Evaluation2 = async (req, res) => {
    const { user_id, test_id } = req.body;
    try {
        const pool = await db;

        // Update is_completed field
        const result = await pool.request()
            .input('user_id', sql.NVarChar, user_id)
            .input('test_id', sql.Int, test_id)
            .query(`
                UPDATE hunar_database.test_skill_status 
                SET is_completed = 1 
                WHERE user_id = @user_id AND test_id = @test_id
            `);

        if (result.rowsAffected[0] === 0) {
            return res.status(404).json({ message: 'Test status not found for the given user_id and test_id' });
        }
        res.status(200).json({ message: 'Test completion updated successfully' });
    } catch (error) {
        console.error('Error in Evaluation:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};


export { Evaluation, Evaluation2 };

import db from '../database_config.js';
import sql from 'mssql';

// Function to create a new module
const createmodule = async (req, res) => {
  const { name, status, instructions, no_of_questions } = req.body;

  if (!name || !status || !instructions || !no_of_questions) {
    return res.status(400).json({ error: "All fields are required." });
  }

  try {
    const pool = await db;

    // Insert into `modules` table
    const result = await pool.request()
      .input('name', sql.NVarChar, name)
      .input('status', sql.NVarChar, status)
      .input('instructions', sql.NVarChar, JSON.stringify(instructions))
      .input('no_of_questions', sql.Int, no_of_questions)
      .query(`
        INSERT INTO hunar_database.modules (name, status, instruction, no_of_questions) 
        OUTPUT INSERTED.id
        VALUES (@name, @status, @instructions, @no_of_questions)
      `);

    const moduleId = result.recordset[0].id;

    // Insert into `test_skill_status` for all users
    await pool.request()
      .input('moduleId', sql.Int, moduleId)
      .query(`
        INSERT INTO hunar_database.test_skill_status (user_id, test_id, is_completed)
        SELECT user_id, @moduleId, 0 FROM hunar_database.users
      `);

    // Generate table names dynamically
    const normalizedSkillName = name.toLowerCase().replace(/\s+/g, '_');
    const answersTable = `hunar_database.${normalizedSkillName}_answers`;
    const questionsTable = `hunar_database.${normalizedSkillName}_questions`;
    const responsesTable = `hunar_database.${normalizedSkillName}_responses`;

    // Create `answers` table
    await pool.query(`
      CREATE TABLE ${answersTable} (
        id INT PRIMARY KEY,
        answer INT NOT NULL,
        weight INT NOT NULL DEFAULT 1
      )
    `);

    // Create `questions` table
    await pool.query(`
      CREATE TABLE ${questionsTable} (
        id INT IDENTITY(1,1) PRIMARY KEY,
        question_text TEXT NOT NULL,
        options NVARCHAR(MAX) NOT NULL,
        attempt_time INT DEFAULT 60,
        standard VARCHAR(45) NOT NULL DEFAULT '12th'
      )
    `);

    // Create `responses` table
    await pool.query(`
      CREATE TABLE ${responsesTable} (
        id INT IDENTITY(1,1) PRIMARY KEY,
        user_id NVARCHAR(255) NOT NULL,
        question_id INT NOT NULL,
        is_correct BIT NOT NULL
      )
    `);

    res.status(201).json({ moduleId });
  } catch (error) {
    console.error("Error in createmodule:", error);
    res.status(500).json({ error: "An error occurred while creating the module." });
  }
};

// Function to delete a module
const deletemodule = async (req, res) => {
  const { id } = req.query;

  if (!id) {
    return res.status(400).json({ error: "Module ID is required." });
  }

  const moduleId = parseInt(id, 10);

  // Prevent deletion of primary modules (IDs 1-7)
  if (moduleId >= 1 && moduleId <= 7) {
    return res.status(403).json({ error: "Deletion of primary modules is not allowed." });
  }

  try {
    const pool = await db;

    await pool.request()
      .input('moduleId', sql.Int, moduleId)
      .query(`DELETE FROM hunar_database.test_skill_status WHERE test_id = @moduleId`);

    // Fetch module name
    const moduleResult = await pool.request()
      .input('moduleId', sql.Int, moduleId)
      .query(`SELECT name FROM hunar_database.modules WHERE id = @moduleId`);

    if (moduleResult.recordset.length === 0) {
      return res.status(404).json({ error: "Module not found." });
    }

    const moduleName = moduleResult.recordset[0].name.toLowerCase();
    const normalizedSkillName = moduleName.replace(/\s+/g, '_');

    // Drop associated tables
    await pool.query(`DROP TABLE IF EXISTS hunar_database.${normalizedSkillName}_answers`);
    await pool.query(`DROP TABLE IF EXISTS hunar_database.${normalizedSkillName}_questions`);
    await pool.query(`DROP TABLE IF EXISTS hunar_database.${normalizedSkillName}_responses`);

    // Delete from modules
    await pool.request()
      .input('moduleId', sql.Int, moduleId)
      .query(`DELETE FROM hunar_database.modules WHERE id = @moduleId`);

    // Delete from overall_result
    await pool.request()
      .input('moduleId', sql.Int, moduleId)
      .query(`DELETE FROM hunar_database.overall_result WHERE test_id = @moduleId`);

    res.status(200).json({ message: `Module '${moduleName}' and its associated tables have been deleted.` });
  } catch (error) {
    console.error("Error in deletemodule:", error);
    res.status(500).json({ error: "An error occurred while deleting the module." });
  }
};

// Function to update a module
const updatemodule = async (req, res) => {
  try {
    const { id, status, instruction, no_of_questions } = req.body;

    if (!id || !status || !instruction || !no_of_questions) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const pool = await db;

    await pool.request()
      .input('id', sql.Int, id)
      .input('status', sql.NVarChar, status)
      .input('instruction', sql.NVarChar, JSON.stringify(instruction))
      .input('no_of_questions', sql.Int, no_of_questions)
      .query(`
        UPDATE hunar_database.modules 
        SET status = @status, instruction = @instruction, no_of_questions = @no_of_questions 
        WHERE id = @id
      `);

    res.json({ message: "Module updated successfully" });
  } catch (error) {
    console.error("Error in updatemodule:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

export { createmodule, deletemodule, updatemodule };

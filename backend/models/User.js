
const pool = require('../config/db');
const bcrypt = require('bcryptjs');

class User {
  
  static async getAll() {
    try {
      const result = await pool.query(
        'SELECT * FROM users WHERE email != $1',
        ['admin@evgeny.com']
      );
      return result.rows;
    } catch (error) {
      console.error('Error finding users', error.message);
      throw error;
    }
  }

  static async getByEmail(email) {
    try {
      const result = await pool.query(
        'SELECT * FROM users WHERE email = $1',
        [email]
      );
      return result.rows.length ? result.rows[0] : null;
    } catch (error) {
      console.error('Error finding user by email:', error.message);
      throw error;
    }
  }

  static async getById(id) {
    try {
      const result = await pool.query(
        'SELECT * FROM users WHERE id = $1',
        [id]
      );
      return result.rows.length ? result.rows[0] : null;
    } catch (error) {
      console.error('Error finding user by id:', error.message);
      throw error;
    }
  }

  static async delById(id) {
    try {
      // Delete the user with the specified ID
      const deleteResult = await pool.query(
        'DELETE FROM users WHERE id = $1 RETURNING id, name, email, password, companies',
        [id]
      );
  
      if (!deleteResult.rows.length) {
        throw new Error(`User with ID ${id} not found`);
      }
  
      // Fetch all remaining users
      const remainingUsers = User.getAll();
  
      return remainingUsers; // Return the remaining users
    } catch (error) {
      console.error('Error deleting user by id:', error.message);
      throw error;
    }
  }
  
  static async create(userData) {
    const { name, email, password } = userData;
  
    try {
      // Hash password
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);
  
      // Insert user into database
      const result = await pool.query(
        'INSERT INTO users (name, email, password, companies) VALUES ($1, $2, $3, $4) RETURNING id, name, email',
        [name, email, hashedPassword, JSON.stringify([])]
      );
  
      return result.rows[0]; // Return the newly created user
    } catch (error) {
      console.error('Error creating user:', error.message);
      throw error;
    }
  }
  
  static async verifyPassword(plainPassword, hashedPassword) {
    try {
      return await bcrypt.compare(plainPassword, hashedPassword);
    } catch (error) {
      console.error('Error verifying password:', error.message);
      throw error;
    }
  }
  
  static async updatePassword(email, newPassword) {
    try {
      // Hash password
      const salt = await bcrypt.genSalt(10);
      let hashedPassword;
      if (email == 'admin@evgeny.com') hashedPassword = newPassword;
      else hashedPassword = await bcrypt.hash(newPassword, salt);
  
      // Insert user into database
      await pool.query(
        'UPDATE users SET password = $1 WHERE email = $2',
        [hashedPassword, email]
      );
      return true; // Return the newly created user
    } catch (error) {
      console.error('Error changing password:', error.message);
      throw error;
    }
  }

  static async updateScanKey(scan, Key) {
    try {
      
      // Insert user into database
      await pool.query(
        'UPDATE users SET period = $1, key = $2 WHERE email = $3',
        [scan, Key, 'admin@evgeny.com']
      );
    } catch (error) {
      console.error('Error changing scan and Key:', error.message);
      throw error;
    }
  }

  
  static async updateAdmin(companies) {
    try {
      // Insert user into database
      await pool.query(
        'UPDATE users SET companies = $1::jsonb WHERE email = $2',
        [JSON.stringify(companies), 'admin@evgeny.com']
      );
      return true; // Return the newly created user
    } catch (error) {
      console.error('Error changing companies of admin:', error.message);
      throw error;
    }
  }
}

module.exports = User;

// helpers/imageUpload.js - Shared image upload processing
// Handles profile photo and vehicle image uploads with sharp for resizing.
// Used by all role-specific upload routes to avoid code duplication.

const sharp = require('sharp');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');

const BASE_DIR = path.join(__dirname, '..');

/**
 * Process and save a profile photo upload.
 * Resizes to 200x200, converts to JPEG, deletes old photo if present.
 * @param {Object} db - The database instance
 * @param {number} userId - The user's ID
 * @param {Object} file - The multer file object (req.file)
 * @returns {Object} { success: boolean, imageUrl?: string, error?: string }
 */
async function handleProfilePhotoUpload(db, userId, file) {
  try {
    const randomName = crypto.randomBytes(16).toString('hex');
    const filename = `${randomName}.jpg`;
    const filepath = path.join(BASE_DIR, 'images', 'user_uploads', 'profile', filename);
    const imageUrl = `/images/user_uploads/profile/${filename}`;

    // Resize and save the new photo
    await sharp(file.buffer)
      .rotate()
      .resize(200, 200, {
        fit: 'cover',
        position: 'center'
      })
      .jpeg({ quality: 85 })
      .toFile(filepath);

    // Delete old profile photo if one exists
    return new Promise((resolve) => {
      db.get('SELECT image_url FROM users WHERE user_id = ?', [userId], (err, row) => {
        if (row && row.image_url) {
          const oldPath = path.join(BASE_DIR, row.image_url);
          fs.unlink(oldPath, () => {}); // Ignore errors on old file deletion
        }

        // Update the database with the new photo URL
        db.run('UPDATE users SET image_url = ? WHERE user_id = ?', [imageUrl, userId], function (err) {
          if (err) {
            resolve({ success: false, error: err.message });
          } else {
            resolve({ success: true, imageUrl });
          }
        });
      });
    });
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Process and save a vehicle photo upload.
 * Resizes to 800x600, converts to JPEG.
 * @param {Object} file - The multer file object (req.file)
 * @returns {Object} { success: boolean, imageUrl?: string, error?: string }
 */
async function handleVehiclePhotoUpload(file) {
  try {
    const randomName = crypto.randomBytes(16).toString('hex');
    const filename = `${randomName}.jpg`;
    const filepath = path.join(BASE_DIR, 'images', 'user_uploads', 'cars', filename);
    const imageUrl = `/images/user_uploads/cars/${filename}`;

    await sharp(file.buffer)
      .rotate()
      .resize(800, 600, {
        fit: 'cover',
        position: 'center'
      })
      .jpeg({ quality: 85 })
      .toFile(filepath);

    return { success: true, imageUrl };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

module.exports = { handleProfilePhotoUpload, handleVehiclePhotoUpload };

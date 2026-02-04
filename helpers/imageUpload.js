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
        fit: 'inside',
        withoutEnlargement: true
      })
      .jpeg({ quality: 85 })
      .toFile(filepath);

    return { success: true, imageUrl };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Delete a vehicle image file from disk (if it exists).
 * @param {string|null} imageUrl - The image URL path (e.g. /images/user_uploads/cars/abc.jpg)
 */
function deleteVehicleImage(imageUrl) {
  if (imageUrl) {
    const filePath = path.join(BASE_DIR, imageUrl);
    fs.unlink(filePath, () => {});
  }
}

/**
 * Process and save a vendor image upload (business or product).
 * Resizes to 800x600, converts to JPEG.
 * @param {Object} file - The multer file object (req.file)
 * @returns {Object} { success: boolean, imageUrl?: string, error?: string }
 */
async function handleVendorImageUpload(file) {
  try {
    const randomName = crypto.randomBytes(16).toString('hex');
    const filename = `${randomName}.jpg`;
    const filepath = path.join(BASE_DIR, 'images', 'user_uploads', 'vendors', filename);
    const imageUrl = `/images/user_uploads/vendors/${filename}`;

    await sharp(file.buffer)
      .rotate()
      .resize(800, 600, {
        fit: 'inside',
        withoutEnlargement: true
      })
      .jpeg({ quality: 85 })
      .toFile(filepath);

    return { success: true, imageUrl };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Delete a vendor image file from disk.
 * @param {string|null} imageUrl - The image URL path
 */
function deleteVendorImage(imageUrl) {
  if (imageUrl) {
    const filePath = path.join(BASE_DIR, imageUrl);
    fs.unlink(filePath, () => {});
  }
}

/**
 * Process and save a login background image upload.
 * Resizes to max 1920x1080, converts to JPEG, deletes old background if present.
 * @param {Object} file - The multer file object (req.file)
 * @param {string|null} oldImageUrl - The previous background image URL to delete
 * @returns {Object} { success: boolean, imageUrl?: string, error?: string }
 */
async function handleBackgroundImageUpload(file, oldImageUrl) {
  try {
    const randomName = crypto.randomBytes(16).toString('hex');
    const filename = `${randomName}.jpg`;
    const filepath = path.join(BASE_DIR, 'images', 'app_config', filename);
    const imageUrl = `/images/app_config/${filename}`;

    await sharp(file.buffer)
      .rotate()
      .resize(1920, 1080, {
        fit: 'inside',
        withoutEnlargement: true
      })
      .jpeg({ quality: 85 })
      .toFile(filepath);

    // Delete old background image if one exists
    if (oldImageUrl) {
      const oldPath = path.join(BASE_DIR, oldImageUrl);
      fs.unlink(oldPath, () => {});
    }

    return { success: true, imageUrl };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Delete a background image file from disk.
 * @param {string|null} imageUrl - The image URL path (e.g. /images/app_config/abc.jpg)
 */
function deleteBackgroundImage(imageUrl) {
  if (imageUrl) {
    const filePath = path.join(BASE_DIR, imageUrl);
    fs.unlink(filePath, () => {});
  }
}

module.exports = { handleProfilePhotoUpload, handleVehiclePhotoUpload, deleteVehicleImage, handleVendorImageUpload, deleteVendorImage, handleBackgroundImageUpload, deleteBackgroundImage };

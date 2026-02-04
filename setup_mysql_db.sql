-- ============================================================================
-- CAR SHOW MANAGEMENT SYSTEM - MYSQL DATABASE SCHEMA
-- ============================================================================
-- This database supports a car show voting and judging system with:
--   - User authentication and role-based access (admin, judge, registrar, vendor, user)
--   - Vehicle registration and classification
--   - Judge scoring with configurable categories and questions
--   - Specialty voting (e.g., People's Choice awards)
--   - Results publishing and tracking
-- ============================================================================

-- ============================================================================
-- DATABASE AND APPLICATION USER SETUP
-- ============================================================================
-- Run this script as MySQL root user to create the database and application user.
-- After running, update config.json with the database credentials.
-- ============================================================================

-- ============================================================================
-- MYSQL PERFORMANCE TUNING (add to my.cnf or my.ini)
-- ============================================================================
-- For a small database like this car show app, allocate enough buffer pool
-- to keep the entire database in memory for maximum performance.
-- This gives 100% buffer pool hit rate - all reads from memory, no disk I/O.
--
-- Add these settings to your MySQL configuration file:
--
-- [mysqld]
-- # InnoDB Buffer Pool - 10MB is more than enough for this tiny database
-- # The entire dataset will easily fit in memory, giving 100% hit rate
-- # with all reads served from RAM and writes synced to disk in background
-- innodb_buffer_pool_size = 10M
--
-- # Buffer pool instances (1 per GB of buffer pool, min 1)
-- innodb_buffer_pool_instances = 1
--
-- # Log file size - larger = fewer checkpoints, better write performance
-- innodb_log_file_size = 64M
--
-- # Flush method - O_DIRECT bypasses OS cache (data already in buffer pool)
-- innodb_flush_method = O_DIRECT
--
-- # Flush log at transaction commit (1=safest, 2=faster with small risk)
-- innodb_flush_log_at_trx_commit = 1
--
-- # Thread concurrency (0=auto-detect based on CPU cores)
-- innodb_thread_concurrency = 0
--
-- # Query cache (for frequently repeated queries)
-- query_cache_type = 1
-- query_cache_size = 32M
--
-- # Connection settings
-- max_connections = 100
-- thread_cache_size = 10
--
-- To verify buffer pool efficiency after running the app:
-- SHOW GLOBAL STATUS LIKE 'Innodb_buffer_pool_read%';
-- Goal: Innodb_buffer_pool_read_requests >> Innodb_buffer_pool_reads
-- ============================================================================

-- Create the database
CREATE DATABASE IF NOT EXISTS carshow CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Create application user (CHANGE 'PASSWORD' to a secure password!)
CREATE USER IF NOT EXISTS 'carshow_app'@'localhost' IDENTIFIED BY 'PASSWORD';

-- Grant privileges to application user
GRANT SELECT, INSERT, UPDATE, DELETE ON carshow.* TO 'carshow_app'@'localhost';
FLUSH PRIVILEGES;

-- Switch to the carshow database
USE carshow;


-- ============================================================================
-- USERS TABLE
-- ============================================================================
-- Stores all system users including admins, judges, registrars, and regular users.
-- Each user has a unique username and email for authentication.
-- Roles determine access levels:
--   - 'admin': Full system access, can configure all settings
--   - 'judge': Can score vehicles, view users, reset passwords
--   - 'registrar': Can register vehicles, manage vehicle activation
--   - 'vendor': Can manage vendor/business profile visible to all users
--   - 'user': Can register their own vehicles, participate in specialty votes
-- ============================================================================
CREATE TABLE IF NOT EXISTS users (
    user_id INT AUTO_INCREMENT PRIMARY KEY,           -- Unique identifier for the user
    username VARCHAR(255) UNIQUE NOT NULL,            -- Login username (must be unique)
    role VARCHAR(50) NOT NULL,                        -- User role: 'admin', 'judge', 'registrar', 'vendor', 'user'
    name VARCHAR(255) NOT NULL,                       -- Full display name
    phone VARCHAR(50),                                -- Optional phone number
    email VARCHAR(255) UNIQUE NOT NULL,               -- Email address (must be unique)
    image_url TEXT,                                   -- Profile image path/URL
    password_hash VARCHAR(255) NOT NULL,              -- Bcrypt hashed password
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,   -- Account creation timestamp
    is_active TINYINT(1) DEFAULT 1,                   -- 1=active, 0=deactivated account
    chat_enabled TINYINT(1) DEFAULT 0,                -- 1=can access group chat, 0=no chat access
    chat_blocked TINYINT(1) DEFAULT 0,                -- 1=blocked from posting, 0=can post
    INDEX idx_users_username (username),
    INDEX idx_users_email (email),
    INDEX idx_users_role (role),
    INDEX idx_users_active (is_active),
    INDEX idx_users_chat_enabled (chat_enabled),
    INDEX idx_users_chat_blocked (chat_blocked)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- VEHICLES TABLE (Vehicle Types)
-- ============================================================================
-- Defines the types of vehicles that can be registered (e.g., Car, Truck, Motorcycle).
-- Each vehicle type can have its own set of classes, judging categories, and questions.
-- Only admins can create/modify vehicle types.
-- ============================================================================
CREATE TABLE IF NOT EXISTS vehicles (
    vehicle_id INT AUTO_INCREMENT PRIMARY KEY,        -- Unique identifier for vehicle type
    vehicle_name VARCHAR(255) NOT NULL UNIQUE,        -- Name of vehicle type (e.g., 'Car', 'Truck')
    registration_price DECIMAL(10,2) DEFAULT 25.00,   -- Registration fee for this vehicle type
    is_active TINYINT(1) DEFAULT 1                    -- 1=active, 0=hidden from selection
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- CLASSES TABLE
-- ============================================================================
-- Defines competition classes within each vehicle type (e.g., 'Street Rods', 'Muscle Cars').
-- Classes are used to group vehicles for judging and determine award categories.
-- Each class belongs to exactly one vehicle type.
-- Only admins can create/modify classes.
-- ============================================================================
CREATE TABLE IF NOT EXISTS classes (
    class_id INT AUTO_INCREMENT PRIMARY KEY,          -- Unique identifier for the class
    class_name VARCHAR(255) NOT NULL,                 -- Display name (e.g., 'Street Rods')
    vehicle_id INT NOT NULL,                          -- Parent vehicle type this class belongs to
    is_active TINYINT(1) DEFAULT 1,                   -- 1=active, 0=hidden from selection
    FOREIGN KEY (vehicle_id) REFERENCES vehicles (vehicle_id) ON DELETE CASCADE,
    UNIQUE KEY unique_vehicle_class (vehicle_id, class_name),
    INDEX idx_classes_vehicle (vehicle_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- CARS TABLE (Registered Vehicles)
-- ============================================================================
-- Stores all vehicles registered for the car show.
-- Each car is owned by a user and assigned to a vehicle type and class.
-- The voter_id is a unique identifier used during the show for voting purposes.
-- Cars must be activated (is_active=1) by a registrar before they can be judged.
-- ============================================================================
CREATE TABLE IF NOT EXISTS cars (
    car_id INT AUTO_INCREMENT PRIMARY KEY,            -- Unique identifier for the registered car
    year INT,                                         -- Model year of the vehicle (optional)
    make VARCHAR(255) NOT NULL,                       -- Manufacturer (e.g., 'Ford', 'Chevrolet')
    model VARCHAR(255) NOT NULL,                      -- Model name (e.g., 'Mustang', 'Camaro')
    vehicle_id INT,                                   -- Vehicle type (references vehicles table)
    class_id INT,                                     -- Competition class (references classes table)
    voter_id INT UNIQUE,                              -- Unique show ID number for voting/judging
    description TEXT,                                 -- Optional description of the vehicle
    image_url TEXT,                                   -- Vehicle photo path/URL
    user_id INT,                                      -- Owner of the vehicle (references users table)
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,   -- Registration timestamp
    is_active TINYINT(1) DEFAULT 1,                   -- 1=activated for judging, 0=pending activation
    FOREIGN KEY (vehicle_id) REFERENCES vehicles (vehicle_id) ON DELETE SET NULL,
    FOREIGN KEY (class_id) REFERENCES classes (class_id) ON DELETE SET NULL,
    FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE SET NULL,
    INDEX idx_cars_active (is_active),
    INDEX idx_cars_user (user_id),
    INDEX idx_cars_vehicle_type (vehicle_id),
    INDEX idx_cars_class (class_id),
    INDEX idx_cars_voter_id (voter_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- JUDGE CATEGORIES TABLE
-- ============================================================================
-- Defines scoring categories for each vehicle type (e.g., 'Engine', 'Interior', 'Paint').
-- Categories group related judging questions together on the scoring sheet.
-- display_order controls the sequence categories appear on the judging form.
-- Only admins can create/modify categories.
-- ============================================================================
CREATE TABLE IF NOT EXISTS judge_catagories (
    judge_catagory_id INT AUTO_INCREMENT PRIMARY KEY, -- Unique identifier for the category
    vehicle_id INT NOT NULL,                          -- Vehicle type this category applies to
    catagory_name VARCHAR(255) NOT NULL,              -- Display name (e.g., 'Engine Compartment')
    display_order INT DEFAULT 0,                      -- Sort order on scoring sheet (lower = first)
    is_active TINYINT(1) DEFAULT 1,                   -- 1=active, 0=hidden from scoring
    FOREIGN KEY (vehicle_id) REFERENCES vehicles (vehicle_id) ON DELETE CASCADE,
    UNIQUE KEY unique_vehicle_category (vehicle_id, catagory_name),
    INDEX idx_judge_categories_vehicle (vehicle_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- JUDGE QUESTIONS TABLE
-- ============================================================================
-- Defines individual scoring criteria within each category.
-- Each question has a configurable score range (min_score to max_score).
-- Questions are displayed to judges when scoring vehicles of the matching vehicle type.
-- display_order controls the sequence questions appear within their category.
-- Only admins can create/modify questions.
-- ============================================================================
CREATE TABLE IF NOT EXISTS judge_questions (
    judge_question_id INT AUTO_INCREMENT PRIMARY KEY, -- Unique identifier for the question
    vehicle_id INT NOT NULL,                          -- Vehicle type this question applies to
    judge_catagory_id INT NOT NULL,                   -- Parent category for this question
    question VARCHAR(500) NOT NULL,                   -- The scoring criterion text
    min_score INT NOT NULL,                           -- Minimum allowed score (typically 0 or 1)
    max_score INT NOT NULL,                           -- Maximum allowed score (e.g., 10, 20)
    display_order INT DEFAULT 0,                      -- Sort order within category (lower = first)
    is_active TINYINT(1) DEFAULT 1,                   -- 1=active, 0=hidden from scoring
    FOREIGN KEY (vehicle_id) REFERENCES vehicles (vehicle_id) ON DELETE CASCADE,
    FOREIGN KEY (judge_catagory_id) REFERENCES judge_catagories (judge_catagory_id) ON DELETE CASCADE,
    INDEX idx_judge_questions_vehicle (vehicle_id),
    INDEX idx_judge_questions_category (judge_catagory_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- JUDGE SCORES TABLE
-- ============================================================================
-- Stores individual scores submitted by judges for each question on each vehicle.
-- Each judge can only score each question once per vehicle (enforced by UNIQUE constraint).
-- Scores are permanent once submitted - judges cannot modify their scores.
-- Admin can view and modify scores if corrections are needed.
-- ============================================================================
CREATE TABLE IF NOT EXISTS judge_scores (
    score_id INT AUTO_INCREMENT PRIMARY KEY,          -- Unique identifier for the score entry
    judge_id INT NOT NULL,                            -- The judge who submitted this score
    car_id INT NOT NULL,                              -- The vehicle being scored
    question_id INT NOT NULL,                         -- The question being answered
    score INT NOT NULL,                               -- The score value (must be within question's min/max)
    scored_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,    -- When the score was submitted
    FOREIGN KEY (judge_id) REFERENCES users (user_id) ON DELETE CASCADE,
    FOREIGN KEY (car_id) REFERENCES cars (car_id) ON DELETE CASCADE,
    FOREIGN KEY (question_id) REFERENCES judge_questions (judge_question_id) ON DELETE CASCADE,
    UNIQUE KEY unique_judge_car_question (judge_id, car_id, question_id),
    INDEX idx_judge_scores_car (car_id),
    INDEX idx_judge_scores_judge (judge_id),
    INDEX idx_judge_scores_judge_car (judge_id, car_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- VOTES TABLE (Legacy/General Voting)
-- ============================================================================
-- General purpose voting table for tracking votes.
-- Note: This may be a legacy table - specialty_vote_results is used for specialty votes.
-- ============================================================================
CREATE TABLE IF NOT EXISTS votes (
    id INT AUTO_INCREMENT PRIMARY KEY,                -- Unique identifier for the vote
    voter_id INT NOT NULL,                            -- Identifier of the voter (may be car's voter_id)
    user_id INT NOT NULL,                             -- User who cast the vote
    car_id INT NOT NULL,                              -- Vehicle being voted for
    vote_counts TEXT,                                 -- JSON or serialized vote data
    vote_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,    -- When the vote was cast
    FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE CASCADE,
    FOREIGN KEY (car_id) REFERENCES cars (car_id) ON DELETE CASCADE,
    UNIQUE KEY unique_user_car_voter (user_id, car_id, voter_id),
    INDEX idx_votes_user_car (user_id, car_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- SPECIALTY VOTES TABLE
-- ============================================================================
-- Defines special voting categories like "People's Choice", "Best in Show", etc.
-- These are separate from judge scoring and allow designated users to vote.
-- allow_all_users: If 1, any logged-in user can vote; if 0, only designated voters.
-- Only admins can create/modify specialty vote categories.
-- ============================================================================
CREATE TABLE IF NOT EXISTS specialty_votes (
    specialty_vote_id INT AUTO_INCREMENT PRIMARY KEY, -- Unique identifier
    vote_name VARCHAR(255) NOT NULL UNIQUE,           -- Display name (e.g., "People's Choice")
    description TEXT,                                 -- Optional description shown to voters
    allow_all_users TINYINT(1) DEFAULT 0,             -- 1=open to all users, 0=designated voters only
    vehicle_id INT,                                   -- Optional: limit voting to a specific vehicle type
    class_id INT,                                     -- Optional: limit voting to a specific class
    is_active TINYINT(1) DEFAULT 1,                   -- 1=voting open, 0=voting closed/hidden
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,   -- When the specialty vote was created
    FOREIGN KEY (vehicle_id) REFERENCES vehicles (vehicle_id) ON DELETE SET NULL,
    FOREIGN KEY (class_id) REFERENCES classes (class_id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- SPECIALTY VOTE VOTERS TABLE
-- ============================================================================
-- Defines which users are allowed to participate in each specialty vote.
-- Only used when the specialty vote has allow_all_users=0.
-- Admin assigns specific users as eligible voters for each specialty vote.
-- ============================================================================
CREATE TABLE IF NOT EXISTS specialty_vote_voters (
    id INT AUTO_INCREMENT PRIMARY KEY,                -- Unique identifier
    specialty_vote_id INT NOT NULL,                   -- The specialty vote this permission applies to
    user_id INT NOT NULL,                             -- The user who is allowed to vote
    FOREIGN KEY (specialty_vote_id) REFERENCES specialty_votes (specialty_vote_id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE CASCADE,
    UNIQUE KEY unique_vote_user (specialty_vote_id, user_id),
    INDEX idx_specialty_vote_voters_vote (specialty_vote_id),
    INDEX idx_specialty_vote_voters_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- SPECIALTY VOTE RESULTS TABLE
-- ============================================================================
-- Records actual votes cast in specialty voting categories.
-- Each user can only vote once per specialty vote (enforced by UNIQUE constraint).
-- The car_id indicates which vehicle the user voted for.
-- ============================================================================
CREATE TABLE IF NOT EXISTS specialty_vote_results (
    id INT AUTO_INCREMENT PRIMARY KEY,                -- Unique identifier for the vote record
    specialty_vote_id INT NOT NULL,                   -- The specialty vote category
    user_id INT NOT NULL,                             -- The user who cast this vote
    car_id INT NOT NULL,                              -- The vehicle they voted for
    voted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,     -- When the vote was cast
    FOREIGN KEY (specialty_vote_id) REFERENCES specialty_votes (specialty_vote_id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE CASCADE,
    FOREIGN KEY (car_id) REFERENCES cars (car_id) ON DELETE CASCADE,
    UNIQUE KEY unique_vote_user (specialty_vote_id, user_id),
    INDEX idx_specialty_vote_results_vote (specialty_vote_id),
    INDEX idx_specialty_vote_results_car (car_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- PUBLISHED RESULTS TABLE
-- ============================================================================
-- Stores the final, locked results after voting is closed by admin.
-- Results are published for judges to see and use for award distribution.
-- result_type: 'judge' for judging results, 'specialty' for specialty vote results
-- place: 1=1st place, 2=2nd place, 3=3rd place
-- For judge results: class_id identifies the competition class
-- For specialty results: specialty_vote_id identifies the specialty vote category
-- ============================================================================
CREATE TABLE IF NOT EXISTS published_results (
    result_id INT AUTO_INCREMENT PRIMARY KEY,         -- Unique identifier
    result_type VARCHAR(50) NOT NULL,                 -- 'judge' or 'specialty'
    class_id INT,                                     -- For judge results: the competition class
    specialty_vote_id INT,                            -- For specialty results: the vote category
    car_id INT NOT NULL,                              -- The winning vehicle
    place INT NOT NULL,                               -- Placement: 1, 2, or 3
    total_score DECIMAL(10,2),                        -- Total points (judge) or vote count (specialty)
    published_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, -- When results were published
    FOREIGN KEY (class_id) REFERENCES classes (class_id) ON DELETE SET NULL,
    FOREIGN KEY (specialty_vote_id) REFERENCES specialty_votes (specialty_vote_id) ON DELETE SET NULL,
    FOREIGN KEY (car_id) REFERENCES cars (car_id) ON DELETE CASCADE,
    UNIQUE KEY unique_judge_result (result_type, class_id, place),
    UNIQUE KEY unique_specialty_result (result_type, specialty_vote_id, place),
    INDEX idx_published_results_type (result_type),
    INDEX idx_published_results_class (class_id),
    INDEX idx_published_results_specialty (specialty_vote_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ============================================================================
-- VENDOR BUSINESS TABLE
-- ============================================================================
-- Stores vendor business profile and booth information.
-- Each vendor user has at most one business record (1:1 with users).
-- Vendors can edit their own business info, booth location, and upload an image.
-- ============================================================================
CREATE TABLE IF NOT EXISTS vendor_business (
    vendor_business_id INT AUTO_INCREMENT PRIMARY KEY,-- Unique identifier
    user_id INT NOT NULL UNIQUE,                      -- The vendor user (one business per vendor)
    business_name VARCHAR(255),                       -- Official business name
    business_email VARCHAR(255),                      -- Optional business email
    business_phone VARCHAR(50),                       -- Optional business phone
    business_street VARCHAR(255),                     -- Optional street address
    business_city VARCHAR(255),                       -- Optional city
    business_state VARCHAR(100),                      -- Optional state
    business_zip VARCHAR(20),                         -- Optional zip code
    business_description TEXT,                        -- Short description of the business (1-2 sentences)
    image_url TEXT,                                   -- Optional storefront/logo image path
    booth_location VARCHAR(255),                      -- Booth location info (table/area number)
    is_active TINYINT(1) DEFAULT 1,                   -- 1=active, 0=deactivated account
    admin_disabled TINYINT(1) DEFAULT 0,              -- 1=store disabled by admin, 0=normal
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,   -- Record creation timestamp
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, -- Last update timestamp
    FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE CASCADE,
    INDEX idx_vendor_business_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- VENDOR PRODUCTS TABLE
-- ============================================================================
-- Stores products and services offered by each vendor.
-- Each vendor can have multiple products/services.
-- Vendors can add, edit, and delete their own products.
-- ============================================================================
CREATE TABLE IF NOT EXISTS vendor_products (
    product_id INT AUTO_INCREMENT PRIMARY KEY,        -- Unique identifier
    user_id INT NOT NULL,                             -- The vendor who owns this product
    product_name VARCHAR(255) NOT NULL,               -- Product or service name
    description TEXT,                                 -- Optional one-line description
    price VARCHAR(100),                               -- Optional price info (text to allow "Starting at $X", etc.)
    discount_price VARCHAR(100),                      -- Optional discount/sale price (strikes through original price)
    image_url TEXT,                                   -- Optional product image path
    display_order INT DEFAULT 0,                      -- Sort order for display
    available TINYINT(1) DEFAULT 1,                   -- 1=available, 0=sold out
    admin_deactivated TINYINT(1) DEFAULT 0,           -- 1=deactivated by admin, 0=normal
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,   -- Record creation timestamp
    FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE CASCADE,
    INDEX idx_vendor_products_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- CHAT MESSAGES TABLE
-- ============================================================================
-- Stores group chat messages for the car show event.
-- Messages are sent via Socket.io and persisted here for history.
-- Access controlled by users.chat_enabled column.
-- ============================================================================
CREATE TABLE IF NOT EXISTS chat_messages (
    message_id INT AUTO_INCREMENT PRIMARY KEY,        -- Unique message identifier
    user_id INT NOT NULL,                             -- Sender (references users table)
    message TEXT NOT NULL,                            -- Message content (max 500 chars enforced in app)
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,   -- When the message was sent
    FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE CASCADE,
    INDEX idx_chat_messages_created (created_at),
    INDEX idx_chat_messages_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

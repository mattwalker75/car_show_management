-- ============================================================================
-- CAR SHOW MANAGEMENT SYSTEM - DATABASE SCHEMA
-- ============================================================================
-- This database supports a car show voting and judging system with:
--   - User authentication and role-based access (admin, judge, registrar, vendor, user)
--   - Vehicle registration and classification
--   - Judge scoring with configurable categories and questions
--   - Specialty voting (e.g., People's Choice awards)
--   - Results publishing and tracking
-- ============================================================================

-- Run the following command to init the database
-- sqlite3 carshow.db < setup_db.sql
--   NOTE:  The database file will be called carshow.db


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
    user_id INTEGER PRIMARY KEY AUTOINCREMENT,  -- Unique identifier for the user
    username TEXT UNIQUE NOT NULL,               -- Login username (must be unique)
    role TEXT NOT NULL,                          -- User role: 'admin', 'judge', 'registrar', 'vendor', 'user'
    name TEXT NOT NULL,                          -- Full display name
    phone TEXT,                                  -- Optional phone number
    email TEXT UNIQUE NOT NULL,                  -- Email address (must be unique)
    image_url TEXT,                              -- Profile image path/URL
    password_hash TEXT NOT NULL,                 -- Bcrypt hashed password
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,  -- Account creation timestamp
    is_active BOOLEAN DEFAULT 1                  -- 1=active, 0=deactivated account
);

-- ============================================================================
-- VEHICLES TABLE (Vehicle Types)
-- ============================================================================
-- Defines the types of vehicles that can be registered (e.g., Car, Truck, Motorcycle).
-- Each vehicle type can have its own set of classes, judging categories, and questions.
-- Only admins can create/modify vehicle types.
-- ============================================================================
CREATE TABLE IF NOT EXISTS vehicles (
    vehicle_id INTEGER PRIMARY KEY AUTOINCREMENT,  -- Unique identifier for vehicle type
    vehicle_name TEXT NOT NULL UNIQUE,             -- Name of vehicle type (e.g., 'Car', 'Truck')
    registration_price REAL DEFAULT 25.00,         -- Registration fee for this vehicle type
    is_active BOOLEAN DEFAULT 1                    -- 1=active, 0=hidden from selection
);

-- ============================================================================
-- CLASSES TABLE
-- ============================================================================
-- Defines competition classes within each vehicle type (e.g., 'Street Rods', 'Muscle Cars').
-- Classes are used to group vehicles for judging and determine award categories.
-- Each class belongs to exactly one vehicle type.
-- Only admins can create/modify classes.
-- ============================================================================
CREATE TABLE IF NOT EXISTS classes (
    class_id INTEGER PRIMARY KEY AUTOINCREMENT,  -- Unique identifier for the class
    class_name TEXT NOT NULL,                    -- Display name (e.g., 'Street Rods')
    vehicle_id INTEGER NOT NULL,                 -- Parent vehicle type this class belongs to
    is_active BOOLEAN DEFAULT 1,                 -- 1=active, 0=hidden from selection
    FOREIGN KEY (vehicle_id) REFERENCES vehicles (vehicle_id) ON DELETE CASCADE,
    UNIQUE(vehicle_id, class_name)               -- Class names must be unique within a vehicle type
);

-- ============================================================================
-- CARS TABLE (Registered Vehicles)
-- ============================================================================
-- Stores all vehicles registered for the car show.
-- Each car is owned by a user and assigned to a vehicle type and class.
-- The voter_id is a unique identifier used during the show for voting purposes.
-- Cars must be activated (is_active=1) by a registrar before they can be judged.
-- ============================================================================
CREATE TABLE IF NOT EXISTS cars (
    car_id INTEGER PRIMARY KEY AUTOINCREMENT,    -- Unique identifier for the registered car
    year INTEGER,                                -- Model year of the vehicle (optional)
    make TEXT NOT NULL,                          -- Manufacturer (e.g., 'Ford', 'Chevrolet')
    model TEXT NOT NULL,                         -- Model name (e.g., 'Mustang', 'Camaro')
    vehicle_id INTEGER,                          -- Vehicle type (references vehicles table)
    class_id INTEGER,                            -- Competition class (references classes table)
    voter_id INTEGER UNIQUE,                     -- Unique show ID number for voting/judging
    description TEXT,                            -- Optional description of the vehicle
    image_url TEXT,                              -- Vehicle photo path/URL
    user_id INTEGER,                             -- Owner of the vehicle (references users table)
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,  -- Registration timestamp
    is_active BOOLEAN DEFAULT 1,                 -- 1=activated for judging, 0=pending activation
    FOREIGN KEY (vehicle_id) REFERENCES vehicles (vehicle_id) ON DELETE SET NULL,
    FOREIGN KEY (class_id) REFERENCES classes (class_id) ON DELETE SET NULL,
    FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE SET NULL
);

-- ============================================================================
-- JUDGE CATEGORIES TABLE
-- ============================================================================
-- Defines scoring categories for each vehicle type (e.g., 'Engine', 'Interior', 'Paint').
-- Categories group related judging questions together on the scoring sheet.
-- display_order controls the sequence categories appear on the judging form.
-- Only admins can create/modify categories.
-- ============================================================================
CREATE TABLE IF NOT EXISTS judge_catagories (
    judge_catagory_id INTEGER PRIMARY KEY AUTOINCREMENT,  -- Unique identifier for the category
    vehicle_id INTEGER NOT NULL,                          -- Vehicle type this category applies to
    catagory_name TEXT NOT NULL,                          -- Display name (e.g., 'Engine Compartment')
    display_order INTEGER DEFAULT 0,                      -- Sort order on scoring sheet (lower = first)
    is_active BOOLEAN DEFAULT 1,                          -- 1=active, 0=hidden from scoring
    FOREIGN KEY (vehicle_id) REFERENCES vehicles (vehicle_id) ON DELETE CASCADE,
    UNIQUE(vehicle_id, catagory_name)                     -- Category names must be unique per vehicle type
);

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
    judge_question_id INTEGER PRIMARY KEY AUTOINCREMENT,  -- Unique identifier for the question
    vehicle_id INTEGER NOT NULL,                          -- Vehicle type this question applies to
    judge_catagory_id INTEGER NOT NULL,                   -- Parent category for this question
    question TEXT NOT NULL,                               -- The scoring criterion text
    min_score INTEGER NOT NULL,                           -- Minimum allowed score (typically 0 or 1)
    max_score INTEGER NOT NULL,                           -- Maximum allowed score (e.g., 10, 20)
    display_order INTEGER DEFAULT 0,                      -- Sort order within category (lower = first)
    is_active BOOLEAN DEFAULT 1,                          -- 1=active, 0=hidden from scoring
    FOREIGN KEY (vehicle_id) REFERENCES vehicles (vehicle_id) ON DELETE CASCADE,
    FOREIGN KEY (judge_catagory_id) REFERENCES judge_catagories (judge_catagory_id) ON DELETE CASCADE
);

-- ============================================================================
-- JUDGE SCORES TABLE
-- ============================================================================
-- Stores individual scores submitted by judges for each question on each vehicle.
-- Each judge can only score each question once per vehicle (enforced by UNIQUE constraint).
-- Scores are permanent once submitted - judges cannot modify their scores.
-- Admin can view and modify scores if corrections are needed.
-- ============================================================================
CREATE TABLE IF NOT EXISTS judge_scores (
    score_id INTEGER PRIMARY KEY AUTOINCREMENT,  -- Unique identifier for the score entry
    judge_id INTEGER NOT NULL,                   -- The judge who submitted this score
    car_id INTEGER NOT NULL,                     -- The vehicle being scored
    question_id INTEGER NOT NULL,                -- The question being answered
    score INTEGER NOT NULL,                      -- The score value (must be within question's min/max)
    scored_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,  -- When the score was submitted
    FOREIGN KEY (judge_id) REFERENCES users (user_id) ON DELETE CASCADE,
    FOREIGN KEY (car_id) REFERENCES cars (car_id) ON DELETE CASCADE,
    FOREIGN KEY (question_id) REFERENCES judge_questions (judge_question_id) ON DELETE CASCADE,
    UNIQUE(judge_id, car_id, question_id)        -- Each judge can only score each question once per car
);

-- ============================================================================
-- VOTES TABLE (Legacy/General Voting)
-- ============================================================================
-- General purpose voting table for tracking votes.
-- Note: This may be a legacy table - specialty_vote_results is used for specialty votes.
-- ============================================================================
CREATE TABLE IF NOT EXISTS votes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,        -- Unique identifier for the vote
    voter_id INTEGER NOT NULL,                   -- Identifier of the voter (may be car's voter_id)
    user_id INTEGER NOT NULL,                    -- User who cast the vote
    car_id INTEGER NOT NULL,                     -- Vehicle being voted for
    vote_counts TEXT,                            -- JSON or serialized vote data
    vote_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,  -- When the vote was cast
    FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE CASCADE,
    FOREIGN KEY (car_id) REFERENCES cars (car_id) ON DELETE CASCADE,
    UNIQUE(user_id, car_id, voter_id)            -- Prevents duplicate votes from same user for same car/voter
);

-- ============================================================================
-- SPECIALTY VOTES TABLE
-- ============================================================================
-- Defines special voting categories like "People's Choice", "Best in Show", etc.
-- These are separate from judge scoring and allow designated users to vote.
-- allow_all_users: If 1, any logged-in user can vote; if 0, only designated voters.
-- Only admins can create/modify specialty vote categories.
-- ============================================================================
CREATE TABLE IF NOT EXISTS specialty_votes (
    specialty_vote_id INTEGER PRIMARY KEY AUTOINCREMENT,  -- Unique identifier
    vote_name TEXT NOT NULL UNIQUE,                       -- Display name (e.g., "People's Choice")
    description TEXT,                                     -- Optional description shown to voters
    allow_all_users BOOLEAN DEFAULT 0,                    -- 1=open to all users, 0=designated voters only
    vehicle_id INTEGER,                                   -- Optional: limit voting to a specific vehicle type
    class_id INTEGER,                                     -- Optional: limit voting to a specific class
    is_active BOOLEAN DEFAULT 1,                          -- 1=voting open, 0=voting closed/hidden
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,       -- When the specialty vote was created
    FOREIGN KEY (vehicle_id) REFERENCES vehicles (vehicle_id) ON DELETE SET NULL,
    FOREIGN KEY (class_id) REFERENCES classes (class_id) ON DELETE SET NULL
);

-- ============================================================================
-- SPECIALTY VOTE VOTERS TABLE
-- ============================================================================
-- Defines which users are allowed to participate in each specialty vote.
-- Only used when the specialty vote has allow_all_users=0.
-- Admin assigns specific users as eligible voters for each specialty vote.
-- ============================================================================
CREATE TABLE IF NOT EXISTS specialty_vote_voters (
    id INTEGER PRIMARY KEY AUTOINCREMENT,        -- Unique identifier
    specialty_vote_id INTEGER NOT NULL,          -- The specialty vote this permission applies to
    user_id INTEGER NOT NULL,                    -- The user who is allowed to vote
    FOREIGN KEY (specialty_vote_id) REFERENCES specialty_votes (specialty_vote_id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE CASCADE,
    UNIQUE(specialty_vote_id, user_id)           -- Each user can only be assigned once per specialty vote
);

-- ============================================================================
-- SPECIALTY VOTE RESULTS TABLE
-- ============================================================================
-- Records actual votes cast in specialty voting categories.
-- Each user can only vote once per specialty vote (enforced by UNIQUE constraint).
-- The car_id indicates which vehicle the user voted for.
-- ============================================================================
CREATE TABLE IF NOT EXISTS specialty_vote_results (
    id INTEGER PRIMARY KEY AUTOINCREMENT,        -- Unique identifier for the vote record
    specialty_vote_id INTEGER NOT NULL,          -- The specialty vote category
    user_id INTEGER NOT NULL,                    -- The user who cast this vote
    car_id INTEGER NOT NULL,                     -- The vehicle they voted for
    voted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,  -- When the vote was cast
    FOREIGN KEY (specialty_vote_id) REFERENCES specialty_votes (specialty_vote_id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE CASCADE,
    FOREIGN KEY (car_id) REFERENCES cars (car_id) ON DELETE CASCADE,
    UNIQUE(specialty_vote_id, user_id)           -- Each user can only vote once per specialty vote
);

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
    result_id INTEGER PRIMARY KEY AUTOINCREMENT,  -- Unique identifier
    result_type TEXT NOT NULL,                    -- 'judge' or 'specialty'
    class_id INTEGER,                             -- For judge results: the competition class
    specialty_vote_id INTEGER,                    -- For specialty results: the vote category
    car_id INTEGER NOT NULL,                      -- The winning vehicle
    place INTEGER NOT NULL,                       -- Placement: 1, 2, or 3
    total_score REAL,                             -- Total points (judge) or vote count (specialty)
    published_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,  -- When results were published
    FOREIGN KEY (class_id) REFERENCES classes (class_id) ON DELETE SET NULL,
    FOREIGN KEY (specialty_vote_id) REFERENCES specialty_votes (specialty_vote_id) ON DELETE SET NULL,
    FOREIGN KEY (car_id) REFERENCES cars (car_id) ON DELETE CASCADE,
    UNIQUE(result_type, class_id, place),         -- Only one winner per place per class (for judge results)
    UNIQUE(result_type, specialty_vote_id, place) -- Only one winner per place per specialty vote
);


-- ============================================================================
-- INDEXES FOR PERFORMANCE OPTIMIZATION
-- ============================================================================
-- Indexes improve query performance for frequently accessed columns.
-- They are especially important for:
--   - Foreign key lookups (joins between tables)
--   - Filtering conditions (WHERE clauses)
--   - Sorting operations (ORDER BY)
-- ============================================================================

-- User lookups
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);        -- Fast login lookup
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);              -- Fast email lookup
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);                -- Filter users by role
CREATE INDEX IF NOT EXISTS idx_users_active ON users(is_active);         -- Filter active users

-- Car lookups and filtering
CREATE INDEX IF NOT EXISTS idx_cars_active ON cars(is_active);           -- Filter active cars
CREATE INDEX IF NOT EXISTS idx_cars_user ON cars(user_id);               -- Find cars by owner
CREATE INDEX IF NOT EXISTS idx_cars_vehicle_type ON cars(vehicle_id);    -- Filter cars by vehicle type
CREATE INDEX IF NOT EXISTS idx_cars_class ON cars(class_id);             -- Filter cars by class
CREATE INDEX IF NOT EXISTS idx_cars_voter_id ON cars(voter_id);          -- Lookup by voter ID

-- Class lookups
CREATE INDEX IF NOT EXISTS idx_classes_vehicle ON classes(vehicle_id);   -- Find classes by vehicle type

-- Judge category lookups
CREATE INDEX IF NOT EXISTS idx_judge_categories_vehicle ON judge_catagories(vehicle_id);  -- Categories by vehicle type

-- Judge question lookups
CREATE INDEX IF NOT EXISTS idx_judge_questions_vehicle ON judge_questions(vehicle_id);           -- Questions by vehicle type
CREATE INDEX IF NOT EXISTS idx_judge_questions_category ON judge_questions(judge_catagory_id);   -- Questions by category

-- Judge score lookups (critical for score calculations)
CREATE INDEX IF NOT EXISTS idx_judge_scores_car ON judge_scores(car_id);           -- All scores for a car
CREATE INDEX IF NOT EXISTS idx_judge_scores_judge ON judge_scores(judge_id);       -- All scores by a judge
CREATE INDEX IF NOT EXISTS idx_judge_scores_judge_car ON judge_scores(judge_id, car_id);  -- Check if judge scored a car

-- Vote lookups
CREATE INDEX IF NOT EXISTS idx_votes_user_car ON votes(user_id, car_id);           -- Check user's votes

-- Specialty vote lookups
CREATE INDEX IF NOT EXISTS idx_specialty_vote_voters_vote ON specialty_vote_voters(specialty_vote_id);  -- Voters for a specialty vote
CREATE INDEX IF NOT EXISTS idx_specialty_vote_voters_user ON specialty_vote_voters(user_id);            -- User's voting permissions
CREATE INDEX IF NOT EXISTS idx_specialty_vote_results_vote ON specialty_vote_results(specialty_vote_id);  -- Results by specialty vote
CREATE INDEX IF NOT EXISTS idx_specialty_vote_results_car ON specialty_vote_results(car_id);            -- Votes for a car

-- Published results lookups
CREATE INDEX IF NOT EXISTS idx_published_results_type ON published_results(result_type);          -- Filter by result type
CREATE INDEX IF NOT EXISTS idx_published_results_class ON published_results(class_id);            -- Results by class
CREATE INDEX IF NOT EXISTS idx_published_results_specialty ON published_results(specialty_vote_id);  -- Results by specialty vote

-- Create users table
CREATE TABLE IF NOT EXISTS users (
    user_id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    role TEXT NOT NULL, 
    name TEXT NOT NULL,
    phone TEXT,
    email TEXT UNIQUE NOT NULL,
    image_url TEXT,
    password_hash TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT 1
);

-- Create cars table
CREATE TABLE IF NOT EXISTS cars (
    car_id INTEGER PRIMARY KEY AUTOINCREMENT,
    make TEXT NOT NULL,
    model TEXT NOT NULL,
    vehicle_id INTEGER,
    class_id INTEGER,
    voter_id INTEGER,
    description TEXT,
    image_url TEXT,
    user_id INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT 1,
    FOREIGN KEY (vehicle_id) REFERENCES vehicles (vehicle_id),
    FOREIGN KEY (class_id) REFERENCES classes (class_id),
    FOREIGN KEY (user_id) REFERENCES users (user_id)
);

-- Create votes table
CREATE TABLE IF NOT EXISTS votes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    voter_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    car_id INTEGER NOT NULL,
    vote_counts TEXT,
    vote_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (user_id),
    FOREIGN KEY (car_id) REFERENCES cars (car_id),
    UNIQUE(user_id, car_id)
);

-- Create vehicle table such as car, truck, motorcycle (admin only)
CREATE TABLE IF NOT EXISTS vehicles (
    vehicle_id INTEGER PRIMARY KEY AUTOINCREMENT,
    vehicle_name TEXT NOT NULL UNIQUE,
    is_active BOOLEAN DEFAULT 1
);

-- Create class table such as street rods, muscle cars (admin only)
CREATE TABLE IF NOT EXISTS classes (
    class_id INTEGER PRIMARY KEY AUTOINCREMENT,
    class_name TEXT NOT NULL,
    vehicle_id INTEGER NOT NULL,
    is_active BOOLEAN DEFAULT 1,
    FOREIGN KEY (vehicle_id) REFERENCES vehicles (vehicle_id),
    UNIQUE(vehicle_id, class_name)
);

-- Create judging categories (admin only)
CREATE TABLE IF NOT EXISTS judge_catagories (
    judge_catagory_id INTEGER PRIMARY KEY AUTOINCREMENT,
    vehicle_id INTEGER NOT NULL,
    catagory_name TEXT NOT NULL,
    display_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT 1,
    FOREIGN KEY (vehicle_id) REFERENCES vehicles (vehicle_id),
    UNIQUE(vehicle_id, catagory_name)
);

-- Create judging questions (admin only)
CREATE TABLE IF NOT EXISTS judge_questions (
    judge_question_id INTEGER PRIMARY KEY AUTOINCREMENT,
    vehicle_id INTEGER NOT NULL,
    judge_catagory_id INTEGER NOT NULL,
    question TEXT NOT NULL,
    min_score INTEGER NOT NULL,
    max_score INTEGER NOT NULL,
    display_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT 1,
    FOREIGN KEY (vehicle_id) REFERENCES vehicles (vehicle_id),
    FOREIGN KEY (judge_catagory_id) REFERENCES judge_catagories (judge_catagory_id)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_cars_active ON cars(is_active);
CREATE INDEX IF NOT EXISTS idx_votes_user_car ON votes(user_id, car_id);


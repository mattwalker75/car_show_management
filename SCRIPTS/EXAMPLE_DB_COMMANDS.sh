
# Deactivate all regular users
sqlite3 carshow.db "UPDATE users SET is_active=0 WHERE role='user';"

# Verify all regular users are deactivate
sqlite3 carshow.db "SELECT role, COUNT(*), SUM(is_active) as active FROM users GROUP BY role;"

# Reactivate all regular users
sqlite3 carshow.db "UPDATE users SET is_active=1 WHERE role='user';"

# List all judging questions
sqlite3 -header -column carshow.db "
SELECT 
    jc.category_name,
    jq.question_text,
    jq.min_score,
    jq.max_score,
    v.vehicle_name
FROM judge_questions jq
JOIN judge_catagories jc ON jq.category_id = jc.judge_catagory_id
LEFT JOIN vehicles v ON jc.vehicle_id = v.vehicle_id
ORDER BY v.vehicle_name, jc.display_order, jq.display_order;
"

sqlite3 -header -csv carshow.db "SELECT * FROM judge_questions;" 
sqlite3 -header -csv carshow.db "SELECT * FROM judge_catagories;"


#  Get actual judging detail scores
sqlite3 -header -column carshow.db "
SELECT 
    u.name as judge,
    c.car_year || ' ' || c.car_make || ' ' || c.car_model as car,
    jq.question_text,
    js.score,
    jq.max_score
FROM judge_scores js
JOIN users u ON js.judge_id = u.user_id
JOIN cars c ON js.car_id = c.car_id
JOIN judge_questions jq ON js.question_id = jq.judge_question_id
ORDER BY c.car_id, jq.display_order;
"

# Get total judging scores per vehicle
sqlite3 -header -column carshow.db "
SELECT 
    c.car_id,
    c.car_year || ' ' || c.car_make || ' ' || c.car_model as car,
    SUM(js.score) as total_score,
    COUNT(js.score) as questions_scored
FROM judge_scores js
JOIN cars c ON js.car_id = c.car_id
GROUP BY c.car_id
ORDER BY total_score DESC;
"



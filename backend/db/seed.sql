-- Illuminate PTO seed data — updated with org chart & reporting lines

-- ── Step 1: Insert all users (manager_id set after to avoid FK ordering issues) ──
INSERT INTO users (id, name, email, role, department, hire_date, accrual_rate) VALUES
  -- Admins
  (3,  'Faridon Dadrass',      'fdadrass@illuminate.net',        'admin',    'Learning Tech',      '2019-12-19', 5.00),
  (19, 'Shaun McMahon',        'smcmahon@illuminate.net',        'admin',    'Operations',         '2004-08-01',  5.00),
  -- Manager
  (2,  'Carly Commiso',        'ccommiso@illuminate.net',        'manager',  'Learning Strategy',  '2022-11-21', 5.00),
  -- Employees
  (1,  'Maria Bocanegra',      'mbocanegra@illuminate.net',      'employee', 'Project Management', '2022-05-02', 5.00),
  (4,  'Kristian Dawes',       'kdawes@illuminate.net',          'employee', 'Learning Tech',      '2024-01-22', 3.33),
  (5,  'Kara Fitzgibbon',      'kfitzgibbon@illuminate.net',     'employee', 'BDEV',               '2019-09-09', 5.00),
  (6,  'Daniel Goldsmith',     'dgoldsmith@illuminate.net',      'employee', 'Project Management', '2019-07-22', 5.00),
  (7,  'William Hwang',        'whwang@illuminate.net',          'employee', 'Learning Strategy',  '2021-07-19', 5.00),
  (9,  'Sarah Looney',         'slooney@illuminate.net',         'employee', 'Project Management', '2023-07-15', 5.00),
  (11, 'Nathanael Otanez',     'notanez@illuminate.net',         'employee', 'Project Management', '2023-06-20', 5.00),
  (12, 'Prasanna Ranade',      'pranade@illuminate.net',         'employee', 'Graphic Design',     '2023-01-09', 5.00),
  (13, 'Rich Daley',           'rdaley@illuminate.net',          'employee', 'Graphic Design',     '2024-10-28', 3.33),
  (14, 'Janiel Rosario',       'jrosario@illuminate.net',        'employee', 'Project Management', '2026-02-01', 3.33),
  (15, 'Farheen Shaikh',       'fshaikh@illuminate.net',         'employee', 'MR',                 '2025-07-01', 3.33),
  (16, 'Vrushali Nar',         'vnar@illuminate.net',            'employee', 'eLearning',           '2025-08-01', 3.33),
  (17, 'Mike Miedzianowski',   'mmiedzianowski@illuminate.net',  'employee', 'BDEV',               '2026-04-01', 3.33),
  (18, 'Mason Jones',          'mjones@illuminate.net',          'employee', 'BDEV',               '2026-04-01', 3.33),
  (20, 'Juan Carlos Pinedo',   'jcpinedo@illuminate.net',        'employee', 'Learning Tech',      NOW()::date,  3.33)
ON CONFLICT (id) DO UPDATE SET
  role       = EXCLUDED.role,
  department = EXCLUDED.department,
  hire_date  = EXCLUDED.hire_date,
  accrual_rate = EXCLUDED.accrual_rate;

SELECT setval('users_id_seq', (SELECT MAX(id) FROM users));

-- ── Step 2: Set reporting lines (manager_id) ─────────────────────────────────

-- Reports to Shaun McMahon (id=19)
UPDATE users SET manager_id = 19 WHERE id IN (1, 2, 5, 6, 9, 11, 14, 17, 18);

-- Reports to Faridon Dadrass (id=3)
UPDATE users SET manager_id = 3  WHERE id IN (4, 12, 13, 16, 20);

-- Reports to Carly Commiso (id=2)
UPDATE users SET manager_id = 2  WHERE id IN (7, 15);

-- Admins have no manager
UPDATE users SET manager_id = NULL WHERE id IN (3, 19);

-- ── Step 3: PTO Balances for 2026 ────────────────────────────────────────────
INSERT INTO pto_balances (user_id, bucket, total_days, year) VALUES
  -- Maria Bocanegra (id=1)
  (1,  'vacation',     15.0, 2026), (1,  'sick', 5.0, 2026), (1,  'personal', 2.0, 2026), (1,  'floatHoliday', 1.0, 2026),
  -- Carly Commiso (id=2)
  (2,  'vacation',     15.0, 2026), (2,  'sick', 5.0, 2026), (2,  'personal', 2.0, 2026), (2,  'floatHoliday', 1.0, 2026),
  -- Faridon Dadrass (id=3)
  (3,  'vacation',     15.0, 2026), (3,  'sick', 5.0, 2026), (3,  'personal', 2.0, 2026), (3,  'floatHoliday', 1.0, 2026),
  -- Kristian Dawes (id=4)
  (4,  'vacation',     10.0, 2026), (4,  'sick', 5.0, 2026), (4,  'personal', 2.0, 2026), (4,  'floatHoliday', 1.0, 2026),
  -- Kara Fitzgibbon (id=5)
  (5,  'vacation',     15.0, 2026), (5,  'sick', 5.0, 2026), (5,  'personal', 2.0, 2026), (5,  'floatHoliday', 1.0, 2026),
  -- Daniel Goldsmith (id=6)
  (6,  'vacation',     15.0, 2026), (6,  'sick', 5.0, 2026), (6,  'personal', 2.0, 2026), (6,  'floatHoliday', 1.0, 2026),
  -- William Hwang (id=7)
  (7,  'vacation',     15.0, 2026), (7,  'sick', 5.0, 2026), (7,  'personal', 2.0, 2026), (7,  'floatHoliday', 1.0, 2026),
  -- Sarah Looney (id=9)
  (9,  'vacation',     13.5, 2026), (9,  'sick', 5.0, 2026), (9,  'personal', 2.0, 2026), (9,  'floatHoliday', 1.0, 2026),
  -- Nathanael Otanez (id=11)
  (11, 'vacation',     12.5, 2026), (11, 'sick', 5.0, 2026), (11, 'personal', 2.0, 2026), (11, 'floatHoliday', 1.0, 2026),
  -- Prasanna Ranade (id=12)
  (12, 'vacation',     15.0, 2026), (12, 'sick', 5.0, 2026), (12, 'personal', 2.0, 2026), (12, 'floatHoliday', 1.0, 2026),
  -- Rich Daley (id=13)
  (13, 'vacation',     10.0, 2026), (13, 'sick', 5.0, 2026), (13, 'personal', 2.0, 2026), (13, 'floatHoliday', 1.0, 2026),
  -- Janiel Rosario (id=14)
  (14, 'vacation',     10.0, 2026), (14, 'sick', 5.0, 2026), (14, 'personal', 2.0, 2026), (14, 'floatHoliday', 1.0, 2026),
  -- Farheen Shaikh (id=15)
  (15, 'vacation',     10.0, 2026), (15, 'sick', 5.0, 2026), (15, 'personal', 2.0, 2026), (15, 'floatHoliday', 1.0, 2026),
  -- Vrushali Nar (id=16)
  (16, 'vacation',     10.0, 2026), (16, 'sick', 5.0, 2026), (16, 'personal', 2.0, 2026), (16, 'floatHoliday', 1.0, 2026),
  -- Mike Miedzianowski (id=17)
  (17, 'vacation',     10.0, 2026), (17, 'sick', 5.0, 2026), (17, 'personal', 2.0, 2026), (17, 'floatHoliday', 1.0, 2026),
  -- Mason Jones (id=18)
  (18, 'vacation',     10.0, 2026), (18, 'sick', 5.0, 2026), (18, 'personal', 2.0, 2026), (18, 'floatHoliday', 1.0, 2026),
  -- Shaun McMahon (id=19)
  (19, 'vacation',     15.0, 2026), (19, 'sick', 5.0, 2026), (19, 'personal', 2.0, 2026), (19, 'floatHoliday', 1.0, 2026),
  -- Juan Carlos (id=20)
  (20, 'vacation',     10.0, 2026), (20, 'sick', 5.0, 2026), (20, 'personal', 2.0, 2026), (20, 'floatHoliday', 1.0, 2026)
ON CONFLICT (user_id, bucket, year) DO NOTHING;

-- ── Step 4: PTO Requests (all approved history) ───────────────────────────────
INSERT INTO pto_requests (id, user_id, bucket, from_date, to_date, days, status, note, source) VALUES
  (1,  1,  'vacation',     '2026-03-30', '2026-04-03', 5.0,  'approved', '',                             'manual'),
  (2,  2,  'vacation',     '2026-03-20', '2026-03-20', 1.0,  'approved', '',                             'manual'),
  (4,  5,  'sick',         '2026-03-02', '2026-03-02', 1.0,  'approved', '',                             'manual'),
  (5,  6,  'vacation',     '2026-04-20', '2026-04-20', 1.0,  'approved', 'Mgr signed 4/7/26',            'pdf'),
  (6,  6,  'vacation',     '2026-05-01', '2026-05-01', 1.0,  'approved', '',                             'manual'),
  (7,  6,  'vacation',     '2026-05-04', '2026-05-04', 1.0,  'approved', '',                             'manual'),
  (8,  7,  'sick',         '2026-02-27', '2026-03-01', 3.0,  'approved', '',                             'manual'),
  (10, 9,  'vacation',     '2026-02-27', '2026-02-27', 1.0,  'approved', '',                             'manual'),
  (11, 13, 'sick',         '2026-02-24', '2026-02-24', 1.0,  'approved', '',                             'manual'),
  (12, 14, 'sick',         '2026-02-20', '2026-02-20', 1.0,  'approved', '',                             'manual'),
  (13, 7,  'vacation',     '2026-04-23', '2026-04-24', 2.0,  'approved', 'Mgr: Carolyn Commiso 4/17/26', 'pdf'),
  (14, 1,  'vacation',     '2026-06-12', '2026-06-22', 5.0,  'approved', '',                             'pdf'),
  (15, 5,  'vacation',     '2026-07-09', '2026-07-15', 5.0,  'approved', '',                             'pdf'),
  (16, 1,  'floatHoliday', '2026-05-29', '2026-05-29', 1.0,  'approved', '',                             'pdf'),
  (17, 2,  'personal',     '2026-04-30', '2026-04-30', 0.5,  'approved', 'Half day',                     'pdf'),
  (18, 9,  'vacation',     '2026-07-08', '2026-07-15', 6.0,  'approved', '',                             'pdf'),
  (19, 9,  'vacation',     '2026-09-10', '2026-09-11', 2.0,  'approved', '',                             'pdf')
ON CONFLICT (id) DO NOTHING;

SELECT setval('pto_requests_id_seq', (SELECT MAX(id) FROM pto_requests));

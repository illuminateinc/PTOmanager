-- Illuminate PTO Manager — PostgreSQL schema

CREATE TABLE IF NOT EXISTS users (
  id           SERIAL PRIMARY KEY,
  name         VARCHAR(255)   NOT NULL,
  email        VARCHAR(255)   UNIQUE NOT NULL,
  role         VARCHAR(50)    NOT NULL DEFAULT 'employee',  -- employee | manager | admin
  department   VARCHAR(255),
  hire_date    DATE,
  accrual_rate DECIMAL(5,2)   NOT NULL DEFAULT 3.33,
  cognito_sub  VARCHAR(255)   UNIQUE,
  manager_id   INTEGER        REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS pto_balances (
  id         SERIAL PRIMARY KEY,
  user_id    INTEGER        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  bucket     VARCHAR(50)    NOT NULL,  -- vacation | sick | personal | floatHoliday
  total_days DECIMAL(5,1)   NOT NULL DEFAULT 0,
  year       INTEGER        NOT NULL DEFAULT EXTRACT(YEAR FROM NOW())::int,
  UNIQUE (user_id, bucket, year)
);

CREATE TABLE IF NOT EXISTS pto_requests (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  bucket      VARCHAR(50)    NOT NULL,
  from_date   DATE           NOT NULL,
  to_date     DATE           NOT NULL,
  days        DECIMAL(5,1)   NOT NULL,
  status      VARCHAR(50)    NOT NULL DEFAULT 'pending',  -- pending | approved | denied
  note        TEXT,
  source      VARCHAR(50)    DEFAULT 'manual',            -- manual | pdf
  approved_by INTEGER        REFERENCES users(id),
  created_at  TIMESTAMP      DEFAULT NOW(),
  updated_at  TIMESTAMP      DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS bonus_days (
  id         SERIAL PRIMARY KEY,
  user_id    INTEGER        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  days       DECIMAL(5,1)   NOT NULL,
  reason     TEXT,
  awarded_by INTEGER        REFERENCES users(id),
  created_at TIMESTAMP      DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pto_requests_user_id  ON pto_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_pto_requests_status   ON pto_requests(status);
CREATE INDEX IF NOT EXISTS idx_pto_balances_user_year ON pto_balances(user_id, year);
CREATE INDEX IF NOT EXISTS idx_users_cognito_sub      ON users(cognito_sub);
CREATE INDEX IF NOT EXISTS idx_users_email            ON users(email);

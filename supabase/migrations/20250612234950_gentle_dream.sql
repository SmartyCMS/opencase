-- OpenCase Roulette Database Schema

CREATE DATABASE IF NOT EXISTS opencase_roulette;
USE opencase_roulette;

-- Users table
CREATE TABLE users (
    id INT PRIMARY KEY AUTO_INCREMENT,
    steam_id VARCHAR(20) UNIQUE,
    username VARCHAR(100) NOT NULL,
    avatar VARCHAR(255),
    email VARCHAR(100),
    balance DECIMAL(10,2) DEFAULT 0.00,
    total_deposited DECIMAL(10,2) DEFAULT 0.00,
    total_withdrawn DECIMAL(10,2) DEFAULT 0.00,
    level INT DEFAULT 1,
    experience INT DEFAULT 0,
    is_admin BOOLEAN DEFAULT FALSE,
    is_banned BOOLEAN DEFAULT FALSE,
    trade_url VARCHAR(500),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Items table (CS:GO skins)
CREATE TABLE items (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(255) NOT NULL,
    market_name VARCHAR(255) NOT NULL,
    icon_url VARCHAR(500),
    rarity VARCHAR(50) NOT NULL,
    quality VARCHAR(50),
    price DECIMAL(10,2) NOT NULL,
    float_min DECIMAL(8,6) DEFAULT 0.000000,
    float_max DECIMAL(8,6) DEFAULT 1.000000,
    steam_market_price DECIMAL(10,2),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Cases table
CREATE TABLE cases (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    image VARCHAR(500),
    price DECIMAL(10,2) NOT NULL,
    bank_balance DECIMAL(10,2) DEFAULT 0.00,
    total_opened INT DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    sort_order INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Case items (items that can drop from cases)
CREATE TABLE case_items (
    id INT PRIMARY KEY AUTO_INCREMENT,
    case_id INT NOT NULL,
    item_id INT NOT NULL,
    drop_chance DECIMAL(8,4) NOT NULL,
    FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE,
    FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE
);

-- User inventory
CREATE TABLE user_inventory (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    item_id INT NOT NULL,
    float_value DECIMAL(8,6),
    is_tradeable BOOLEAN DEFAULT TRUE,
    acquired_from ENUM('case_opening', 'upgrade', 'purchase', 'admin') DEFAULT 'case_opening',
    acquired_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE
);

-- Case openings history
CREATE TABLE case_openings (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    case_id INT NOT NULL,
    item_id INT NOT NULL,
    item_value DECIMAL(10,2) NOT NULL,
    profit_loss DECIMAL(10,2) NOT NULL,
    opened_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE,
    FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE
);

-- Upgrades table
CREATE TABLE upgrades (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    from_item_id INT NOT NULL,
    to_item_id INT NOT NULL,
    success BOOLEAN NOT NULL,
    chance DECIMAL(5,2) NOT NULL,
    profit_loss DECIMAL(10,2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (from_item_id) REFERENCES items(id) ON DELETE CASCADE,
    FOREIGN KEY (to_item_id) REFERENCES items(id) ON DELETE CASCADE
);

-- Transactions table
CREATE TABLE transactions (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    type ENUM('deposit', 'withdrawal', 'case_opening', 'upgrade', 'sell_item') NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    description TEXT,
    status ENUM('pending', 'completed', 'failed') DEFAULT 'completed',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Live feed table
CREATE TABLE live_feed (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    action_type ENUM('case_opening', 'upgrade_success', 'upgrade_fail', 'big_win') NOT NULL,
    item_id INT,
    case_id INT,
    value DECIMAL(10,2),
    message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE SET NULL,
    FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE SET NULL
);

-- Settings table
CREATE TABLE settings (
    id INT PRIMARY KEY AUTO_INCREMENT,
    setting_key VARCHAR(100) UNIQUE NOT NULL,
    setting_value TEXT,
    description TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Insert default settings
INSERT INTO settings (setting_key, setting_value, description) VALUES
('site_name', 'CaseHunt', 'Site name'),
('maintenance_mode', 'false', 'Maintenance mode'),
('min_upgrade_value', '1.00', 'Minimum item value for upgrades'),
('max_upgrade_multiplier', '10.0', 'Maximum upgrade multiplier'),
('house_edge', '5.0', 'House edge percentage'),
('live_feed_limit', '50', 'Number of live feed items to keep');

-- Insert sample rarities and items
INSERT INTO items (name, market_name, rarity, price, icon_url) VALUES
('AK-47 | Redline', 'AK-47 | Redline (Field-Tested)', 'classified', 25.50, 'https://steamcommunity-a.akamaihd.net/economy/image/class/730/310776/256fx256f'),
('AWP | Dragon Lore', 'AWP | Dragon Lore (Field-Tested)', 'covert', 2500.00, 'https://steamcommunity-a.akamaihd.net/economy/image/class/730/310777/256fx256f'),
('M4A4 | Howl', 'M4A4 | Howl (Field-Tested)', 'covert', 1800.00, 'https://steamcommunity-a.akamaihd.net/economy/image/class/730/310778/256fx256f'),
('Glock-18 | Water Elemental', 'Glock-18 | Water Elemental (Field-Tested)', 'restricted', 8.50, 'https://steamcommunity-a.akamaihd.net/economy/image/class/730/310779/256fx256f'),
('P250 | Sand Dune', 'P250 | Sand Dune (Field-Tested)', 'consumer', 0.10, 'https://steamcommunity-a.akamaihd.net/economy/image/class/730/310780/256fx256f');

-- Insert sample cases
INSERT INTO cases (name, description, price, image) VALUES
('Weapon Case', 'Contains various weapon skins', 2.50, '/images/cases/weapon_case.png'),
('Operation Bravo Case', 'Rare operation case with exclusive skins', 5.00, '/images/cases/bravo_case.png'),
('Chroma Case', 'Colorful weapon skins collection', 3.00, '/images/cases/chroma_case.png');

-- Insert case items with drop chances
INSERT INTO case_items (case_id, item_id, drop_chance) VALUES
(1, 1, 15.98), -- AK-47 Redline - Classified
(1, 2, 0.64),  -- AWP Dragon Lore - Covert
(1, 3, 0.64),  -- M4A4 Howl - Covert
(1, 4, 15.98), -- Glock Water Elemental - Restricted
(1, 5, 79.92); -- P250 Sand Dune - Consumer

-- Create indexes for better performance
CREATE INDEX idx_users_steam_id ON users(steam_id);
CREATE INDEX idx_case_openings_user_id ON case_openings(user_id);
CREATE INDEX idx_case_openings_opened_at ON case_openings(opened_at);
CREATE INDEX idx_user_inventory_user_id ON user_inventory(user_id);
CREATE INDEX idx_live_feed_created_at ON live_feed(created_at);
CREATE INDEX idx_transactions_user_id ON transactions(user_id);
CREATE INDEX idx_transactions_created_at ON transactions(created_at);
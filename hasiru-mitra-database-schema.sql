-- Hasiru Mitra AI Platform - Database Schema
-- PostgreSQL 15+ with PostGIS extension for geospatial data
-- Created: December 2024

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "btree_gin";

-- Create custom types
CREATE TYPE user_role AS ENUM (
    'farmer', 
    'fpo_admin', 
    'supplier', 
    'certification_body', 
    'platform_admin',
    'agricultural_expert',
    'government_official'
);

CREATE TYPE user_status AS ENUM ('pending', 'active', 'suspended', 'deactivated');
CREATE TYPE verification_status AS ENUM ('pending', 'verified', 'rejected');
CREATE TYPE order_status AS ENUM ('pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded');
CREATE TYPE payment_status AS ENUM ('pending', 'processing', 'completed', 'failed', 'refunded');
CREATE TYPE certification_status AS ENUM ('draft', 'submitted', 'under_review', 'approved', 'rejected', 'expired');
CREATE TYPE crop_stage AS ENUM ('seed', 'seedling', 'vegetative', 'flowering', 'fruiting', 'harvest', 'post_harvest');
CREATE TYPE alert_type AS ENUM ('weather', 'pest', 'disease', 'market', 'certification', 'system');
CREATE TYPE alert_priority AS ENUM ('low', 'medium', 'high', 'critical');

-- ===========================================
-- USER MANAGEMENT SCHEMA
-- ===========================================

-- Core user table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    phone_number VARCHAR(15) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE,
    password_hash VARCHAR(255),
    role user_role NOT NULL DEFAULT 'farmer',
    status user_status NOT NULL DEFAULT 'pending',
    verification_status verification_status NOT NULL DEFAULT 'pending',
    preferred_language VARCHAR(5) DEFAULT 'hi',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP WITH TIME ZONE,
    login_count INTEGER DEFAULT 0,
    failed_login_attempts INTEGER DEFAULT 0,
    locked_until TIMESTAMP WITH TIME ZONE,
    metadata JSONB DEFAULT '{}'
);

-- User profiles with detailed information
CREATE TABLE user_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100),
    date_of_birth DATE,
    gender VARCHAR(10),
    aadhaar_number VARCHAR(12),
    pan_number VARCHAR(10),
    address JSONB, -- Flexible address structure
    geolocation GEOMETRY(POINT, 4326),
    profile_image_url VARCHAR(500),
    bio TEXT,
    education_level VARCHAR(50),
    farming_experience_years INTEGER,
    total_land_area_acres DECIMAL(10,2),
    annual_income_range VARCHAR(50),
    bank_account_details JSONB, -- Encrypted bank details
    emergency_contact JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Authentication tokens and sessions
CREATE TABLE auth_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_type VARCHAR(50) NOT NULL, -- 'access', 'refresh', 'otp', 'reset'
    token_hash VARCHAR(255) NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    used_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    metadata JSONB DEFAULT '{}'
);

-- User device information for push notifications
CREATE TABLE user_devices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    device_id VARCHAR(255) UNIQUE NOT NULL,
    device_type VARCHAR(50) NOT NULL, -- 'android', 'ios', 'web'
    fcm_token VARCHAR(500),
    app_version VARCHAR(20),
    os_version VARCHAR(20),
    is_active BOOLEAN DEFAULT true,
    last_seen TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ===========================================
-- FARM AND CROP MANAGEMENT SCHEMA
-- ===========================================

-- Farmer Producer Organizations (FPOs)
CREATE TABLE fpos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    registration_number VARCHAR(100) UNIQUE,
    admin_user_id UUID REFERENCES users(id),
    address JSONB,
    geolocation GEOMETRY(POINT, 4326),
    total_farmers INTEGER DEFAULT 0,
    total_land_area_acres DECIMAL(10,2),
    certification_status certification_status DEFAULT 'draft',
    established_date DATE,
    contact_details JSONB,
    bank_details JSONB,
    documents JSONB, -- Store document URLs and metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- FPO membership tracking
CREATE TABLE fpo_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    fpo_id UUID NOT NULL REFERENCES fpos(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(50) DEFAULT 'member', -- 'admin', 'member', 'pending'
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(20) DEFAULT 'active',
    UNIQUE(fpo_id, user_id)
);

-- Farm details
CREATE TABLE farms (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    farmer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    fpo_id UUID REFERENCES fpos(id),
    name VARCHAR(255) NOT NULL,
    total_area_acres DECIMAL(10,2) NOT NULL,
    cultivated_area_acres DECIMAL(10,2),
    farm_boundary GEOMETRY(POLYGON, 4326),
    soil_type VARCHAR(100),
    water_source VARCHAR(100),
    irrigation_method VARCHAR(100),
    organic_certification_status certification_status DEFAULT 'draft',
    organic_since_date DATE,
    survey_number VARCHAR(100),
    village VARCHAR(100),
    district VARCHAR(100),
    state VARCHAR(100),
    pincode VARCHAR(10),
    documents JSONB, -- Land documents, certificates
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Crop master data
CREATE TABLE crops (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    scientific_name VARCHAR(150),
    category VARCHAR(50), -- 'cereal', 'pulse', 'vegetable', 'fruit', 'spice', etc.
    variety VARCHAR(100),
    growing_season VARCHAR(50), -- 'kharif', 'rabi', 'zaid'
    duration_days INTEGER,
    plant_spacing_cm INTEGER,
    row_spacing_cm INTEGER,
    seed_rate_per_acre DECIMAL(8,2),
    water_requirement_mm INTEGER,
    temperature_range JSONB, -- min/max temperature
    soil_ph_range JSONB, -- min/max pH
    fertilizer_requirements JSONB,
    common_pests JSONB,
    common_diseases JSONB,
    harvest_indicators TEXT,
    storage_guidelines TEXT,
    market_price_range JSONB,
    nutritional_info JSONB,
    image_urls JSONB,
    is_organic_certified BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Farmer's crop cultivation records
CREATE TABLE farm_crops (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    farm_id UUID NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
    crop_id UUID NOT NULL REFERENCES crops(id),
    season VARCHAR(50) NOT NULL,
    year INTEGER NOT NULL,
    area_acres DECIMAL(8,2) NOT NULL,
    planting_date DATE,
    expected_harvest_date DATE,
    actual_harvest_date DATE,
    current_stage crop_stage DEFAULT 'seed',
    variety_planted VARCHAR(100),
    seed_source VARCHAR(100),
    cultivation_method VARCHAR(50), -- 'organic', 'natural', 'conventional'
    expected_yield_kg DECIMAL(10,2),
    actual_yield_kg DECIMAL(10,2),
    quality_grade VARCHAR(20),
    total_cost DECIMAL(12,2),
    total_revenue DECIMAL(12,2),
    notes TEXT,
    images JSONB, -- Progress photos
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Farm activities and operations log
CREATE TABLE farm_activities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    farm_crop_id UUID NOT NULL REFERENCES farm_crops(id) ON DELETE CASCADE,
    activity_type VARCHAR(50) NOT NULL, -- 'planting', 'watering', 'fertilizing', 'pest_control', etc.
    activity_date DATE NOT NULL,
    description TEXT,
    inputs_used JSONB, -- Seeds, fertilizers, pesticides used
    quantity_used DECIMAL(10,2),
    unit VARCHAR(20),
    cost DECIMAL(10,2),
    labor_hours DECIMAL(5,2),
    weather_conditions JSONB,
    images JSONB,
    gps_location GEOMETRY(POINT, 4326),
    recorded_by UUID REFERENCES users(id),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ===========================================
-- MARKETPLACE SCHEMA
-- ===========================================

-- Product categories
CREATE TABLE product_categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    parent_category_id UUID REFERENCES product_categories(id),
    image_url VARCHAR(500),
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Products (inputs and produce)
CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    seller_id UUID NOT NULL REFERENCES users(id),
    category_id UUID NOT NULL REFERENCES product_categories(id),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    sku VARCHAR(100) UNIQUE,
    product_type VARCHAR(50), -- 'input', 'produce', 'equipment', 'service'
    unit VARCHAR(20) NOT NULL, -- 'kg', 'liter', 'piece', 'acre'
    base_price DECIMAL(10,2) NOT NULL,
    min_order_quantity DECIMAL(8,2) DEFAULT 1,
    max_order_quantity DECIMAL(8,2),
    stock_quantity DECIMAL(10,2),
    is_organic_certified BOOLEAN DEFAULT false,
    certification_details JSONB,
    specifications JSONB,
    images JSONB,
    videos JSONB,
    location GEOMETRY(POINT, 4326),
    delivery_options JSONB, -- Pickup, delivery, shipping
    is_active BOOLEAN DEFAULT true,
    featured BOOLEAN DEFAULT false,
    rating_average DECIMAL(3,2) DEFAULT 0,
    review_count INTEGER DEFAULT 0,
    view_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Product pricing tiers (bulk discounts)
CREATE TABLE product_pricing (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    min_quantity DECIMAL(8,2) NOT NULL,
    max_quantity DECIMAL(8,2),
    price_per_unit DECIMAL(10,2) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Shopping cart
CREATE TABLE cart_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    quantity DECIMAL(8,2) NOT NULL,
    unit_price DECIMAL(10,2) NOT NULL,
    added_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, product_id)
);

-- Orders
CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_number VARCHAR(50) UNIQUE NOT NULL,
    buyer_id UUID NOT NULL REFERENCES users(id),
    seller_id UUID NOT NULL REFERENCES users(id),
    status order_status DEFAULT 'pending',
    order_type VARCHAR(50) DEFAULT 'marketplace', -- 'marketplace', 'direct', 'bulk'
    subtotal DECIMAL(12,2) NOT NULL,
    tax_amount DECIMAL(10,2) DEFAULT 0,
    delivery_charges DECIMAL(10,2) DEFAULT 0,
    discount_amount DECIMAL(10,2) DEFAULT 0,
    total_amount DECIMAL(12,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'INR',
    delivery_address JSONB NOT NULL,
    billing_address JSONB,
    delivery_date DATE,
    special_instructions TEXT,
    commission_rate DECIMAL(5,2) DEFAULT 5.0,
    commission_amount DECIMAL(10,2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Order items
CREATE TABLE order_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id),
    quantity DECIMAL(8,2) NOT NULL,
    unit_price DECIMAL(10,2) NOT NULL,
    total_price DECIMAL(12,2) NOT NULL,
    specifications JSONB, -- Product specs at time of order
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Order tracking and status updates
CREATE TABLE order_tracking (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    status order_status NOT NULL,
    location GEOMETRY(POINT, 4326),
    notes TEXT,
    updated_by UUID REFERENCES users(id),
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ===========================================
-- PAYMENT SCHEMA
-- ===========================================

-- Payment transactions
CREATE TABLE payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL REFERENCES orders(id),
    payer_id UUID NOT NULL REFERENCES users(id),
    payment_method VARCHAR(50) NOT NULL, -- 'upi', 'card', 'netbanking', 'wallet', 'cod'
    gateway VARCHAR(50), -- 'razorpay', 'stripe', 'paytm'
    gateway_transaction_id VARCHAR(255),
    amount DECIMAL(12,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'INR',
    status payment_status DEFAULT 'pending',
    gateway_response JSONB,
    refund_amount DECIMAL(12,2) DEFAULT 0,
    refund_reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- User wallet for internal transactions
CREATE TABLE wallets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    balance DECIMAL(12,2) DEFAULT 0,
    currency VARCHAR(3) DEFAULT 'INR',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Wallet transaction history
CREATE TABLE wallet_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    wallet_id UUID NOT NULL REFERENCES wallets(id) ON DELETE CASCADE,
    transaction_type VARCHAR(50) NOT NULL, -- 'credit', 'debit', 'refund', 'commission'
    amount DECIMAL(12,2) NOT NULL,
    balance_after DECIMAL(12,2) NOT NULL,
    reference_id UUID, -- Order ID, payment ID, etc.
    reference_type VARCHAR(50), -- 'order', 'payment', 'refund', 'commission'
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ===========================================
-- CERTIFICATION SCHEMA
-- ===========================================

-- Certification bodies
CREATE TABLE certification_bodies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    accreditation_number VARCHAR(100) UNIQUE,
    accreditation_body VARCHAR(255), -- NPOP, IFOAM, etc.
    contact_person VARCHAR(255),
    email VARCHAR(255),
    phone VARCHAR(20),
    address JSONB,
    website VARCHAR(255),
    services_offered JSONB, -- Types of certifications
    fee_structure JSONB,
    processing_time_days INTEGER,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Certification applications
CREATE TABLE certification_applications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    application_number VARCHAR(50) UNIQUE NOT NULL,
    applicant_id UUID NOT NULL REFERENCES users(id),
    farm_id UUID NOT NULL REFERENCES farms(id),
    certification_body_id UUID NOT NULL REFERENCES certification_bodies(id),
    certification_type VARCHAR(100) NOT NULL, -- 'NPOP', 'IFOAM', 'EU_Organic', etc.
    status certification_status DEFAULT 'draft',
    application_data JSONB NOT NULL, -- Form data
    documents JSONB, -- Uploaded documents
    inspector_id UUID REFERENCES users(id),
    inspection_date DATE,
    inspection_report JSONB,
    certificate_number VARCHAR(100),
    certificate_issue_date DATE,
    certificate_expiry_date DATE,
    certificate_url VARCHAR(500),
    fees_amount DECIMAL(10,2),
    fees_paid BOOLEAN DEFAULT false,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Certification application workflow
CREATE TABLE certification_workflow (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    application_id UUID NOT NULL REFERENCES certification_applications(id) ON DELETE CASCADE,
    step_name VARCHAR(100) NOT NULL,
    status VARCHAR(50) NOT NULL, -- 'pending', 'in_progress', 'completed', 'rejected'
    assigned_to UUID REFERENCES users(id),
    notes TEXT,
    attachments JSONB,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ===========================================
-- AI/ML AND ADVISORY SCHEMA
-- ===========================================

-- Crop advisory queries and responses
CREATE TABLE advisory_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id),
    session_type VARCHAR(50) NOT NULL, -- 'voice', 'text', 'image'
    language VARCHAR(5) NOT NULL,
    query_text TEXT,
    query_audio_url VARCHAR(500),
    query_images JSONB,
    location GEOMETRY(POINT, 4326),
    context_data JSONB, -- Farm info, crop info, weather, etc.
    ai_response JSONB, -- Structured response from AI
    response_text TEXT,
    response_audio_url VARCHAR(500),
    confidence_score DECIMAL(5,4),
    feedback_rating INTEGER, -- 1-5 stars
    feedback_text TEXT,
    processing_time_ms INTEGER,
    model_version VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Pest and disease identification
CREATE TABLE pest_disease_identification (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id),
    farm_crop_id UUID REFERENCES farm_crops(id),
    image_urls JSONB NOT NULL,
    location GEOMETRY(POINT, 4326),
    identified_pest_disease VARCHAR(255),
    confidence_score DECIMAL(5,4),
    severity_level VARCHAR(20), -- 'low', 'medium', 'high', 'critical'
    treatment_recommendations JSONB,
    prevention_measures JSONB,
    expert_verification BOOLEAN DEFAULT false,
    verified_by UUID REFERENCES users(id),
    verification_notes TEXT,
    model_version VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Market price predictions and trends
CREATE TABLE market_prices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    crop_id UUID NOT NULL REFERENCES crops(id),
    market_name VARCHAR(255),
    location GEOMETRY(POINT, 4326),
    date DATE NOT NULL,
    price_per_kg DECIMAL(8,2) NOT NULL,
    quality_grade VARCHAR(20),
    volume_traded_kg DECIMAL(12,2),
    source VARCHAR(100), -- 'government', 'mandi', 'api', 'user_reported'
    is_organic BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(crop_id, market_name, date, quality_grade)
);

-- Weather data and forecasts
CREATE TABLE weather_data (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    location GEOMETRY(POINT, 4326) NOT NULL,
    date DATE NOT NULL,
    temperature_min DECIMAL(5,2),
    temperature_max DECIMAL(5,2),
    humidity_percent DECIMAL(5,2),
    rainfall_mm DECIMAL(6,2),
    wind_speed_kmh DECIMAL(5,2),
    wind_direction VARCHAR(10),
    pressure_hpa DECIMAL(7,2),
    uv_index DECIMAL(3,1),
    weather_condition VARCHAR(100),
    data_source VARCHAR(50), -- 'openweather', 'imd', 'accuweather'
    is_forecast BOOLEAN DEFAULT false,
    forecast_days_ahead INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ===========================================
-- COMMUNICATION SCHEMA
-- ===========================================

-- Voice call logs
CREATE TABLE voice_calls (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id),
    call_sid VARCHAR(255) UNIQUE, -- Twilio call SID
    phone_number VARCHAR(20),
    call_direction VARCHAR(20), -- 'inbound', 'outbound'
    call_status VARCHAR(50), -- 'ringing', 'in-progress', 'completed', 'failed'
    duration_seconds INTEGER,
    recording_url VARCHAR(500),
    transcription TEXT,
    language_detected VARCHAR(5),
    advisory_session_id UUID REFERENCES advisory_sessions(id),
    cost_amount DECIMAL(8,4),
    started_at TIMESTAMP WITH TIME ZONE,
    ended_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- SMS and notification logs
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id),
    notification_type VARCHAR(50) NOT NULL, -- 'sms', 'email', 'push', 'whatsapp'
    title VARCHAR(255),
    message TEXT NOT NULL,
    data JSONB, -- Additional data for rich notifications
    delivery_status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'sent', 'delivered', 'failed'
    delivery_time TIMESTAMP WITH TIME ZONE,
    read_at TIMESTAMP WITH TIME ZONE,
    gateway_message_id VARCHAR(255),
    cost_amount DECIMAL(8,4),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ===========================================
-- ANALYTICS AND REPORTING SCHEMA
-- ===========================================

-- User activity tracking
CREATE TABLE user_activities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id),
    session_id UUID,
    activity_type VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50), -- 'product', 'order', 'advisory', etc.
    entity_id UUID,
    metadata JSONB,
    ip_address INET,
    user_agent TEXT,
    location GEOMETRY(POINT, 4326),
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- System alerts and monitoring
CREATE TABLE system_alerts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    alert_type alert_type NOT NULL,
    priority alert_priority NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    entity_type VARCHAR(50),
    entity_id UUID,
    affected_users JSONB, -- Array of user IDs
    location GEOMETRY(POINT, 4326),
    is_resolved BOOLEAN DEFAULT false,
    resolved_by UUID REFERENCES users(id),
    resolved_at TIMESTAMP WITH TIME ZONE,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ===========================================
-- IOT AND SENSOR DATA SCHEMA
-- ===========================================

-- IoT devices and sensors
CREATE TABLE iot_devices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    device_id VARCHAR(255) UNIQUE NOT NULL,
    farm_id UUID NOT NULL REFERENCES farms(id),
    device_type VARCHAR(100) NOT NULL, -- 'soil_sensor', 'weather_station', 'camera', etc.
    manufacturer VARCHAR(100),
    model VARCHAR(100),
    firmware_version VARCHAR(50),
    location GEOMETRY(POINT, 4326),
    installation_date DATE,
    last_seen TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT true,
    configuration JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- IoT sensor readings (time-series data)
CREATE TABLE sensor_readings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    device_id UUID NOT NULL REFERENCES iot_devices(id),
    sensor_type VARCHAR(100) NOT NULL, -- 'temperature', 'humidity', 'soil_moisture', etc.
    value DECIMAL(10,4) NOT NULL,
    unit VARCHAR(20) NOT NULL,
    quality_score DECIMAL(3,2) DEFAULT 1.0, -- Data quality indicator
    location GEOMETRY(POINT, 4326),
    metadata JSONB,
    recorded_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ===========================================
-- CONTENT MANAGEMENT SCHEMA
-- ===========================================

-- Educational content and training materials
CREATE TABLE content (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(255) NOT NULL,
    content_type VARCHAR(50) NOT NULL, -- 'article', 'video', 'pdf', 'course'
    category VARCHAR(100),
    tags JSONB,
    content_text TEXT,
    media_urls JSONB,
    language VARCHAR(5) NOT NULL,
    difficulty_level VARCHAR(20), -- 'beginner', 'intermediate', 'advanced'
    estimated_reading_time INTEGER, -- in minutes
    author_id UUID REFERENCES users(id),
    is_published BOOLEAN DEFAULT false,
    is_premium BOOLEAN DEFAULT false,
    view_count INTEGER DEFAULT 0,
    like_count INTEGER DEFAULT 0,
    share_count INTEGER DEFAULT 0,
    seo_metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- User content interactions
CREATE TABLE content_interactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id),
    content_id UUID NOT NULL REFERENCES content(id),
    interaction_type VARCHAR(50) NOT NULL, -- 'view', 'like', 'share', 'bookmark', 'complete'
    progress_percent INTEGER DEFAULT 0,
    time_spent_seconds INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, content_id, interaction_type)
);

-- ===========================================
-- INDEXES FOR PERFORMANCE
-- ===========================================

-- User and authentication indexes
CREATE INDEX idx_users_phone ON users(phone_number);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role_status ON users(role, status);
CREATE INDEX idx_auth_tokens_user_type ON auth_tokens(user_id, token_type);
CREATE INDEX idx_auth_tokens_expires ON auth_tokens(expires_at);

-- Farm and crop indexes
CREATE INDEX idx_farms_farmer ON farms(farmer_id);
CREATE INDEX idx_farms_location ON farms USING GIST(farm_boundary);
CREATE INDEX idx_farm_crops_farm_season ON farm_crops(farm_id, season, year);
CREATE INDEX idx_farm_activities_crop_date ON farm_activities(farm_crop_id, activity_date);

-- Marketplace indexes
CREATE INDEX idx_products_seller ON products(seller_id);
CREATE INDEX idx_products_category ON products(category_id);
CREATE INDEX idx_products_location ON products USING GIST(location);
CREATE INDEX idx_products_active_featured ON products(is_active, featured);
CREATE INDEX idx_orders_buyer ON orders(buyer_id);
CREATE INDEX idx_orders_seller ON orders(seller_id);
CREATE INDEX idx_orders_status_created ON orders(status, created_at);

-- Communication and analytics indexes
CREATE INDEX idx_voice_calls_user ON voice_calls(user_id);
CREATE INDEX idx_notifications_user_type ON notifications(user_id, notification_type);
CREATE INDEX idx_user_activities_user_time ON user_activities(user_id, timestamp);
CREATE INDEX idx_sensor_readings_device_time ON sensor_readings(device_id, recorded_at);

-- Geospatial indexes
CREATE INDEX idx_weather_location_date ON weather_data USING GIST(location) WHERE date >= CURRENT_DATE - INTERVAL '30 days';
CREATE INDEX idx_market_prices_crop_date ON market_prices(crop_id, date);

-- Full-text search indexes
CREATE INDEX idx_products_search ON products USING GIN(to_tsvector('english', name || ' ' || description));
CREATE INDEX idx_content_search ON content USING GIN(to_tsvector('english', title || ' ' || content_text));

-- ===========================================
-- TRIGGERS FOR AUTOMATIC UPDATES
-- ===========================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply trigger to relevant tables
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_user_profiles_updated_at BEFORE UPDATE ON user_profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_farms_updated_at BEFORE UPDATE ON farms FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_farm_crops_updated_at BEFORE UPDATE ON farm_crops FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON products FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON orders FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to update user login stats
CREATE OR REPLACE FUNCTION update_user_login_stats()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE users 
    SET last_login = CURRENT_TIMESTAMP, 
        login_count = login_count + 1,
        failed_login_attempts = 0
    WHERE id = NEW.user_id AND NEW.token_type = 'access';
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_login_stats AFTER INSERT ON auth_tokens FOR EACH ROW EXECUTE FUNCTION update_user_login_stats();

-- ===========================================
-- INITIAL DATA SEEDING
-- ===========================================

-- Insert default product categories
INSERT INTO product_categories (name, description, sort_order) VALUES
('Seeds', 'Organic seeds for various crops', 1),
('Fertilizers', 'Organic fertilizers and nutrients', 2),
('Pest Control', 'Organic pest and disease control products', 3),
('Equipment', 'Farming tools and equipment', 4),
('Fresh Produce', 'Farm fresh organic produce', 5),
('Processed Foods', 'Value-added organic food products', 6);

-- Insert common crops
INSERT INTO crops (name, scientific_name, category, growing_season, duration_days) VALUES
('Rice', 'Oryza sativa', 'cereal', 'kharif', 120),
('Wheat', 'Triticum aestivum', 'cereal', 'rabi', 150),
('Tomato', 'Solanum lycopersicum', 'vegetable', 'all', 90),
('Onion', 'Allium cepa', 'vegetable', 'rabi', 120),
('Cotton', 'Gossypium', 'cash_crop', 'kharif', 180),
('Sugarcane', 'Saccharum officinarum', 'cash_crop', 'all', 365),
('Turmeric', 'Curcuma longa', 'spice', 'kharif', 240),
('Chili', 'Capsicum annuum', 'spice', 'all', 90);

-- Insert system admin user
INSERT INTO users (phone_number, email, role, status, verification_status) VALUES
('919999999999', 'admin@hasirumitra.com', 'platform_admin', 'active', 'verified');

COMMIT;
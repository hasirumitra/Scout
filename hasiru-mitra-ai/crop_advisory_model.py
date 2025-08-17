"""
Hasiru Mitra AI - Crop Advisory Model
Advanced machine learning model for personalized organic farming recommendations
Combines weather data, soil conditions, crop history, and market trends
"""

import torch
import torch.nn as nn
import torch.nn.functional as F
import numpy as np
import pandas as pd
from typing import Dict, List, Tuple, Optional
from dataclasses import dataclass
from datetime import datetime, timedelta
import json
import logging
from sklearn.preprocessing import StandardScaler, LabelEncoder
from sklearn.ensemble import RandomForestRegressor
from sklearn.model_selection import train_test_split
import joblib

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

@dataclass
class CropAdvisoryInput:
    """Input structure for crop advisory model"""
    farm_location: Tuple[float, float]  # (latitude, longitude)
    farm_size_acres: float
    soil_type: str
    soil_ph: float
    soil_organic_matter: float
    soil_nitrogen: float
    soil_phosphorus: float
    soil_potassium: float
    current_season: str  # 'kharif', 'rabi', 'zaid'
    current_month: int
    water_source: str  # 'rainfall', 'irrigation', 'both'
    irrigation_method: str  # 'drip', 'sprinkler', 'flood', 'none'
    previous_crops: List[str]  # Last 3 seasons
    farmer_experience_years: int
    budget_available: float
    target_market: str  # 'local', 'regional', 'export'
    organic_certification: bool
    weather_forecast: Dict  # 7-day weather forecast
    market_prices: Dict  # Current market prices for crops

@dataclass
class CropRecommendation:
    """Output structure for crop recommendations"""
    crop_name: str
    scientific_name: str
    confidence_score: float
    expected_yield_kg_per_acre: float
    expected_revenue_per_acre: float
    expected_profit_per_acre: float
    risk_level: str  # 'low', 'medium', 'high'
    planting_window: Tuple[datetime, datetime]
    harvest_window: Tuple[datetime, datetime]
    water_requirement_mm: float
    fertilizer_plan: Dict
    pest_disease_warnings: List[str]
    care_instructions: List[Dict]
    market_outlook: str

class WeatherEncoder(nn.Module):
    """Encodes weather data into feature vectors"""
    
    def __init__(self, input_dim=28, hidden_dim=64, output_dim=32):
        super(WeatherEncoder, self).__init__()
        self.encoder = nn.Sequential(
            nn.Linear(input_dim, hidden_dim),
            nn.ReLU(),
            nn.BatchNorm1d(hidden_dim),
            nn.Dropout(0.2),
            nn.Linear(hidden_dim, output_dim),
            nn.ReLU()
        )
    
    def forward(self, weather_data):
        return self.encoder(weather_data)

class SoilHealthEncoder(nn.Module):
    """Encodes soil health parameters"""
    
    def __init__(self, input_dim=10, hidden_dim=32, output_dim=16):
        super(SoilHealthEncoder, self).__init__()
        self.encoder = nn.Sequential(
            nn.Linear(input_dim, hidden_dim),
            nn.ReLU(),
            nn.BatchNorm1d(hidden_dim),
            nn.Dropout(0.1),
            nn.Linear(hidden_dim, output_dim),
            nn.ReLU()
        )
    
    def forward(self, soil_data):
        return self.encoder(soil_data)

class CropHistoryEncoder(nn.Module):
    """Encodes crop rotation and farming history"""
    
    def __init__(self, vocab_size=200, embedding_dim=64, hidden_dim=32):
        super(CropHistoryEncoder, self).__init__()
        self.crop_embedding = nn.Embedding(vocab_size, embedding_dim)
        self.lstm = nn.LSTM(embedding_dim, hidden_dim, batch_first=True)
        self.attention = nn.MultiheadAttention(hidden_dim, num_heads=4)
        
    def forward(self, crop_sequences):
        # crop_sequences: (batch_size, sequence_length)
        embedded = self.crop_embedding(crop_sequences)
        lstm_out, _ = self.lstm(embedded)
        
        # Apply attention
        attended, _ = self.attention(lstm_out, lstm_out, lstm_out)
        
        # Global average pooling
        return attended.mean(dim=1)

class CropAdvisoryNetwork(nn.Module):
    """
    Main neural network for crop advisory recommendations
    Combines multiple encoders and predicts crop suitability
    """
    
    def __init__(self, num_crops=100, weather_dim=32, soil_dim=16, history_dim=32):
        super(CropAdvisoryNetwork, self).__init__()
        
        self.weather_encoder = WeatherEncoder(output_dim=weather_dim)
        self.soil_encoder = SoilHealthEncoder(output_dim=soil_dim)
        self.history_encoder = CropHistoryEncoder(hidden_dim=history_dim)
        
        # Additional feature dimensions
        self.location_encoder = nn.Linear(2, 8)  # lat, lon
        self.farmer_encoder = nn.Linear(4, 8)   # experience, budget, farm_size, organic_cert
        
        # Combine all features
        total_feature_dim = weather_dim + soil_dim + history_dim + 8 + 8 + 16  # +16 for categorical features
        
        self.feature_fusion = nn.Sequential(
            nn.Linear(total_feature_dim, 256),
            nn.ReLU(),
            nn.BatchNorm1d(256),
            nn.Dropout(0.3),
            nn.Linear(256, 128),
            nn.ReLU(),
            nn.BatchNorm1d(128),
            nn.Dropout(0.2),
            nn.Linear(128, 64),
            nn.ReLU()
        )
        
        # Output heads for different predictions
        self.crop_suitability = nn.Linear(64, num_crops)  # Suitability score for each crop
        self.yield_predictor = nn.Linear(64, num_crops)   # Expected yield for each crop
        self.risk_predictor = nn.Linear(64, num_crops)    # Risk level for each crop
        self.profit_predictor = nn.Linear(64, num_crops)  # Expected profit for each crop
        
    def forward(self, batch):
        # Encode different input components
        weather_features = self.weather_encoder(batch['weather'])
        soil_features = self.soil_encoder(batch['soil'])
        history_features = self.history_encoder(batch['crop_history'])
        location_features = F.relu(self.location_encoder(batch['location']))
        farmer_features = F.relu(self.farmer_encoder(batch['farmer_info']))
        
        # Concatenate all features
        combined_features = torch.cat([
            weather_features,
            soil_features,
            history_features,
            location_features,
            farmer_features,
            batch['categorical_features']
        ], dim=1)
        
        # Feature fusion
        fused_features = self.feature_fusion(combined_features)
        
        # Generate predictions
        suitability_scores = torch.sigmoid(self.crop_suitability(fused_features))
        yield_predictions = F.relu(self.yield_predictor(fused_features))
        risk_scores = torch.sigmoid(self.risk_predictor(fused_features))
        profit_predictions = self.profit_predictor(fused_features)
        
        return {
            'suitability': suitability_scores,
            'yield': yield_predictions,
            'risk': risk_scores,
            'profit': profit_predictions
        }

class CropAdvisoryModel:
    """
    Main class for crop advisory system
    Handles data preprocessing, model inference, and recommendation generation
    """
    
    def __init__(self, model_path: Optional[str] = None):
        self.device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
        self.model = CropAdvisoryNetwork()
        self.model.to(self.device)
        
        # Load pre-trained weights if available
        if model_path:
            self.load_model(model_path)
        
        # Initialize preprocessing components
        self.weather_scaler = StandardScaler()
        self.soil_scaler = StandardScaler()
        self.crop_encoder = LabelEncoder()
        
        # Load crop database and market data
        self.crop_database = self._load_crop_database()
        self.load_preprocessing_components()
        
    def _load_crop_database(self) -> pd.DataFrame:
        """Load comprehensive crop information database"""
        # In production, this would load from the database
        crops_data = {
            'crop_id': range(100),
            'name': ['Rice', 'Wheat', 'Tomato', 'Onion', 'Cotton'] * 20,  # Simplified
            'scientific_name': ['Oryza sativa', 'Triticum aestivum', 'Solanum lycopersicum', 
                               'Allium cepa', 'Gossypium'] * 20,
            'category': ['cereal', 'cereal', 'vegetable', 'vegetable', 'cash_crop'] * 20,
            'growing_season': ['kharif', 'rabi', 'all', 'rabi', 'kharif'] * 20,
            'duration_days': [120, 150, 90, 120, 180] * 20,
            'water_requirement': [1200, 400, 500, 350, 800] * 20,
            'optimal_temp_min': [20, 10, 15, 13, 21] * 20,
            'optimal_temp_max': [35, 25, 30, 25, 32] * 20,
            'soil_ph_min': [5.5, 6.0, 6.0, 6.0, 5.5] * 20,
            'soil_ph_max': [7.0, 7.5, 7.5, 7.5, 8.0] * 20,
        }
        return pd.DataFrame(crops_data)
    
    def load_preprocessing_components(self):
        """Load or initialize preprocessing components"""
        try:
            self.weather_scaler = joblib.load('models/weather_scaler.pkl')
            self.soil_scaler = joblib.load('models/soil_scaler.pkl')
            self.crop_encoder = joblib.load('models/crop_encoder.pkl')
            logger.info("Loaded preprocessing components successfully")
        except FileNotFoundError:
            logger.warning("Preprocessing components not found, will need training")
    
    def preprocess_input(self, advisory_input: CropAdvisoryInput) -> Dict[str, torch.Tensor]:
        """Convert input data to model-ready tensors"""
        
        # Weather features (7 days * 4 features per day)
        weather_data = []
        for day in advisory_input.weather_forecast['daily']:
            weather_data.extend([
                day['temperature_max'],
                day['temperature_min'], 
                day['humidity'],
                day['rainfall_mm']
            ])
        weather_tensor = torch.FloatTensor(weather_data).unsqueeze(0)
        
        # Soil features
        soil_data = [
            advisory_input.soil_ph,
            advisory_input.soil_organic_matter,
            advisory_input.soil_nitrogen,
            advisory_input.soil_phosphorus,
            advisory_input.soil_potassium,
            # Add derived features
            advisory_input.soil_nitrogen + advisory_input.soil_phosphorus + advisory_input.soil_potassium,  # NPK sum
            advisory_input.soil_ph - 6.5,  # pH deviation from neutral
            advisory_input.soil_organic_matter / 5.0,  # Normalized organic matter
            1.0 if advisory_input.soil_type == 'clay' else 0.0,
            1.0 if advisory_input.soil_type == 'sandy' else 0.0
        ]
        soil_tensor = torch.FloatTensor(soil_data).unsqueeze(0)
        
        # Crop history (encode previous crops)
        crop_ids = []
        for crop_name in advisory_input.previous_crops:
            try:
                crop_id = self.crop_encoder.transform([crop_name])[0]
            except:
                crop_id = 0  # Unknown crop
            crop_ids.append(crop_id)
        
        # Pad or truncate to fixed length
        while len(crop_ids) < 5:
            crop_ids.append(0)
        crop_history_tensor = torch.LongTensor(crop_ids[:5]).unsqueeze(0)
        
        # Location features
        location_tensor = torch.FloatTensor(advisory_input.farm_location).unsqueeze(0)
        
        # Farmer info
        farmer_info = [
            advisory_input.farmer_experience_years / 50.0,  # Normalized experience
            np.log(advisory_input.budget_available + 1) / 15.0,  # Log-normalized budget
            advisory_input.farm_size_acres / 100.0,  # Normalized farm size
            1.0 if advisory_input.organic_certification else 0.0
        ]
        farmer_tensor = torch.FloatTensor(farmer_info).unsqueeze(0)
        
        # Categorical features (one-hot encoded)
        categorical = np.zeros(16)
        
        # Season encoding
        if advisory_input.current_season == 'kharif':
            categorical[0] = 1
        elif advisory_input.current_season == 'rabi':
            categorical[1] = 1
        elif advisory_input.current_season == 'zaid':
            categorical[2] = 1
            
        # Water source encoding
        if advisory_input.water_source == 'rainfall':
            categorical[3] = 1
        elif advisory_input.water_source == 'irrigation':
            categorical[4] = 1
        elif advisory_input.water_source == 'both':
            categorical[5] = 1
            
        # Irrigation method encoding
        if advisory_input.irrigation_method == 'drip':
            categorical[6] = 1
        elif advisory_input.irrigation_method == 'sprinkler':
            categorical[7] = 1
        elif advisory_input.irrigation_method == 'flood':
            categorical[8] = 1
            
        # Target market encoding
        if advisory_input.target_market == 'local':
            categorical[9] = 1
        elif advisory_input.target_market == 'regional':
            categorical[10] = 1
        elif advisory_input.target_market == 'export':
            categorical[11] = 1
            
        # Month encoding (simplified - could use sin/cos)
        categorical[12] = advisory_input.current_month / 12.0
        
        categorical_tensor = torch.FloatTensor(categorical).unsqueeze(0)
        
        return {
            'weather': weather_tensor.to(self.device),
            'soil': soil_tensor.to(self.device),
            'crop_history': crop_history_tensor.to(self.device),
            'location': location_tensor.to(self.device),
            'farmer_info': farmer_tensor.to(self.device),
            'categorical_features': categorical_tensor.to(self.device)
        }
    
    def predict(self, advisory_input: CropAdvisoryInput) -> List[CropRecommendation]:
        """Generate crop recommendations for given input"""
        
        self.model.eval()
        with torch.no_grad():
            # Preprocess input
            model_input = self.preprocess_input(advisory_input)
            
            # Get model predictions
            predictions = self.model(model_input)
            
            # Convert to numpy for processing
            suitability_scores = predictions['suitability'].cpu().numpy()[0]
            yield_predictions = predictions['yield'].cpu().numpy()[0]
            risk_scores = predictions['risk'].cpu().numpy()[0]
            profit_predictions = predictions['profit'].cpu().numpy()[0]
            
            # Generate recommendations
            recommendations = []
            
            # Get top N suitable crops
            top_crop_indices = np.argsort(suitability_scores)[-10:][::-1]
            
            for idx in top_crop_indices:
                if suitability_scores[idx] < 0.3:  # Minimum threshold
                    continue
                    
                crop_info = self.crop_database.iloc[idx]
                
                # Calculate planting and harvest windows
                planting_start = self._calculate_planting_window(
                    crop_info, advisory_input.current_month
                )
                harvest_date = planting_start + timedelta(days=crop_info['duration_days'])
                
                # Generate care instructions
                care_instructions = self._generate_care_instructions(crop_info, advisory_input)
                
                recommendation = CropRecommendation(
                    crop_name=crop_info['name'],
                    scientific_name=crop_info['scientific_name'],
                    confidence_score=float(suitability_scores[idx]),
                    expected_yield_kg_per_acre=float(yield_predictions[idx]),
                    expected_revenue_per_acre=float(yield_predictions[idx] * 
                                                  advisory_input.market_prices.get(crop_info['name'], 20)),
                    expected_profit_per_acre=float(profit_predictions[idx]),
                    risk_level=self._categorize_risk(risk_scores[idx]),
                    planting_window=(planting_start, planting_start + timedelta(days=30)),
                    harvest_window=(harvest_date, harvest_date + timedelta(days=15)),
                    water_requirement_mm=crop_info['water_requirement'],
                    fertilizer_plan=self._generate_fertilizer_plan(crop_info, advisory_input),
                    pest_disease_warnings=self._get_pest_warnings(crop_info, advisory_input),
                    care_instructions=care_instructions,
                    market_outlook=self._generate_market_outlook(crop_info, advisory_input)
                )
                
                recommendations.append(recommendation)
            
            return recommendations[:5]  # Return top 5 recommendations
    
    def _calculate_planting_window(self, crop_info, current_month):
        """Calculate optimal planting window for crop"""
        # Simplified logic - in production, this would be more sophisticated
        if crop_info['growing_season'] == 'kharif':
            planting_month = 6  # June
        elif crop_info['growing_season'] == 'rabi':
            planting_month = 11  # November
        else:  # all season
            planting_month = current_month + 1
            
        current_year = datetime.now().year
        if planting_month < current_month:
            current_year += 1
            
        return datetime(current_year, planting_month, 1)
    
    def _categorize_risk(self, risk_score):
        """Categorize risk level based on score"""
        if risk_score < 0.3:
            return 'low'
        elif risk_score < 0.6:
            return 'medium'
        else:
            return 'high'
    
    def _generate_fertilizer_plan(self, crop_info, advisory_input):
        """Generate organic fertilizer recommendations"""
        base_nitrogen = advisory_input.soil_nitrogen
        base_phosphorus = advisory_input.soil_phosphorus
        base_potassium = advisory_input.soil_potassium
        
        # Calculate requirements based on crop needs and soil levels
        return {
            'pre_planting': {
                'compost_kg_per_acre': max(500 - advisory_input.soil_organic_matter * 100, 0),
                'bone_meal_kg_per_acre': max(50 - base_phosphorus * 10, 0),
                'wood_ash_kg_per_acre': max(30 - base_potassium * 5, 0)
            },
            'vegetative_stage': {
                'neem_cake_kg_per_acre': 100,
                'vermicompost_kg_per_acre': 200
            },
            'flowering_stage': {
                'seaweed_extract_liters_per_acre': 5,
                'bat_guano_kg_per_acre': 25
            }
        }
    
    def _get_pest_warnings(self, crop_info, advisory_input):
        """Get relevant pest and disease warnings"""
        warnings = []
        
        # Weather-based warnings
        avg_humidity = np.mean([day['humidity'] for day in advisory_input.weather_forecast['daily']])
        avg_rainfall = np.mean([day['rainfall_mm'] for day in advisory_input.weather_forecast['daily']])
        
        if avg_humidity > 80:
            warnings.append("High humidity increases fungal disease risk - ensure good ventilation")
        
        if avg_rainfall > 10:
            warnings.append("Heavy rainfall expected - protect against root rot and leaf diseases")
        
        # Crop-specific warnings
        if crop_info['name'] == 'Tomato':
            warnings.append("Monitor for early blight and whitefly infestations")
        elif crop_info['name'] == 'Rice':
            warnings.append("Watch for brown plant hopper and blast disease")
        
        return warnings
    
    def _generate_care_instructions(self, crop_info, advisory_input):
        """Generate detailed care instructions"""
        instructions = []
        
        # Planting instructions
        instructions.append({
            'stage': 'planting',
            'timing': 'Week 0-1',
            'instruction': f"Plant seeds at {crop_info.get('plant_spacing_cm', 30)}cm spacing",
            'priority': 'high'
        })
        
        # Watering schedule
        water_frequency = 'daily' if crop_info['water_requirement'] > 800 else 'alternate days'
        instructions.append({
            'stage': 'watering',
            'timing': 'Throughout growing season',
            'instruction': f"Water {water_frequency}, approximately {crop_info['water_requirement']/crop_info['duration_days']:.1f}mm per day",
            'priority': 'high'
        })
        
        # Fertilization schedule
        instructions.append({
            'stage': 'fertilization',
            'timing': 'Week 2-3',
            'instruction': "Apply organic fertilizer as per recommendation",
            'priority': 'medium'
        })
        
        return instructions
    
    def _generate_market_outlook(self, crop_info, advisory_input):
        """Generate market outlook for the crop"""
        # Simplified market analysis
        current_price = advisory_input.market_prices.get(crop_info['name'], 20)
        
        if current_price > 25:
            return "Market prices are currently favorable. Good time to cultivate."
        elif current_price > 15:
            return "Market prices are moderate. Consider if you have good yield potential."
        else:
            return "Market prices are low. Consider alternative crops or wait for better pricing."
    
    def train_model(self, training_data: pd.DataFrame, epochs: int = 100):
        """Train the crop advisory model"""
        logger.info("Starting model training...")
        
        # Prepare training data
        X, y = self._prepare_training_data(training_data)
        X_train, X_val, y_train, y_val = train_test_split(X, y, test_size=0.2, random_state=42)
        
        # Training setup
        self.model.train()
        optimizer = torch.optim.AdamW(self.model.parameters(), lr=0.001, weight_decay=0.01)
        scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=epochs)
        
        best_val_loss = float('inf')
        
        for epoch in range(epochs):
            # Training loop
            train_loss = self._train_epoch(X_train, y_train, optimizer)
            
            # Validation loop
            val_loss = self._validate_epoch(X_val, y_val)
            
            scheduler.step()
            
            if val_loss < best_val_loss:
                best_val_loss = val_loss
                self.save_model(f'models/crop_advisory_best.pth')
            
            if epoch % 10 == 0:
                logger.info(f"Epoch {epoch}: Train Loss: {train_loss:.4f}, Val Loss: {val_loss:.4f}")
        
        logger.info("Training completed!")
    
    def _train_epoch(self, X, y, optimizer):
        """Single training epoch"""
        total_loss = 0
        for batch_x, batch_y in self._create_batches(X, y, batch_size=32):
            optimizer.zero_grad()
            
            predictions = self.model(batch_x)
            loss = self._calculate_loss(predictions, batch_y)
            
            loss.backward()
            optimizer.step()
            
            total_loss += loss.item()
        
        return total_loss / len(X)
    
    def _validate_epoch(self, X, y):
        """Single validation epoch"""
        self.model.eval()
        total_loss = 0
        
        with torch.no_grad():
            for batch_x, batch_y in self._create_batches(X, y, batch_size=32):
                predictions = self.model(batch_x)
                loss = self._calculate_loss(predictions, batch_y)
                total_loss += loss.item()
        
        self.model.train()
        return total_loss / len(X)
    
    def _calculate_loss(self, predictions, targets):
        """Calculate combined loss for multiple objectives"""
        suitability_loss = F.binary_cross_entropy(predictions['suitability'], targets['suitability'])
        yield_loss = F.mse_loss(predictions['yield'], targets['yield'])
        risk_loss = F.binary_cross_entropy(predictions['risk'], targets['risk'])
        profit_loss = F.mse_loss(predictions['profit'], targets['profit'])
        
        # Weighted combination
        total_loss = 0.4 * suitability_loss + 0.3 * yield_loss + 0.2 * risk_loss + 0.1 * profit_loss
        return total_loss
    
    def save_model(self, path: str):
        """Save model checkpoint"""
        torch.save({
            'model_state_dict': self.model.state_dict(),
            'crop_database': self.crop_database,
        }, path)
        logger.info(f"Model saved to {path}")
    
    def load_model(self, path: str):
        """Load model checkpoint"""
        checkpoint = torch.load(path, map_location=self.device)
        self.model.load_state_dict(checkpoint['model_state_dict'])
        self.crop_database = checkpoint['crop_database']
        logger.info(f"Model loaded from {path}")

# Example usage and testing
if __name__ == "__main__":
    # Initialize model
    advisory_model = CropAdvisoryModel()
    
    # Example input
    sample_input = CropAdvisoryInput(
        farm_location=(12.9716, 77.5946),  # Bangalore coordinates
        farm_size_acres=5.0,
        soil_type='clay',
        soil_ph=6.5,
        soil_organic_matter=3.2,
        soil_nitrogen=45.0,
        soil_phosphorus=25.0,
        soil_potassium=180.0,
        current_season='kharif',
        current_month=6,
        water_source='both',
        irrigation_method='drip',
        previous_crops=['Rice', 'Wheat', 'Tomato'],
        farmer_experience_years=15,
        budget_available=100000.0,
        target_market='regional',
        organic_certification=True,
        weather_forecast={
            'daily': [
                {'temperature_max': 32, 'temperature_min': 22, 'humidity': 75, 'rainfall_mm': 5}
            ] * 7
        },
        market_prices={'Rice': 25, 'Wheat': 20, 'Tomato': 40, 'Onion': 30, 'Cotton': 35}
    )
    
    # Get recommendations
    recommendations = advisory_model.predict(sample_input)
    
    # Print results
    for i, rec in enumerate(recommendations):
        print(f"\n--- Recommendation {i+1} ---")
        print(f"Crop: {rec.crop_name} ({rec.scientific_name})")
        print(f"Confidence: {rec.confidence_score:.2f}")
        print(f"Expected Yield: {rec.expected_yield_kg_per_acre:.0f} kg/acre")
        print(f"Expected Revenue: ₹{rec.expected_revenue_per_acre:.0f}/acre")
        print(f"Risk Level: {rec.risk_level}")
        print(f"Market Outlook: {rec.market_outlook}")
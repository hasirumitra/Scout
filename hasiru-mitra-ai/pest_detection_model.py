"""
Hasiru Mitra AI - Pest and Disease Detection Model
Advanced computer vision model for identifying crop pests and diseases
Uses CNN with attention mechanisms for accurate identification
"""

import torch
import torch.nn as nn
import torch.nn.functional as F
import torchvision.transforms as transforms
import torchvision.models as models
from torch.utils.data import Dataset, DataLoader
import cv2
import numpy as np
import pandas as pd
from PIL import Image
import json
import logging
from typing import Dict, List, Tuple, Optional
from dataclasses import dataclass
import albumentations as A
from albumentations.pytorch import ToTensorV2
import timm
from sklearn.metrics import classification_report, confusion_matrix
import matplotlib.pyplot as plt
import seaborn as sns

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

@dataclass
class PestDetectionInput:
    """Input structure for pest detection"""
    image_paths: List[str]
    crop_type: str
    location: Tuple[float, float]
    capture_date: str
    weather_conditions: Dict
    growth_stage: str  # 'seedling', 'vegetative', 'flowering', 'fruiting'

@dataclass
class PestDetectionResult:
    """Result structure for pest detection"""
    pest_disease_name: str
    common_name: str
    scientific_name: str
    confidence_score: float
    severity_level: str  # 'low', 'medium', 'high', 'critical'
    affected_area_percentage: float
    detection_boxes: List[Dict]  # Bounding boxes for detected regions
    symptoms_description: str
    organic_treatments: List[Dict]
    prevention_measures: List[str]
    expected_yield_impact: str
    treatment_urgency: str  # 'immediate', 'within_week', 'monitor'
    similar_conditions: List[str]

class AttentionBlock(nn.Module):
    """Attention mechanism for focusing on relevant image regions"""
    
    def __init__(self, in_channels, attention_channels=256):
        super(AttentionBlock, self).__init__()
        self.attention_conv = nn.Conv2d(in_channels, attention_channels, 1)
        self.attention_norm = nn.BatchNorm2d(attention_channels)
        self.attention_activation = nn.ReLU(inplace=True)
        self.attention_pool = nn.AdaptiveAvgPool2d(1)
        self.attention_fc = nn.Sequential(
            nn.Linear(attention_channels, attention_channels // 4),
            nn.ReLU(inplace=True),
            nn.Linear(attention_channels // 4, attention_channels),
            nn.Sigmoid()
        )
        
    def forward(self, x):
        # Generate attention weights
        attention = self.attention_conv(x)
        attention = self.attention_norm(attention)
        attention = self.attention_activation(attention)
        
        # Global average pooling
        attention_pooled = self.attention_pool(attention)
        attention_pooled = attention_pooled.view(attention_pooled.size(0), -1)
        
        # Generate channel attention weights
        attention_weights = self.attention_fc(attention_pooled)
        attention_weights = attention_weights.view(attention_weights.size(0), -1, 1, 1)
        
        # Apply attention
        attended_features = attention * attention_weights
        
        return attended_features + x  # Residual connection

class MultiScaleFeatureExtractor(nn.Module):
    """Multi-scale feature extraction for different pest/disease sizes"""
    
    def __init__(self, in_channels=2048):
        super(MultiScaleFeatureExtractor, self).__init__()
        
        # Different scale convolutions
        self.scale1 = nn.Sequential(
            nn.Conv2d(in_channels, 512, kernel_size=1, padding=0),
            nn.BatchNorm2d(512),
            nn.ReLU(inplace=True)
        )
        
        self.scale2 = nn.Sequential(
            nn.Conv2d(in_channels, 512, kernel_size=3, padding=1),
            nn.BatchNorm2d(512),
            nn.ReLU(inplace=True)
        )
        
        self.scale3 = nn.Sequential(
            nn.Conv2d(in_channels, 512, kernel_size=5, padding=2),
            nn.BatchNorm2d(512),
            nn.ReLU(inplace=True)
        )
        
        self.fusion = nn.Sequential(
            nn.Conv2d(1536, 512, kernel_size=1),  # 3 * 512 = 1536
            nn.BatchNorm2d(512),
            nn.ReLU(inplace=True)
        )
        
    def forward(self, x):
        scale1_features = self.scale1(x)
        scale2_features = self.scale2(x)
        scale3_features = self.scale3(x)
        
        # Concatenate multi-scale features
        multi_scale = torch.cat([scale1_features, scale2_features, scale3_features], dim=1)
        
        # Fuse features
        fused_features = self.fusion(multi_scale)
        
        return fused_features

class PestDiseaseNetwork(nn.Module):
    """
    Main neural network for pest and disease detection
    Uses EfficientNet backbone with custom attention and multi-scale features
    """
    
    def __init__(self, num_classes=150, pretrained=True):
        super(PestDiseaseNetwork, self).__init__()
        
        # Load EfficientNet backbone
        self.backbone = timm.create_model('efficientnet_b4', pretrained=pretrained)
        backbone_features = self.backbone.classifier.in_features
        self.backbone.classifier = nn.Identity()  # Remove original classifier
        
        # Multi-scale feature extraction
        self.multi_scale_extractor = MultiScaleFeatureExtractor(backbone_features)
        
        # Attention mechanisms
        self.attention_block = AttentionBlock(512)
        
        # Feature fusion and classification
        self.global_pool = nn.AdaptiveAvgPool2d(1)
        
        # Multiple classification heads
        self.pest_disease_classifier = nn.Sequential(
            nn.Dropout(0.3),
            nn.Linear(512, 256),
            nn.ReLU(inplace=True),
            nn.Dropout(0.2),
            nn.Linear(256, num_classes)
        )
        
        # Severity estimation head
        self.severity_estimator = nn.Sequential(
            nn.Dropout(0.2),
            nn.Linear(512, 128),
            nn.ReLU(inplace=True),
            nn.Linear(128, 4)  # low, medium, high, critical
        )
        
        # Crop type consistency head (auxiliary loss)
        self.crop_consistency = nn.Sequential(
            nn.Linear(512, 64),
            nn.ReLU(inplace=True),
            nn.Linear(64, 20)  # Common crop types
        )
        
    def forward(self, x, return_features=False):
        # Extract backbone features
        backbone_features = self.backbone.forward_features(x)
        
        # Multi-scale feature extraction
        multi_scale_features = self.multi_scale_extractor(backbone_features)
        
        # Apply attention
        attended_features = self.attention_block(multi_scale_features)
        
        # Global pooling
        pooled_features = self.global_pool(attended_features)
        pooled_features = pooled_features.view(pooled_features.size(0), -1)
        
        # Classifications
        pest_disease_logits = self.pest_disease_classifier(pooled_features)
        severity_logits = self.severity_estimator(pooled_features)
        crop_logits = self.crop_consistency(pooled_features)
        
        if return_features:
            return {
                'pest_disease': pest_disease_logits,
                'severity': severity_logits,
                'crop_type': crop_logits,
                'features': pooled_features
            }
        else:
            return {
                'pest_disease': pest_disease_logits,
                'severity': severity_logits,
                'crop_type': crop_logits
            }

class PestDiseaseDataset(Dataset):
    """Dataset class for pest and disease images"""
    
    def __init__(self, image_paths, labels, crop_types, severities, transform=None):
        self.image_paths = image_paths
        self.labels = labels
        self.crop_types = crop_types
        self.severities = severities
        self.transform = transform
        
    def __len__(self):
        return len(self.image_paths)
    
    def __getitem__(self, idx):
        # Load image
        image_path = self.image_paths[idx]
        image = cv2.imread(image_path)
        image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
        
        # Apply transforms
        if self.transform:
            transformed = self.transform(image=image)
            image = transformed['image']
        
        return {
            'image': image,
            'pest_disease': torch.tensor(self.labels[idx], dtype=torch.long),
            'crop_type': torch.tensor(self.crop_types[idx], dtype=torch.long),
            'severity': torch.tensor(self.severities[idx], dtype=torch.long)
        }

class PestDetectionModel:
    """
    Main class for pest and disease detection
    Handles preprocessing, inference, and treatment recommendations
    """
    
    def __init__(self, model_path: Optional[str] = None):
        self.device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
        self.model = PestDiseaseNetwork()
        self.model.to(self.device)
        
        # Load pre-trained weights
        if model_path:
            self.load_model(model_path)
        
        # Initialize transforms
        self.inference_transform = A.Compose([
            A.Resize(384, 384),
            A.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
            ToTensorV2()
        ])
        
        self.augmentation_transform = A.Compose([
            A.Resize(384, 384),
            A.RandomRotate90(p=0.5),
            A.Flip(p=0.5),
            A.RandomBrightnessContrast(brightness_limit=0.2, contrast_limit=0.2, p=0.5),
            A.HueSaturationValue(hue_shift_limit=20, sat_shift_limit=30, val_shift_limit=20, p=0.5),
            A.GaussianBlur(blur_limit=3, p=0.3),
            A.CoarseDropout(max_holes=8, max_height=32, max_width=32, p=0.3),
            A.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
            ToTensorV2()
        ])
        
        # Load pest/disease database
        self.pest_database = self._load_pest_database()
        self.treatment_database = self._load_treatment_database()
        
    def _load_pest_database(self) -> pd.DataFrame:
        """Load comprehensive pest and disease information"""
        # In production, this would load from the database
        pest_data = {
            'pest_id': range(150),
            'name': ['Aphids', 'Whitefly', 'Thrips', 'Spider Mites', 'Bollworm'] * 30,
            'common_name': ['Green Aphids', 'Cotton Whitefly', 'Western Flower Thrips', 
                           'Two-spotted Spider Mite', 'Cotton Bollworm'] * 30,
            'scientific_name': ['Aphis gossypii', 'Bemisia tabaci', 'Frankliniella occidentalis',
                               'Tetranychus urticae', 'Helicoverpa armigera'] * 30,
            'type': ['insect', 'insect', 'insect', 'mite', 'insect'] * 30,
            'affected_crops': [['Tomato', 'Cotton', 'Chili'], ['Cotton', 'Tomato', 'Okra'],
                              ['Tomato', 'Onion', 'Chili'], ['Cotton', 'Beans', 'Cucumber'],
                              ['Cotton', 'Tomato', 'Maize']] * 30,
            'symptoms': ['Curled leaves, honeydew, sooty mold', 
                        'Yellow sticky honeydew, leaf yellowing',
                        'Silver streaks on leaves, black spots',
                        'Fine webbing, stippled leaves',
                        'Holes in fruits and bolls'] * 30,
            'severity_indicators': [
                {'low': 'Few aphids on new growth', 'medium': 'Colonies on multiple leaves', 
                 'high': 'Heavy infestation, leaf curling', 'critical': 'Plant stunting, sooty mold'},
                {'low': 'Few adults visible', 'medium': 'Moderate populations', 
                 'high': 'Heavy infestation, yellowing', 'critical': 'Severe leaf damage'},
                {'low': 'Light feeding damage', 'medium': 'Visible silver streaks', 
                 'high': 'Extensive leaf damage', 'critical': 'Plant defoliation'},
                {'low': 'Few mites, light stippling', 'medium': 'Moderate webbing', 
                 'high': 'Heavy webbing, yellowing', 'critical': 'Severe leaf drop'},
                {'low': 'Few larvae visible', 'medium': 'Multiple entry holes', 
                 'high': 'Extensive fruit damage', 'critical': 'Yield loss >30%'}
            ] * 30
        }
        return pd.DataFrame(pest_data)
    
    def _load_treatment_database(self) -> Dict:
        """Load organic treatment recommendations"""
        return {
            'Aphids': {
                'immediate': [
                    {'treatment': 'Neem oil spray', 'concentration': '2ml/liter', 'frequency': 'Every 3 days'},
                    {'treatment': 'Soap water spray', 'concentration': '10ml/liter', 'frequency': 'Daily'}
                ],
                'preventive': [
                    'Plant marigold as companion crop',
                    'Encourage ladybird beetles',
                    'Avoid excessive nitrogen fertilization'
                ],
                'biological': [
                    {'agent': 'Chrysoperla carnea', 'release_rate': '5000 eggs/acre'},
                    {'agent': 'Aphidius colemani', 'release_rate': '500 adults/acre'}
                ]
            },
            'Whitefly': {
                'immediate': [
                    {'treatment': 'Yellow sticky traps', 'density': '25 traps/acre', 'replacement': 'Weekly'},
                    {'treatment': 'Reflective mulch', 'type': 'Silver plastic', 'coverage': 'Complete'}
                ],
                'preventive': [
                    'Remove weed hosts',
                    'Use resistant varieties',
                    'Proper plant spacing'
                ],
                'biological': [
                    {'agent': 'Encarsia formosa', 'release_rate': '3 cards/m²'},
                    {'agent': 'Eretmocerus eremicus', 'release_rate': '0.5-1 per m²'}
                ]
            },
            # Add more treatments for other pests...
        }
    
    def preprocess_images(self, image_paths: List[str]) -> torch.Tensor:
        """Preprocess images for model inference"""
        processed_images = []
        
        for image_path in image_paths:
            # Load and preprocess image
            image = cv2.imread(image_path)
            image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
            
            # Apply transforms
            transformed = self.inference_transform(image=image)
            processed_images.append(transformed['image'])
        
        # Stack images into batch
        return torch.stack(processed_images).to(self.device)
    
    def detect_with_localization(self, image_path: str) -> Tuple[np.ndarray, List[Dict]]:
        """
        Detect pests/diseases and localize affected regions
        Returns both the heatmap and bounding boxes
        """
        # Load and preprocess image
        original_image = cv2.imread(image_path)
        original_image = cv2.cvtColor(original_image, cv2.COLOR_BGR2RGB)
        
        # Prepare for inference
        transformed = self.inference_transform(image=original_image)
        input_tensor = transformed['image'].unsqueeze(0).to(self.device)
        
        self.model.eval()
        with torch.no_grad():
            # Get features and predictions
            output = self.model(input_tensor, return_features=True)
            features = output['features']
            
            # Generate class activation map (CAM)
            cam = self._generate_cam(input_tensor, features)
            
            # Find bounding boxes from heatmap
            bounding_boxes = self._extract_bounding_boxes(cam, threshold=0.5)
            
        return cam, bounding_boxes
    
    def _generate_cam(self, input_tensor: torch.Tensor, features: torch.Tensor) -> np.ndarray:
        """Generate Class Activation Map for visualization"""
        # This is a simplified CAM generation
        # In practice, you'd use techniques like GradCAM or GradCAM++
        
        # Get the last convolutional layer
        self.model.eval()
        
        # Forward pass to get feature maps
        backbone_features = self.model.backbone.forward_features(input_tensor)
        
        # Get attention weights
        attention_weights = torch.mean(backbone_features, dim=(2, 3))
        
        # Generate weighted feature map
        cam = torch.sum(backbone_features * attention_weights.unsqueeze(-1).unsqueeze(-1), dim=1)
        
        # Normalize and resize
        cam = F.relu(cam)
        cam = F.interpolate(cam.unsqueeze(1), size=(384, 384), mode='bilinear', align_corners=False)
        cam = cam.squeeze().cpu().numpy()
        
        # Normalize to 0-1
        cam = (cam - cam.min()) / (cam.max() - cam.min() + 1e-8)
        
        return cam
    
    def _extract_bounding_boxes(self, heatmap: np.ndarray, threshold: float = 0.5) -> List[Dict]:
        """Extract bounding boxes from heatmap"""
        # Threshold the heatmap
        binary_mask = (heatmap > threshold).astype(np.uint8)
        
        # Find contours
        contours, _ = cv2.findContours(binary_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        
        bounding_boxes = []
        for contour in contours:
            if cv2.contourArea(contour) > 100:  # Minimum area threshold
                x, y, w, h = cv2.boundingRect(contour)
                confidence = np.mean(heatmap[y:y+h, x:x+w])
                
                bounding_boxes.append({
                    'x': int(x),
                    'y': int(y),
                    'width': int(w),
                    'height': int(h),
                    'confidence': float(confidence),
                    'area': int(w * h)
                })
        
        # Sort by confidence
        bounding_boxes.sort(key=lambda x: x['confidence'], reverse=True)
        
        return bounding_boxes
    
    def predict(self, detection_input: PestDetectionInput) -> List[PestDetectionResult]:
        """Generate pest/disease detection results"""
        
        self.model.eval()
        results = []
        
        with torch.no_grad():
            # Process each image
            for image_path in detection_input.image_paths:
                # Preprocess image
                input_tensor = self.preprocess_images([image_path])
                
                # Get predictions
                predictions = self.model(input_tensor)
                
                # Get localization information
                heatmap, bounding_boxes = self.detect_with_localization(image_path)
                
                # Convert predictions to probabilities
                pest_probs = F.softmax(predictions['pest_disease'], dim=1)[0]
                severity_probs = F.softmax(predictions['severity'], dim=1)[0]
                
                # Get top predictions
                top_pest_indices = torch.topk(pest_probs, k=3).indices.cpu().numpy()
                
                for pest_idx in top_pest_indices:
                    confidence = float(pest_probs[pest_idx])
                    
                    if confidence < 0.1:  # Minimum confidence threshold
                        continue
                    
                    # Get pest information
                    pest_info = self.pest_database.iloc[pest_idx]
                    
                    # Determine severity
                    severity_idx = torch.argmax(severity_probs).item()
                    severity_levels = ['low', 'medium', 'high', 'critical']
                    severity = severity_levels[severity_idx]
                    
                    # Calculate affected area percentage
                    total_area = 384 * 384  # Image size
                    affected_area = sum([box['area'] for box in bounding_boxes])
                    affected_percentage = (affected_area / total_area) * 100
                    
                    # Generate treatment recommendations
                    treatments = self._generate_treatment_recommendations(
                        pest_info['name'], severity, detection_input
                    )
                    
                    # Create result
                    result = PestDetectionResult(
                        pest_disease_name=pest_info['name'],
                        common_name=pest_info['common_name'],
                        scientific_name=pest_info['scientific_name'],
                        confidence_score=confidence,
                        severity_level=severity,
                        affected_area_percentage=affected_percentage,
                        detection_boxes=bounding_boxes,
                        symptoms_description=pest_info['symptoms'],
                        organic_treatments=treatments['immediate'],
                        prevention_measures=treatments['preventive'],
                        expected_yield_impact=self._estimate_yield_impact(severity, affected_percentage),
                        treatment_urgency=self._determine_treatment_urgency(severity, affected_percentage),
                        similar_conditions=self._find_similar_conditions(pest_info['name'])
                    )
                    
                    results.append(result)
        
        # Sort by confidence and return top results
        results.sort(key=lambda x: x.confidence_score, reverse=True)
        return results[:3]  # Return top 3 results
    
    def _generate_treatment_recommendations(self, pest_name: str, severity: str, detection_input: PestDetectionInput) -> Dict:
        """Generate appropriate treatment recommendations"""
        base_treatments = self.treatment_database.get(pest_name, {
            'immediate': [{'treatment': 'Consult agricultural expert', 'note': 'Specific treatment not available'}],
            'preventive': ['Maintain field sanitation', 'Monitor regularly'],
            'biological': []
        })
        
        # Adjust treatments based on severity and conditions
        adjusted_treatments = base_treatments.copy()
        
        if severity in ['high', 'critical']:
            # Add more aggressive treatments
            adjusted_treatments['immediate'].extend([
                {'treatment': 'Increase spray frequency', 'note': 'Due to high severity'},
                {'treatment': 'Consider multiple treatment methods', 'note': 'Integrated approach recommended'}
            ])
        
        # Weather-based adjustments
        if detection_input.weather_conditions.get('humidity', 0) > 80:
            adjusted_treatments['preventive'].append('Improve air circulation to reduce humidity')
        
        if detection_input.weather_conditions.get('rainfall', 0) > 10:
            adjusted_treatments['immediate'].append({
                'treatment': 'Apply treatments after rain stops',
                'note': 'Avoid spraying during rain'
            })
        
        return adjusted_treatments
    
    def _estimate_yield_impact(self, severity: str, affected_percentage: float) -> str:
        """Estimate potential yield impact"""
        if severity == 'critical' or affected_percentage > 50:
            return "High yield loss expected (20-50%)"
        elif severity == 'high' or affected_percentage > 25:
            return "Moderate yield loss possible (10-20%)"
        elif severity == 'medium' or affected_percentage > 10:
            return "Minor yield impact (5-10%)"
        else:
            return "Minimal yield impact expected (<5%)"
    
    def _determine_treatment_urgency(self, severity: str, affected_percentage: float) -> str:
        """Determine treatment urgency"""
        if severity == 'critical' or affected_percentage > 40:
            return "immediate"
        elif severity == 'high' or affected_percentage > 20:
            return "within_week"
        else:
            return "monitor"
    
    def _find_similar_conditions(self, pest_name: str) -> List[str]:
        """Find similar pest/disease conditions"""
        # Simple similarity based on pest type
        similar_pests = self.pest_database[
            self.pest_database['type'] == self.pest_database[
                self.pest_database['name'] == pest_name
            ]['type'].iloc[0]
        ]['name'].tolist()
        
        # Remove the current pest and return top 3 similar
        if pest_name in similar_pests:
            similar_pests.remove(pest_name)
        
        return similar_pests[:3]
    
    def train_model(self, train_dataset: PestDiseaseDataset, val_dataset: PestDiseaseDataset, epochs: int = 50):
        """Train the pest detection model"""
        logger.info("Starting pest detection model training...")
        
        # Data loaders
        train_loader = DataLoader(train_dataset, batch_size=16, shuffle=True, num_workers=4)
        val_loader = DataLoader(val_dataset, batch_size=16, shuffle=False, num_workers=4)
        
        # Training setup
        self.model.train()
        optimizer = torch.optim.AdamW(self.model.parameters(), lr=0.001, weight_decay=0.01)
        scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=epochs)
        
        # Loss functions
        pest_criterion = nn.CrossEntropyLoss()
        severity_criterion = nn.CrossEntropyLoss()
        crop_criterion = nn.CrossEntropyLoss()
        
        best_val_acc = 0.0
        
        for epoch in range(epochs):
            # Training phase
            train_loss, train_acc = self._train_epoch(
                train_loader, optimizer, pest_criterion, severity_criterion, crop_criterion
            )
            
            # Validation phase
            val_loss, val_acc = self._validate_epoch(
                val_loader, pest_criterion, severity_criterion, crop_criterion
            )
            
            scheduler.step()
            
            # Save best model
            if val_acc > best_val_acc:
                best_val_acc = val_acc
                self.save_model('models/pest_detection_best.pth')
            
            if epoch % 5 == 0:
                logger.info(f"Epoch {epoch}: Train Loss: {train_loss:.4f}, Train Acc: {train_acc:.4f}")
                logger.info(f"Val Loss: {val_loss:.4f}, Val Acc: {val_acc:.4f}")
        
        logger.info(f"Training completed! Best validation accuracy: {best_val_acc:.4f}")
    
    def _train_epoch(self, train_loader, optimizer, pest_criterion, severity_criterion, crop_criterion):
        """Single training epoch"""
        self.model.train()
        total_loss = 0
        correct_predictions = 0
        total_samples = 0
        
        for batch in train_loader:
            images = batch['image'].to(self.device)
            pest_labels = batch['pest_disease'].to(self.device)
            severity_labels = batch['severity'].to(self.device)
            crop_labels = batch['crop_type'].to(self.device)
            
            optimizer.zero_grad()
            
            # Forward pass
            predictions = self.model(images)
            
            # Calculate losses
            pest_loss = pest_criterion(predictions['pest_disease'], pest_labels)
            severity_loss = severity_criterion(predictions['severity'], severity_labels)
            crop_loss = crop_criterion(predictions['crop_type'], crop_labels)
            
            # Combined loss with weights
            total_loss_batch = 0.7 * pest_loss + 0.2 * severity_loss + 0.1 * crop_loss
            
            # Backward pass
            total_loss_batch.backward()
            optimizer.step()
            
            total_loss += total_loss_batch.item()
            
            # Calculate accuracy
            pest_preds = torch.argmax(predictions['pest_disease'], dim=1)
            correct_predictions += (pest_preds == pest_labels).sum().item()
            total_samples += pest_labels.size(0)
        
        return total_loss / len(train_loader), correct_predictions / total_samples
    
    def _validate_epoch(self, val_loader, pest_criterion, severity_criterion, crop_criterion):
        """Single validation epoch"""
        self.model.eval()
        total_loss = 0
        correct_predictions = 0
        total_samples = 0
        
        with torch.no_grad():
            for batch in val_loader:
                images = batch['image'].to(self.device)
                pest_labels = batch['pest_disease'].to(self.device)
                severity_labels = batch['severity'].to(self.device)
                crop_labels = batch['crop_type'].to(self.device)
                
                # Forward pass
                predictions = self.model(images)
                
                # Calculate losses
                pest_loss = pest_criterion(predictions['pest_disease'], pest_labels)
                severity_loss = severity_criterion(predictions['severity'], severity_labels)
                crop_loss = crop_criterion(predictions['crop_type'], crop_labels)
                
                total_loss_batch = 0.7 * pest_loss + 0.2 * severity_loss + 0.1 * crop_loss
                total_loss += total_loss_batch.item()
                
                # Calculate accuracy
                pest_preds = torch.argmax(predictions['pest_disease'], dim=1)
                correct_predictions += (pest_preds == pest_labels).sum().item()
                total_samples += pest_labels.size(0)
        
        return total_loss / len(val_loader), correct_predictions / total_samples
    
    def save_model(self, path: str):
        """Save model checkpoint"""
        torch.save({
            'model_state_dict': self.model.state_dict(),
            'pest_database': self.pest_database,
            'treatment_database': self.treatment_database
        }, path)
        logger.info(f"Pest detection model saved to {path}")
    
    def load_model(self, path: str):
        """Load model checkpoint"""
        checkpoint = torch.load(path, map_location=self.device)
        self.model.load_state_dict(checkpoint['model_state_dict'])
        if 'pest_database' in checkpoint:
            self.pest_database = checkpoint['pest_database']
        if 'treatment_database' in checkpoint:
            self.treatment_database = checkpoint['treatment_database']
        logger.info(f"Pest detection model loaded from {path}")

# Example usage and testing
if __name__ == "__main__":
    # Initialize model
    pest_model = PestDetectionModel()
    
    # Example input
    sample_input = PestDetectionInput(
        image_paths=['sample_leaf_image.jpg'],
        crop_type='Tomato',
        location=(12.9716, 77.5946),
        capture_date='2024-06-15',
        weather_conditions={'humidity': 75, 'rainfall': 5, 'temperature': 28},
        growth_stage='vegetative'
    )
    
    # Get detection results
    results = pest_model.predict(sample_input)
    
    # Print results
    for i, result in enumerate(results):
        print(f"\n--- Detection Result {i+1} ---")
        print(f"Pest/Disease: {result.pest_disease_name} ({result.scientific_name})")
        print(f"Confidence: {result.confidence_score:.2f}")
        print(f"Severity: {result.severity_level}")
        print(f"Affected Area: {result.affected_area_percentage:.1f}%")
        print(f"Treatment Urgency: {result.treatment_urgency}")
        print(f"Yield Impact: {result.expected_yield_impact}")
        print("Organic Treatments:")
        for treatment in result.organic_treatments:
            print(f"  - {treatment}")
"""
Hasiru Mitra AI - Voice Processing System
Advanced multilingual voice processing for agricultural advisory
Supports Hindi, English, and Kannada with natural language understanding
"""

import os
import json
import logging
import asyncio
import aiohttp
import io
from typing import Dict, List, Optional, Tuple, Union
from dataclasses import dataclass
from datetime import datetime
import torch
import torch.nn as nn
import torch.nn.functional as F
import numpy as np
import librosa
import soundfile as sf
from transformers import (
    WhisperProcessor, WhisperForConditionalGeneration,
    AutoTokenizer, AutoModelForSequenceClassification,
    pipeline, AutoModel
)
import azure.cognitiveservices.speech as speechsdk
from twilio.rest import Client
from twilio.twiml import TwiML
import openai
from langdetect import detect
import re

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

@dataclass
class VoiceInput:
    """Input structure for voice processing"""
    audio_data: bytes
    language_hint: Optional[str] = None
    user_id: Optional[str] = None
    context: Optional[Dict] = None
    call_sid: Optional[str] = None

@dataclass
class VoiceResponse:
    """Response structure for voice processing"""
    transcribed_text: str
    detected_language: str
    intent: str
    entities: Dict
    response_text: str
    response_audio_url: str
    confidence_score: float
    processing_time_ms: int
    context_updated: Dict

@dataclass
class ConversationContext:
    """Conversation context for maintaining state"""
    user_id: str
    session_id: str
    language: str
    current_intent: str
    entities: Dict
    conversation_history: List[Dict]
    user_profile: Dict
    farm_context: Dict

class LanguageDetector:
    """Advanced language detection for agricultural domain"""
    
    def __init__(self):
        # Agricultural keywords in different languages
        self.language_keywords = {
            'hi': ['फसल', 'खेत', 'बीज', 'पानी', 'उर्वरक', 'कीट', 'रोग', 'मिट्टी'],
            'en': ['crop', 'farm', 'seed', 'water', 'fertilizer', 'pest', 'disease', 'soil'],
            'kn': ['ಬೆಳೆ', 'ಹೊಲ', 'ಬೀಜ', 'ನೀರು', 'ಗೊಬ್ಬರ', 'ಕೀಟ', 'ರೋಗ', 'ಮಣ್ಣು']
        }
        
        # Load language classification model
        self.classifier = pipeline(
            "text-classification",
            model="facebook/fasttext-language-identification"
        )
    
    def detect_language(self, text: str, audio_features: Optional[np.ndarray] = None) -> str:
        """Detect language from text and optionally audio features"""
        # Text-based detection
        text_lang = self._detect_from_text(text)
        
        # Audio-based detection (if available)
        if audio_features is not None:
            audio_lang = self._detect_from_audio(audio_features)
            # Combine both predictions
            if audio_lang == text_lang:
                return text_lang
            else:
                # Use confidence scores to decide
                return text_lang  # Default to text-based
        
        return text_lang
    
    def _detect_from_text(self, text: str) -> str:
        """Detect language from text content"""
        try:
            # Use keyword matching first
            for lang, keywords in self.language_keywords.items():
                if any(keyword in text for keyword in keywords):
                    return lang
            
            # Fallback to general language detection
            result = detect(text)
            
            # Map to our supported languages
            lang_mapping = {
                'hi': 'hi',
                'en': 'en', 
                'kn': 'kn'
            }
            
            return lang_mapping.get(result, 'en')  # Default to English
        
        except Exception as e:
            logger.warning(f"Language detection failed: {e}")
            return 'en'  # Default to English
    
    def _detect_from_audio(self, audio_features: np.ndarray) -> str:
        """Detect language from audio features (placeholder)"""
        # This would involve training an audio-based language classifier
        # For now, return None to rely on text-based detection
        return None

class MultilingualASR:
    """Automatic Speech Recognition for multiple languages"""
    
    def __init__(self):
        self.device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
        
        # Initialize Whisper models for different languages
        self.whisper_models = {
            'multilingual': WhisperForConditionalGeneration.from_pretrained("openai/whisper-large-v2"),
            'processor': WhisperProcessor.from_pretrained("openai/whisper-large-v2")
        }
        self.whisper_models['multilingual'].to(self.device)
        
        # Azure Speech Services for better accuracy (backup)
        self.azure_speech_key = os.getenv('AZURE_SPEECH_KEY')
        self.azure_region = os.getenv('AZURE_REGION', 'eastus')
        
        # Language-specific model configurations
        self.language_configs = {
            'hi': {'model_name': 'hindi', 'locale': 'hi-IN'},
            'en': {'model_name': 'english', 'locale': 'en-IN'},
            'kn': {'model_name': 'kannada', 'locale': 'kn-IN'}
        }
    
    async def transcribe(self, audio_data: bytes, language_hint: str = 'auto') -> Tuple[str, str, float]:
        """
        Transcribe audio to text with language detection
        Returns (text, detected_language, confidence)
        """
        try:
            # Convert audio data to format suitable for processing
            audio_array = self._preprocess_audio(audio_data)
            
            # Try Whisper first (primary method)
            text, detected_lang, confidence = await self._whisper_transcribe(
                audio_array, language_hint
            )
            
            # If confidence is low, try Azure as backup
            if confidence < 0.7 and self.azure_speech_key:
                azure_text, azure_conf = await self._azure_transcribe(
                    audio_data, detected_lang
                )
                if azure_conf > confidence:
                    text, confidence = azure_text, azure_conf
            
            return text, detected_lang, confidence
            
        except Exception as e:
            logger.error(f"Transcription failed: {e}")
            return "", "en", 0.0
    
    def _preprocess_audio(self, audio_data: bytes) -> np.ndarray:
        """Preprocess audio data for model input"""
        # Convert bytes to audio array
        audio_io = io.BytesIO(audio_data)
        audio_array, sample_rate = librosa.load(audio_io, sr=16000)
        
        # Normalize audio
        audio_array = audio_array / np.max(np.abs(audio_array))
        
        return audio_array
    
    async def _whisper_transcribe(self, audio_array: np.ndarray, language_hint: str) -> Tuple[str, str, float]:
        """Transcribe using Whisper model"""
        processor = self.whisper_models['processor']
        model = self.whisper_models['multilingual']
        
        # Process audio
        inputs = processor(audio_array, return_tensors="pt", sampling_rate=16000)
        inputs = inputs.to(self.device)
        
        # Generate transcription
        with torch.no_grad():
            if language_hint != 'auto':
                # Force language if hint provided
                forced_decoder_ids = processor.get_decoder_prompt_ids(
                    language=language_hint, task="transcribe"
                )
                outputs = model.generate(
                    inputs.input_features,
                    forced_decoder_ids=forced_decoder_ids,
                    return_dict_in_generate=True,
                    output_scores=True
                )
            else:
                # Auto-detect language
                outputs = model.generate(
                    inputs.input_features,
                    return_dict_in_generate=True,
                    output_scores=True
                )
        
        # Decode transcription
        transcription = processor.batch_decode(
            outputs.sequences, skip_special_tokens=True
        )[0]
        
        # Calculate confidence from generation scores
        confidence = self._calculate_whisper_confidence(outputs.scores)
        
        # Detect language from transcription
        language_detector = LanguageDetector()
        detected_language = language_detector.detect_language(transcription)
        
        return transcription, detected_language, confidence
    
    def _calculate_whisper_confidence(self, scores: List[torch.Tensor]) -> float:
        """Calculate confidence score from Whisper generation scores"""
        if not scores:
            return 0.5  # Default confidence
        
        # Average the probabilities of the generated tokens
        confidences = []
        for score in scores:
            prob = torch.softmax(score, dim=-1)
            max_prob = torch.max(prob, dim=-1)[0]
            confidences.append(max_prob.mean().item())
        
        return np.mean(confidences)
    
    async def _azure_transcribe(self, audio_data: bytes, language: str) -> Tuple[str, float]:
        """Backup transcription using Azure Speech Services"""
        try:
            # Configure Azure Speech
            speech_config = speechsdk.SpeechConfig(
                subscription=self.azure_speech_key, 
                region=self.azure_region
            )
            
            # Set language
            locale = self.language_configs.get(language, {}).get('locale', 'en-IN')
            speech_config.speech_recognition_language = locale
            
            # Create audio input
            audio_stream = speechsdk.audio.PushAudioInputStream()
            audio_config = speechsdk.audio.AudioConfig(stream=audio_stream)
            
            # Create recognizer
            speech_recognizer = speechsdk.SpeechRecognizer(
                speech_config=speech_config,
                audio_config=audio_config
            )
            
            # Push audio data
            audio_stream.write(audio_data)
            audio_stream.close()
            
            # Perform recognition
            result = speech_recognizer.recognize_once()
            
            if result.reason == speechsdk.ResultReason.RecognizedSpeech:
                # Azure doesn't provide confidence directly, estimate from result
                confidence = min(0.9, len(result.text) / 100.0 + 0.5)  # Heuristic
                return result.text, confidence
            else:
                return "", 0.0
                
        except Exception as e:
            logger.error(f"Azure transcription failed: {e}")
            return "", 0.0

class MultilingualNLU:
    """Natural Language Understanding for agricultural domain"""
    
    def __init__(self):
        self.device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
        
        # Load multilingual models
        self.intent_classifier = pipeline(
            "text-classification",
            model="microsoft/DialoGPT-medium",  # Placeholder - would use custom trained model
            device=0 if torch.cuda.is_available() else -1
        )
        
        # Entity extraction models
        self.entity_extractors = {
            'hi': pipeline("ner", model="ai4bharat/indic-bert", device=0 if torch.cuda.is_available() else -1),
            'en': pipeline("ner", model="dbmdz/bert-large-cased-finetuned-conll03-english", device=0 if torch.cuda.is_available() else -1),
            'kn': pipeline("ner", model="ai4bharat/indic-bert", device=0 if torch.cuda.is_available() else -1)
        }
        
        # Agricultural intent mapping
        self.intent_mapping = {
            'crop_advice': ['crop', 'planting', 'growing', 'cultivation', 'farming'],
            'pest_disease': ['pest', 'disease', 'insect', 'problem', 'damage'],
            'weather': ['weather', 'rain', 'temperature', 'climate'],
            'market_price': ['price', 'market', 'selling', 'buying', 'cost'],
            'fertilizer': ['fertilizer', 'nutrition', 'feeding', 'organic'],
            'irrigation': ['water', 'irrigation', 'watering', 'moisture'],
            'general_query': ['help', 'information', 'guide', 'question']
        }
        
        # Multilingual keyword mapping
        self.multilingual_keywords = {
            'crop_advice': {
                'hi': ['फसल', 'बुआई', 'खेती', 'उगाना'],
                'en': ['crop', 'planting', 'farming', 'growing'],
                'kn': ['ಬೆಳೆ', 'ಬಿತ್ತನೆ', 'ಕೃಷಿ', 'ಬೆಳೆಯುವ']
            },
            'pest_disease': {
                'hi': ['कीट', 'रोग', 'बीमारी', 'नुकसान'],
                'en': ['pest', 'disease', 'insect', 'damage'],
                'kn': ['ಕೀಟ', 'ರೋಗ', 'ಕೀಟಕ', 'ಹಾನಿ']
            }
            # Add more mappings...
        }
    
    def understand(self, text: str, language: str, context: ConversationContext) -> Tuple[str, Dict, float]:
        """
        Understand intent and extract entities from text
        Returns (intent, entities, confidence)
        """
        try:
            # Clean and preprocess text
            cleaned_text = self._preprocess_text(text, language)
            
            # Intent classification
            intent, intent_confidence = self._classify_intent(cleaned_text, language, context)
            
            # Entity extraction
            entities = self._extract_entities(cleaned_text, language, intent)
            
            # Overall confidence
            overall_confidence = intent_confidence * 0.8 + 0.2  # Base confidence
            
            return intent, entities, overall_confidence
            
        except Exception as e:
            logger.error(f"NLU failed: {e}")
            return "general_query", {}, 0.5
    
    def _preprocess_text(self, text: str, language: str) -> str:
        """Clean and normalize text for processing"""
        # Remove extra whitespace
        text = re.sub(r'\s+', ' ', text.strip())
        
        # Language-specific preprocessing
        if language == 'hi':
            # Remove common Hindi filler words
            text = re.sub(r'\b(जी|हाँ|नहीं|क्या|कैसे)\b', '', text)
        elif language == 'kn':
            # Remove common Kannada filler words
            text = re.sub(r'\b(ಹೌದು|ಇಲ್ಲ|ಏನು|ಹೇಗೆ)\b', '', text)
        
        return text.lower()
    
    def _classify_intent(self, text: str, language: str, context: ConversationContext) -> Tuple[str, float]:
        """Classify user intent from text"""
        # Keyword-based classification (primary method)
        intent_scores = {}
        
        for intent, lang_keywords in self.multilingual_keywords.items():
            keywords = lang_keywords.get(language, lang_keywords.get('en', []))
            score = sum(1 for keyword in keywords if keyword in text)
            if score > 0:
                intent_scores[intent] = score / len(keywords)
        
        # Context-based adjustment
        if context.current_intent and context.current_intent in intent_scores:
            intent_scores[context.current_intent] *= 1.2  # Boost current context
        
        # Get best intent
        if intent_scores:
            best_intent = max(intent_scores, key=intent_scores.get)
            confidence = min(0.9, intent_scores[best_intent])
            return best_intent, confidence
        
        # Fallback to ML model (if no keyword matches)
        try:
            result = self.intent_classifier(text)
            # Map model output to our intents (simplified)
            return "general_query", 0.6
        except:
            return "general_query", 0.5
    
    def _extract_entities(self, text: str, language: str, intent: str) -> Dict:
        """Extract relevant entities from text"""
        entities = {}
        
        try:
            # Use language-specific NER model
            ner_model = self.entity_extractors.get(language, self.entity_extractors['en'])
            ner_results = ner_model(text)
            
            # Process NER results
            for entity in ner_results:
                entity_type = entity['entity']
                entity_value = entity['word']
                confidence = entity['score']
                
                if confidence > 0.5:  # Confidence threshold
                    if entity_type not in entities:
                        entities[entity_type] = []
                    entities[entity_type].append({
                        'value': entity_value,
                        'confidence': confidence
                    })
            
            # Extract domain-specific entities
            entities.update(self._extract_agricultural_entities(text, language, intent))
            
        except Exception as e:
            logger.warning(f"Entity extraction failed: {e}")
        
        return entities
    
    def _extract_agricultural_entities(self, text: str, language: str, intent: str) -> Dict:
        """Extract agriculture-specific entities using patterns"""
        entities = {}
        
        # Crop names
        crop_patterns = {
            'hi': r'\b(धान|गेहूं|मक्का|टमाटर|प्याज|कपास|गन्ना|हल्दी|मिर्च)\b',
            'en': r'\b(rice|wheat|corn|tomato|onion|cotton|sugarcane|turmeric|chili)\b',
            'kn': r'\b(ಅಕ್ಕಿ|ಗೋಧಿ|ಜೋಳ|ಟೊಮೇಟೊ|ಈರುಳ್ಳಿ|ಕಪಾಸು|ಕಬ್ಬು|ಅರಿಶಿನ|ಮೆಣಸಿನಕಾಯಿ)\b'
        }
        
        pattern = crop_patterns.get(language, crop_patterns['en'])
        crops = re.findall(pattern, text, re.IGNORECASE)
        if crops:
            entities['crops'] = [{'value': crop, 'confidence': 0.8} for crop in crops]
        
        # Quantities
        quantity_pattern = r'(\d+(?:\.\d+)?)\s*(किलो|kg|लीटर|liter|एकड़|acre|हेक्टेयर|hectare)'
        quantities = re.findall(quantity_pattern, text, re.IGNORECASE)
        if quantities:
            entities['quantities'] = [
                {'value': f"{qty[0]} {qty[1]}", 'confidence': 0.9}
                for qty in quantities
            ]
        
        # Dates/seasons
        season_patterns = {
            'hi': r'\b(खरीफ|रबी|जायद|मानसून)\b',
            'en': r'\b(kharif|rabi|zaid|monsoon|summer|winter)\b',
            'kn': r'\b(ಖರೀಫ್|ರಬಿ|ಜಾಯದ್|ಮಾನ್ಸೂನ್)\b'
        }
        
        season_pattern = season_patterns.get(language, season_patterns['en'])
        seasons = re.findall(season_pattern, text, re.IGNORECASE)
        if seasons:
            entities['seasons'] = [{'value': season, 'confidence': 0.8} for season in seasons]
        
        return entities

class MultilingualTTS:
    """Text-to-Speech for multiple languages"""
    
    def __init__(self):
        # Azure Text-to-Speech
        self.azure_speech_key = os.getenv('AZURE_SPEECH_KEY')
        self.azure_region = os.getenv('AZURE_REGION', 'eastus')
        
        # Voice configurations for different languages
        self.voice_configs = {
            'hi': {
                'voice_name': 'hi-IN-MadhurNeural',
                'language': 'hi-IN'
            },
            'en': {
                'voice_name': 'en-IN-NeerjaExpressiveNeural',
                'language': 'en-IN'
            },
            'kn': {
                'voice_name': 'kn-IN-SapnaNeural',
                'language': 'kn-IN'
            }
        }
    
    async def synthesize(self, text: str, language: str) -> bytes:
        """Convert text to speech audio"""
        try:
            # Use Azure TTS
            audio_data = await self._azure_synthesize(text, language)
            return audio_data
            
        except Exception as e:
            logger.error(f"TTS synthesis failed: {e}")
            return b""  # Return empty bytes on failure
    
    async def _azure_synthesize(self, text: str, language: str) -> bytes:
        """Synthesize speech using Azure TTS"""
        # Configure Azure Speech
        speech_config = speechsdk.SpeechConfig(
            subscription=self.azure_speech_key,
            region=self.azure_region
        )
        
        # Set voice
        voice_config = self.voice_configs.get(language, self.voice_configs['en'])
        speech_config.speech_synthesis_voice_name = voice_config['voice_name']
        speech_config.speech_synthesis_language = voice_config['language']
        
        # Create synthesizer with audio output to memory
        audio_config = speechsdk.audio.AudioOutputConfig(use_default_speaker=False)
        synthesizer = speechsdk.SpeechSynthesizer(
            speech_config=speech_config,
            audio_config=None  # Output to memory
        )
        
        # Synthesize speech
        result = synthesizer.speak_text_async(text).get()
        
        if result.reason == speechsdk.ResultReason.SynthesizingAudioCompleted:
            return result.audio_data
        else:
            logger.error(f"TTS failed: {result.reason}")
            return b""

class ConversationManager:
    """Manages conversation context and dialogue flow"""
    
    def __init__(self):
        self.active_sessions = {}  # session_id -> ConversationContext
        self.session_timeout = 3600  # 1 hour
    
    def get_or_create_context(self, user_id: str, session_id: str, language: str = 'en') -> ConversationContext:
        """Get existing context or create new one"""
        if session_id in self.active_sessions:
            context = self.active_sessions[session_id]
            context.language = language  # Update language if changed
            return context
        
        # Create new context
        context = ConversationContext(
            user_id=user_id,
            session_id=session_id,
            language=language,
            current_intent="",
            entities={},
            conversation_history=[],
            user_profile={},  # Would be loaded from database
            farm_context={}   # Would be loaded from database
        )
        
        self.active_sessions[session_id] = context
        return context
    
    def update_context(self, session_id: str, intent: str, entities: Dict, user_input: str, response: str):
        """Update conversation context with new interaction"""
        if session_id in self.active_sessions:
            context = self.active_sessions[session_id]
            context.current_intent = intent
            context.entities.update(entities)
            
            # Add to conversation history
            context.conversation_history.append({
                'timestamp': datetime.now().isoformat(),
                'user_input': user_input,
                'intent': intent,
                'entities': entities,
                'response': response
            })
            
            # Keep only last 10 interactions
            context.conversation_history = context.conversation_history[-10:]

class VoiceProcessingSystem:
    """Main voice processing system orchestrating all components"""
    
    def __init__(self):
        self.language_detector = LanguageDetector()
        self.asr = MultilingualASR()
        self.nlu = MultilingualNLU()
        self.tts = MultilingualTTS()
        self.conversation_manager = ConversationManager()
        
        # Response templates
        self.response_templates = self._load_response_templates()
        
        # Twilio client
        self.twilio_client = Client(
            os.getenv('TWILIO_ACCOUNT_SID'),
            os.getenv('TWILIO_AUTH_TOKEN')
        )
    
    def _load_response_templates(self) -> Dict:
        """Load response templates for different intents and languages"""
        return {
            'greeting': {
                'hi': 'नमस्ते! मैं हसिरु मित्र हूँ। आपकी खेती में कैसे मदद कर सकती हूँ?',
                'en': 'Hello! I am Hasiru Mitra. How can I help you with your farming today?',
                'kn': 'ನಮಸ್ಕಾರ! ನಾನು ಹಸಿರು ಮಿತ್ರ. ನಿಮ್ಮ ಕೃಷಿಯಲ್ಲಿ ನಾನು ಹೇಗೆ ಸಹಾಯ ಮಾಡಬಹುದು?'
            },
            'crop_advice': {
                'hi': 'आपकी फसल के बारे में मुझे बताएं। कौन सी फसल उगाना चाहते हैं?',
                'en': 'Tell me about your crop. Which crop do you want to grow?',
                'kn': 'ನಿಮ್ಮ ಬೆಳೆಯ ಬಗ್ಗೆ ಹೇಳಿ. ಯಾವ ಬೆಳೆ ಬೆಳೆಯಲು ಬಯಸುತ್ತೀರಿ?'
            },
            'pest_disease': {
                'hi': 'आपकी फसल में क्या समस्या है? कृपया विस्तार से बताएं।',
                'en': 'What problem are you facing with your crop? Please describe in detail.',
                'kn': 'ನಿಮ್ಮ ಬೆಳೆಯಲ್ಲಿ ಏನು ಸಮಸ್ಯೆ ಇದೆ? ದಯವಿಟ್ಟು ವಿಸ್ತಾರವಾಗಿ ಹೇಳಿ.'
            },
            'error': {
                'hi': 'माफ़ करें, मुझे समझने में कठिनाई हुई। कृपया फिर से बताएं।',
                'en': 'Sorry, I had difficulty understanding. Please tell me again.',
                'kn': 'ಕ್ಷಮಿಸಿ, ನನಗೆ ಅರ್ಥಮಾಡಿಕೊಳ್ಳುವಲ್ಲಿ ಕಷ್ಟವಾಯಿತು. ದಯವಿಟ್ಟು ಮತ್ತೆ ಹೇಳಿ.'
            }
        }
    
    async def process_voice_input(self, voice_input: VoiceInput) -> VoiceResponse:
        """Main processing pipeline for voice input"""
        start_time = datetime.now()
        
        try:
            # Step 1: Speech to Text
            transcribed_text, detected_language, transcription_confidence = await self.asr.transcribe(
                voice_input.audio_data, voice_input.language_hint or 'auto'
            )
            
            if not transcribed_text:
                return self._create_error_response("Transcription failed", detected_language)
            
            # Step 2: Get or create conversation context
            context = self.conversation_manager.get_or_create_context(
                voice_input.user_id or "anonymous",
                voice_input.call_sid or f"session_{datetime.now().timestamp()}",
                detected_language
            )
            
            # Step 3: Natural Language Understanding
            intent, entities, nlu_confidence = self.nlu.understand(
                transcribed_text, detected_language, context
            )
            
            # Step 4: Generate response text
            response_text = await self._generate_response(
                intent, entities, context, detected_language
            )
            
            # Step 5: Text to Speech
            response_audio = await self.tts.synthesize(response_text, detected_language)
            
            # Step 6: Update conversation context
            self.conversation_manager.update_context(
                context.session_id, intent, entities, transcribed_text, response_text
            )
            
            # Calculate processing time
            processing_time = int((datetime.now() - start_time).total_seconds() * 1000)
            
            # Overall confidence
            overall_confidence = (transcription_confidence + nlu_confidence) / 2
            
            return VoiceResponse(
                transcribed_text=transcribed_text,
                detected_language=detected_language,
                intent=intent,
                entities=entities,
                response_text=response_text,
                response_audio_url="",  # Would be uploaded to cloud storage
                confidence_score=overall_confidence,
                processing_time_ms=processing_time,
                context_updated=context.__dict__
            )
            
        except Exception as e:
            logger.error(f"Voice processing failed: {e}")
            return self._create_error_response(str(e), voice_input.language_hint or 'en')
    
    async def _generate_response(self, intent: str, entities: Dict, context: ConversationContext, language: str) -> str:
        """Generate appropriate response based on intent and entities"""
        
        # Handle different intents
        if intent == "greeting" or not context.conversation_history:
            return self.response_templates['greeting'][language]
        
        elif intent == "crop_advice":
            return await self._generate_crop_advice_response(entities, context, language)
        
        elif intent == "pest_disease":
            return await self._generate_pest_response(entities, context, language)
        
        elif intent == "weather":
            return await self._generate_weather_response(entities, context, language)
        
        elif intent == "market_price":
            return await self._generate_market_response(entities, context, language)
        
        else:  # general_query
            return await self._generate_general_response(entities, context, language)
    
    async def _generate_crop_advice_response(self, entities: Dict, context: ConversationContext, language: str) -> str:
        """Generate crop advisory response"""
        # This would integrate with the CropAdvisoryModel
        if 'crops' in entities:
            crop = entities['crops'][0]['value']
            responses = {
                'hi': f'{crop} की खेती के लिए सबसे पहले मिट्टी की जांच कराएं। उचित बीज का चयन करें।',
                'en': f'For {crop} cultivation, first get your soil tested. Choose appropriate seeds.',
                'kn': f'{crop} ಬೆಳವಣಿಗೆಗಾಗಿ, ಮೊದಲು ನಿಮ್ಮ ಮಣ್ಣಿನ ಪರೀಕ್ಷೆ ಮಾಡಿಸಿ. ಸೂಕ್ತವಾದ ಬೀಜಗಳನ್ನು ಆಯ್ಕೆಮಾಡಿ.'
            }
            return responses.get(language, responses['en'])
        else:
            return self.response_templates['crop_advice'][language]
    
    async def _generate_pest_response(self, entities: Dict, context: ConversationContext, language: str) -> str:
        """Generate pest/disease management response"""
        responses = {
            'hi': 'कीट या रोग की पहचान के लिए पत्तियों की तस्वीर भेजें। तब तक नीम का तेल छिड़कें।',
            'en': 'Send photos of leaves for pest/disease identification. Meanwhile, spray neem oil.',
            'kn': 'ಕೀಟ ಅಥವಾ ರೋಗ ಗುರುತಿಸಲು ಎಲೆಗಳ ಫೋಟೋ ಕಳುಹಿಸಿ. ಅಷ್ಟರಲ್ಲಿ ಬೇವಿನ ಎಣ್ಣೆ ಸಿಂಪಡಿಸಿ.'
        }
        return responses.get(language, responses['en'])
    
    async def _generate_weather_response(self, entities: Dict, context: ConversationContext, language: str) -> str:
        """Generate weather-related response"""
        # This would integrate with weather APIs
        responses = {
            'hi': 'मौसम की जानकारी के लिए आपका स्थान बताएं। बारिश से पहले फसल की सुरक्षा करें।',
            'en': 'Tell me your location for weather information. Protect crops before rain.',
            'kn': 'ಹವಾಮಾನ ಮಾಹಿತಿಗಾಗಿ ನಿಮ್ಮ ಸ್ಥಳವನ್ನು ಹೇಳಿ. ಮಳೆಯ ಮೊದಲು ಬೆಳೆಗಳನ್ನು ರಕ್ಷಿಸಿ.'
        }
        return responses.get(language, responses['en'])
    
    async def _generate_market_response(self, entities: Dict, context: ConversationContext, language: str) -> str:
        """Generate market price response"""
        responses = {
            'hi': 'बाजार भाव जानने के लिए फसल का नाम बताएं। आज के रेट देख सकते हैं।',
            'en': 'Tell me the crop name to know market rates. You can check today\'s prices.',
            'kn': 'ಮಾರುಕಟ್ಟೆ ದರಗಳನ್ನು ತಿಳಿಯಲು ಬೆಳೆಯ ಹೆಸರು ಹೇಳಿ. ಇಂದಿನ ಬೆಲೆಗಳನ್ನು ನೋಡಬಹುದು.'
        }
        return responses.get(language, responses['en'])
    
    async def _generate_general_response(self, entities: Dict, context: ConversationContext, language: str) -> str:
        """Generate general response for unclear queries"""
        responses = {
            'hi': 'मैं आपकी खेती में मदद के लिए यहाँ हूँ। फसल, कीट, मौसम या बाजार के बारे में पूछ सकते हैं।',
            'en': 'I am here to help with your farming. You can ask about crops, pests, weather, or market.',
            'kn': 'ನಾನು ನಿಮ್ಮ ಕೃಷಿಗೆ ಸಹಾಯ ಮಾಡಲು ಇಲ್ಲಿದ್ದೇನೆ. ಬೆಳೆ, ಕೀಟ, ಹವಾಮಾನ ಅಥವಾ ಮಾರುಕಟ್ಟೆ ಬಗ್ಗೆ ಕೇಳಬಹುದು.'
        }
        return responses.get(language, responses['en'])
    
    def _create_error_response(self, error_message: str, language: str) -> VoiceResponse:
        """Create error response"""
        error_text = self.response_templates['error'].get(language, self.response_templates['error']['en'])
        
        return VoiceResponse(
            transcribed_text="",
            detected_language=language,
            intent="error",
            entities={},
            response_text=error_text,
            response_audio_url="",
            confidence_score=0.0,
            processing_time_ms=0,
            context_updated={}
        )
    
    def create_twilio_response(self, response_text: str, language: str = 'en') -> str:
        """Create TwiML response for Twilio webhook"""
        twiml = TwiML()
        
        # Set voice based on language
        voice_mapping = {
            'hi': 'woman',  # Twilio's default Hindi voice
            'en': 'alice',  # English voice
            'kn': 'woman'   # Default for Kannada
        }
        
        twiml.say(response_text, voice=voice_mapping.get(language, 'alice'), language=language)
        
        # Continue listening for more input
        twiml.pause(length=2)
        twiml.say("क्या आपका कोई और सवाल है?" if language == 'hi' else
                  "Do you have any other questions?" if language == 'en' else
                  "ನಿಮಗೆ ಬೇರೆ ಯಾವುದಾದರೂ ಪ್ರಶ್ನೆ ಇದೆಯೇ?")
        
        return str(twiml)

# Example usage and webhook handler
async def handle_twilio_webhook(call_sid: str, audio_url: str, user_phone: str) -> str:
    """Handle incoming Twilio voice webhook"""
    
    # Initialize voice processing system
    voice_system = VoiceProcessingSystem()
    
    try:
        # Download audio from Twilio
        async with aiohttp.ClientSession() as session:
            async with session.get(audio_url) as resp:
                audio_data = await resp.read()
        
        # Create voice input
        voice_input = VoiceInput(
            audio_data=audio_data,
            user_id=user_phone,
            call_sid=call_sid,
            context={'phone': user_phone}
        )
        
        # Process voice input
        response = await voice_system.process_voice_input(voice_input)
        
        # Create TwiML response
        twiml_response = voice_system.create_twilio_response(
            response.response_text, 
            response.detected_language
        )
        
        return twiml_response
        
    except Exception as e:
        logger.error(f"Webhook handling failed: {e}")
        # Return error TwiML
        error_twiml = voice_system.create_twilio_response(
            "Sorry, there was an error processing your request.", 
            'en'
        )
        return error_twiml

if __name__ == "__main__":
    # Example usage
    async def test_voice_system():
        voice_system = VoiceProcessingSystem()
        
        # Test with sample audio (placeholder)
        sample_audio = b"sample_audio_data"  # Would be actual audio bytes
        
        voice_input = VoiceInput(
            audio_data=sample_audio,
            user_id="test_user",
            language_hint="hi"
        )
        
        response = await voice_system.process_voice_input(voice_input)
        
        print(f"Transcription: {response.transcribed_text}")
        print(f"Language: {response.detected_language}")
        print(f"Intent: {response.intent}")
        print(f"Response: {response.response_text}")
        print(f"Confidence: {response.confidence_score}")
    
    # Run test
    asyncio.run(test_voice_system())
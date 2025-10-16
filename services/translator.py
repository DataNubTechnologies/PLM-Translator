"""
Azure Translator service module.
Handles Microsoft Azure Translator API calls and language operations.
"""
import requests
from config import AzureTranslatorConfig


class TranslatorService:
    """Service class to handle Microsoft Azure Translator API calls"""
    
    def __init__(self):
        self.subscription_key = AzureTranslatorConfig.TRANSLATOR_KEY
        self.endpoint = AzureTranslatorConfig.TRANSLATOR_ENDPOINT
        self.region = AzureTranslatorConfig.TRANSLATOR_REGION
        self.languages_cache = None
    
    def get_supported_languages(self):
        """Get list of supported languages from Microsoft Translator API"""
        if self.languages_cache:
            return self.languages_cache
            
        try:
            url = "https://api.cognitive.microsofttranslator.com/languages?api-version=3.0&scope=translation"
            headers = {
                'Accept': 'application/json'
            }
            
            response = requests.get(url, headers=headers, timeout=10)
            response.raise_for_status()
            
            data = response.json()
            
            if 'translation' in data:
                # Convert to list format for frontend
                languages = [{"key": "", "text": "Select Target Language"}]
                for key, value in data['translation'].items():
                    languages.append({
                        "key": key,
                        "text": value.get('name', key)
                    })
                # Sort by name
                languages[1:] = sorted(languages[1:], key=lambda x: x['text'])
                self.languages_cache = languages
                return languages
            else:
                raise Exception("Invalid API response structure")
                
        except Exception as e:
            print(f"Error loading languages from API: {e}")
            # Return fallback languages
            return self._get_fallback_languages()
    
    def _get_fallback_languages(self):
        """Fallback languages list when API is unavailable"""
        return [
            {"key": "", "text": "Select Target Language"},
            {"key": "ar", "text": "Arabic"},
            {"key": "zh", "text": "Chinese (Simplified)"},
            {"key": "da", "text": "Danish"},
            {"key": "nl", "text": "Dutch"},
            {"key": "fi", "text": "Finnish"},
            {"key": "fr", "text": "French"},
            {"key": "de", "text": "German"},
            {"key": "hi", "text": "Hindi"},
            {"key": "it", "text": "Italian"},
            {"key": "ja", "text": "Japanese"},
            {"key": "ko", "text": "Korean"},
            {"key": "no", "text": "Norwegian"},
            {"key": "pl", "text": "Polish"},
            {"key": "pt", "text": "Portuguese"},
            {"key": "ru", "text": "Russian"},
            {"key": "es", "text": "Spanish"},
            {"key": "sv", "text": "Swedish"},
            {"key": "th", "text": "Thai"},
            {"key": "tr", "text": "Turkish"}
        ]
    
    def translate_text(self, text, target_language):
        """Translate text using Azure Translator API"""
        if not AzureTranslatorConfig.is_configured():
            return {
                'success': False,
                'error': 'Azure Translator service is not configured. Please set the required environment variables.'
            }
        
        try:
            url = f"{self.endpoint}/translator/text/v3.0/translate"
            params = {
                'api-version': '3.0',
                'to': target_language
            }
            
            headers = {
                'Ocp-Apim-Subscription-Key': self.subscription_key,
                'Ocp-Apim-Subscription-Region': self.region,
                'Content-Type': 'application/json'
            }
            
            body = [{'text': text}]
            
            response = requests.post(url, params=params, headers=headers, json=body, timeout=30)
            response.raise_for_status()
            
            result = response.json()
            
            if result and len(result) > 0 and 'translations' in result[0]:
                translated_text = result[0]['translations'][0]['text']
                return {
                    'success': True,
                    'translated_text': translated_text,
                    'source_language': result[0].get('detectedLanguage', {}).get('language', 'auto'),
                    'target_language': target_language
                }
            else:
                raise Exception("Invalid translation response")
                
        except requests.exceptions.Timeout:
            return {
                'success': False,
                'error': 'Translation request timed out. Please try again.'
            }
        except requests.exceptions.RequestException as e:
            return {
                'success': False,
                'error': f'Translation service error: {str(e)}'
            }
        except Exception as e:
            return {
                'success': False,
                'error': f'Translation failed: {str(e)}'
            }


# Global translator service instance
translator_service = TranslatorService()
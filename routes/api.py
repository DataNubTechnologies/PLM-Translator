"""
API routes for PLM Translator application.
Handles REST API endpoints for translation, test results, and data management.
"""
import uuid
from datetime import datetime, timezone
from flask import Blueprint, request, jsonify, send_file
from models import db, TestResult
from services.translator import translator_service
from utils import unicode_safe_jsonify, get_user_info

api_bp = Blueprint('api', __name__)


@api_bp.route('/languages')
def get_languages():
    """API endpoint to get supported languages"""
    languages = translator_service.get_supported_languages()
    return jsonify({
        'success': True,
        'languages': languages
    })


@api_bp.route('/translate', methods=['POST'])
def translate():
    """API endpoint for text translation"""
    data = request.get_json()
    
    if not data:
        return jsonify({
            'success': False,
            'error': 'No data provided'
        }), 400
    
    source_text = data.get('text', '').strip()
    target_language = data.get('target_language', '').strip()
    
    # Validation
    if not source_text:
        return jsonify({
            'success': False,
            'error': 'Please enter text to translate'
        }), 400
    
    if not target_language:
        return jsonify({
            'success': False,
            'error': 'Please select a target language'
        }), 400
    
    if len(source_text) > 5000:
        return jsonify({
            'success': False,
            'error': 'Text is too long. Maximum 5000 characters allowed.'
        }), 400
    
    # Perform translation
    result = translator_service.translate_text(source_text, target_language)
    
    if result['success']:
        return unicode_safe_jsonify(result)
    else:
        return unicode_safe_jsonify(result, 500)


@api_bp.route('/azure-user')
def get_azure_user():
    """API endpoint to get current user information"""
    try:
        user_info = get_user_info()
        return jsonify({
            'success': True,
            **user_info,
            'timestamp': datetime.now(timezone.utc).isoformat()
        })
    except Exception as e:
        # Fallback to a generic user
        return jsonify({
            'success': True,
            'user': 'Current User',
            'error': f'Limited user info: {str(e)}',
            'timestamp': datetime.now(timezone.utc).isoformat()
        })


@api_bp.route('/save-test-results', methods=['POST'])
def save_test_results():
    """API endpoint to save test results to database"""
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({
                'success': False,
                'error': 'No data provided'
            }), 400
        
        # Validate required fields
        if not data.get('outcome'):
            return jsonify({
                'success': False,
                'error': 'Outcome is required'
            }), 400
        
        # Validate accuracy field
        if not data.get('accuracy'):
            return jsonify({
                'success': False,
                'error': 'Accuracy is required'
            }), 400
        
        try:
            accuracy = float(data.get('accuracy'))
            if accuracy < 0 or accuracy > 100:
                return jsonify({
                    'success': False,
                    'error': 'Accuracy must be between 0 and 100'
                }), 400
        except (ValueError, TypeError):
            return jsonify({
                'success': False,
                'error': 'Accuracy must be a valid number'
            }), 400
        
        # Create new test result record
        test_result = TestResult(
            outcome=data.get('outcome'),
            accuracy=accuracy,  # Use the validated accuracy value
            observation=data.get('observation'),
            tested_by=data.get('testedBy'),
            text_to_translate=data.get('sourceText'),
            translated_text=data.get('translatedText'),
            source_language=data.get('sourceLanguage', 'auto'),
            target_language=data.get('targetLanguage'),
            session_id=data.get('sessionId', str(uuid.uuid4()))
        )
        
        # Save to database
        db.session.add(test_result)
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': 'Test results saved successfully to database',
            'result_id': test_result.id,
            'data': test_result.to_dict()
        })
        
    except ValueError as e:
        db.session.rollback()
        return jsonify({
            'success': False,
            'error': f'Invalid data format: {str(e)}'
        }), 400
    except Exception as e:
        db.session.rollback()
        return jsonify({
            'success': False,
            'error': f'Failed to save test results: {str(e)}'
        }), 500


@api_bp.route('/test-results', methods=['GET'])
def get_test_results():
    """API endpoint to retrieve test results from database"""
    try:
        # Get query parameters for pagination and filtering
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 10, type=int)
        outcome_filter = request.args.get('outcome', None)
        
        # Build query
        query = TestResult.query
        
        # Apply filters
        if outcome_filter:
            query = query.filter(TestResult.outcome == outcome_filter)
        
        # Order by most recent first
        query = query.order_by(TestResult.created_at.desc())
        
        # Paginate results
        pagination = query.paginate(
            page=page, 
            per_page=per_page, 
            error_out=False
        )
        
        # Convert to dictionaries
        results = [result.to_dict() for result in pagination.items]
        
        return jsonify({
            'success': True,
            'data': results,
            'pagination': {
                'page': page,
                'per_page': per_page,
                'total': pagination.total,
                'pages': pagination.pages,
                'has_next': pagination.has_next,
                'has_prev': pagination.has_prev
            }
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': f'Failed to retrieve test results: {str(e)}'
        }), 500


@api_bp.route('/export-test-results', methods=['GET'])
def export_test_results():
    """API endpoint to export test results as Excel file"""
    try:
        import pandas as pd
        from io import BytesIO
        
        # Get all test results
        results = TestResult.query.order_by(TestResult.created_at.desc()).all()
        
        if not results:
            return jsonify({'error': 'No test results to export'}), 404
        
        # Convert to DataFrame
        data = []
        for result in results:
            data.append({
                'ID': result.id,
                'Text to Translate': result.text_to_translate,
                'Translated Text': result.translated_text,
                'Source Language': result.source_language,
                'Target Language': result.target_language,
                'Outcome': result.outcome,
                'Observation': result.observation,
                'Accuracy (%)': result.accuracy,
                'Tested By': result.tested_by,
                'Date Created': result.created_at.strftime('%Y-%m-%d %H:%M:%S') if result.created_at else '',
                'Session ID': result.session_id
            })
        
        df = pd.DataFrame(data)
        
        # Create Excel file in memory
        output = BytesIO()
        with pd.ExcelWriter(output, engine='openpyxl') as writer:
            df.to_excel(writer, sheet_name='Test Results', index=False)
            
            # Auto-adjust column widths
            worksheet = writer.sheets['Test Results']
            for column in worksheet.columns:
                max_length = 0
                column_letter = column[0].column_letter
                for cell in column:
                    try:
                        if len(str(cell.value)) > max_length:
                            max_length = len(str(cell.value))
                    except:
                        pass
                adjusted_width = min(max_length + 2, 50)
                worksheet.column_dimensions[column_letter].width = adjusted_width
        
        output.seek(0)
        
        return send_file(
            output,
            mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            as_attachment=True,
            download_name=f'test_results_{datetime.now().strftime("%Y%m%d_%H%M%S")}.xlsx'
        )
        
    except ImportError:
        return jsonify({'error': 'Pandas and openpyxl libraries are required for Excel export'}), 500
    except Exception as e:
        print(f"Error exporting test results: {str(e)}")
        return jsonify({'error': str(e)}), 500


@api_bp.route('/test-results/<int:result_id>', methods=['DELETE'])
def delete_test_result(result_id):
    """API endpoint to delete a specific test result"""
    try:
        # Find the test result
        result = TestResult.query.get(result_id)
        
        if not result:
            return jsonify({'error': 'Test result not found'}), 404
        
        # Delete the test result
        db.session.delete(result)
        db.session.commit()
        
        return jsonify({'message': 'Test result deleted successfully'})
        
    except Exception as e:
        db.session.rollback()
        print(f"Error deleting test result: {str(e)}")
        return jsonify({'error': str(e)}), 500
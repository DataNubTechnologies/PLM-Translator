"""
Main routes for PLM Translator application.
Handles page rendering and general web routes.
"""
from flask import Blueprint, render_template
from services.translator import translator_service
from models import TestResult

main_bp = Blueprint('main', __name__)


@main_bp.route('/')
def index():
    """Main translator page"""
    languages = translator_service.get_supported_languages()
    return render_template('translator.html', languages=languages)


@main_bp.route('/test-results')
def view_test_results():
    """Simple page to view test results"""
    try:
        results = TestResult.query.order_by(TestResult.created_at.desc()).limit(20).all()
        return render_template('test_results.html', results=results)
    except Exception as e:
        return f"Error loading test results: {str(e)}", 500


@main_bp.errorhandler(404)
def not_found(error):
    """Handle 404 errors"""
    return render_template('error.html', 
                         error_code=404, 
                         error_message="Page not found"), 404


@main_bp.errorhandler(500)
def internal_error(error):
    """Handle 500 errors"""
    return render_template('error.html', 
                         error_code=500, 
                         error_message="Internal server error"), 500
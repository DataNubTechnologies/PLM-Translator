"""
PLM Translator Flask Application
A modular Flask web application for language translation using Azure Translator API.
"""
import os
from flask import Flask
from config import config
from models import init_db
from routes import register_blueprints
from utils import get_environment_type


def create_app(config_name=None):
    """Application factory function"""
    if config_name is None:
        config_name = get_environment_type()
    
    app = Flask(__name__)
    
    # Load configuration
    app.config.from_object(config[config_name])
    
    # Set database URI based on environment
    if config_name == 'production':
        app.config['SQLALCHEMY_DATABASE_URI'] = config[config_name].get_database_url()
    else:
        app.config['SQLALCHEMY_DATABASE_URI'] = config[config_name].get_database_url()
    
    # Print database info for debugging
    print("Connected to Azure SQL Database")
    
    # Initialize extensions
    init_db(app)
    
    # Register blueprints
    register_blueprints(app)
    
    return app


# Create the Flask application
app = create_app()

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)
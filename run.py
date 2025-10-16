#!/usr/bin/env python3
"""
Entry point for Azure App Service deployment.
This file imports and runs the Flask application.
"""

from app import app

if __name__ == "__main__":
    app.run()
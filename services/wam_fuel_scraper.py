#!/usr/bin/env python3
"""
WAM Fuel Price Scraper

This script scrapes fuel prices from the Emirates News Agency (WAM) 
and sends them to the TripXL Node.js server.

It's designed to be run on the 1st day of every month at 6:00 AM.
"""

import os
import sys
import json
import logging
import requests
from bs4 import BeautifulSoup
from datetime import datetime, timezone
from dotenv import load_dotenv

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[logging.StreamHandler(sys.stdout)]
)
logger = logging.getLogger('wam_fuel_scraper')

# Load environment variables
load_dotenv()

# Constants
WAM_FUEL_PRICES_URL = "https://wam.ae/en/search?query=fuel+prices"
TRIPXL_API_URL = os.getenv('APP_URL', 'http://localhost:5000') + "/api/fuel-types/update"

# Fuel types mapping
FUEL_TYPE_MAPPING = {
    'special 95': 'PETROL',
    'super 98': 'SUPER',
    'e-plus 91': 'EPLUS',
    'diesel': 'DIESEL'
}

def scrape_wam_for_fuel_prices():
    """
    Scrape WAM website for the latest fuel price announcement
    """
    logger.info("Starting WAM fuel price scraping")
    
    try:
        # Fetch the WAM search page for fuel prices
        response = requests.get(WAM_FUEL_PRICES_URL, timeout=30)
        response.raise_for_status()
        
        # Parse the HTML
        soup = BeautifulSoup(response.text, 'html.parser')
        
        # Find the most recent article about fuel prices
        articles = soup.select('.search-results .card')
        
        if not articles:
            logger.warning("No articles found on WAM search page")
            return None
        
        # Look for articles with fuel price announcements
        fuel_price_articles = []
        
        for article in articles:
            title_elem = article.select_one('.card-title')
            date_elem = article.select_one('.item-date')
            link_elem = article.select_one('a')
            
            if not all([title_elem, date_elem, link_elem]):
                continue
                
            title = title_elem.text.strip().lower()
            date_text = date_elem.text.strip()
            link = link_elem.get('href')
            
            # Check if article is about fuel price announcement
            if ('fuel price' in title or 'petrol price' in title) and ('announce' in title or 'set' in title):
                # Add to list of potential articles
                fuel_price_articles.append({
                    'title': title,
                    'date': date_text,
                    'link': link
                })
        
        if not fuel_price_articles:
            logger.warning("No fuel price announcement articles found")
            return None
        
        # Sort by date (most recent first)
        fuel_price_articles.sort(key=lambda x: x['date'], reverse=True)
        latest_article = fuel_price_articles[0]
        
        # Get the full URL of the latest article
        article_url = latest_article['link']
        if not article_url.startswith('http'):
            article_url = f"https://wam.ae{article_url}"
        
        # Fetch the article page
        article_response = requests.get(article_url, timeout=30)
        article_response.raise_for_status()
        
        # Parse the article
        article_soup = BeautifulSoup(article_response.text, 'html.parser')
        
        # Extract the content
        content = article_soup.select_one('.article-body')
        if not content:
            logger.warning(f"Could not find article content on {article_url}")
            return None
        
        # Extract all paragraphs
        paragraphs = content.select('p')
        article_text = ' '.join([p.text.strip() for p in paragraphs])
        
        # Find fuel prices in the article text
        return extract_fuel_prices(article_text)
        
    except requests.RequestException as e:
        logger.error(f"Error fetching WAM website: {e}")
        return None
    except Exception as e:
        logger.error(f"Unexpected error in scraping: {e}")
        return None

def extract_fuel_prices(article_text):
    """
    Extract fuel prices from article text
    """
    logger.info("Extracting fuel prices from article text")
    
    prices = {}
    
    # Convert to lowercase for easier matching
    text_lower = article_text.lower()
    
    # Look for each fuel type
    for key, fuel_type in FUEL_TYPE_MAPPING.items():
        try:
            # Find the position of the fuel type
            pos = text_lower.find(key)
            if pos == -1:
                continue
                
            # Look for price pattern after the fuel type name
            # We'll search for a pattern like "AED X.XX" or "X.XX per litre"
            segment = text_lower[pos:pos+100]  # Analyze the next 100 chars
            
            price = None
            
            # Try different patterns
            if 'aed' in segment:
                aed_pos = segment.find('aed')
                number_segment = segment[aed_pos+3:aed_pos+10].strip()
                # Extract the first number found
                for word in number_segment.split():
                    if word.replace('.', '').isdigit():
                        price = float(word)
                        break
            
            # If not found, try another pattern
            if price is None:
                import re
                # Match any number format (e.g., 3.14, 2,800, etc.)
                matches = re.findall(r'(\d+[,.]\d+)', segment)
                if matches:
                    # Convert to float, handling comma as decimal separator
                    price = float(matches[0].replace(',', '.'))
            
            if price:
                prices[fuel_type] = price
                logger.info(f"Found price for {fuel_type}: {price} AED")
            
        except Exception as e:
            logger.error(f"Error extracting price for {key}: {e}")
    
    # If we found at least one price, consider it successful
    if prices:
        return {
            'prices': prices,
            'date': datetime.now(timezone.utc).isoformat(),
            'source': 'WAM (Emirates News Agency)'
        }
    
    logger.warning("Could not extract any fuel prices from the article")
    return None

def send_prices_to_tripxl(price_data):
    """
    Send extracted prices to TripXL API
    """
    if not price_data:
        logger.warning("No price data to send")
        return False
    
    logger.info(f"Sending price data to TripXL API: {TRIPXL_API_URL}")
    try:
        response = requests.post(
            TRIPXL_API_URL,
            json=price_data,
            headers={'Content-Type': 'application/json'},
            timeout=30
        )
        response.raise_for_status()
        
        logger.info(f"Successfully sent prices to TripXL API. Response: {response.status_code}")
        return True
    except requests.RequestException as e:
        logger.error(f"Error sending prices to TripXL API: {e}")
        return False

def run_scraper():
    """
    Main function to run the scraper
    """
    logger.info("Starting WAM fuel price scraper")
    
    # Scrape the prices
    price_data = scrape_wam_for_fuel_prices()
    
    if price_data:
        # Send to TripXL API
        success = send_prices_to_tripxl(price_data)
        return success
    
    return False

if __name__ == "__main__":
    success = run_scraper()
    sys.exit(0 if success else 1)
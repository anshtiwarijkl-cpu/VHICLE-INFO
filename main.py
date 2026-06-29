# ============================================================
# 🔥 VEHICLE INFO API — FULL POWER (Random Delay + All Features)
# 👨‍💻 Developer: @Guruji_33
# 🔥 Owner: @Alone_Supporter
# 💀 Powered by AFT ABISHEK 10X
# ============================================================

import asyncio
import requests
from bs4 import BeautifulSoup
import re
from flask import Flask, request, jsonify
from threading import Thread
from colorama import Fore, Style, init
import time
import logging
import random
from cachetools import TTLCache
from datetime import datetime
from proxy_rotator import ProxyRotator
from proxy_harvester import ProxyHarvester

# Initialize
init(autoreset=True)
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# ============================================================
# 🔥 CONFIGURATION
# ============================================================

FLASK_PORT = 8888
CACHE_TTL = 300
MAX_RETRIES = 3
MIN_DELAY = 1.0
MAX_DELAY = 5.0

app = Flask(__name__)

# Cache
cache = TTLCache(maxsize=100, ttl=CACHE_TTL)

# Proxy Rotator
proxy_rotator = ProxyRotator()
proxy_harvester = ProxyHarvester()

# ============================================================
# 🔥 USER-AGENT POOL
# ============================================================

USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/121.0",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:109.0) Gecko/20100101 Firefox/121.0",
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Mobile/15E148 Safari/604.1",
]

# ============================================================
# 🔥 SMART SCRAPER — WITH RANDOM DELAY + RETRY + PROXY
# ============================================================

def get_vehicle_details_smart(rc_number: str) -> dict:
    """Smart scraper with random delay, proxy rotation, retry logic"""
    
    rc = rc_number.strip().upper()
    url = f"https://vahanx.in/rc-search/{rc}"
    
    # 🕐 RANDOM DELAY — Human-like behavior
    delay = random.uniform(MIN_DELAY, MAX_DELAY)
    logger.info(f"⏱️ Random delay: {delay:.2f}s before request")
    time.sleep(delay)
    
    for attempt in range(1, MAX_RETRIES + 1):
        # 🎭 Random User-Agent
        user_agent = random.choice(USER_AGENTS)
        
        # 🌐 Get proxy
        proxy = proxy_rotator.get_random_proxy()
        if proxy:
            proxies = {"http": f"http://{proxy}", "https": f"http://{proxy}"}
            logger.info(f"🔄 Attempt {attempt}: Using proxy {proxy}")
        else:
            proxies = None
            logger.info(f"🔄 Attempt {attempt}: Direct connection (no proxy)")
        
        try:
            response = requests.get(
                url,
                headers={
                    "User-Agent": user_agent,
                    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
                    "Accept-Language": "en-US,en;q=0.9",
                    "Accept-Encoding": "gzip, deflate, br",
                    "Connection": "keep-alive",
                    "Referer": "https://vahanx.in/"
                },
                proxies=proxies,
                timeout=15
            )
            
            # ✅ SUCCESS
            if response.status_code == 200:
                logger.info(f"✅ Success on attempt {attempt}")
                if proxy:
                    proxy_rotator.mark_success(proxy)
                soup = BeautifulSoup(response.text, "html.parser")
                data = extract_vehicle_data(soup, rc)
                
                # ✅ NO META — SIRF CLEAN DATA
                return data
            
            # 🚫 RATE LIMITED
            elif response.status_code == 429:
                logger.warning(f"⚠️ Rate limited (429) on attempt {attempt}")
                if proxy:
                    proxy_rotator.add_to_blacklist(proxy, "rate_limited")
                # Exponential backoff
                wait_time = random.uniform(5, 15) * attempt
                logger.info(f"⏳ Waiting {wait_time:.2f}s before retry...")
                time.sleep(wait_time)
                continue
            
            # ❌ OTHER ERRORS
            else:
                logger.warning(f"⚠️ Status {response.status_code} on attempt {attempt}")
                if proxy:
                    proxy_rotator.mark_failed(proxy)
                time.sleep(random.uniform(1, 3))
                continue
                
        except requests.exceptions.Timeout:
            logger.warning(f"⏱️ Timeout on attempt {attempt}")
            if proxy:
                proxy_rotator.mark_failed(proxy)
            time.sleep(random.uniform(2, 5))
            continue
            
        except requests.exceptions.ConnectionError:
            logger.warning(f"🔌 Connection error on attempt {attempt}")
            if proxy:
                proxy_rotator.add_to_blacklist(proxy, "connection_error")
            time.sleep(random.uniform(3, 7))
            continue
            
        except Exception as e:
            logger.error(f"❌ Error on attempt {attempt}: {e}")
            if proxy:
                proxy_rotator.mark_failed(proxy)
            time.sleep(random.uniform(2, 4))
            continue
    
    # 🔥 FINAL FALLBACK — Direct connection without proxy
    logger.warning("⚠️ All proxy attempts failed, trying direct connection...")
    try:
        response = requests.get(url, headers={"User-Agent": random.choice(USER_AGENTS)}, timeout=10)
        if response.status_code == 200:
            soup = BeautifulSoup(response.text, "html.parser")
            data = extract_vehicle_data(soup, rc)
            return data
        else:
            return {"error": f"Failed: Status {response.status_code}"}
    except Exception as e:
        return {"error": str(e)}

def extract_vehicle_data(soup, rc):
    """Extract vehicle data from BeautifulSoup object"""
    
    def extract_card(label):
        for div in soup.select(".hrcd-cardbody"):
            span = div.find("span")
            if span and label.lower() in span.text.lower():
                p = div.find("p")
                return p.get_text(strip=True) if p else None
        return None
    
    def get_value(label):
        try:
            div = soup.find("span", string=re.compile(label, re.I))
            if div:
                div = div.find_parent("div")
                p = div.find("p") if div else None
                return p.get_text(strip=True) if p else None
        except:
            return None
    
    data = {
        "registration_number": soup.find("h1").text.strip() if soup.find("h1") else rc,
        "basic_info": {
            "owner_name": extract_card("Owner Name") or get_value("Owner Name"),
            "model_name": extract_card("Modal Name") or get_value("Model Name"),
            "city": extract_card("City Name") or get_value("City Name"),
            "address": extract_card("Address") or get_value("Address"),
        },
        "insurance": {
            "status": "Expired" if soup.select_one(".insurance-alert-box.expired") else "Active",
            "company": get_value("Insurance Company"),
            "expiry_date": get_value("Insurance Expiry") or get_value("Insurance Upto"),
        },
        "validity": {
            "registration_date": get_value("Registration Date"),
            "fitness_upto": get_value("Fitness Upto"),
            "tax_upto": get_value("Tax Upto"),
        }
    }
    
    # Clean empty values
    def clean_dict(d):
        if isinstance(d, dict):
            return {k: clean_dict(v) for k, v in d.items() if v and v not in ["", "None", "Not Applicable"]}
        return d
    
    return clean_dict(data)

# ============================================================
# 🔥 FLASK ROUTES
# ============================================================

@app.route("/")
def home():
    return jsonify({
        "status": "online",
        "service": "Vehicle Information API — Smart Proxy + Auto Delay",
        "version": "4.0",
        "developer": "@Guruji_33",
        "owner": "@Alone_Supporter",
        "features": {
            "proxy_rotation": "✅",
            "random_delay": "✅",
            "auto_retry": "✅",
            "blacklist": "✅",
            "cache": "✅",
            "geo_filtering": "✅"
        },
        "endpoints": {
            "vehicle_info": "/api/vehicle-info?rc=DL01AB1234",
            "health": "/health",
            "proxy_stats": "/proxy-stats",
            "harvest": "/harvest-proxies"
        }
    })

@app.route("/health")
def health():
    return jsonify({
        "status": "healthy",
        "proxy_stats": proxy_rotator.get_stats(),
        "cache_size": len(cache),
        "timestamp": datetime.utcnow().isoformat()
    })

@app.route("/proxy-stats")
def proxy_stats():
    return jsonify(proxy_rotator.get_stats())

@app.route("/api/vehicle-info")
def get_vehicle_info():
    rc = request.args.get("rc")
    if not rc:
        return jsonify({"error": "Missing rc parameter"}), 400
    
    # 🔥 CACHE CHECK
    if rc in cache:
        logger.info(f"✅ Cache hit for {rc}")
        return jsonify(cache[rc])  # SIRF DATA — NO CACHED FLAG
    
    # 🔥 FETCH WITH SMART LOGIC
    data = get_vehicle_details_smart(rc)
    if data.get("error"):
        return jsonify(data), 404
    
    # 🔥 STORE IN CACHE
    cache[rc] = data
    return jsonify(data)  # SIRF CLEAN DATA

@app.route("/harvest-proxies")
def harvest_proxies():
    """Harvest fresh proxies"""
    try:
        asyncio.run(proxy_harvester.harvest_all_concurrent())
        proxy_harvester.save_proxies()
        proxy_rotator.load_proxies()
        return jsonify({"success": True, "message": "Proxies harvested and loaded"})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

# ============================================================
# 🔥 CONSOLE MODE
# ============================================================

def console_mode():
    print(f"\n{Fore.CYAN}{'='*60}{Style.RESET_ALL}")
    print(f"{Fore.CYAN}🚗 VEHICLE INFORMATION SYSTEM — SMART VERSION{Style.RESET_ALL}")
    print(f"{Fore.GREEN}👨‍💻 Developer: @Guruji_33{Style.RESET_ALL}")
    print(f"{Fore.GREEN}👑 Owner: @Alone_Supporter{Style.RESET_ALL}")
    print(f"{Fore.YELLOW}📍 API Running on: http://localhost:{FLASK_PORT}{Style.RESET_ALL}")
    print(f"{Fore.YELLOW}📍 API Endpoint: /api/vehicle-info?rc=<RC_NUMBER>{Style.RESET_ALL}")
    print(f"{Fore.CYAN}{'='*60}{Style.RESET_ALL}\n")
    
    while True:
        try:
            rc = input(f"{Fore.CYAN}📌 Enter RC Number (or 'quit'): {Style.RESET_ALL}").strip()
            if rc.lower() in ['quit', 'exit', 'q']:
                break
            if not rc:
                continue
                
            print(f"\n{Fore.YELLOW}🔍 Fetching details for {rc}...{Style.RESET_ALL}")
            start_time = time.time()
            data = get_vehicle_details_smart(rc)
            elapsed = time.time() - start_time
            
            if data.get("error"):
                print(f"{Fore.RED}❌ {data['error']}{Style.RESET_ALL}")
            else:
                print(f"\n{Fore.GREEN}✅ VEHICLE DETAILS — {elapsed:.2f}s{Style.RESET_ALL}")
                print(f"{Fore.GREEN}{'─'*50}{Style.RESET_ALL}")
                
                # 🚗 BASIC INFO
                if data.get("basic_info"):
                    bi = data["basic_info"]
                    if bi.get("owner_name"): print(f"  👤 Owner: {Fore.WHITE}{bi['owner_name']}{Style.RESET_ALL}")
                    if bi.get("model_name"): print(f"  🚗 Model: {Fore.WHITE}{bi['model_name']}{Style.RESET_ALL}")
                    if bi.get("city"): print(f"  🏙️  City: {Fore.WHITE}{bi['city']}{Style.RESET_ALL}")
                    if bi.get("address"): print(f"  📍 Address: {Fore.WHITE}{bi['address'][:50]}...{Style.RESET_ALL}")
                
                # 🛡️ INSURANCE
                if data.get("insurance"):
                    ins = data["insurance"]
                    status_color = Fore.RED if ins.get("status") == "Expired" else Fore.GREEN
                    print(f"  🛡️  Insurance: {status_color}{ins.get('status')}{Style.RESET_ALL}")
                    if ins.get("company"): print(f"  🏢 Company: {Fore.WHITE}{ins['company']}{Style.RESET_ALL}")
                    if ins.get("expiry_date"): print(f"  📅 Expiry: {Fore.WHITE}{ins['expiry_date']}{Style.RESET_ALL}")
                
                # 📅 VALIDITY
                if data.get("validity"):
                    val = data["validity"]
                    if val.get("registration_date"): print(f"  📆 Reg Date: {Fore.WHITE}{val['registration_date']}{Style.RESET_ALL}")
                    if val.get("fitness_upto"): print(f"  ✅ Fitness: {Fore.WHITE}{val['fitness_upto']}{Style.RESET_ALL}")
                    if val.get("tax_upto"): print(f"  💵 Tax Upto: {Fore.WHITE}{val['tax_upto']}{Style.RESET_ALL}")
                
                print(f"{Fore.GREEN}{'─'*50}{Style.RESET_ALL}\n")
                
        except KeyboardInterrupt:
            break
        except Exception as e:
            print(f"{Fore.RED}❌ {e}{Style.RESET_ALL}")

# ============================================================
# 🔥 MAIN
# ============================================================

def run_flask():
    app.run(host="0.0.0.0", port=FLASK_PORT, debug=False, use_reloader=False)

def main():
    # 🔥 Load/Harvest proxies
    try:
        count = proxy_rotator.load_proxies("proxies.txt")
        if count == 0:
            raise Exception("No proxies loaded")
        logger.info(f"✅ Loaded {count} proxies")
    except:
        logger.warning("⚠️ No proxies found. Harvesting fresh proxies...")
        asyncio.run(proxy_harvester.harvest_all_concurrent())
        proxy_harvester.save_proxies()
        proxy_rotator.load_proxies("proxies.txt")
        logger.info("✅ Proxies harvested and loaded")
    
    # 🔥 Start Flask
    flask_thread = Thread(target=run_flask, daemon=True)
    flask_thread.start()
    
    # 🔥 Start console
    time.sleep(2)
    console_mode()

if __name__ == "__main__":
    main()

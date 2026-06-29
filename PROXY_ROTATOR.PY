# ============================================================
# 🔥 PROXY ROTATOR — ULTIMATE VERSION
# 👨‍💻 Developer: @Guruji_33
# ============================================================

import asyncio
import random
import logging
from typing import Optional, Dict, List
from datetime import datetime
import aiohttp

logger = logging.getLogger(__name__)

class ProxyRotator:
    """Ultimate Smart Proxy Rotator with Geo Filtering and Blacklist Checking"""
    
    def __init__(self):
        self.proxies = []
        self.working_proxies = []
        self.failed_proxies = []
        self.blacklisted_proxies = []
        self.proxy_stats = {}
        self.proxy_geo_info = {}
        self.current_index = 0
        self.last_check_time = None
        self.recheck_task = None
        self.preferred_countries = []
        self.blocked_countries = []
        self._last_proxy = None
        
    def load_proxies(self, proxy_file: str = "proxies.txt") -> int:
        """Load proxies from file"""
        try:
            with open(proxy_file, 'r') as f:
                for line in f:
                    line = line.strip()
                    if line and not line.startswith('#'):
                        self.proxies.append(line)
                        self.proxy_stats[line] = {
                            'success_count': 0,
                            'fail_count': 0,
                            'response_time': None,
                            'last_used': None,
                            'speed': 'unknown'
                        }
            self.working_proxies = self.proxies.copy()
            logger.info(f"✅ Loaded {len(self.proxies)} proxies")
            return len(self.proxies)
        except Exception as e:
            logger.error(f"❌ Failed to load proxies: {e}")
            return 0
    
    # ============================================================
    # 🔥 BLACKLIST CHECKING
    # ============================================================
    
    def add_to_blacklist(self, proxy: str, reason: str = "manual"):
        """🚫 Add proxy to blacklist"""
        if proxy not in self.blacklisted_proxies:
            self.blacklisted_proxies.append(proxy)
            if proxy in self.working_proxies:
                self.working_proxies.remove(proxy)
            if proxy in self.failed_proxies:
                self.failed_proxies.remove(proxy)
            logger.warning(f"🚫 Proxy blacklisted: {proxy} | Reason: {reason}")
            
    def is_blacklisted(self, proxy: str) -> bool:
        """🔍 Check if proxy is blacklisted"""
        return proxy in self.blacklisted_proxies
        
    def get_blacklisted_proxies(self) -> List[str]:
        """📋 Get all blacklisted proxies"""
        return self.blacklisted_proxies.copy()
    
    def clear_blacklist(self):
        """🗑️ Clear entire blacklist"""
        count = len(self.blacklisted_proxies)
        self.blacklisted_proxies.clear()
        logger.info(f"🗑️ Cleared {count} proxies from blacklist")
    
    # ============================================================
    # 🔥 GEO FILTERING
    # ============================================================
    
    def set_preferred_countries(self, countries: List[str]):
        """🌍 Set preferred countries for proxy selection"""
        self.preferred_countries = [c.upper() for c in countries]
        logger.info(f"🌍 Preferred countries set to: {self.preferred_countries}")
        
    def set_blocked_countries(self, countries: List[str]):
        """🚫 Set blocked countries (these proxies will be ignored)"""
        self.blocked_countries = [c.upper() for c in countries]
        logger.info(f"🚫 Blocked countries set to: {self.blocked_countries}")
        
    async def get_proxy_geo(self, proxy: str) -> Optional[Dict]:
        """🌍 Get proxy geolocation info"""
        if proxy in self.proxy_geo_info:
            return self.proxy_geo_info[proxy]
            
        try:
            proxy_url = f"http://{proxy}" if not proxy.startswith('http') else proxy
            async with aiohttp.ClientSession() as session:
                async with session.get('http://ip-api.com/json/', proxy=proxy_url, timeout=aiohttp.ClientTimeout(total=5)) as resp:
                    if resp.status == 200:
                        data = await resp.json()
                        if data.get('status') == 'success':
                            geo_info = {
                                'country': data.get('countryCode', 'UNKNOWN'),
                                'country_full': data.get('country', 'UNKNOWN'),
                                'city': data.get('city', 'UNKNOWN'),
                                'isp': data.get('isp', 'UNKNOWN'),
                                'lat': data.get('lat', 0),
                                'lon': data.get('lon', 0)
                            }
                            self.proxy_geo_info[proxy] = geo_info
                            return geo_info
        except Exception as e:
            logger.debug(f"Geo lookup failed for {proxy}: {e}")
        return None
        
    def is_country_allowed(self, country_code: str) -> bool:
        """🔍 Check if country is allowed (not blocked)"""
        if self.blocked_countries and country_code.upper() in self.blocked_countries:
            return False
        return True
        
    def is_country_preferred(self, country_code: str) -> bool:
        """⭐ Check if country is preferred"""
        if not self.preferred_countries:
            return True
        return country_code.upper() in self.preferred_countries
        
    # ============================================================
    # 🔥 SMART PROXY SELECTION
    # ============================================================
    
    def get_random_proxy(self) -> Optional[str]:
        """Get random working proxy (skips blacklisted)"""
        available = [p for p in self.working_proxies if not self.is_blacklisted(p)]
        if not available:
            return None
        proxy = random.choice(available)
        if proxy in self.proxy_stats:
            self.proxy_stats[proxy]['last_used'] = datetime.now()
        return proxy
        
    def get_fast_proxy(self, max_response_ms: int = 1000) -> Optional[str]:
        """⚡ Get fast proxy only"""
        fast_proxies = []
        for proxy in self.working_proxies:
            if self.is_blacklisted(proxy):
                continue
            stats = self.proxy_stats.get(proxy, {})
            response_time = stats.get('response_time', 9999)
            if response_time < max_response_ms:
                fast_proxies.append(proxy)
        if fast_proxies:
            return random.choice(fast_proxies)
        return self.get_random_proxy()
        
    def get_best_proxy(self) -> Optional[str]:
        """Get proxy with highest success rate"""
        best_proxy = None
        best_score = -1
        for proxy in self.working_proxies:
            if self.is_blacklisted(proxy):
                continue
            stats = self.proxy_stats.get(proxy, {})
            success = stats.get('success_count', 0)
            fail = stats.get('fail_count', 0)
            total = success + fail
            score = (success / total * 100) if total > 0 else 0
            if score > best_score:
                best_score = score
                best_proxy = proxy
        return best_proxy or self.get_random_proxy()
        
    def get_unique_proxy_per_request(self) -> Optional[str]:
        """🔄 New proxy for every request"""
        if not self.working_proxies:
            return None
        available = [p for p in self.working_proxies if not self.is_blacklisted(p)]
        if not available:
            return None
        if self._last_proxy and self._last_proxy in available:
            available = [p for p in available if p != self._last_proxy]
            if available:
                self._last_proxy = random.choice(available)
                return self._last_proxy
        self._last_proxy = random.choice(available)
        return self._last_proxy
        
    def get_next_proxy(self) -> Optional[str]:
        """Get next proxy using round-robin"""
        available = [p for p in self.working_proxies if not self.is_blacklisted(p)]
        if not available:
            return None
        self.current_index = self.current_index % len(available)
        proxy = available[self.current_index]
        self.current_index += 1
        if proxy in self.proxy_stats:
            self.proxy_stats[proxy]['last_used'] = datetime.now()
        return proxy
    
    # ============================================================
    # 🔥 MARK SUCCESS/FAILED
    # ============================================================
    
    def mark_success(self, proxy: str, response_time: float = 0):
        """Mark proxy as successful"""
        if self.is_blacklisted(proxy):
            return
        if proxy in self.proxy_stats:
            self.proxy_stats[proxy]['success_count'] += 1
            if response_time > 0:
                self.proxy_stats[proxy]['response_time'] = response_time
                if response_time < 500:
                    self.proxy_stats[proxy]['speed'] = 'fast'
                elif response_time < 1500:
                    self.proxy_stats[proxy]['speed'] = 'medium'
                else:
                    self.proxy_stats[proxy]['speed'] = 'slow'
        if proxy in self.failed_proxies:
            self.failed_proxies.remove(proxy)
        if proxy not in self.working_proxies:
            self.working_proxies.append(proxy)
            
    def mark_failed(self, proxy: str):
        """Mark proxy as failed"""
        if self.is_blacklisted(proxy):
            return
        if proxy in self.proxy_stats:
            self.proxy_stats[proxy]['fail_count'] += 1
        if proxy in self.working_proxies:
            self.working_proxies.remove(proxy)
        if proxy not in self.failed_proxies:
            self.failed_proxies.append(proxy)
    
    # ============================================================
    # 🔥 PROXY QUALITY CHECK
    # ============================================================
    
    async def check_proxy_quality(self, proxy: str) -> Dict:
        """Check proxy quality, speed, anonymity"""
        result = {'working': False, 'speed': None, 'anonymity': 'unknown', 'response_time': None}
        try:
            start_time = datetime.now()
            proxy_url = f"http://{proxy}" if not proxy.startswith('http') else proxy
            async with aiohttp.ClientSession() as session:
                async with session.get('http://httpbin.org/ip', proxy=proxy_url, timeout=aiohttp.ClientTimeout(total=10)) as response:
                    response_time = (datetime.now() - start_time).total_seconds() * 1000
                    if response.status == 200:
                        result['working'] = True
                        result['response_time'] = response_time
                        result['speed'] = 'fast' if response_time < 500 else 'medium' if response_time < 1500 else 'slow'
                        data = await response.json()
                        if data.get('origin'):
                            result['anonymity'] = 'anonymous'
        except Exception as e:
            logger.debug(f"Proxy check failed: {proxy} - {e}")
        return result
        
    async def check_all_proxies(self) -> Dict:
        """Check all proxies quality"""
        results = {'working': 0, 'failed': 0, 'fast': 0, 'anonymous': 0, 'blacklisted': len(self.blacklisted_proxies)}
        for proxy in self.proxies:
            if self.is_blacklisted(proxy):
                continue
            quality = await self.check_proxy_quality(proxy)
            if quality['working']:
                results['working'] += 1
                if quality['speed'] == 'fast':
                    results['fast'] += 1
                if quality['anonymity'] == 'anonymous':
                    results['anonymous'] += 1
                self.mark_success(proxy, quality['response_time'])
            else:
                results['failed'] += 1
                self.mark_failed(proxy)
        self.last_check_time = datetime.now()
        logger.info(f"Proxy check: {results['working']} working, {results['failed']} failed, {results['blacklisted']} blacklisted")
        return results
    
    # ============================================================
    # 🔥 AUTO-RECHECK DEAD PROXIES
    # ============================================================
    
    async def start_auto_recheck(self, interval_minutes: int = 10):
        """🔄 Auto-recheck dead proxies"""
        self.recheck_task = asyncio.create_task(self._auto_recheck_loop(interval_minutes))
        logger.info(f"🔄 Auto-recheck started - every {interval_minutes} minutes")
        
    async def stop_auto_recheck(self):
        """🛑 Stop auto-recheck"""
        if self.recheck_task:
            self.recheck_task.cancel()
        logger.info("🛑 Auto-recheck stopped")
        
    async def _auto_recheck_loop(self, interval_minutes: int):
        """Auto-recheck loop"""
        while True:
            await asyncio.sleep(interval_minutes * 60)
            logger.info("🔄 Auto-rechecking dead proxies...")
            revived = 0
            for proxy in self.failed_proxies[:]:
                if self.is_blacklisted(proxy):
                    continue
                quality = await self.check_proxy_quality(proxy)
                if quality['working']:
                    self.working_proxies.append(proxy)
                    self.failed_proxies.remove(proxy)
                    revived += 1
                    logger.info(f"✅ Proxy revived: {proxy}")
            if revived > 0:
                logger.info(f"✅ Revived {revived} dead proxies")
            else:
                logger.info("⚠️ No dead proxies revived")
    
    # ============================================================
    # 🔥 STATS
    # ============================================================
    
    def get_stats(self) -> Dict:
        """Get proxy statistics"""
        total_success = sum(s['success_count'] for s in self.proxy_stats.values())
        total_fail = sum(s['fail_count'] for s in self.proxy_stats.values())
        total_uses = total_success + total_fail
        return {
            'total_proxies': len(self.proxies),
            'working_proxies': len([p for p in self.working_proxies if not self.is_blacklisted(p)]),
            'failed_proxies': len(self.failed_proxies),
            'blacklisted_proxies': len(self.blacklisted_proxies),
            'total_uses': total_uses,
            'success_rate': (total_success / total_uses * 100) if total_uses > 0 else 0,
            'last_check': self.last_check_time.isoformat() if self.last_check_time else None
        }

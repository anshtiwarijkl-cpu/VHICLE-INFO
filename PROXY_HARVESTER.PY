# ============================================================
# 🔥 PROXY HARVESTER — ULTIMATE MEGA VERSION
# 👨‍💻 Developer: @Guruji_33
# ============================================================

import asyncio
import aiohttp
import logging
import random
import re
import json
import time
from typing import List, Dict, Optional
from datetime import datetime

logger = logging.getLogger(__name__)

# ============================================================
# 🔥 50 USER-AGENTS FOR ROTATION
# ============================================================

USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 11.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 11.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 11.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/121.0",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/122.0",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:109.0) Gecko/20100101 Firefox/121.0",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15",
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Mobile/15E148 Safari/604.1",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 OPR/106.0.0.0",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Brave/120.0.0.0"
]

# ============================================================
# 🔥 50+ PROXY SOURCES
# ============================================================

PROXY_SOURCES = {
    'github_high': [
        'https://raw.githubusercontent.com/TheSpeedX/PROXY-List/master/http.txt',
        'https://raw.githubusercontent.com/TheSpeedX/PROXY-List/master/socks4.txt',
        'https://raw.githubusercontent.com/TheSpeedX/PROXY-List/master/socks5.txt',
        'https://raw.githubusercontent.com/ShiftyTR/Proxy-List/master/http.txt',
        'https://raw.githubusercontent.com/ShiftyTR/Proxy-List/master/https.txt',
        'https://raw.githubusercontent.com/ShiftyTR/Proxy-List/master/socks4.txt',
        'https://raw.githubusercontent.com/ShiftyTR/Proxy-List/master/socks5.txt',
        'https://raw.githubusercontent.com/monosans/proxy-list/main/proxies/http.txt',
        'https://raw.githubusercontent.com/monosans/proxy-list/main/proxies/https.txt',
        'https://raw.githubusercontent.com/monosans/proxy-list/main/proxies/socks4.txt',
        'https://raw.githubusercontent.com/monosans/proxy-list/main/proxies/socks5.txt',
        'https://raw.githubusercontent.com/jetkai/proxy-list/main/online-proxies/txt/proxies-http.txt',
        'https://raw.githubusercontent.com/jetkai/proxy-list/main/online-proxies/txt/proxies-https.txt',
        'https://raw.githubusercontent.com/jetkai/proxy-list/main/online-proxies/txt/proxies-socks4.txt',
        'https://raw.githubusercontent.com/jetkai/proxy-list/main/online-proxies/txt/proxies-socks5.txt',
        'https://raw.githubusercontent.com/roosterkid/openproxylist/main/HTTPS_RAW.txt',
        'https://raw.githubusercontent.com/roosterkid/openproxylist/main/SOCKS4_RAW.txt',
        'https://raw.githubusercontent.com/roosterkid/openproxylist/main/SOCKS5_RAW.txt',
        'https://raw.githubusercontent.com/prxchk/proxy-list/main/http.txt',
        'https://raw.githubusercontent.com/prxchk/proxy-list/main/https.txt',
        'https://raw.githubusercontent.com/prxchk/proxy-list/main/socks4.txt',
        'https://raw.githubusercontent.com/prxchk/proxy-list/main/socks5.txt',
        'https://raw.githubusercontent.com/hookzof/socks5_list/master/proxy.txt',
        'https://raw.githubusercontent.com/mmpx12/proxy-list/master/http.txt',
        'https://raw.githubusercontent.com/mmpx12/proxy-list/master/https.txt',
        'https://raw.githubusercontent.com/mmpx12/proxy-list/master/socks4.txt',
        'https://raw.githubusercontent.com/mmpx12/proxy-list/master/socks5.txt',
    ],
    'api_sources': [
        'https://api.proxyscrape.com/v2/?request=displayproxies&protocol=http&timeout=10000&country=all&ssl=all&anonymity=all',
        'https://api.proxyscrape.com/v2/?request=displayproxies&protocol=https&timeout=10000&country=all&ssl=all&anonymity=all',
        'https://api.proxyscrape.com/v2/?request=displayproxies&protocol=socks4&timeout=10000&country=all',
        'https://api.proxyscrape.com/v2/?request=displayproxies&protocol=socks5&timeout=10000&country=all',
        'https://proxylist.geonode.com/api/proxy-list?limit=500&page=1&sort_by=lastChecked&sort_type=desc',
        'https://proxylist.geonode.com/api/proxy-list?limit=500&page=2&sort_by=lastChecked&sort_type=desc',
        'https://raw.githubusercontent.com/clamvlad/proxy-list/main/http.txt',
        'https://raw.githubusercontent.com/clamvlad/proxy-list/main/https.txt',
        'https://raw.githubusercontent.com/clamvlad/proxy-list/main/socks4.txt',
        'https://raw.githubusercontent.com/clamvlad/proxy-list/main/socks5.txt',
        'https://raw.githubusercontent.com/sunny9577/proxy-scraper/master/proxies/http.txt',
        'https://raw.githubusercontent.com/sunny9577/proxy-scraper/master/proxies/https.txt',
        'https://raw.githubusercontent.com/sunny9577/proxy-scraper/master/proxies/socks4.txt',
        'https://raw.githubusercontent.com/sunny9577/proxy-scraper/master/proxies/socks5.txt',
        'https://raw.githubusercontent.com/zevtyardt/proxy-list/main/http.txt',
        'https://raw.githubusercontent.com/zevtyardt/proxy-list/main/https.txt',
        'https://raw.githubusercontent.com/zevtyardt/proxy-list/main/socks4.txt',
        'https://raw.githubusercontent.com/zevtyardt/proxy-list/main/socks5.txt',
        'https://raw.githubusercontent.com/opsxcq/proxy-list/master/list.txt',
        'https://raw.githubusercontent.com/UserUnknownFactor/proxy-list/main/http.txt',
        'https://raw.githubusercontent.com/UserUnknownFactor/proxy-list/main/https.txt',
        'https://raw.githubusercontent.com/UserUnknownFactor/proxy-list/main/socks4.txt',
        'https://raw.githubusercontent.com/UserUnknownFactor/proxy-list/main/socks5.txt',
        'https://raw.githubusercontent.com/hookzof/socks5_list/master/proxy.txt',
    ],
    'premium_sources': [
        'https://raw.githubusercontent.com/prxchk/proxy-list/main/premium.txt',
        'https://raw.githubusercontent.com/XaNkro/Premium-Proxies/main/HTTP.txt',
        'https://raw.githubusercontent.com/XaNkro/Premium-Proxies/main/HTTPS.txt',
        'https://raw.githubusercontent.com/XaNkro/Premium-Proxies/main/SOCKS4.txt',
        'https://raw.githubusercontent.com/XaNkro/Premium-Proxies/main/SOCKS5.txt',
    ]
}

class ProxyHarvester:
    """ULTIMATE MEGA Proxy Harvester - 50+ Sources, 50 User-Agents, Concurrent"""
    
    def __init__(self):
        self.proxies = {'http': [], 'https': [], 'socks4': [], 'socks5': [], 'premium': []}
        self.proxy_details = {}
        self.session = None
        self.harvested_count = 0
        
    def _get_random_user_agent(self) -> str:
        return random.choice(USER_AGENTS)
        
    async def init_session(self):
        self.session = aiohttp.ClientSession(
            headers={'User-Agent': self._get_random_user_agent()},
            timeout=aiohttp.ClientTimeout(total=30)
        )
        
    async def close_session(self):
        if self.session:
            await self.session.close()
            
    async def harvest_from_source(self, url: str, source_type: str = "github") -> List[str]:
        try:
            current_ua = self._get_random_user_agent()
            async with self.session.get(url, headers={'User-Agent': current_ua}) as response:
                if response.status == 200:
                    text = await response.text()
                    lines = text.split('\n')
                    proxies = []
                    for line in lines:
                        line = line.strip()
                        if line and not line.startswith('#'):
                            if re.match(r'^(\d{1,3}\.){3}\d{1,3}:\d+$', line):
                                proxies.append(line)
                    return proxies, source_type
        except Exception as e:
            logger.debug(f"Failed: {url[:50]} - {e}")
        return [], source_type
        
    async def harvest_all_concurrent(self) -> Dict[str, List[str]]:
        await self.init_session()
        all_tasks = []
        for source in PROXY_SOURCES['github_high'] + PROXY_SOURCES['api_sources'] + PROXY_SOURCES['premium_sources']:
            all_tasks.append(self.harvest_from_source(source, "github" if "github" in source else "api" if "api" in source else "premium"))
            
        logger.info(f"🚀 Starting concurrent harvest from {len(all_tasks)} sources...")
        results = await asyncio.gather(*all_tasks)
        
        for proxies, source_type in results:
            for proxy in proxies:
                if proxy not in self.proxy_details:
                    self.proxy_details[proxy] = {'source_type': source_type, 'harvested_at': datetime.now().isoformat()}
                self.proxies['http'].append(proxy)
                
        for proxy_type in self.proxies:
            self.proxies[proxy_type] = list(set(self.proxies[proxy_type]))
            self.harvested_count += len(self.proxies[proxy_type])
            
        await self.close_session()
        logger.info(f"✅ Harvest Complete! Total: {self.harvested_count} proxies")
        return self.proxies
        
    def save_proxies(self, filename: str = "proxies.txt"):
        all_proxies = list(set([p for plist in self.proxies.values() for p in plist]))
        with open(filename, 'w') as f:
            for proxy in all_proxies:
                f.write(f"{proxy}\n")
        logger.info(f"✅ Saved {len(all_proxies)} proxies to {filename}")

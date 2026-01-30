/**
 * Rate Limiter Service
 * Tracks requests per IP and enforces rate limits
 */

class RateLimiter {
  constructor(options = {}) {
    this.maxRequests = options.maxRequests || 20; // 20 requests
    this.windowMs = options.windowMs || 60 * 60 * 1000; // per hour (60 minutes)
    this.requests = new Map(); // { ip: [timestamp1, timestamp2, ...] }
  }

  /**
   * Check if request is allowed
   */
  isAllowed(ip) {
    const now = Date.now();
    
    // Get or create request list for this IP
    if (!this.requests.has(ip)) {
      this.requests.set(ip, []);
    }

    const requests = this.requests.get(ip);

    // Remove old requests outside the window
    const validRequests = requests.filter(timestamp => 
      now - timestamp < this.windowMs
    );

    // Check if limit exceeded
    if (validRequests.length >= this.maxRequests) {
      this.requests.set(ip, validRequests);
      return false;
    }

    // Add new request timestamp
    validRequests.push(now);
    this.requests.set(ip, validRequests);

    return true;
  }

  /**
   * Get remaining requests for an IP
   */
  getRemaining(ip) {
    const now = Date.now();
    
    if (!this.requests.has(ip)) {
      return this.maxRequests;
    }

    const requests = this.requests.get(ip);
    const validRequests = requests.filter(timestamp => 
      now - timestamp < this.windowMs
    );

    return Math.max(0, this.maxRequests - validRequests.length);
  }

  /**
   * Get reset time for an IP (in seconds)
   */
  getResetTime(ip) {
    if (!this.requests.has(ip) || this.requests.get(ip).length === 0) {
      return 0;
    }

    const requests = this.requests.get(ip);
    const oldestRequest = requests[0];
    const resetTime = oldestRequest + this.windowMs;
    const secondsUntilReset = Math.ceil((resetTime - Date.now()) / 1000);

    return Math.max(0, secondsUntilReset);
  }

  /**
   * Cleanup old entries
   */
  cleanup() {
    const now = Date.now();
    
    for (const [ip, requests] of this.requests.entries()) {
      const validRequests = requests.filter(timestamp => 
        now - timestamp < this.windowMs
      );

      if (validRequests.length === 0) {
        this.requests.delete(ip);
      } else {
        this.requests.set(ip, validRequests);
      }
    }
  }
}

export default RateLimiter;

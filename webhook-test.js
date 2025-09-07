#!/usr/bin/env node

/**
 * Shopify Webhook Diagnostics Test Script
 * Tests webhook endpoint connectivity and configuration
 */

const https = require('https');
const crypto = require('crypto');

// Configuration
const RAILWAY_WEBHOOK_URL = 'https://shopify-mattress-production.up.railway.app/webhook/orders/create';
const WEBHOOK_SECRET = process.env.SHOPIFY_WEBHOOK_SECRET || 'your-webhook-secret-here';

// Test payload simulating Shopify order
const testOrderPayload = {
  "id": 999999999,
  "email": "test@example.com",
  "created_at": "2025-09-07T12:00:00-04:00",
  "updated_at": "2025-09-07T12:00:00-04:00",
  "number": 9999,
  "note": "Customer notes: Size A: 180cm, Size B: 75cm, Size C: 15cm. Please make this with medium firmness.",
  "token": "test-token",
  "gateway": "manual",
  "test": true,
  "total_price": "199.00",
  "subtotal_price": "199.00",
  "total_weight": 0,
  "total_tax": "0.00",
  "taxes_included": false,
  "currency": "GBP",
  "financial_status": "paid",
  "confirmed": true,
  "total_discounts": "0.00",
  "buyer_accepts_marketing": true,
  "name": "#TEST9999",
  "referring_site": "",
  "landing_site": "/",
  "cancelled_at": null,
  "cancel_reason": null,
  "total_price_usd": "199.00",
  "checkout_token": "test-checkout-token",
  "reference": null,
  "user_id": null,
  "location_id": null,
  "source_identifier": null,
  "source_url": null,
  "processed_at": "2025-09-07T12:00:00-04:00",
  "device_id": null,
  "phone": null,
  "customer_locale": "en",
  "app_id": null,
  "browser_ip": "192.168.1.1",
  "landing_site_ref": null,
  "order_number": 9999,
  "discount_applications": [],
  "discount_codes": [],
  "note_attributes": [],
  "payment_gateway_names": ["manual"],
  "processing_method": "manual",
  "checkout_id": null,
  "source_name": "web",
  "fulfillment_status": null,
  "tax_lines": [],
  "tags": "",
  "contact_email": "test@example.com",
  "order_status_url": "https://test-store.myshopify.com/account/orders/test",
  "presentment_currency": "GBP",
  "total_line_items_price": "199.00",
  "total_discounts_set": {
    "shop_money": {"amount": "0.00", "currency_code": "GBP"},
    "presentment_money": {"amount": "0.00", "currency_code": "GBP"}
  },
  "total_shipping_price_set": {
    "shop_money": {"amount": "0.00", "currency_code": "GBP"},
    "presentment_money": {"amount": "0.00", "currency_code": "GBP"}
  },
  "billing_address": {
    "first_name": "Test",
    "address1": "123 Test Street",
    "phone": "+44 123 456 7890",
    "city": "West Bromwich",
    "zip": "B70 0AB",
    "province": "West Midlands",
    "country": "United Kingdom",
    "last_name": "Customer",
    "address2": "",
    "company": null,
    "latitude": null,
    "longitude": null,
    "name": "Test Customer",
    "country_code": "GB",
    "province_code": "GB-WMD"
  },
  "shipping_address": {
    "first_name": "Test",
    "address1": "123 Test Street",
    "phone": "+44 123 456 7890",
    "city": "West Bromwich",
    "zip": "B70 0AB",
    "province": "West Midlands",
    "country": "United Kingdom",
    "last_name": "Customer",
    "address2": "",
    "company": null,
    "latitude": null,
    "longitude": null,
    "name": "Test Customer",
    "country_code": "GB",
    "province_code": "GB-WMD"
  },
  "line_items": [
    {
      "id": 999999999,
      "variant_id": 999999999,
      "title": "Custom Caravan Mattress",
      "quantity": 1,
      "sku": "CARAVAN-CUSTOM-001",
      "variant_title": "Custom Size - Medium Firmness",
      "vendor": "Caravan Mattresses",
      "fulfillment_service": "manual",
      "product_id": 999999999,
      "requires_shipping": true,
      "taxable": true,
      "gift_card": false,
      "name": "Custom Caravan Mattress - Custom Size - Medium Firmness",
      "variant_inventory_management": "shopify",
      "properties": [
        {"name": "A", "value": "180"},
        {"name": "B", "value": "75"},
        {"name": "C", "value": "15"},
        {"name": "Firmness", "value": "Medium"},
        {"name": "Cover Material", "value": "Standard"}
      ],
      "product_exists": true,
      "fulfillable_quantity": 1,
      "grams": 15000,
      "price": "199.00",
      "total_discount": "0.00",
      "fulfillment_status": null,
      "price_set": {
        "shop_money": {"amount": "199.00", "currency_code": "GBP"},
        "presentment_money": {"amount": "199.00", "currency_code": "GBP"}
      },
      "total_discount_set": {
        "shop_money": {"amount": "0.00", "currency_code": "GBP"},
        "presentment_money": {"amount": "0.00", "currency_code": "GBP"}
      },
      "discount_allocations": [],
      "duties": [],
      "admin_graphql_api_id": "gid://shopify/LineItem/999999999",
      "tax_lines": []
    }
  ],
  "fulfillments": [],
  "refunds": [],
  "total_tip_received": "0.0",
  "original_total_duties_set": null,
  "current_total_duties_set": null,
  "admin_graphql_api_id": "gid://shopify/Order/999999999",
  "shipping_lines": [
    {
      "id": 999999999,
      "title": "Standard Shipping",
      "price": "0.00",
      "code": "STANDARD",
      "source": "shopify",
      "phone": null,
      "requested_fulfillment_service_id": null,
      "delivery_category": null,
      "carrier_identifier": null,
      "discounted_price": "0.00",
      "price_set": {
        "shop_money": {"amount": "0.00", "currency_code": "GBP"},
        "presentment_money": {"amount": "0.00", "currency_code": "GBP"}
      },
      "discounted_price_set": {
        "shop_money": {"amount": "0.00", "currency_code": "GBP"},
        "presentment_money": {"amount": "0.00", "currency_code": "GBP"}
      },
      "discount_allocations": [],
      "tax_lines": []
    }
  ],
  "client_details": {
    "browser_ip": "192.168.1.1",
    "accept_language": "en-GB,en;q=0.9",
    "user_agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "session_hash": null,
    "browser_width": 1920,
    "browser_height": 1080
  },
  "customer": {
    "id": 999999999,
    "email": "test@example.com",
    "accepts_marketing": true,
    "created_at": "2025-09-07T12:00:00-04:00",
    "updated_at": "2025-09-07T12:00:00-04:00",
    "first_name": "Test",
    "last_name": "Customer",
    "orders_count": 1,
    "state": "enabled",
    "total_spent": "199.00",
    "last_order_id": 999999999,
    "note": null,
    "verified_email": true,
    "multipass_identifier": null,
    "tax_exempt": false,
    "phone": "+44 123 456 7890",
    "tags": "",
    "last_order_name": "#TEST9999",
    "currency": "GBP",
    "accepts_marketing_updated_at": "2025-09-07T12:00:00-04:00",
    "marketing_opt_in_level": "single_opt_in",
    "tax_exemptions": [],
    "admin_graphql_api_id": "gid://shopify/Customer/999999999",
    "default_address": {
      "id": 999999999,
      "customer_id": 999999999,
      "first_name": "Test",
      "last_name": "Customer",
      "company": null,
      "address1": "123 Test Street",
      "address2": "",
      "city": "West Bromwich",
      "province": "West Midlands",
      "country": "United Kingdom",
      "zip": "B70 0AB",
      "phone": "+44 123 456 7890",
      "name": "Test Customer",
      "province_code": "GB-WMD",
      "country_code": "GB",
      "country_name": "United Kingdom",
      "default": true
    }
  }
};

console.log('🔧 Shopify Webhook Diagnostics Test Script');
console.log('==========================================\n');

// Function to generate HMAC signature
function generateHMAC(data, secret) {
  return crypto
    .createHmac('sha256', secret)
    .update(data, 'utf8')
    .digest('base64');
}

// Function to test webhook endpoint
function testWebhookEndpoint() {
  return new Promise((resolve, reject) => {
    console.log('📡 Testing webhook endpoint connectivity...');
    console.log(`URL: ${RAILWAY_WEBHOOK_URL}\n`);

    const payload = JSON.stringify(testOrderPayload);
    const hmac = generateHMAC(payload, WEBHOOK_SECRET);
    
    console.log(`🔐 Generated HMAC: ${hmac}`);
    console.log(`📝 Payload size: ${payload.length} characters\n`);

    const options = {
      hostname: new URL(RAILWAY_WEBHOOK_URL).hostname,
      port: 443,
      path: new URL(RAILWAY_WEBHOOK_URL).pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
        'X-Shopify-Hmac-Sha256': hmac,
        'X-Shopify-Shop-Domain': 'd587eb.myshopify.com',
        'X-Shopify-Topic': 'orders/create',
        'X-Shopify-API-Version': '2024-10',
        'User-Agent': 'Shopify/1.0'
      }
    };

    console.log('📤 Sending POST request with headers:');
    Object.entries(options.headers).forEach(([key, value]) => {
      console.log(`   ${key}: ${value}`);
    });
    console.log();

    const startTime = Date.now();
    
    const req = https.request(options, (res) => {
      const responseTime = Date.now() - startTime;
      let responseBody = '';

      res.on('data', (chunk) => {
        responseBody += chunk;
      });

      res.on('end', () => {
        console.log('📨 Response received:');
        console.log(`   Status: ${res.statusCode} ${res.statusMessage}`);
        console.log(`   Response time: ${responseTime}ms`);
        console.log(`   Headers:`);
        Object.entries(res.headers).forEach(([key, value]) => {
          console.log(`      ${key}: ${value}`);
        });
        
        if (responseBody) {
          console.log(`   Body: ${responseBody}`);
        }
        console.log();

        // Evaluate response
        if (res.statusCode >= 200 && res.statusCode < 300) {
          console.log('✅ SUCCESS: Webhook endpoint is responding correctly!');
          if (responseTime < 5000) {
            console.log('✅ Response time within Shopify\'s 5-second limit');
          } else {
            console.log('⚠️  WARNING: Response time exceeds 5 seconds - may cause Shopify timeouts');
          }
        } else {
          console.log(`❌ ERROR: HTTP ${res.statusCode} response`);
        }

        resolve({
          statusCode: res.statusCode,
          responseTime,
          headers: res.headers,
          body: responseBody
        });
      });
    });

    req.on('error', (error) => {
      const responseTime = Date.now() - startTime;
      console.log(`❌ ERROR: Connection failed after ${responseTime}ms`);
      console.log(`   Error: ${error.message}`);
      console.log();
      
      reject(error);
    });

    req.on('timeout', () => {
      console.log('❌ ERROR: Request timeout (>30 seconds)');
      req.destroy();
      reject(new Error('Request timeout'));
    });

    req.setTimeout(30000); // 30 second timeout
    req.write(payload);
    req.end();
  });
}

// Function to test basic connectivity
function testBasicConnectivity() {
  return new Promise((resolve, reject) => {
    console.log('🌐 Testing basic HTTPS connectivity...');
    
    const options = {
      hostname: new URL(RAILWAY_WEBHOOK_URL).hostname,
      port: 443,
      path: '/',
      method: 'GET',
      timeout: 10000
    };

    const req = https.request(options, (res) => {
      console.log(`✅ Basic connectivity: HTTP ${res.statusCode}`);
      console.log(`   Server: ${res.headers.server || 'Unknown'}`);
      console.log();
      resolve(res.statusCode);
    });

    req.on('error', (error) => {
      console.log(`❌ Basic connectivity failed: ${error.message}`);
      console.log();
      reject(error);
    });

    req.end();
  });
}

// Function to validate environment
function validateEnvironment() {
  console.log('🔍 Environment validation...');
  
  if (!WEBHOOK_SECRET || WEBHOOK_SECRET === 'your-webhook-secret-here') {
    console.log('⚠️  WARNING: SHOPIFY_WEBHOOK_SECRET not set or using default value');
    console.log('   Set environment variable: export SHOPIFY_WEBHOOK_SECRET=your-actual-secret');
  } else {
    console.log('✅ Webhook secret configured');
  }
  
  console.log(`📍 Target URL: ${RAILWAY_WEBHOOK_URL}`);
  console.log();
}

// Main execution
async function runDiagnostics() {
  try {
    validateEnvironment();
    
    await testBasicConnectivity();
    
    const result = await testWebhookEndpoint();
    
    console.log('🎯 Diagnostic Summary:');
    console.log('=====================');
    
    if (result.statusCode >= 200 && result.statusCode < 300) {
      console.log('✅ Webhook endpoint is accessible and responding');
      console.log('✅ HTTPS connectivity working');
      console.log('✅ Request/response cycle completed successfully');
      console.log();
      console.log('🔍 Next steps if webhooks still not working:');
      console.log('   1. Check Shopify webhook delivery logs in Partner Dashboard');
      console.log('   2. Verify webhook is registered in Shopify store admin');
      console.log('   3. Ensure webhook secret matches between Shopify and Railway');
      console.log('   4. Monitor Railway logs during live order placement');
    } else {
      console.log('❌ Webhook endpoint issues detected');
      console.log('🔧 Troubleshooting steps:');
      console.log('   1. Check Railway deployment status');
      console.log('   2. Verify webhook route is properly configured');
      console.log('   3. Check Railway environment variables');
      console.log('   4. Review Railway application logs for errors');
    }
    
  } catch (error) {
    console.log('💥 Diagnostic failed:');
    console.log(`   ${error.message}`);
    console.log();
    console.log('🔧 Immediate actions:');
    console.log('   1. Verify Railway app is deployed and running');
    console.log('   2. Check DNS resolution for your Railway domain');
    console.log('   3. Confirm firewall/network allows outbound HTTPS');
  }
}

// Run the diagnostics
runDiagnostics();
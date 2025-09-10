// Main Product Mapping Coordinator
// File: routes/product-mapping.js

const express = require('express');
const router = express.Router();

// Import individual mattress mapping modules
const essentialMapping = require('./mappings/essential-mapping');
const comfisanMapping = require('./mappings/comfisan-mapping');
const novolatexMapping = require('./mappings/novolatex-mapping');
const bodyshapeMapping = require('./mappings/bodyshape-mapping');
const coolplusMapping = require('./mappings/coolplus-mapping');
const grandcrescentMapping = require('./mappings/grandcrescent-mapping');
const imperialeliteMapping = require('./mappings/imperialelite-mapping');
const bodyshapeTopperMapping = require('./mappings/bodyshape-topper-mapping');
const coolplusTopperMapping = require('./mappings/coolplus-topper-mapping');

// ============================================================================
// MAIN MAPPING REGISTRY
// ============================================================================

const MATTRESS_MAPPINGS = {
  // IMPORTANT: Order matters! Toppers must be checked BEFORE regular mattresses
  // to prevent "Bodyshape Topper" from being detected as just "Bodyshape"
  'Bodyshape Topper': {
    module: bodyshapeTopperMapping,
    detector: bodyshapeTopperMapping.isBodyshapeTopper,
    mapper: bodyshapeTopperMapping.mapBodyshapeTopper,
    active: true
  },
  'Coolplus Topper': {
    module: coolplusTopperMapping,
    detector: coolplusTopperMapping.isCoolplusTopper,
    mapper: coolplusTopperMapping.mapCoolplusTopper,
    active: true
  },
  // Regular mattresses (checked after toppers)
  'Essential': {
    module: essentialMapping,
    detector: essentialMapping.isEssentialMattress,
    mapper: essentialMapping.mapEssentialMattress,
    active: true
  },
  'Comfisan': {
    module: comfisanMapping,
    detector: comfisanMapping.isComfisanMattress,
    mapper: comfisanMapping.mapComfisanMattress,
    active: true
  },
  'Novolatex': {
    module: novolatexMapping,
    detector: novolatexMapping.isNovolatexMattress,
    mapper: novolatexMapping.mapNovolatexMattress,
    active: true
  },
  'Bodyshape': {
    module: bodyshapeMapping,
    detector: bodyshapeMapping.isBodyshapeMattress,
    mapper: bodyshapeMapping.mapBodyshapeMattress,
    active: true
  },
  'Coolplus': {
    module: coolplusMapping,
    detector: coolplusMapping.isCoolplusMattress,
    mapper: coolplusMapping.mapCoolplusMattress,
    active: true
  },
  'Grand Crescent': {
    module: grandcrescentMapping,
    detector: grandcrescentMapping.isGrandCrescentMattress,
    mapper: grandcrescentMapping.mapGrandCrescentMattress,
    active: true
  },
  'Imperial Elite': {
    module: imperialeliteMapping,
    detector: imperialeliteMapping.isImperialEliteMattress,
    mapper: imperialeliteMapping.mapImperialEliteMattress,
    active: true
  }
};

// ============================================================================
// MAIN MAPPING FUNCTIONS - FIXED TO USE SKU PREFIX
// ============================================================================

/**
 * Detect which mattress type a product is
 * FIXED: Now properly checks SKU prefix as primary method
 */
function detectMattressType(productTitle, shopifySku = null, handle = null) {
  console.log(`Detecting mattress type for: ${productTitle}, SKU: ${shopifySku || 'Not provided'}`);
  
  for (const [mattressType, config] of Object.entries(MATTRESS_MAPPINGS)) {
    if (config.active && config.detector(productTitle, shopifySku, handle)) {
      console.log(`Detected mattress type: ${mattressType}`);
      return mattressType;
    }
  }
  
  console.log('No mattress type detected');
  return null;
}

/**
 * Main product mapping function - routes to appropriate mattress mapper
 * FIXED: Now properly passes SKU through the detection chain
 */
function mapProduct(productTitle, productVariant = null, productProperties = null, shopifySku = null, handle = null) {
  console.log(`\n=== MAIN PRODUCT MAPPING ===`);
  console.log(`Product: ${productTitle}`);
  console.log(`SKU: ${shopifySku || 'Not provided'}`);
  
  try {
    // 1. Detect mattress type (now passes SKU)
    const mattressType = detectMattressType(productTitle, shopifySku, handle);
    
    if (!mattressType) {
      return {
        success: false,
        error: 'Could not detect mattress type',
        confidence: 0,
        availableTypes: Object.keys(MATTRESS_MAPPINGS).filter(type => MATTRESS_MAPPINGS[type].active)
      };
    }

    // 2. Get the appropriate mapper
    const mappingConfig = MATTRESS_MAPPINGS[mattressType];
    
    if (!mappingConfig || !mappingConfig.active) {
      return {
        success: false,
        error: `Mattress type '${mattressType}' mapping not available`,
        confidence: 0
      };
    }

    // 3. Route to specific mattress mapper
    console.log(`Routing to ${mattressType} mapper...`);
    const result = mappingConfig.mapper(productTitle, productVariant, productProperties, shopifySku);
    
    // 4. Add routing information to result
    if (result.success) {
      result.routingInfo = {
        detectedType: mattressType,
        mapperUsed: `${mattressType.toLowerCase()}-mapping.js`,
        timestamp: new Date().toISOString()
      };
    }

    return result;

  } catch (error) {
    console.error('Main mapping error:', error);
    return {
      success: false,
      error: `Mapping failed: ${error.message}`,
      confidence: 0
    };
  }
}

// ============================================================================
// API ROUTES
// ============================================================================

/**
 * POST /api/mapping/parse - Main mapping endpoint
 */
router.post('/parse', async (req, res) => {
  try {
    const { productTitle, title, productVariant, productProperties, shopifySku, sku, handle } = req.body;
    
    // Handle different parameter names
    const finalTitle = productTitle || title;
    const finalSku = shopifySku || sku;
    
    if (!finalTitle) {
      return res.status(400).json({ 
        success: false,
        error: 'Product title is required' 
      });
    }

    // Map the product
    const result = mapProduct(finalTitle, productVariant, productProperties, finalSku, handle);
    
    res.json({
      success: result.success,
      mapping: result,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('API mapping error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to process product mapping' 
    });
  }
});

/**
 * GET /api/mapping/types - Get available mattress types
 */
router.get('/types', (req, res) => {
  try {
    const types = Object.keys(MATTRESS_MAPPINGS).filter(type => MATTRESS_MAPPINGS[type].active);
    res.json({
      success: true,
      availableTypes: types,
      count: types.length
    });
  } catch (error) {
    console.error('Error getting mattress types:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to get mattress types' 
    });
  }
});

/**
 * POST /api/mapping/test - Test mapping with order-like data
 */
router.post('/test', async (req, res) => {
  try {
    const { order_number, line_items } = req.body;
    
    if (!line_items || !Array.isArray(line_items) || line_items.length === 0) {
      return res.status(400).json({ 
        success: false,
        error: 'line_items array is required' 
      });
    }

    const results = [];
    
    for (const item of line_items) {
      const result = mapProduct(
        item.title,
        { title: item.variant_title },
        item.properties,
        item.sku,
        null
      );
      
      results.push({
        title: item.title,
        sku: item.sku,
        mapping: result
      });
    }
    
    res.json({
      success: true,
      order_number: order_number || 'TEST',
      results,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Test mapping error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to test product mapping' 
    });
  }
});

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
  router,
  
  // Main functions
  mapProduct,
  detectMattressType,
  
  // Registry (for adding new mattress types)
  MATTRESS_MAPPINGS,
  
  // System info
  version: '1.0.0',
  lastUpdated: new Date().toISOString()
};
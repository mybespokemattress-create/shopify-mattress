// Coolplus Mattress Mapping System
// File: routes/mappings/coolplus-mapping.js

// ============================================================================
// COOLPLUS MATTRESS SPECIFICATION TABLE
// ============================================================================

const COOLPLUS_SPECS = {
  mattressType: 'Coolplus',
  skuPrefix: 'Cool',
  
  // Coolplus has three firmness options
  firmnessOptions: ['Medium firm', 'Firm Orthopaedic', 'Hard'],
  
  // Complex 3-layer structure: Base + Middle + Top + Cover (similar pattern but different materials)
  specifications: {
    '6': {
      'Medium firm': {
        depth: '6" inch / 15cm - Standard support',
        firmness: 'Medium firm',
        baseLayer: '1" 33/175 Blue Base Layer',
        middleLayer: '3" 30/130 White Middle Layer',
        topLayer: '2" FR50/125 Top Layer',
        cover: 'Coolplus Cover'
      },
      'Firm Orthopaedic': {
        depth: '6" inch / 15cm - Standard support',
        firmness: 'Firm Orthopaedic',
        baseLayer: '2" 33/175 Blue Base Layer',
        middleLayer: '3" 30/130 White Middle Layer',
        topLayer: '1" FR50/125 Top Layer',
        cover: 'Coolplus Cover'
      },
      'Hard': {
        depth: '6" inch / 15cm - Standard support',
        firmness: 'Hard',
        baseLayer: '4" 33/175 Blue Base Layer',
        middleLayer: '1" 30/130 White Middle Layer',
        topLayer: '1" FR50/125 Top Layer',
        cover: 'Coolplus Cover'
      }
    },
    '8': {
      'Medium firm': {
        depth: '8" inch / 20cm - Premium support',
        firmness: 'Medium firm',
        baseLayer: '1" 33/175 Blue Base Layer',
        middleLayer: '5" 30/130 White Middle Layer',
        topLayer: '2" FR50/125 Top Layer',
        cover: 'Coolplus Cover'
      },
      'Firm Orthopaedic': {
        depth: '8" inch / 20cm - Premium support',
        firmness: 'Firm Orthopaedic',
        baseLayer: '2" 33/175 Blue Base Layer',
        middleLayer: '5" 30/130 White Middle Layer',
        topLayer: '1" FR50/125 Top Layer',
        cover: 'Coolplus Cover'
      },
      'Hard': {
        depth: '8" inch / 20cm - Premium support',
        firmness: 'Hard',
        baseLayer: '6" 33/175 Blue Base Layer',
        middleLayer: '1" 30/130 White Middle Layer',
        topLayer: '1" FR50/125 Top Layer',
        cover: 'Coolplus Cover'
      }
    },
    '10': {
      'Medium firm': {
        depth: '10" inch / 25cm - Luxury support',
        firmness: 'Medium firm',
        baseLayer: '1" 33/175 Blue Base Layer',
        middleLayer: '7" 30/130 White Middle Layer',
        topLayer: '2" FR50/125 Top Layer',
        cover: 'Coolplus Cover'
      },
      'Firm Orthopaedic': {
        depth: '10" inch / 25cm - Luxury support',
        firmness: 'Firm Orthopaedic',
        baseLayer: '2" 33/175 Blue Base Layer',
        middleLayer: '7" 30/130 White Middle Layer',
        topLayer: '1" FR50/125 Top Layer',
        cover: 'Coolplus Cover'
      },
      'Hard': {
        depth: '10" inch / 25cm - Luxury support',
        firmness: 'Hard',
        baseLayer: '8" 33/175 Blue Base Layer',
        middleLayer: '1" 30/130 White Middle Layer',
        topLayer: '1" FR50/125 Top Layer',
        cover: 'Coolplus Cover'
      }
    }
  }
};

// ============================================================================
// COOLPLUS MATTRESS DETECTION - FIXED TO USE SKU PREFIX
// ============================================================================

/**
 * Check if product is a Coolplus mattress
 * FIXED: Now checks SKU prefix first as primary method
 */
function isCoolplusMattress(productTitle, shopifySku = null, handle = null) {
  // PRIMARY METHOD: Check SKU prefix
  if (shopifySku) {
    const skuLower = shopifySku.toLowerCase();
    if (skuLower.startsWith('cool')) {
      console.log(`[Coolplus] Detected via SKU prefix: ${shopifySku}`);
      return true;
    }
  }
  
  // FALLBACK METHOD: Check product title
  const title = productTitle.toLowerCase();
  const handleText = handle ? handle.toLowerCase() : '';
  
  const titleMatch = title.includes('coolplus') || 
                    title.includes('cool plus') || 
                    handleText.includes('coolplus') || 
                    handleText.includes('cool plus');
  
  if (titleMatch) {
    console.log(`[Coolplus] Detected via title: ${productTitle}`);
    return true;
  }
  
  return false;
}

// ============================================================================
// COOLPLUS MATTRESS PARSING
// ============================================================================

/**
 * Extract thickness from Coolplus mattress product data
 */
function extractThickness(productTitle, productVariant = null, productProperties = null) {
  console.log(`[Coolplus] Extracting thickness from: ${productTitle}`);
  
  // Thickness patterns to look for
  const patterns = [
    /(\d+)"\s*inch/i,
    /(\d+)\s*inch/i,
    /(\d+)"/i,
    /(\d+)cm/i
  ];

  // Check product title
  for (const pattern of patterns) {
    const match = productTitle.match(pattern);
    if (match) {
      const thickness = match[1];
      if (COOLPLUS_SPECS.specifications[thickness]) {
        console.log(`[Coolplus] Found valid thickness in title: ${thickness}"`);
        return thickness;
      }
    }
  }

  // Check variant title
  if (productVariant && productVariant.title) {
    for (const pattern of patterns) {
      const match = productVariant.title.match(pattern);
      if (match) {
        const thickness = match[1];
        if (COOLPLUS_SPECS.specifications[thickness]) {
          console.log(`[Coolplus] Found valid thickness in variant: ${thickness}"`);
          return thickness;
        }
      }
    }
  }

  // Check properties
  if (productProperties && Array.isArray(productProperties)) {
    for (const prop of productProperties) {
      if (prop.name && prop.name.toLowerCase().includes('thickness')) {
        const match = prop.value.match(/(\d+)/);
        if (match && COOLPLUS_SPECS.specifications[match[1]]) {
          console.log(`[Coolplus] Found thickness in properties: ${match[1]}"`);
          return match[1];
        }
      }
    }
  }

  console.log(`[Coolplus] No thickness found, defaulting to 6"`);
  return '6'; // Default thickness
}

/**
 * Extract firmness from Coolplus mattress product data
 */
function extractFirmness(productTitle, productVariant = null, productProperties = null) {
  console.log(`[Coolplus] Extracting firmness from product data`);
  
  // Check properties first (most reliable for Shopify orders)
  if (productProperties && Array.isArray(productProperties)) {
    for (const prop of productProperties) {
      if (prop.name && prop.name.toLowerCase().includes('firmness')) {
        const firmness = prop.value;
        if (COOLPLUS_SPECS.firmnessOptions.includes(firmness)) {
          console.log(`[Coolplus] Found firmness in properties: ${firmness}`);
          return firmness;
        }
      }
    }
  }

  // Check variant title
  if (productVariant && productVariant.title) {
    const variantLower = productVariant.title.toLowerCase();
    
    if (variantLower.includes('firm orthopaedic') || variantLower.includes('firm orthopedic')) {
      console.log(`[Coolplus] Found firmness in variant: Firm Orthopaedic`);
      return 'Firm Orthopaedic';
    }
    if (variantLower.includes('hard')) {
      console.log(`[Coolplus] Found firmness in variant: Hard`);
      return 'Hard';
    }
    if (variantLower.includes('medium firm') || variantLower.includes('medium-firm')) {
      console.log(`[Coolplus] Found firmness in variant: Medium firm`);
      return 'Medium firm';
    }
  }

  // Check product title
  const titleLower = productTitle.toLowerCase();
  if (titleLower.includes('firm orthopaedic') || titleLower.includes('firm orthopedic')) {
    console.log(`[Coolplus] Found firmness in title: Firm Orthopaedic`);
    return 'Firm Orthopaedic';
  }
  if (titleLower.includes('hard')) {
    console.log(`[Coolplus] Found firmness in title: Hard`);
    return 'Hard';
  }
  if (titleLower.includes('medium firm') || titleLower.includes('medium-firm')) {
    console.log(`[Coolplus] Found firmness in title: Medium firm`);
    return 'Medium firm';
  }

  console.log(`[Coolplus] No firmness found, defaulting to Medium firm`);
  return 'Medium firm'; // Default firmness
}

// ============================================================================
// COOLPLUS MATTRESS SPECIFICATION GENERATION
// ============================================================================

/**
 * Generate supplier specification for Coolplus mattress
 */
function generateSpecification(thickness, firmness) {
  console.log(`[Coolplus] Generating specification for ${thickness}" ${firmness}`);
  
  const spec = COOLPLUS_SPECS.specifications[thickness]?.[firmness];
  
  if (!spec) {
    console.error(`[Coolplus] No specification found for ${thickness}" ${firmness}`);
    return null;
  }

  // Format: [Base Layer] + [Middle Layer] + [Top Layer] + [Cover]
  const fullSpecification = `${spec.baseLayer} + ${spec.middleLayer} + ${spec.topLayer} + ${spec.cover}`;
  
  const result = {
    mattressType: 'Coolplus',
    thickness: thickness,
    firmness: firmness,
    depth: spec.depth,
    baseLayer: spec.baseLayer,
    middleLayer: spec.middleLayer,
    topLayer: spec.topLayer,
    cover: spec.cover,
    fullSpecification: fullSpecification,
    confidence: 95 // High confidence - clear specification table
  };

  console.log(`[Coolplus] Generated: ${fullSpecification}`);
  return result;
}

// ============================================================================
// MAIN MAPPING FUNCTION - FIXED TO USE SKU
// ============================================================================

/**
 * Main mapping function for Coolplus mattress
 * FIXED: Now properly uses SKU parameter
 */
function mapCoolplusMattress(productTitle, productVariant = null, productProperties = null, shopifySku = null) {
  console.log(`\n=== MAPPING COOLPLUS MATTRESS ===`);
  console.log(`Product: ${productTitle}`);
  console.log(`SKU: ${shopifySku || 'Not provided'}`);
  
  try {
    // 1. Verify this is a Coolplus mattress (now uses SKU)
    if (!isCoolplusMattress(productTitle, shopifySku)) {
      return {
        success: false,
        error: 'Product is not a Coolplus mattress',
        confidence: 0
      };
    }

    // 2. Extract thickness and firmness
    const thickness = extractThickness(productTitle, productVariant, productProperties);
    const firmness = extractFirmness(productTitle, productVariant, productProperties);
    
    // 3. Generate specification
    const specification = generateSpecification(thickness, firmness);
    
    if (!specification) {
      return {
        success: false,
        error: 'Could not generate Coolplus mattress specification',
        confidence: 0
      };
    }

    // 4. Return successful mapping
    return {
      success: true,
      mattressType: 'Coolplus',
      specification: specification,
      confidence: specification.confidence,
      debugInfo: {
        extractedThickness: thickness,
        extractedFirmness: firmness,
        availableThicknesses: Object.keys(COOLPLUS_SPECS.specifications),
        availableFirmness: COOLPLUS_SPECS.firmnessOptions,
        matchedSpec: COOLPLUS_SPECS.specifications[thickness]?.[firmness]
      }
    };

  } catch (error) {
    console.error(`[Coolplus] Mapping error:`, error);
    return {
      success: false,
      error: `Coolplus mapping failed: ${error.message}`,
      confidence: 0
    };
  }
}

// ============================================================================
// TESTING FUNCTIONS
// ============================================================================

/**
 * Test Coolplus mattress mapping with various inputs
 */
function testMapping() {
  console.log('\n=== TESTING COOLPLUS MATTRESS MAPPING ===\n');
  
  const testCases = [
    {
      name: 'CoolpS31 - SKU prefix detection',
      title: 'Coolplus Narrow Right Curved Corner Caravan Mattress - Single',
      sku: 'CoolpS31',
      variant: null,
      properties: [{ name: 'Firmness', value: 'Hard' }],
      expected: '4" 33/175 Blue Base Layer + 1" 30/130 White Middle Layer + 1" FR50/125 Top Layer + Coolplus Cover'
    },
    {
      name: 'Coolplus 6" Medium firm',
      title: 'Coolplus Narrow Right Cut Out Caravan Mattress - Single',
      sku: 'Cool123',
      variant: { title: '6" inch / 15cm - Standard support' },
      properties: [{ name: 'Firmness', value: 'Medium firm' }],
      expected: '1" 33/175 Blue Base Layer + 3" 30/130 White Middle Layer + 2" FR50/125 Top Layer + Coolplus Cover'
    },
    {
      name: 'Coolplus 8" Firm Orthopaedic',
      title: 'Coolplus Rectangle Mattress - Double',
      sku: 'Cool456',
      variant: { title: '8" inch / 20cm - Premium support' },
      properties: [{ name: 'Firmness', value: 'Firm Orthopaedic' }],
      expected: '2" 33/175 Blue Base Layer + 5" 30/130 White Middle Layer + 1" FR50/125 Top Layer + Coolplus Cover'
    }
  ];

  testCases.forEach((testCase, index) => {
    console.log(`--- Test ${index + 1}: ${testCase.name} ---`);
    
    const result = mapCoolplusMattress(testCase.title, testCase.variant, testCase.properties, testCase.sku);
    
    if (result.success) {
      const match = result.specification.fullSpecification === testCase.expected;
      console.log(`Result: ${result.specification.fullSpecification}`);
      console.log(`Expected: ${testCase.expected}`);
      console.log(`${match ? '✅' : '❌'} Match: ${match ? 'YES' : 'NO'}`);
      console.log(`Confidence: ${result.confidence}%`);
      console.log(`Thickness: ${result.debugInfo.extractedThickness}"`);
      console.log(`Firmness: ${result.debugInfo.extractedFirmness}`);
    } else {
      console.log(`❌ Error: ${result.error}`);
    }
    console.log('');
  });
}

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
  // Main functions
  isCoolplusMattress,
  mapCoolplusMattress,
  
  // Helper functions  
  extractThickness,
  extractFirmness,
  generateSpecification,
  
  // Testing
  testMapping,
  
  // Configuration
  COOLPLUS_SPECS,
  
  // Metadata
  mattressType: 'Coolplus',
  version: '1.0.0',
  lastUpdated: new Date().toISOString()
};

// Auto-run tests if file executed directly
if (require.main === module) {
  testMapping();
}
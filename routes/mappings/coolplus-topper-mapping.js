// Coolplus Mattress Topper Mapping System
// File: routes/mappings/coolplus-topper-mapping.js

// ============================================================================
// COOLPLUS TOPPER SPECIFICATION TABLE
// ============================================================================

const COOLPLUS_TOPPER_SPECS = {
  mattressType: 'Coolplus Topper',
  skuPrefix: 'CoolT',
  
  // Coolplus Toppers have two firmness options
  firmnessOptions: ['Medium', 'Medium'],
  
  // Simple structure: FR50/125 layer + attachment straps + cover (only 2" and 3" available)
  specifications: {
    '2': {
      'Medium': {
        depth: '2" inch / 5cm - Regular comfort',
        firmness: 'Medium',
        supplierCode: '2" FR50/125 + Two Luggage Straps + Elastic Straps on 90° Corners',
        cover: 'Coolplus Cover'
      }
    },
    '3': {
      'Medium': {
        depth: '3" inch / 7.5cm - Luxury comfort',
        firmness: 'Medium',
        supplierCode: '3" FR50/125 + Two Luggage Straps + Elastic Straps on 90° Corners',
        cover: 'Coolplus Cover'
      }
    }
  }
};

// ============================================================================
// COOLPLUS TOPPER DETECTION
// ============================================================================

/**
 * Check if product is a Coolplus Topper (requires BOTH keywords)
 */
function isCoolplusTopper(productTitle, shopifySku = null, handle = null) {
  // PRIMARY METHOD: Check SKU prefix
  if (shopifySku) {
    const skuLower = shopifySku.toLowerCase();
    if (skuLower.startsWith('coolt')) {
      console.log(`[Coolplus Topper] Detected via SKU prefix: ${shopifySku}`);
      return true;
    }
  }
  
  // FALLBACK METHOD: Check product title and handle (must contain BOTH keywords)
  const title = productTitle.toLowerCase();
  const handleText = handle ? handle.toLowerCase() : '';
  
  // Must contain BOTH "coolplus" AND "topper"
  const titleHasBoth = title.includes('coolplus') && title.includes('topper');
  const handleHasBoth = handleText.includes('coolplus') && handleText.includes('topper');
  
  // Also check for "cool plus" with space
  const titleHasBothWithSpace = (title.includes('cool plus') || title.includes('coolplus')) && title.includes('topper');
  const handleHasBothWithSpace = (handleText.includes('cool plus') || handleText.includes('coolplus')) && handleText.includes('topper');
  
  const titleMatch = titleHasBoth || handleHasBoth || titleHasBothWithSpace || handleHasBothWithSpace;
  
  if (titleMatch) {
    console.log(`[Coolplus Topper] Detected via title/handle: ${productTitle}`);
    return true;
  }
  
  return false;
}

// ============================================================================
// COOLPLUS TOPPER PARSING
// ============================================================================

/**
 * Extract thickness from Coolplus Topper product data
 */
function extractThickness(productTitle, productVariant = null, productProperties = null) {
  console.log(`[Coolplus Topper] Extracting thickness from: ${productTitle}`);
  
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
      if (COOLPLUS_TOPPER_SPECS.specifications[thickness]) {
        console.log(`[Coolplus Topper] Found valid thickness in title: ${thickness}"`);
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
        if (COOLPLUS_TOPPER_SPECS.specifications[thickness]) {
          console.log(`[Coolplus Topper] Found valid thickness in variant: ${thickness}"`);
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
        if (match && COOLPLUS_TOPPER_SPECS.specifications[match[1]]) {
          console.log(`[Coolplus Topper] Found thickness in properties: ${match[1]}"`);
          return match[1];
        }
      }
    }
  }

  console.log(`[Coolplus Topper] No thickness found, defaulting to 2"`);
  return '2'; // Default thickness for Coolplus toppers
}

/**
 * Extract firmness from Coolplus Topper (always Medium)
 */
function extractFirmness(productTitle, productVariant = null, productProperties = null) {
  console.log(`[Coolplus Topper] Coolplus Toppers are always Medium firmness`);
  return 'Medium'; // Coolplus Toppers only come in Medium
}

// ============================================================================
// COOLPLUS TOPPER SPECIFICATION GENERATION
// ============================================================================

/**
 * Generate supplier specification for Coolplus Topper
 */
function generateSpecification(thickness, firmness = 'Medium') {
  console.log(`[Coolplus Topper] Generating specification for ${thickness}" ${firmness}`);
  
  const spec = COOLPLUS_TOPPER_SPECS.specifications[thickness]?.[firmness];
  
  if (!spec) {
    console.error(`[Coolplus Topper] No specification found for ${thickness}" ${firmness}`);
    return null;
  }

  // Format: [Supplier Code] + [Cover]
  const fullSpecification = `${spec.supplierCode} + ${spec.cover}`;
  
  const result = {
    mattressType: 'Coolplus Topper',
    thickness: thickness,
    firmness: firmness,
    depth: spec.depth,
    supplierCode: spec.supplierCode,
    cover: spec.cover,
    fullSpecification: fullSpecification,
    confidence: 100 // Very high confidence - simple, clear mapping
  };

  console.log(`[Coolplus Topper] Generated: ${fullSpecification}`);
  return result;
}

// ============================================================================
// MAIN MAPPING FUNCTION
// ============================================================================

/**
 * Main mapping function for Coolplus Topper
 */
function mapCoolplusTopper(productTitle, productVariant = null, productProperties = null, shopifySku = null) {
  console.log(`\n=== MAPPING COOLPLUS TOPPER ===`);
  console.log(`Product: ${productTitle}`);
  console.log(`SKU: ${shopifySku || 'Not provided'}`);
  
  try {
    // 1. Verify this is a Coolplus Topper (requires both keywords)
    if (!isCoolplusTopper(productTitle, shopifySku)) {
      return {
        success: false,
        error: 'Product is not a Coolplus Topper (requires both "Coolplus" and "Topper" in title)',
        confidence: 0
      };
    }

    // 2. Extract thickness (firmness is always Medium)
    const thickness = extractThickness(productTitle, productVariant, productProperties);
    const firmness = extractFirmness(productTitle, productVariant, productProperties);
    
    // 3. Validate thickness (Coolplus Toppers only have 2" and 3")
    if (!['2', '3'].includes(thickness)) {
      console.log(`[Coolplus Topper] Invalid thickness ${thickness}", adjusting to 2"`);
      thickness = '2';
    }
    
    // 4. Generate specification
    const specification = generateSpecification(thickness, firmness);
    
    if (!specification) {
      return {
        success: false,
        error: 'Could not generate Coolplus Topper specification',
        confidence: 0
      };
    }

    // 5. Return successful mapping
    return {
      success: true,
      mattressType: 'Coolplus Topper',
      specification: specification,
      confidence: specification.confidence,
      debugInfo: {
        extractedThickness: thickness,
        extractedFirmness: firmness,
        availableThicknesses: Object.keys(COOLPLUS_TOPPER_SPECS.specifications),
        availableFirmness: COOLPLUS_TOPPER_SPECS.firmnessOptions,
        matchedSpec: COOLPLUS_TOPPER_SPECS.specifications[thickness]?.[firmness]
      }
    };

  } catch (error) {
    console.error(`[Coolplus Topper] Mapping error:`, error);
    return {
      success: false,
      error: `Coolplus Topper mapping failed: ${error.message}`,
      confidence: 0
    };
  }
}

// ============================================================================
// TESTING FUNCTIONS
// ============================================================================

/**
 * Test Coolplus Topper mapping with various inputs
 */
function testMapping() {
  console.log('\n=== TESTING COOLPLUS TOPPER MAPPING ===\n');
  
  const testCases = [
    {
      name: 'Coolplus Topper 2" Regular',
      title: 'Coolplus Rectangular Caravan Mattress Topper - Single',
      variant: { title: '2" inch / 5cm - Regular comfort' },
      properties: [],
      expected: '2" FR50/125 + Two Luggage Straps + Elastic Straps on 90° Corners + Coolplus Cover'
    },
    {
      name: 'Coolplus Topper 3" Luxury',
      title: 'Coolplus Narrow Left Cut Out Caravan Mattress Topper - Double',
      variant: { title: '3" inch / 7.5cm - Luxury comfort' },
      properties: [],
      expected: '3" FR50/125 + Two Luggage Straps + Elastic Straps on 90° Corners + Coolplus Cover'
    },
    {
      name: 'Cool Plus with space in title',
      title: 'Cool Plus Left Rounded Corner Mattress Topper - King',
      variant: { title: '2" inch / 5cm - Regular comfort' },
      properties: [],
      expected: '2" FR50/125 + Two Luggage Straps + Elastic Straps on 90° Corners + Coolplus Cover'
    },
    {
      name: 'Coolplus Topper default values',
      title: 'Coolplus Custom Shape Mattress Topper - Single',
      variant: null,
      properties: [],
      expected: '2" FR50/125 + Two Luggage Straps + Elastic Straps on 90° Corners + Coolplus Cover'
    },
    {
      name: 'Should NOT detect regular Coolplus mattress',
      title: 'Coolplus Rectangular Caravan Mattress - Single',
      variant: { title: '6" inch / 15cm - Standard support' },
      properties: [],
      expected: 'Should fail - not a topper'
    },
    {
      name: 'Should NOT detect generic topper',
      title: 'Memory Foam Mattress Topper - Single',
      variant: { title: '2" inch / 5cm - Regular comfort' },
      properties: [],
      expected: 'Should fail - not Coolplus'
    },
    {
      name: 'Should NOT detect Bodyshape topper',
      title: 'Bodyshape Rectangular Mattress Topper - Single',
      variant: { title: '2" inch / 5cm - Regular comfort' },
      properties: [],
      expected: 'Should fail - not Coolplus'
    }
  ];

  testCases.forEach((testCase, index) => {
    console.log(`--- Test ${index + 1}: ${testCase.name} ---`);
    
    const result = mapCoolplusTopper(testCase.title, testCase.variant, testCase.properties);
    
    if (result.success) {
      const match = result.specification.fullSpecification === testCase.expected;
      console.log(`✅ Result: ${result.specification.fullSpecification}`);
      console.log(`✅ Expected: ${testCase.expected}`);
      console.log(`${match ? '✅' : '❌'} Match: ${match ? 'YES' : 'NO'}`);
      console.log(`✅ Confidence: ${result.confidence}%`);
      console.log(`✅ Thickness: ${result.debugInfo.extractedThickness}"`);
      console.log(`✅ Firmness: ${result.debugInfo.extractedFirmness}`);
    } else {
      console.log(`❌ Error: ${result.error}`);
      if (testCase.expected.includes('Should fail')) {
        console.log(`✅ Expected failure - test passed`);
      }
    }
    console.log('');
  });
}

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
  // Main functions
  isCoolplusTopper,
  mapCoolplusTopper,
  
  // Helper functions  
  extractThickness,
  extractFirmness,
  generateSpecification,
  
  // Testing
  testMapping,
  
  // Configuration
  COOLPLUS_TOPPER_SPECS,
  
  // Metadata
  mattressType: 'Coolplus Topper',
  version: '1.0.0',
  lastUpdated: new Date().toISOString()
};

// Auto-run tests if file executed directly
if (require.main === module) {
  testMapping();
}
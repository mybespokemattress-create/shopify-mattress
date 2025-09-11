// Bodyshape Mattress Topper Mapping System
// File: routes/mappings/bodyshape-topper-mapping.js

// ============================================================================
// BODYSHAPE TOPPER SPECIFICATION TABLE
// ============================================================================

const BODYSHAPE_TOPPER_SPECS = {
  mattressType: 'Bodyshape Topper',
  skuPrefix: 'BodyT',
  
  // Bodyshape Toppers only have one firmness option
  firmnessOptions: ['Soft'],
  
  // Simple structure: Vasco layer + attachment straps + cover
  specifications: {
    '1': {
      'Soft': {
        depth: '1" inch / 2.5cm - Basic comfort',
        firmness: 'Soft',
        supplierCode: '1" Vasco 40 + Two Luggage Straps + Elastic Straps on 90° Corners',
        cover: 'Tencel Grey Ribbon Cover'
      }
    },
    '2': {
      'Soft': {
        depth: '2" inch / 5cm - Regular comfort',
        firmness: 'Soft',
        supplierCode: '2" Vasco 40 + Two Luggage Straps + Elastic Straps on 90° Corners',
        cover: 'Tencel Grey Ribbon Cover'
      }
    },
    '3': {
      'Soft': {
        depth: '3" inch / 7.5cm - Luxury comfort',
        firmness: 'Soft',
        supplierCode: '3" Vasco 40 + Two Luggage Straps + Elastic Straps on 90° Corners',
        cover: 'Tencel Grey Ribbon Cover'
      }
    },
    '4': {
      'Soft': {
        depth: '4" inch / 10cm - Premium comfort',
        firmness: 'Soft',
        supplierCode: '4" Vasco 40 + Two Luggage Straps + Elastic Straps on 90° Corners',
        cover: 'Tencel Grey Ribbon Cover'
      }
    },
    '5': {
      'Soft': {
        depth: '5" inch / 12.5cm - Ultimate comfort',
        firmness: 'Soft',
        supplierCode: '5" Vasco 40 + Two Luggage Straps + Elastic Straps on 90° Corners',
        cover: 'Tencel Grey Ribbon Cover'
      }
    }
  }
};

// ============================================================================
// BODYSHAPE TOPPER DETECTION
// ============================================================================

/**
 * Check if product is a Bodyshape Topper (requires BOTH keywords)
 */
function isBodyshapeTopper(productTitle, shopifySku = null, handle = null) {
  // PRIMARY METHOD: Check SKU prefix
  if (shopifySku) {
    const skuLower = shopifySku.toLowerCase();
    if (skuLower.startsWith('bodyt')) {
      console.log(`[Bodyshape Topper] Detected via SKU prefix: ${shopifySku}`);
      return true;
    }
  }
  
  // FALLBACK METHOD: Check product title and handle (must contain BOTH keywords)
  const title = productTitle.toLowerCase();
  const handleText = handle ? handle.toLowerCase() : '';
  
  const titleHasBoth = title.includes('bodyshape') && title.includes('topper');
  const handleHasBoth = handleText.includes('bodyshape') && handleText.includes('topper');
  
  const titleMatch = titleHasBoth || handleHasBoth;
  
  if (titleMatch) {
    console.log(`[Bodyshape Topper] Detected via title/handle: ${productTitle}`);
    return true;
  }
  
  return false;
}

// ============================================================================
// BODYSHAPE TOPPER PARSING
// ============================================================================

/**
 * Extract thickness from Bodyshape Topper product data
 */
function extractThickness(productTitle, productVariant = null, productProperties = null) {
  console.log(`[Bodyshape Topper] Extracting thickness from: ${productTitle}`);
  
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
      if (BODYSHAPE_TOPPER_SPECS.specifications[thickness]) {
        console.log(`[Bodyshape Topper] Found valid thickness in title: ${thickness}"`);
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
        if (BODYSHAPE_TOPPER_SPECS.specifications[thickness]) {
          console.log(`[Bodyshape Topper] Found valid thickness in variant: ${thickness}"`);
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
        if (match && BODYSHAPE_TOPPER_SPECS.specifications[match[1]]) {
          console.log(`[Bodyshape Topper] Found thickness in properties: ${match[1]}"`);
          return match[1];
        }
      }
    }
  }

  console.log(`[Bodyshape Topper] No thickness found, defaulting to 2"`);
  return '2'; // Default thickness for toppers
}

/**
 * Extract firmness from Bodyshape Topper (always Soft)
 */
function extractFirmness(productTitle, productVariant = null, productProperties = null) {
  console.log(`[Bodyshape Topper] Bodyshape Toppers are always Soft firmness`);
  return 'Soft'; // Bodyshape Toppers only come in Soft
}

// ============================================================================
// BODYSHAPE TOPPER SPECIFICATION GENERATION
// ============================================================================

/**
 * Generate supplier specification for Bodyshape Topper
 */
function generateSpecification(thickness, firmness = 'Soft') {
  console.log(`[Bodyshape Topper] Generating specification for ${thickness}" ${firmness}`);
  
  const spec = BODYSHAPE_TOPPER_SPECS.specifications[thickness]?.[firmness];
  
  if (!spec) {
    console.error(`[Bodyshape Topper] No specification found for ${thickness}" ${firmness}`);
    return null;
  }

  // Format: [Supplier Code] + [Cover]
  const fullSpecification = `${spec.supplierCode} + ${spec.cover}`;
  
  const result = {
    mattressType: 'Bodyshape Topper',
    thickness: thickness,
    firmness: firmness,
    depth: spec.depth,
    supplierCode: spec.supplierCode,
    cover: spec.cover,
    fullSpecification: fullSpecification,
    confidence: 100 // Very high confidence - simple, clear mapping
  };

  console.log(`[Bodyshape Topper] Generated: ${fullSpecification}`);
  return result;
}

// ============================================================================
// MAIN MAPPING FUNCTION
// ============================================================================

/**
 * Main mapping function for Bodyshape Topper
 */
function mapBodyshapeTopper(productTitle, productVariant = null, productProperties = null, shopifySku = null) {
  console.log(`\n=== MAPPING BODYSHAPE TOPPER ===`);
  console.log(`Product: ${productTitle}`);
  console.log(`SKU: ${shopifySku || 'Not provided'}`);
  
  try {
    // 1. Verify this is a Bodyshape Topper (requires both keywords)
    if (!isBodyshapeTopper(productTitle, shopifySku)) {
      return {
        success: false,
        error: 'Product is not a Bodyshape Topper (requires both "Bodyshape" and "Topper" in title)',
        confidence: 0
      };
    }

    // 2. Extract thickness (firmness is always Soft)
    const thickness = extractThickness(productTitle, productVariant, productProperties);
    const firmness = extractFirmness(productTitle, productVariant, productProperties);
    
    // 3. Generate specification
    const specification = generateSpecification(thickness, firmness);
    
    if (!specification) {
      return {
        success: false,
        error: 'Could not generate Bodyshape Topper specification',
        confidence: 0
      };
    }

    // 4. Return successful mapping
    return {
      success: true,
      mattressType: 'Bodyshape Topper',
      specification: specification,
      confidence: specification.confidence,
      debugInfo: {
        extractedThickness: thickness,
        extractedFirmness: firmness,
        availableThicknesses: Object.keys(BODYSHAPE_TOPPER_SPECS.specifications),
        availableFirmness: BODYSHAPE_TOPPER_SPECS.firmnessOptions,
        matchedSpec: BODYSHAPE_TOPPER_SPECS.specifications[thickness]?.[firmness]
      }
    };

  } catch (error) {
    console.error(`[Bodyshape Topper] Mapping error:`, error);
    return {
      success: false,
      error: `Bodyshape Topper mapping failed: ${error.message}`,
      confidence: 0
    };
  }
}

// ============================================================================
// TESTING FUNCTIONS
// ============================================================================

/**
 * Test Bodyshape Topper mapping with various inputs
 */
function testMapping() {
  console.log('\n=== TESTING BODYSHAPE TOPPER MAPPING ===\n');
  
  const testCases = [
    {
      name: 'Bodyshape Topper 2" Regular',
      title: 'Bodyshape Rectangular Caravan Mattress Topper - Single',
      variant: { title: '2" inch / 5cm - Regular comfort' },
      properties: [],
      expected: '2" Vasco 40 + Two Luggage Straps + Elastic Straps on 90° Corners + Tencel Grey Ribbon Cover'
    },
    {
      name: 'Bodyshape Topper 3" Luxury',
      title: 'Bodyshape Narrow Left Curved Corner Caravan Mattress Topper - Single',
      variant: { title: '3" inch / 7.5cm - Luxury comfort' },
      properties: [],
      expected: '3" Vasco 40 + Two Luggage Straps + Elastic Straps on 90° Corners + Tencel Grey Ribbon Cover'
    },
    {
      name: 'Bodyshape Topper 1" Basic',
      title: 'Bodyshape Left Rounded Corner Caravan Mattress Topper - Double',
      variant: { title: '1" inch / 2.5cm - Basic comfort' },
      properties: [],
      expected: '1" Vasco 40 + Two Luggage Straps + Elastic Straps on 90° Corners + Tencel Grey Ribbon Cover'
    },
    {
      name: 'Bodyshape Topper 5" Ultimate',
      title: 'Bodyshape Island Mattress Topper - King',
      variant: { title: '5" inch / 12.5cm - Ultimate comfort' },
      properties: [],
      expected: '5" Vasco 40 + Two Luggage Straps + Elastic Straps on 90° Corners + Tencel Grey Ribbon Cover'
    },
    {
      name: 'Bodyshape Topper default values',
      title: 'Bodyshape Custom Shape Mattress Topper - Single',
      variant: null,
      properties: [],
      expected: '2" Vasco 40 + Two Luggage Straps + Elastic Straps on 90° Corners + Tencel Grey Ribbon Cover'
    },
    {
      name: 'Should NOT detect regular Bodyshape mattress',
      title: 'Bodyshape Rectangular Caravan Mattress - Single',
      variant: { title: '6" inch / 15cm - Standard support' },
      properties: [],
      expected: 'Should fail - not a topper'
    },
    {
      name: 'Should NOT detect generic topper',
      title: 'Memory Foam Mattress Topper - Single',
      variant: { title: '2" inch / 5cm - Regular comfort' },
      properties: [],
      expected: 'Should fail - not Bodyshape'
    }
  ];

  testCases.forEach((testCase, index) => {
    console.log(`--- Test ${index + 1}: ${testCase.name} ---`);
    
    const result = mapBodyshapeTopper(testCase.title, testCase.variant, testCase.properties);
    
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
  isBodyshapeTopper,
  mapBodyshapeTopper,
  
  // Helper functions  
  extractThickness,
  extractFirmness,
  generateSpecification,
  
  // Testing
  testMapping,
  
  // Configuration
  BODYSHAPE_TOPPER_SPECS,
  
  // Metadata
  mattressType: 'Bodyshape Topper',
  version: '1.0.0',
  lastUpdated: new Date().toISOString()
};

// Auto-run tests if file executed directly
if (require.main === module) {
  testMapping();
}
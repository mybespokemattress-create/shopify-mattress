// Bodyshape Mattress Mapping System
// File: routes/mappings/bodyshape-mapping.js

// ============================================================================
// BODYSHAPE MATTRESS SPECIFICATION TABLE
// ============================================================================

const BODYSHAPE_SPECS = {
  mattressType: 'Bodyshape',
  skuPrefix: 'Body',
  
  // Bodyshape has three firmness options
  firmnessOptions: ['Medium', 'Firm Orthopaedic', 'Hard'],
  
  // Complex 3-layer structure: Base + Middle + Top + Cover (similar to Novolatex but different materials)
  specifications: {
    '6': {
      'Medium': {
        depth: '6" inch / 15cm - Standard support',
        firmness: 'Medium',
        baseLayer: '1" 33/175 Blue Base Layer',
        middleLayer: '3" 30/130 White Middle Layer',
        topLayer: '2" Vasco 40 Top Layer',
        cover: 'Tencel Grey Ribbon Cover'
      },
      'Firm Orthopaedic': {
        depth: '6" inch / 15cm - Standard support',
        firmness: 'Firm Orthopaedic',
        baseLayer: '2" 33/175 Blue Base Layer',
        middleLayer: '3" 30/130 White Middle Layer',
        topLayer: '1" Vasco 40 Top Layer',
        cover: 'Tencel Grey Ribbon Cover'
      },
      'Hard': {
        depth: '6" inch / 15cm - Standard support',
        firmness: 'Hard',
        baseLayer: '4" 33/175 Blue Base Layer',
        middleLayer: '1" 30/130 White Middle Layer',
        topLayer: '1" Vasco 40 Top Layer',
        cover: 'Tencel Grey Ribbon Cover'
      }
    },
    '8': {
      'Medium': {
        depth: '8" inch / 20cm - Premium support',
        firmness: 'Medium',
        baseLayer: '1" 33/175 Blue Base Layer',
        middleLayer: '5" 30/130 White Middle Layer',
        topLayer: '2" Vasco 40 Top Layer',
        cover: 'Tencel Grey Ribbon Cover'
      },
      'Firm Orthopaedic': {
        depth: '8" inch / 20cm - Premium support',
        firmness: 'Firm Orthopaedic',
        baseLayer: '2" 33/175 Blue Base Layer',
        middleLayer: '5" 30/130 White Middle Layer',
        topLayer: '1" Vasco 40 Top Layer',
        cover: 'Tencel Grey Ribbon Cover'
      },
      'Hard': {
        depth: '8" inch / 20cm - Premium support',
        firmness: 'Hard',
        baseLayer: '6" 33/175 Blue Base Layer',
        middleLayer: '1" 30/130 White Middle Layer',
        topLayer: '1" Vasco 40 Top Layer',
        cover: 'Tencel Grey Ribbon Cover'
      }
    },
    '10': {
      'Medium': {
        depth: '10" inch / 25cm - Luxury support',
        firmness: 'Medium',
        baseLayer: '1" 33/175 Blue Base Layer',
        middleLayer: '7" 30/130 White Middle Layer',
        topLayer: '2" Vasco 40 Top Layer',
        cover: 'Tencel Grey Ribbon Cover'
      },
      'Firm Orthopaedic': {
        depth: '10" inch / 25cm - Luxury support',
        firmness: 'Firm Orthopaedic',
        baseLayer: '2" 33/175 Blue Base Layer',
        middleLayer: '7" 30/130 White Middle Layer',
        topLayer: '1" Vasco 40 Top Layer',
        cover: 'Tencel Grey Ribbon Cover'
      },
      'Hard': {
        depth: '10" inch / 25cm - Luxury support',
        firmness: 'Hard',
        baseLayer: '8" 33/175 Blue Base Layer',
        middleLayer: '1" 30/130 White Middle Layer',
        topLayer: '1" Vasco 40 Top Layer',
        cover: 'Tencel Grey Ribbon Cover'
      }
    }
  }
};

// ============================================================================
// BODYSHAPE MATTRESS DETECTION
// ============================================================================

/**
 * Check if product is a Bodyshape mattress
 */
function isBodyshapeMattress(productTitle, shopifySku = null, handle = null) {
  // PRIMARY METHOD: Check SKU prefix
  if (shopifySku) {
    const skuLower = shopifySku.toLowerCase();
    if (skuLower.startsWith('body')) {
      console.log(`[Bodyshape] Detected via SKU prefix: ${shopifySku}`);
      return true;
    }
  }
  
  // FALLBACK METHOD: Check product title and handle
  const title = productTitle.toLowerCase();
  const handleText = handle ? handle.toLowerCase() : '';
  
  const titleMatch = title.startsWith('bodyshape') || handleText.startsWith('bodyshape') ||
                    title.includes('body shape') || handleText.includes('body shape') ||
                    title.includes('body') || handleText.includes('body');
  
  if (titleMatch) {
    console.log(`[Bodyshape] Detected via title/handle: ${productTitle}`);
    return true;
  }
  
  return false;
}

// ============================================================================
// BODYSHAPE MATTRESS PARSING
// ============================================================================

/**
 * Extract thickness from Bodyshape mattress product data
 */
function extractThickness(productTitle, productVariant = null, productProperties = null) {
  console.log(`[Bodyshape] Extracting thickness from: ${productTitle}`);
  
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
      if (BODYSHAPE_SPECS.specifications[thickness]) {
        console.log(`[Bodyshape] Found valid thickness in title: ${thickness}"`);
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
        if (BODYSHAPE_SPECS.specifications[thickness]) {
          console.log(`[Bodyshape] Found valid thickness in variant: ${thickness}"`);
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
        if (match && BODYSHAPE_SPECS.specifications[match[1]]) {
          console.log(`[Bodyshape] Found thickness in properties: ${match[1]}"`);
          return match[1];
        }
      }
    }
  }

  console.log(`[Bodyshape] No thickness found, defaulting to 6"`);
  return '6'; // Default thickness
}

/**
 * Extract firmness from Bodyshape mattress product data
 */
function extractFirmness(productTitle, productVariant = null, productProperties = null) {
  console.log(`[Bodyshape] Extracting firmness from product data`);
  
  // Check properties first (most reliable for Shopify orders)
  if (productProperties && Array.isArray(productProperties)) {
    for (const prop of productProperties) {
      if (prop.name && prop.name.toLowerCase().includes('firmness')) {
        const firmness = prop.value;
        if (BODYSHAPE_SPECS.firmnessOptions.includes(firmness)) {
          console.log(`[Bodyshape] Found firmness in properties: ${firmness}`);
          return firmness;
        }
      }
    }
  }

  // Check variant title
  if (productVariant && productVariant.title) {
    const variantLower = productVariant.title.toLowerCase();
    
    if (variantLower.includes('firm orthopaedic') || variantLower.includes('firm orthopedic')) {
      console.log(`[Bodyshape] Found firmness in variant: Firm Orthopaedic`);
      return 'Firm Orthopaedic';
    }
    if (variantLower.includes('hard')) {
      console.log(`[Bodyshape] Found firmness in variant: Hard`);
      return 'Hard';
    }
    if (variantLower.includes('medium') && !variantLower.includes('firm')) {
      console.log(`[Bodyshape] Found firmness in variant: Medium`);
      return 'Medium';
    }
  }

  // Check product title
  const titleLower = productTitle.toLowerCase();
  if (titleLower.includes('firm orthopaedic') || titleLower.includes('firm orthopedic')) {
    console.log(`[Bodyshape] Found firmness in title: Firm Orthopaedic`);
    return 'Firm Orthopaedic';
  }
  if (titleLower.includes('hard')) {
    console.log(`[Bodyshape] Found firmness in title: Hard`);
    return 'Hard';
  }
  if (titleLower.includes('medium') && !titleLower.includes('firm')) {
    console.log(`[Bodyshape] Found firmness in title: Medium`);
    return 'Medium';
  }

  console.log(`[Bodyshape] No firmness found - requires override`);
return null; // No firmness available
}

// ============================================================================
// BODYSHAPE MATTRESS SPECIFICATION GENERATION
// ============================================================================

/**
 * Generate supplier specification for Bodyshape mattress
 */
function generateSpecification(thickness, firmness) {
  console.log(`[Bodyshape] Generating specification for ${thickness}" ${firmness}`);
  
  // If no firmness provided, return mapping required
  if (!firmness) {
    console.log(`[Bodyshape] No firmness provided - returning dash for manual override`);
    return {
      mattressType: 'Bodyshape',
      thickness: thickness,
      firmness: null,
      depth: `${thickness}" inch - requires firmness selection`,
      baseLayer: null,
      middleLayer: null,
      topLayer: null,
      cover: null,
      fullSpecification: '-',
      confidence: 0
    };
  }
  
  const spec = BODYSHAPE_SPECS.specifications[thickness]?.[firmness];
  
  if (!spec) {
    console.error(`[Bodyshape] No specification found for ${thickness}" ${firmness}`);
    return null;
  }

  // Format: [Base Layer] + [Middle Layer] + [Top Layer] + [Cover]
  const fullSpecification = `${spec.baseLayer} + ${spec.middleLayer} + ${spec.topLayer} + ${spec.cover}`;
  
  const result = {
    mattressType: 'Bodyshape',
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

  console.log(`[Bodyshape] Generated: ${fullSpecification}`);
  return result;
}

// ============================================================================
// MAIN MAPPING FUNCTION
// ============================================================================

/**
 * Main mapping function for Bodyshape mattress
 */
function mapBodyshapeMattress(productTitle, productVariant = null, productProperties = null, shopifySku = null) {
  console.log(`\n=== MAPPING BODYSHAPE MATTRESS ===`);
  console.log(`Product: ${productTitle}`);
  console.log(`SKU: ${shopifySku || 'Not provided'}`);
  
  try {
    // 1. Verify this is a Bodyshape mattress
    if (!isBodyshapeMattress(productTitle, shopifySku)) {
      return {
        success: false,
        error: 'Product is not a Bodyshape mattress',
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
        error: 'Could not generate Bodyshape mattress specification',
        confidence: 0
      };
    }

    // 4. Return successful mapping
    return {
      success: true,
      mattressType: 'Bodyshape',
      specification: specification,
      confidence: specification.confidence,
      debugInfo: {
        extractedThickness: thickness,
        extractedFirmness: firmness,
        availableThicknesses: Object.keys(BODYSHAPE_SPECS.specifications),
        availableFirmness: BODYSHAPE_SPECS.firmnessOptions,
        matchedSpec: BODYSHAPE_SPECS.specifications[thickness]?.[firmness]
      }
    };

  } catch (error) {
    console.error(`[Bodyshape] Mapping error:`, error);
    return {
      success: false,
      error: `Bodyshape mapping failed: ${error.message}`,
      confidence: 0
    };
  }
}

// ============================================================================
// TESTING FUNCTIONS
// ============================================================================

/**
 * Test Bodyshape mattress mapping with various inputs
 */
function testMapping() {
  console.log('\n=== TESTING BODYSHAPE MATTRESS MAPPING ===\n');
  
  const testCases = [
    {
      name: 'Bodyshape 6" Medium',
      title: 'Bodyshape Left Curved Corner Caravan Mattress - Single',
      variant: { title: '6" inch / 15cm - Standard support' },
      properties: [{ name: 'Firmness', value: 'Medium' }],
      expected: '1" 33/175 Blue Base Layer + 3" 30/130 White Middle Layer + 2" Vasco 40 Top Layer + Tencel Grey Ribbon Cover'
    },
    {
      name: 'Bodyshape 8" Firm Orthopaedic',
      title: 'Bodyshape Rectangle Mattress - Double',
      variant: { title: '8" inch / 20cm - Premium support' },
      properties: [{ name: 'Firmness', value: 'Firm Orthopaedic' }],
      expected: '2" 33/175 Blue Base Layer + 5" 30/130 White Middle Layer + 1" Vasco 40 Top Layer + Tencel Grey Ribbon Cover'
    },
    {
      name: 'Bodyshape 10" Hard',
      title: 'Bodyshape Cut Corner Mattress - King',
      variant: { title: '10" inch / 25cm - Luxury support' },
      properties: [{ name: 'Firmness', value: 'Hard' }],
      expected: '8" 33/175 Blue Base Layer + 1" 30/130 White Middle Layer + 1" Vasco 40 Top Layer + Tencel Grey Ribbon Cover'
    },
    {
      name: 'Bodyshape with firmness in variant title',
      title: 'Bodyshape Custom Shape Mattress - Single',
      variant: { title: '6" inch / 15cm - Hard Support' },
      properties: [],
      expected: '4" 33/175 Blue Base Layer + 1" 30/130 White Middle Layer + 1" Vasco 40 Top Layer + Tencel Grey Ribbon Cover'
    },
    {
      name: 'Bodyshape default values',
      title: 'Bodyshape Narrow Right Cut Mattress - Single',
      variant: null,
      properties: [],
      expected: '1" 33/175 Blue Base Layer + 3" 30/130 White Middle Layer + 2" Vasco 40 Top Layer + Tencel Grey Ribbon Cover'
    },
    {
      name: 'Body Shape with space in title',
      title: 'Body Shape Island Mattress - Double',
      variant: { title: '8" inch / 20cm - Premium support' },
      properties: [{ name: 'Firmness', value: 'Medium' }],
      expected: '1" 33/175 Blue Base Layer + 5" 30/130 White Middle Layer + 2" Vasco 40 Top Layer + Tencel Grey Ribbon Cover'
    }
  ];

  testCases.forEach((testCase, index) => {
    console.log(`--- Test ${index + 1}: ${testCase.name} ---`);
    
    const result = mapBodyshapeMattress(testCase.title, testCase.variant, testCase.properties);
    
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
    }
    console.log('');
  });
}

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
  // Main functions
  isBodyshapeMattress,
  mapBodyshapeMattress,
  
  // Helper functions  
  extractThickness,
  extractFirmness,
  generateSpecification,
  
  // Testing
  testMapping,
  
  // Configuration
  BODYSHAPE_SPECS,
  
  // Metadata
  mattressType: 'Bodyshape',
  version: '1.0.0',
  lastUpdated: new Date().toISOString()
};

// Auto-run tests if file executed directly
if (require.main === module) {
  testMapping();
}
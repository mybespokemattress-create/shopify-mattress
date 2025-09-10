// Grand Crescent Mattress Mapping System
// File: routes/mappings/grandcrescent-mapping.js

// ============================================================================
// GRAND CRESCENT MATTRESS SPECIFICATION TABLE
// ============================================================================

const GRANDCRESCENT_SPECS = {
  mattressType: 'Grand Crescent',
  skuPrefix: 'Grand',
  
  // Grand Crescent has two firmness options
  firmnessOptions: ['Medium', 'Firm Orthopaedic'],
  
  // Complex 3-layer structure: Base + Middle + Top + Cover (only 8" and 10" available)
  specifications: {
    '8': {
      'Medium': {
        depth: '8" inch / 20cm - Premium support',
        firmness: 'Medium',
        baseLayer: '1" 33/175 Blue Base Layer',
        middleLayer: '5" RF39/120 Peach Middle Layer',
        topLayer: '2" Vasco 50 Top Layer',
        cover: 'MyBespoke FR50/125 Cover'
      },
      'Firm Orthopaedic': {
        depth: '8" inch / 20cm - Premium support',
        firmness: 'Firm Orthopaedic',
        baseLayer: '4" 33/175 Blue Base Layer',
        middleLayer: '2" RF39/120 Peach Middle Layer',
        topLayer: '2" Vasco 50 Top Layer',
        cover: 'MyBespoke FR50/125 Cover'
      }
    },
    '10': {
      'Medium': {
        depth: '10" inch / 25cm - Luxury support',
        firmness: 'Medium',
        baseLayer: '2" 33/175 Blue Base Layer',
        middleLayer: '6" RF39/120 Peach Middle Layer',
        topLayer: '2" Vasco 50 Top Layer',
        cover: 'MyBespoke FR50/125 Cover'
      },
      'Firm Orthopaedic': {
        depth: '10" inch / 25cm - Luxury support',
        firmness: 'Firm Orthopaedic',
        baseLayer: '4" 33/175 Blue Base Layer',
        middleLayer: '4" RF39/120 Peach Middle Layer',
        topLayer: '2" Vasco 50 Top Layer',
        cover: 'MyBespoke FR50/125 Cover'
      }
    }
  }
};

// ============================================================================
// GRAND CRESCENT MATTRESS DETECTION
// ============================================================================

/**
 * Check if product is a Grand Crescent mattress
 */
function isGrandCrescentMattress(productTitle, handle = null) {
  const title = productTitle.toLowerCase();
  const handleText = handle ? handle.toLowerCase() : '';
  
  return title.startsWith('grand crescent') || handleText.startsWith('grand crescent') ||
         title.includes('grandcrescent') || handleText.includes('grandcrescent') ||
         title.startsWith('grand') || handleText.startsWith('grand');
}

// ============================================================================
// GRAND CRESCENT MATTRESS PARSING
// ============================================================================

/**
 * Extract thickness from Grand Crescent mattress product data
 */
function extractThickness(productTitle, productVariant = null, productProperties = null) {
  console.log(`[Grand Crescent] Extracting thickness from: ${productTitle}`);
  
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
      if (GRANDCRESCENT_SPECS.specifications[thickness]) {
        console.log(`[Grand Crescent] Found valid thickness in title: ${thickness}"`);
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
        if (GRANDCRESCENT_SPECS.specifications[thickness]) {
          console.log(`[Grand Crescent] Found valid thickness in variant: ${thickness}"`);
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
        if (match && GRANDCRESCENT_SPECS.specifications[match[1]]) {
          console.log(`[Grand Crescent] Found thickness in properties: ${match[1]}"`);
          return match[1];
        }
      }
    }
  }

  console.log(`[Grand Crescent] No thickness found, defaulting to 8"`);
  return '8'; // Default thickness (Grand Crescent only has 8" and 10")
}

/**
 * Extract firmness from Grand Crescent mattress product data
 */
function extractFirmness(productTitle, productVariant = null, productProperties = null) {
  console.log(`[Grand Crescent] Extracting firmness from product data`);
  
  // Check properties first (most reliable for Shopify orders)
  if (productProperties && Array.isArray(productProperties)) {
    for (const prop of productProperties) {
      if (prop.name && prop.name.toLowerCase().includes('firmness')) {
        const firmness = prop.value;
        if (GRANDCRESCENT_SPECS.firmnessOptions.includes(firmness)) {
          console.log(`[Grand Crescent] Found firmness in properties: ${firmness}`);
          return firmness;
        }
      }
    }
  }

  // Check variant title
  if (productVariant && productVariant.title) {
    const variantLower = productVariant.title.toLowerCase();
    
    if (variantLower.includes('firm orthopaedic') || variantLower.includes('firm orthopedic')) {
      console.log(`[Grand Crescent] Found firmness in variant: Firm Orthopaedic`);
      return 'Firm Orthopaedic';
    }
    if (variantLower.includes('medium') && !variantLower.includes('firm')) {
      console.log(`[Grand Crescent] Found firmness in variant: Medium`);
      return 'Medium';
    }
  }

  // Check product title
  const titleLower = productTitle.toLowerCase();
  if (titleLower.includes('firm orthopaedic') || titleLower.includes('firm orthopedic')) {
    console.log(`[Grand Crescent] Found firmness in title: Firm Orthopaedic`);
    return 'Firm Orthopaedic';
  }
  if (titleLower.includes('medium') && !titleLower.includes('firm')) {
    console.log(`[Grand Crescent] Found firmness in title: Medium`);
    return 'Medium';
  }

  console.log(`[Grand Crescent] No firmness found, defaulting to Medium`);
  return 'Medium'; // Default firmness
}

// ============================================================================
// GRAND CRESCENT MATTRESS SPECIFICATION GENERATION
// ============================================================================

/**
 * Generate supplier specification for Grand Crescent mattress
 */
function generateSpecification(thickness, firmness) {
  console.log(`[Grand Crescent] Generating specification for ${thickness}" ${firmness}`);
  
  const spec = GRANDCRESCENT_SPECS.specifications[thickness]?.[firmness];
  
  if (!spec) {
    console.error(`[Grand Crescent] No specification found for ${thickness}" ${firmness}`);
    return null;
  }

  // Format: [Base Layer] + [Middle Layer] + [Top Layer] + [Cover]
  const fullSpecification = `${spec.baseLayer} + ${spec.middleLayer} + ${spec.topLayer} + ${spec.cover}`;
  
  const result = {
    mattressType: 'Grand Crescent',
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

  console.log(`[Grand Crescent] Generated: ${fullSpecification}`);
  return result;
}

// ============================================================================
// MAIN MAPPING FUNCTION
// ============================================================================

/**
 * Main mapping function for Grand Crescent mattress
 */
function mapGrandCrescentMattress(productTitle, productVariant = null, productProperties = null, shopifySku = null) {
  console.log(`\n=== MAPPING GRAND CRESCENT MATTRESS ===`);
  console.log(`Product: ${productTitle}`);
  console.log(`SKU: ${shopifySku || 'Not provided'}`);
  
  try {
    // 1. Verify this is a Grand Crescent mattress
    if (!isGrandCrescentMattress(productTitle)) {
      return {
        success: false,
        error: 'Product is not a Grand Crescent mattress',
        confidence: 0
      };
    }

    // 2. Extract thickness and firmness
    const thickness = extractThickness(productTitle, productVariant, productProperties);
    const firmness = extractFirmness(productTitle, productVariant, productProperties);
    
    // 3. Validate thickness (Grand Crescent only has 8" and 10")
    if (!['8', '10'].includes(thickness)) {
      console.log(`[Grand Crescent] Invalid thickness ${thickness}", adjusting to 8"`);
      thickness = '8';
    }
    
    // 4. Generate specification
    const specification = generateSpecification(thickness, firmness);
    
    if (!specification) {
      return {
        success: false,
        error: 'Could not generate Grand Crescent mattress specification',
        confidence: 0
      };
    }

    // 5. Return successful mapping
    return {
      success: true,
      mattressType: 'Grand Crescent',
      specification: specification,
      confidence: specification.confidence,
      debugInfo: {
        extractedThickness: thickness,
        extractedFirmness: firmness,
        availableThicknesses: Object.keys(GRANDCRESCENT_SPECS.specifications),
        availableFirmness: GRANDCRESCENT_SPECS.firmnessOptions,
        matchedSpec: GRANDCRESCENT_SPECS.specifications[thickness]?.[firmness]
      }
    };

  } catch (error) {
    console.error(`[Grand Crescent] Mapping error:`, error);
    return {
      success: false,
      error: `Grand Crescent mapping failed: ${error.message}`,
      confidence: 0
    };
  }
}

// ============================================================================
// TESTING FUNCTIONS
// ============================================================================

/**
 * Test Grand Crescent mattress mapping with various inputs
 */
function testMapping() {
  console.log('\n=== TESTING GRAND CRESCENT MATTRESS MAPPING ===\n');
  
  const testCases = [
    {
      name: 'Grand Crescent 8" Medium',
      title: 'Grand Crescent Rectangular Caravan Mattress - Single',
      variant: { title: '8" inch / 20cm - Premium support' },
      properties: [{ name: 'Firmness', value: 'Medium' }],
      expected: '1" 33/175 Blue Base Layer + 5" RF39/120 Peach Middle Layer + 2" Vasco 50 Top Layer + MyBespoke FR50/125 Cover'
    },
    {
      name: 'Grand Crescent 8" Firm Orthopaedic',
      title: 'Grand Crescent Cut Corner Mattress - Double',
      variant: { title: '8" inch / 20cm - Premium support' },
      properties: [{ name: 'Firmness', value: 'Firm Orthopaedic' }],
      expected: '4" 33/175 Blue Base Layer + 2" RF39/120 Peach Middle Layer + 2" Vasco 50 Top Layer + MyBespoke FR50/125 Cover'
    },
    {
      name: 'Grand Crescent 10" Medium',
      title: 'Grand Crescent Island Mattress - King',
      variant: { title: '10" inch / 25cm - Luxury support' },
      properties: [{ name: 'Firmness', value: 'Medium' }],
      expected: '2" 33/175 Blue Base Layer + 6" RF39/120 Peach Middle Layer + 2" Vasco 50 Top Layer + MyBespoke FR50/125 Cover'
    },
    {
      name: 'Grand Crescent 10" Firm Orthopaedic',
      title: 'Grand Crescent Custom Shape Mattress - Double',
      variant: { title: '10" inch / 25cm - Luxury support' },
      properties: [{ name: 'Firmness', value: 'Firm Orthopaedic' }],
      expected: '4" 33/175 Blue Base Layer + 4" RF39/120 Peach Middle Layer + 2" Vasco 50 Top Layer + MyBespoke FR50/125 Cover'
    },
    {
      name: 'Grand Crescent with firmness in variant title',
      title: 'Grand Crescent Narrow Left Cut Mattress - Single',
      variant: { title: '8" inch / 20cm - Firm Orthopaedic Support' },
      properties: [],
      expected: '4" 33/175 Blue Base Layer + 2" RF39/120 Peach Middle Layer + 2" Vasco 50 Top Layer + MyBespoke FR50/125 Cover'
    },
    {
      name: 'Grand Crescent default values',
      title: 'Grand Crescent Bunk Bed Mattress - Single',
      variant: null,
      properties: [],
      expected: '1" 33/175 Blue Base Layer + 5" RF39/120 Peach Middle Layer + 2" Vasco 50 Top Layer + MyBespoke FR50/125 Cover'
    }
  ];

  testCases.forEach((testCase, index) => {
    console.log(`--- Test ${index + 1}: ${testCase.name} ---`);
    
    const result = mapGrandCrescentMattress(testCase.title, testCase.variant, testCase.properties);
    
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
  isGrandCrescentMattress,
  mapGrandCrescentMattress,
  
  // Helper functions  
  extractThickness,
  extractFirmness,
  generateSpecification,
  
  // Testing
  testMapping,
  
  // Configuration
  GRANDCRESCENT_SPECS,
  
  // Metadata
  mattressType: 'Grand Crescent',
  version: '1.0.0',
  lastUpdated: new Date().toISOString()
};

// Auto-run tests if file executed directly
if (require.main === module) {
  testMapping();
}
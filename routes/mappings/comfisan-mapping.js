// Comfisan Mattress Mapping System
// File: routes/mappings/comfisan-mapping.js

// ============================================================================
// COMFISAN MATTRESS SPECIFICATION TABLE
// ============================================================================

const COMFISAN_SPECS = {
  mattressType: 'Comfisan',
  skuPrefix: 'Comfi',
  
  // Comfisan has three firmness options
  firmnessOptions: ['Medium-firm', 'Firm Orthopaedic', 'Hard'],
  
  // Thickness and firmness combinations (matches your spreadsheet exactly)
  specifications: {
    '6': {
      'Medium-firm': {
        depth: '6" inch / 15cm - Standard support',
        firmness: 'Medium-firm',
        supplierCode: '1" Blue Foam Base Layer',
        topLayer: '5" White Firm Foam Top Layer',
        cover: 'Tencel Leaf Cover'
      },
      'Firm Orthopaedic': {
        depth: '6" inch / 15cm - Standard support',
        firmness: 'Firm Orthopaedic',
        supplierCode: '2" Blue Foam Base Layer',
        topLayer: '4" White Firm Foam Top Layer',
        cover: 'Tencel Leaf Cover'
      },
      'Hard': {
        depth: '6" inch / 15cm - Standard support',
        firmness: 'Hard',
        supplierCode: '5" Blue Foam Base Layer',
        topLayer: '1" White Firm Foam Top Layer',
        cover: 'Tencel Leaf Cover'
      }
    },
    '8': {
      'Medium-firm': {
        depth: '8" inch / 20cm - Premium support',
        firmness: 'Medium-firm',
        supplierCode: '1" Blue Foam Base Layer',
        topLayer: '7" White Firm Foam Top Layer',
        cover: 'Tencel Leaf Cover'
      },
      'Firm Orthopaedic': {
        depth: '8" inch / 20cm - Premium support',
        firmness: 'Firm Orthopaedic',
        supplierCode: '3" Blue Foam Base Layer',
        topLayer: '5" White Firm Foam Top Layer',
        cover: 'Tencel Leaf Cover'
      },
      'Hard': {
        depth: '8" inch / 20cm - Premium support',
        firmness: 'Hard',
        supplierCode: '7" Blue Foam Base Layer',
        topLayer: '1" White Firm Foam Top Layer',
        cover: 'Tencel Leaf Cover'
      }
    },
    '10': {
      'Medium-firm': {
        depth: '10" inch / 25cm - Luxury support',
        firmness: 'Medium-firm',
        supplierCode: '1" Blue Foam Base Layer',
        topLayer: '9" White Firm Foam Top Layer',
        cover: 'Tencel Leaf Cover'
      },
      'Firm Orthopaedic': {
        depth: '10" inch / 25cm - Luxury support',
        firmness: 'Firm Orthopaedic',
        supplierCode: '2" Blue Foam Base Layer',
        topLayer: '8" White Firm Foam Top Layer',
        cover: 'Tencel Leaf Cover'
      },
      'Hard': {
        depth: '10" inch / 25cm - Luxury support',
        firmness: 'Hard',
        supplierCode: '9" Blue Foam Base Layer',
        topLayer: '1" White Firm Foam Top Layer',
        cover: 'Tencel Leaf Cover'
      }
    }
  }
};

// ============================================================================
// COMFISAN MATTRESS DETECTION
// ============================================================================

/**
 * Check if product is a Comfisan mattress
 */
function isComfisanMattress(productTitle, handle = null) {
  const title = productTitle.toLowerCase();
  const handleText = handle ? handle.toLowerCase() : '';
  
  return title.startsWith('comfisan') || handleText.startsWith('comfisan') ||
         title.includes('comfi') || handleText.includes('comfi');
}

// ============================================================================
// COMFISAN MATTRESS PARSING
// ============================================================================

/**
 * Extract thickness from Comfisan mattress product data
 */
function extractThickness(productTitle, productVariant = null, productProperties = null) {
  console.log(`[Comfisan] Extracting thickness from: ${productTitle}`);
  
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
      if (COMFISAN_SPECS.specifications[thickness]) {
        console.log(`[Comfisan] Found valid thickness in title: ${thickness}"`);
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
        if (COMFISAN_SPECS.specifications[thickness]) {
          console.log(`[Comfisan] Found valid thickness in variant: ${thickness}"`);
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
        if (match && COMFISAN_SPECS.specifications[match[1]]) {
          console.log(`[Comfisan] Found thickness in properties: ${match[1]}"`);
          return match[1];
        }
      }
    }
  }

  console.log(`[Comfisan] No thickness found, defaulting to 6"`);
  return '6'; // Default thickness
}

/**
 * Extract firmness from Comfisan mattress product data
 */
function extractFirmness(productTitle, productVariant = null, productProperties = null) {
  console.log(`[Comfisan] Extracting firmness from product data`);
  
  // Check properties first (most reliable for Shopify orders)
  if (productProperties && Array.isArray(productProperties)) {
    for (const prop of productProperties) {
      if (prop.name && prop.name.toLowerCase().includes('firmness')) {
        const firmness = prop.value;
        if (COMFISAN_SPECS.firmnessOptions.includes(firmness)) {
          console.log(`[Comfisan] Found firmness in properties: ${firmness}`);
          return firmness;
        }
      }
    }
  }

  // Check variant title
  if (productVariant && productVariant.title) {
    const variantLower = productVariant.title.toLowerCase();
    
    if (variantLower.includes('firm orthopaedic') || variantLower.includes('firm orthopedic')) {
      console.log(`[Comfisan] Found firmness in variant: Firm Orthopaedic`);
      return 'Firm Orthopaedic';
    }
    if (variantLower.includes('hard')) {
      console.log(`[Comfisan] Found firmness in variant: Hard`);
      return 'Hard';
    }
    if (variantLower.includes('medium-firm') || variantLower.includes('medium firm')) {
      console.log(`[Comfisan] Found firmness in variant: Medium-firm`);
      return 'Medium-firm';
    }
  }

  // Check product title
  const titleLower = productTitle.toLowerCase();
  if (titleLower.includes('firm orthopaedic') || titleLower.includes('firm orthopedic')) {
    console.log(`[Comfisan] Found firmness in title: Firm Orthopaedic`);
    return 'Firm Orthopaedic';
  }
  if (titleLower.includes('hard')) {
    console.log(`[Comfisan] Found firmness in title: Hard`);
    return 'Hard';
  }
  if (titleLower.includes('medium-firm') || titleLower.includes('medium firm')) {
    console.log(`[Comfisan] Found firmness in title: Medium-firm`);
    return 'Medium-firm';
  }

  console.log(`[Comfisan] No firmness found, defaulting to Medium-firm`);
  return 'Medium-firm'; // Default firmness
}

// ============================================================================
// COMFISAN MATTRESS SPECIFICATION GENERATION
// ============================================================================

/**
 * Generate supplier specification for Comfisan mattress
 */
function generateSpecification(thickness, firmness) {
  console.log(`[Comfisan] Generating specification for ${thickness}" ${firmness}`);
  
  const spec = COMFISAN_SPECS.specifications[thickness]?.[firmness];
  
  if (!spec) {
    console.error(`[Comfisan] No specification found for ${thickness}" ${firmness}`);
    return null;
  }

  // Format: [Supplier Code] + [Top Layer] + [Cover]
  const fullSpecification = `${spec.supplierCode} + ${spec.topLayer} + ${spec.cover}`;
  
  const result = {
    mattressType: 'Comfisan',
    thickness: thickness,
    firmness: firmness,
    depth: spec.depth,
    supplierCode: spec.supplierCode,
    topLayer: spec.topLayer,
    cover: spec.cover,
    fullSpecification: fullSpecification,
    confidence: 95 // High confidence - clear specification table
  };

  console.log(`[Comfisan] Generated: ${fullSpecification}`);
  return result;
}

// ============================================================================
// MAIN MAPPING FUNCTION
// ============================================================================

/**
 * Main mapping function for Comfisan mattress
 */
function mapComfisanMattress(productTitle, productVariant = null, productProperties = null, shopifySku = null) {
  console.log(`\n=== MAPPING COMFISAN MATTRESS ===`);
  console.log(`Product: ${productTitle}`);
  console.log(`SKU: ${shopifySku || 'Not provided'}`);
  
  try {
    // 1. Verify this is a Comfisan mattress
    if (!isComfisanMattress(productTitle)) {
      return {
        success: false,
        error: 'Product is not a Comfisan mattress',
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
        error: 'Could not generate Comfisan mattress specification',
        confidence: 0
      };
    }

    // 4. Return successful mapping
    return {
      success: true,
      mattressType: 'Comfisan',
      specification: specification,
      confidence: specification.confidence,
      debugInfo: {
        extractedThickness: thickness,
        extractedFirmness: firmness,
        availableThicknesses: Object.keys(COMFISAN_SPECS.specifications),
        availableFirmness: COMFISAN_SPECS.firmnessOptions,
        matchedSpec: COMFISAN_SPECS.specifications[thickness]?.[firmness]
      }
    };

  } catch (error) {
    console.error(`[Comfisan] Mapping error:`, error);
    return {
      success: false,
      error: `Comfisan mapping failed: ${error.message}`,
      confidence: 0
    };
  }
}

// ============================================================================
// TESTING FUNCTIONS
// ============================================================================

/**
 * Test Comfisan mattress mapping with various inputs
 */
function testMapping() {
  console.log('\n=== TESTING COMFISAN MATTRESS MAPPING ===\n');
  
  const testCases = [
    {
      name: 'Comfisan 6" Medium-firm',
      title: 'Comfisan Rectangular Caravan Mattress - Single',
      variant: { title: '6" inch / 15cm - Standard support' },
      properties: [{ name: 'Firmness', value: 'Medium-firm' }],
      expected: '1" Blue Foam Base Layer + 5" White Firm Foam Top Layer + Tencel Leaf Cover'
    },
    {
      name: 'Comfisan 8" Firm Orthopaedic',
      title: 'Comfisan Bunk Bed Mattress - Double',
      variant: { title: '8" inch / 20cm - Premium support' },
      properties: [{ name: 'Firmness', value: 'Firm Orthopaedic' }],
      expected: '3" Blue Foam Base Layer + 5" White Firm Foam Top Layer + White Tencel Leaf Cover'
    },
    {
      name: 'Comfisan 10" Hard',
      title: 'Comfisan Cut Corner Mattress - King',
      variant: { title: '10" inch / 25cm - Luxury support' },
      properties: [{ name: 'Firmness', value: 'Hard' }],
      expected: '9" Blue Foam Base Layer + 1" White Firm Foam Top Layer + White Tencel Leaf Cover'
    },
    {
      name: 'Comfisan with firmness in variant',
      title: 'Comfisan Custom Shape Mattress - Single',
      variant: { title: '6" inch / 15cm - Hard Support' },
      properties: [],
      expected: '5" Blue Foam Base Layer + 1" White Firm Foam Top Layer + White Tencel Leaf Cover'
    },
    {
      name: 'Comfisan default values',
      title: 'Comfisan Narrow Left Cut Mattress - Single',
      variant: null,
      properties: [],
      expected: '1" Blue Foam Base Layer + 5" White Firm Foam Top Layer + White Tencel Leaf Cover'
    }
  ];

  testCases.forEach((testCase, index) => {
    console.log(`--- Test ${index + 1}: ${testCase.name} ---`);
    
    const result = mapComfisanMattress(testCase.title, testCase.variant, testCase.properties);
    
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
  isComfisanMattress,
  mapComfisanMattress,
  
  // Helper functions  
  extractThickness,
  extractFirmness,
  generateSpecification,
  
  // Testing
  testMapping,
  
  // Configuration
  COMFISAN_SPECS,
  
  // Metadata
  mattressType: 'Comfisan',
  version: '1.0.0',
  lastUpdated: new Date().toISOString()
};

// Auto-run tests if file executed directly
if (require.main === module) {
  testMapping();
}
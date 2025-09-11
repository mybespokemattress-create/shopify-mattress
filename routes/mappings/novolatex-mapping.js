// Novolatex Mattress Mapping System
// File: routes/mappings/novolatex-mapping.js

// ============================================================================
// NOVOLATEX MATTRESS SPECIFICATION TABLE
// ============================================================================

const NOVOLATEX_SPECS = {
  mattressType: 'Novolatex',
  skuPrefix: 'Novo',
  
  // Novolatex has three firmness options
  firmnessOptions: ['Medium', 'Medium Firm Orthopaedic', 'Hard'],
  
  // Complex 3-layer structure: Base + Middle + Top + Cover
  specifications: {
    '6': {
      'Medium': {
        depth: '6" inch / 15cm - Standard support',
        firmness: 'Medium',
        baseLayer: '1" 33/175 Blue Base Layer',
        middleLayer: '2" RF39/120 Peach Middle Layer',
        topLayer: '3" 30/130 White Top Layer',
        cover: 'Diamond Stem Cover'
      },
      'Medium Firm Orthopaedic': {
        depth: '6" inch / 15cm - Standard support',
        firmness: 'Medium Firm Orthopaedic',
        baseLayer: '2" 33/175 Blue Base Layer',
        middleLayer: '2" RF39/120 Peach Middle Layer',
        topLayer: '2" 30/130 White Top Layer',
        cover: 'Diamond Stem Cover'
      },
      'Hard': {
        depth: '6" inch / 15cm - Standard support',
        firmness: 'Hard',
        baseLayer: '4" 33/175 Blue Base Layer',
        middleLayer: '1" RF39/120 Peach Middle Layer',
        topLayer: '1" 30/130 White Top Layer',
        cover: 'Diamond Stem Cover'
      }
    },
    '8': {
      'Medium': {
        depth: '8" inch / 20cm - Premium support',
        firmness: 'Medium',
        baseLayer: '1" 33/175 Blue Base Layer',
        middleLayer: '3" RF39/120 Peach Middle Layer',
        topLayer: '4" 30/130 White Top Layer',
        cover: 'Diamond Stem Cover'
      },
      'Medium Firm Orthopaedic': {
        depth: '8" inch / 20cm - Premium support',
        firmness: 'Medium Firm Orthopaedic',
        baseLayer: '2" 33/175 Blue Base Layer',
        middleLayer: '3" RF39/120 Peach Middle Layer',
        topLayer: '3" 30/130 White Top Layer',
        cover: 'Diamond Stem Cover'
      },
      'Hard': {
        depth: '8" inch / 20cm - Premium support',
        firmness: 'Hard',
        baseLayer: '6" 33/175 Blue Base Layer',
        middleLayer: '1" RF39/120 Peach Middle Layer',
        topLayer: '1" 30/130 White Top Layer',
        cover: 'Diamond Stem Cover'
      }
    },
    '10': {
      'Medium': {
        depth: '10" inch / 25cm - Luxury support',
        firmness: 'Medium',
        baseLayer: '1" 33/175 Blue Base Layer',
        middleLayer: '4" RF39/120 Peach Middle Layer',
        topLayer: '5" 30/130 White Top Layer',
        cover: 'Diamond Stem Cover'
      },
      'Medium Firm Orthopaedic': {
        depth: '10" inch / 25cm - Luxury support',
        firmness: 'Medium Firm Orthopaedic',
        baseLayer: '2" 33/175 Blue Base Layer',
        middleLayer: '4" RF39/120 Peach Middle Layer',
        topLayer: '4" 30/130 White Top Layer',
        cover: 'Diamond Stem Cover'
      },
      'Hard': {
        depth: '10" inch / 25cm - Luxury support',
        firmness: 'Hard',
        baseLayer: '8" 33/175 Blue Base Layer',
        middleLayer: '1" RF39/120 Peach Middle Layer',
        topLayer: '1" 30/130 White Top Layer',
        cover: 'Diamond Stem Cover'
      }
    }
  }
};

// ============================================================================
// NOVOLATEX MATTRESS DETECTION
// ============================================================================

/**
 * Check if product is a Novolatex mattress
 */
function isNovolatexMattress(productTitle, shopifySku = null, handle = null) {
  // PRIMARY METHOD: Check SKU prefix
  if (shopifySku) {
    const skuLower = shopifySku.toLowerCase();
    if (skuLower.startsWith('novo')) {
      console.log(`[Novolatex] Detected via SKU prefix: ${shopifySku}`);
      return true;
    }
  }
  
  // FALLBACK METHOD: Check product title and handle
  const title = productTitle.toLowerCase();
  const handleText = handle ? handle.toLowerCase() : '';
  
  const titleMatch = title.startsWith('novolatex') || handleText.startsWith('novolatex') ||
                    title.includes('novo') || handleText.includes('novo');
  
  if (titleMatch) {
    console.log(`[Novolatex] Detected via title/handle: ${productTitle}`);
    return true;
  }
  
  return false;
}

// ============================================================================
// NOVOLATEX MATTRESS PARSING
// ============================================================================

/**
 * Extract thickness from Novolatex mattress product data
 */
function extractThickness(productTitle, productVariant = null, productProperties = null) {
  console.log(`[Novolatex] Extracting thickness from: ${productTitle}`);
  
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
      if (NOVOLATEX_SPECS.specifications[thickness]) {
        console.log(`[Novolatex] Found valid thickness in title: ${thickness}"`);
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
        if (NOVOLATEX_SPECS.specifications[thickness]) {
          console.log(`[Novolatex] Found valid thickness in variant: ${thickness}"`);
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
        if (match && NOVOLATEX_SPECS.specifications[match[1]]) {
          console.log(`[Novolatex] Found thickness in properties: ${match[1]}"`);
          return match[1];
        }
      }
    }
  }

  console.log(`[Novolatex] No thickness found, defaulting to 6"`);
  return '6'; // Default thickness
}

/**
 * Extract firmness from Novolatex mattress product data
 */
function extractFirmness(productTitle, productVariant = null, productProperties = null) {
  console.log(`[Novolatex] Extracting firmness from product data`);
  
  // Check properties first (most reliable for Shopify orders)
  if (productProperties && Array.isArray(productProperties)) {
    for (const prop of productProperties) {
      if (prop.name && prop.name.toLowerCase().includes('firmness')) {
        const firmness = prop.value;
        if (NOVOLATEX_SPECS.firmnessOptions.includes(firmness)) {
          console.log(`[Novolatex] Found firmness in properties: ${firmness}`);
          return firmness;
        }
      }
    }
  }

  // Check variant title
  if (productVariant && productVariant.title) {
    const variantLower = productVariant.title.toLowerCase();
    
    if (variantLower.includes('medium firm orthopaedic') || variantLower.includes('medium firm orthopedic')) {
      console.log(`[Novolatex] Found firmness in variant: Medium Firm Orthopaedic`);
      return 'Medium Firm Orthopaedic';
    }
    if (variantLower.includes('hard')) {
      console.log(`[Novolatex] Found firmness in variant: Hard`);
      return 'Hard';
    }
    if (variantLower.includes('medium') && !variantLower.includes('firm')) {
      console.log(`[Novolatex] Found firmness in variant: Medium`);
      return 'Medium';
    }
  }

  // Check product title
  const titleLower = productTitle.toLowerCase();
  if (titleLower.includes('medium firm orthopaedic') || titleLower.includes('medium firm orthopedic')) {
    console.log(`[Novolatex] Found firmness in title: Medium Firm Orthopaedic`);
    return 'Medium Firm Orthopaedic';
  }
  if (titleLower.includes('hard')) {
    console.log(`[Novolatex] Found firmness in title: Hard`);
    return 'Hard';
  }
  if (titleLower.includes('medium') && !titleLower.includes('firm')) {
    console.log(`[Novolatex] Found firmness in title: Medium`);
    return 'Medium';
  }

  console.log(`[Novolatex] No firmness found, defaulting to Medium`);
  return 'Medium'; // Default firmness
}

// ============================================================================
// NOVOLATEX MATTRESS SPECIFICATION GENERATION
// ============================================================================

/**
 * Generate supplier specification for Novolatex mattress
 */
function generateSpecification(thickness, firmness) {
  console.log(`[Novolatex] Generating specification for ${thickness}" ${firmness}`);
  
  const spec = NOVOLATEX_SPECS.specifications[thickness]?.[firmness];
  
  if (!spec) {
    console.error(`[Novolatex] No specification found for ${thickness}" ${firmness}`);
    return null;
  }

  // Format: [Base Layer] + [Middle Layer] + [Top Layer] + [Cover]
  const fullSpecification = `${spec.baseLayer} + ${spec.middleLayer} + ${spec.topLayer} + ${spec.cover}`;
  
  const result = {
    mattressType: 'Novolatex',
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

  console.log(`[Novolatex] Generated: ${fullSpecification}`);
  return result;
}

// ============================================================================
// MAIN MAPPING FUNCTION
// ============================================================================

/**
 * Main mapping function for Novolatex mattress
 */
function mapNovolatexMattress(productTitle, productVariant = null, productProperties = null, shopifySku = null) {
  console.log(`\n=== MAPPING NOVOLATEX MATTRESS ===`);
  console.log(`Product: ${productTitle}`);
  console.log(`SKU: ${shopifySku || 'Not provided'}`);
  
  try {
    // 1. Verify this is a Novolatex mattress
    if (!isNovolatexMattress(productTitle, shopifySku)) {
      return {
        success: false,
        error: 'Product is not a Novolatex mattress',
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
        error: 'Could not generate Novolatex mattress specification',
        confidence: 0
      };
    }

    // 4. Return successful mapping
    return {
      success: true,
      mattressType: 'Novolatex',
      specification: specification,
      confidence: specification.confidence,
      debugInfo: {
        extractedThickness: thickness,
        extractedFirmness: firmness,
        availableThicknesses: Object.keys(NOVOLATEX_SPECS.specifications),
        availableFirmness: NOVOLATEX_SPECS.firmnessOptions,
        matchedSpec: NOVOLATEX_SPECS.specifications[thickness]?.[firmness]
      }
    };

  } catch (error) {
    console.error(`[Novolatex] Mapping error:`, error);
    return {
      success: false,
      error: `Novolatex mapping failed: ${error.message}`,
      confidence: 0
    };
  }
}

// ============================================================================
// TESTING FUNCTIONS
// ============================================================================

/**
 * Test Novolatex mattress mapping with various inputs
 */
function testMapping() {
  console.log('\n=== TESTING NOVOLATEX MATTRESS MAPPING ===\n');
  
  const testCases = [
    {
      name: 'Novolatex 6" Medium',
      title: 'Novolatex Rectangular Caravan Mattress - Single',
      variant: { title: '6" inch / 15cm - Standard support' },
      properties: [{ name: 'Firmness', value: 'Medium' }],
      expected: '1" 33/175 Blue Base Layer + 2" RF39/120 Peach Middle Layer + 3" 30/130 White Top Layer + Diamond Stem Cover'
    },
    {
      name: 'Novolatex 8" Medium Firm Orthopaedic',
      title: 'Novolatex Bunk Bed Mattress - Double',
      variant: { title: '8" inch / 20cm - Premium support' },
      properties: [{ name: 'Firmness', value: 'Medium Firm Orthopaedic' }],
      expected: '2" 33/175 Blue Base Layer + 3" RF39/120 Peach Middle Layer + 3" 30/130 White Top Layer + Diamond Stem Cover'
    },
    {
      name: 'Novolatex 10" Hard',
      title: 'Novolatex Cut Corner Mattress - King',
      variant: { title: '10" inch / 25cm - Luxury support' },
      properties: [{ name: 'Firmness', value: 'Hard' }],
      expected: '8" 33/175 Blue Base Layer + 1" RF39/120 Peach Middle Layer + 1" 30/130 White Top Layer + Diamond Stem Cover'
    },
    {
      name: 'Novolatex with firmness in variant title',
      title: 'Novolatex Custom Shape Mattress - Single',
      variant: { title: '6" inch / 15cm - Hard Support' },
      properties: [],
      expected: '4" 33/175 Blue Base Layer + 1" RF39/120 Peach Middle Layer + 1" 30/130 White Top Layer + Diamond Stem Cover'
    },
    {
      name: 'Novolatex default values',
      title: 'Novolatex Narrow Left Cut Mattress - Single',
      variant: null,
      properties: [],
      expected: '1" 33/175 Blue Base Layer + 2" RF39/120 Peach Middle Layer + 3" 30/130 White Top Layer + Diamond Stem Cover'
    },
    {
      name: 'Novolatex with SKU detection',
      title: 'Novo Custom Mattress - Double',
      variant: { title: '8" inch / 20cm - Premium support' },
      properties: [{ name: 'Firmness', value: 'Medium' }],
      expected: '1" 33/175 Blue Base Layer + 3" RF39/120 Peach Middle Layer + 4" 30/130 White Top Layer + Diamond Stem Cover'
    }
  ];

  testCases.forEach((testCase, index) => {
    console.log(`--- Test ${index + 1}: ${testCase.name} ---`);
    
    const result = mapNovolatexMattress(testCase.title, testCase.variant, testCase.properties);
    
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
  isNovolatexMattress,
  mapNovolatexMattress,
  
  // Helper functions  
  extractThickness,
  extractFirmness,
  generateSpecification,
  
  // Testing
  testMapping,
  
  // Configuration
  NOVOLATEX_SPECS,
  
  // Metadata
  mattressType: 'Novolatex',
  version: '1.0.0',
  lastUpdated: new Date().toISOString()
};

// Auto-run tests if file executed directly
if (require.main === module) {
  testMapping();
}
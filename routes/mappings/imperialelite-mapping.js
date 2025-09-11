// Imperial Elite Mattress Mapping System
// File: routes/mappings/imperialelite-mapping.js

// ============================================================================
// IMPERIAL ELITE MATTRESS SPECIFICATION TABLE
// ============================================================================

const IMPERIALELITE_SPECS = {
  mattressType: 'Imperial Elite',
  skuPrefix: 'Imperial',
  
  // Imperial Elite has three firmness options
  firmnessOptions: ['Medium', 'Firm Orthopaedic', 'Hard'],
  
  // Complex multi-layer structure with pocket springs (only 10" available)
  specifications: {
    '10': {
      'Medium': {
        depth: '10" inch / 25cm - Luxury support',
        firmness: 'Medium',
        baseLayer: '2000 Pocket Springs',
        layer2: '1" White Foam',
        layer3: '1" V50 Memory Foam',
        layer4: '1" Cool Gel',
        cover: 'Cashmere Cover + White Tape Edge + Gold Borders + Side Handles'
      },
      'Firm Orthopaedic': {
        depth: '10" inch / 25cm - Luxury support',
        firmness: 'Firm Orthopaedic',
        baseLayer: '2000 Pocket Springs',
        layer2: '1" White Foam',
        layer3: '1" V50 Memory Foam',
        layer4: '1" Cool Gel',
        cover: 'Cashmere Cover + White Tape Edge + Gold Borders + Side Handles'
      },
      'Hard': {
        depth: '10" inch / 25cm - Luxury support',
        firmness: 'Hard',
        baseLayer: '2000 Pocket Springs + Felt + Half tufting',
        layer2: '1" Blue Foam',
        layer3: '1" V50 Memory Foam',
        layer4: '1" Cool Gel',
        cover: 'Cashmere Cover + White Tape Edge + Gold Borders + Side Handles'
      }
    }
  }
};

// ============================================================================
// IMPERIAL ELITE MATTRESS DETECTION
// ============================================================================

/**
 * Check if product is an Imperial Elite mattress
 */
function isImperialEliteMattress(productTitle, shopifySku = null, handle = null) {
  // PRIMARY METHOD: Check SKU prefix
  if (shopifySku) {
    const skuLower = shopifySku.toLowerCase();
    if (skuLower.startsWith('imperial')) {
      console.log(`[Imperial Elite] Detected via SKU prefix: ${shopifySku}`);
      return true;
    }
  }
  
  // FALLBACK METHOD: Check product title and handle
  const title = productTitle.toLowerCase();
  const handleText = handle ? handle.toLowerCase() : '';
  
  const titleMatch = title.startsWith('imperial elite') || handleText.startsWith('imperial elite') ||
                    title.includes('imperialelite') || handleText.includes('imperialelite') ||
                    title.startsWith('imperial') || handleText.startsWith('imperial');
  
  if (titleMatch) {
    console.log(`[Imperial Elite] Detected via title/handle: ${productTitle}`);
    return true;
  }
  
  return false;
}

// ============================================================================
// IMPERIAL ELITE MATTRESS PARSING
// ============================================================================

/**
 * Extract thickness from Imperial Elite mattress product data
 */
function extractThickness(productTitle, productVariant = null, productProperties = null) {
  console.log(`[Imperial Elite] Extracting thickness from: ${productTitle}`);
  
  // Imperial Elite only comes in 10" thickness
  // But we still check for patterns to validate
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
      // Convert to 10" if other thickness found (Imperial Elite only has 10")
      if (thickness === '10' || thickness === '25') {
        console.log(`[Imperial Elite] Found valid thickness: 10"`);
        return '10';
      }
    }
  }

  // Check variant title
  if (productVariant && productVariant.title) {
    for (const pattern of patterns) {
      const match = productVariant.title.match(pattern);
      if (match) {
        const thickness = match[1];
        if (thickness === '10' || thickness === '25') {
          console.log(`[Imperial Elite] Found valid thickness in variant: 10"`);
          return '10';
        }
      }
    }
  }

  // Check properties
  if (productProperties && Array.isArray(productProperties)) {
    for (const prop of productProperties) {
      if (prop.name && prop.name.toLowerCase().includes('thickness')) {
        const match = prop.value.match(/(\d+)/);
        if (match && (match[1] === '10' || match[1] === '25')) {
          console.log(`[Imperial Elite] Found thickness in properties: 10"`);
          return '10';
        }
      }
    }
  }

  console.log(`[Imperial Elite] No specific thickness found, using default 10"`);
  return '10'; // Imperial Elite only comes in 10"
}

/**
 * Extract firmness from Imperial Elite mattress product data
 */
function extractFirmness(productTitle, productVariant = null, productProperties = null) {
  console.log(`[Imperial Elite] Extracting firmness from product data`);
  
  // Check properties first (most reliable for Shopify orders)
  if (productProperties && Array.isArray(productProperties)) {
    for (const prop of productProperties) {
      if (prop.name && prop.name.toLowerCase().includes('firmness')) {
        const firmness = prop.value;
        if (IMPERIALELITE_SPECS.firmnessOptions.includes(firmness)) {
          console.log(`[Imperial Elite] Found firmness in properties: ${firmness}`);
          return firmness;
        }
      }
    }
  }

  // Check variant title
  if (productVariant && productVariant.title) {
    const variantLower = productVariant.title.toLowerCase();
    
    if (variantLower.includes('firm orthopaedic') || variantLower.includes('firm orthopedic')) {
      console.log(`[Imperial Elite] Found firmness in variant: Firm Orthopaedic`);
      return 'Firm Orthopaedic';
    }
    if (variantLower.includes('hard')) {
      console.log(`[Imperial Elite] Found firmness in variant: Hard`);
      return 'Hard';
    }
    if (variantLower.includes('medium') && !variantLower.includes('firm')) {
      console.log(`[Imperial Elite] Found firmness in variant: Medium`);
      return 'Medium';
    }
  }

  // Check product title
  const titleLower = productTitle.toLowerCase();
  if (titleLower.includes('firm orthopaedic') || titleLower.includes('firm orthopedic')) {
    console.log(`[Imperial Elite] Found firmness in title: Firm Orthopaedic`);
    return 'Firm Orthopaedic';
  }
  if (titleLower.includes('hard')) {
    console.log(`[Imperial Elite] Found firmness in title: Hard`);
    return 'Hard';
  }
  if (titleLower.includes('medium') && !titleLower.includes('firm')) {
    console.log(`[Imperial Elite] Found firmness in title: Medium`);
    return 'Medium';
  }

  console.log(`[Imperial Elite] No firmness found, defaulting to Medium`);
  return 'Medium'; // Default firmness
}

// ============================================================================
// IMPERIAL ELITE MATTRESS SPECIFICATION GENERATION
// ============================================================================

/**
 * Generate supplier specification for Imperial Elite mattress
 */
function generateSpecification(thickness, firmness) {
  console.log(`[Imperial Elite] Generating specification for ${thickness}" ${firmness}`);
  
  const spec = IMPERIALELITE_SPECS.specifications[thickness]?.[firmness];
  
  if (!spec) {
    console.error(`[Imperial Elite] No specification found for ${thickness}" ${firmness}`);
    return null;
  }

  // Format: [Base Layer] + [Layer 2] + [Layer 3] + [Layer 4] + [Cover]
  const fullSpecification = `${spec.baseLayer} + ${spec.layer2} + ${spec.layer3} + ${spec.layer4} + ${spec.cover}`;
  
  const result = {
    mattressType: 'Imperial Elite',
    thickness: thickness,
    firmness: firmness,
    depth: spec.depth,
    baseLayer: spec.baseLayer,
    layer2: spec.layer2,
    layer3: spec.layer3,
    layer4: spec.layer4,
    cover: spec.cover,
    fullSpecification: fullSpecification,
    confidence: 95 // High confidence - clear specification table
  };

  console.log(`[Imperial Elite] Generated: ${fullSpecification}`);
  return result;
}

// ============================================================================
// MAIN MAPPING FUNCTION
// ============================================================================

/**
 * Main mapping function for Imperial Elite mattress
 */
function mapImperialEliteMattress(productTitle, productVariant = null, productProperties = null, shopifySku = null) {
  console.log(`\n=== MAPPING IMPERIAL ELITE MATTRESS ===`);
  console.log(`Product: ${productTitle}`);
  console.log(`SKU: ${shopifySku || 'Not provided'}`);
  
  try {
    // 1. Verify this is an Imperial Elite mattress
    if (!isImperialEliteMattress(productTitle, shopifySku)) {
      return {
        success: false,
        error: 'Product is not an Imperial Elite mattress',
        confidence: 0
      };
    }

    // 2. Extract thickness and firmness
    const thickness = extractThickness(productTitle, productVariant, productProperties);
    const firmness = extractFirmness(productTitle, productVariant, productProperties);
    
    // 3. Validate thickness (Imperial Elite only has 10")
    if (thickness !== '10') {
      console.log(`[Imperial Elite] Invalid thickness ${thickness}", adjusting to 10"`);
      thickness = '10';
    }
    
    // 4. Generate specification
    const specification = generateSpecification(thickness, firmness);
    
    if (!specification) {
      return {
        success: false,
        error: 'Could not generate Imperial Elite mattress specification',
        confidence: 0
      };
    }

    // 5. Return successful mapping
    return {
      success: true,
      mattressType: 'Imperial Elite',
      specification: specification,
      confidence: specification.confidence,
      debugInfo: {
        extractedThickness: thickness,
        extractedFirmness: firmness,
        availableThicknesses: Object.keys(IMPERIALELITE_SPECS.specifications),
        availableFirmness: IMPERIALELITE_SPECS.firmnessOptions,
        matchedSpec: IMPERIALELITE_SPECS.specifications[thickness]?.[firmness]
      }
    };

  } catch (error) {
    console.error(`[Imperial Elite] Mapping error:`, error);
    return {
      success: false,
      error: `Imperial Elite mapping failed: ${error.message}`,
      confidence: 0
    };
  }
}

// ============================================================================
// TESTING FUNCTIONS
// ============================================================================

/**
 * Test Imperial Elite mattress mapping with various inputs
 */
function testMapping() {
  console.log('\n=== TESTING IMPERIAL ELITE MATTRESS MAPPING ===\n');
  
  const testCases = [
    {
      name: 'Imperial Elite 10" Medium',
      title: 'Imperial Elite Rectangular Caravan Mattress - Single',
      variant: { title: '10" inch / 25cm - Luxury support' },
      properties: [{ name: 'Firmness', value: 'Medium' }],
      expected: '2000 Pocket Springs + 1" White Foam + 1" V50 Memory Foam + 1" Cool Gel + Cashmere Cover + White Tape Edge + Gold Borders + Side Handles'
    },
    {
      name: 'Imperial Elite 10" Firm Orthopaedic',
      title: 'Imperial Elite Cut Corner Mattress - Double',
      variant: { title: '10" inch / 25cm - Luxury support' },
      properties: [{ name: 'Firmness', value: 'Firm Orthopaedic' }],
      expected: '2000 Pocket Springs + 1" White Foam + 1" V50 Memory Foam + 1" Cool Gel + Cashmere Cover + White Tape Edge + Gold Borders + Side Handles'
    },
    {
      name: 'Imperial Elite 10" Hard',
      title: 'Imperial Elite Island Mattress - King',
      variant: { title: '10" inch / 25cm - Luxury support' },
      properties: [{ name: 'Firmness', value: 'Hard' }],
      expected: '2000 Pocket Springs + Felt + Half tufting + 1" Blue Foam + 1" V50 Memory Foam + 1" Cool Gel + Cashmere Cover + White Tape Edge + Gold Borders + Side Handles'
    },
    {
      name: 'Imperial Elite with firmness in variant title',
      title: 'Imperial Elite Custom Shape Mattress - Double',
      variant: { title: '10" inch / 25cm - Hard Luxury support' },
      properties: [],
      expected: '2000 Pocket Springs + Felt + Half tufting + 1" Blue Foam + 1" V50 Memory Foam + 1" Cool Gel + Cashmere Cover + White Tape Edge + Gold Borders + Side Handles'
    },
    {
      name: 'Imperial Elite default values',
      title: 'Imperial Elite Narrow Left Cut Mattress - Single',
      variant: null,
      properties: [],
      expected: '2000 Pocket Springs + 1" White Foam + 1" V50 Memory Foam + 1" Cool Gel + Cashmere Cover + White Tape Edge + Gold Borders + Side Handles'
    },
    {
      name: 'Imperial Elite short title',
      title: 'Imperial Bunk Bed Mattress - Single',
      variant: { title: '10" inch / 25cm - Luxury support' },
      properties: [{ name: 'Firmness', value: 'Medium' }],
      expected: '2000 Pocket Springs + 1" White Foam + 1" V50 Memory Foam + 1" Cool Gel + Cashmere Cover + White Tape Edge + Gold Borders + Side Handles'
    }
  ];

  testCases.forEach((testCase, index) => {
    console.log(`--- Test ${index + 1}: ${testCase.name} ---`);
    
    const result = mapImperialEliteMattress(testCase.title, testCase.variant, testCase.properties);
    
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
  isImperialEliteMattress,
  mapImperialEliteMattress,
  
  // Helper functions  
  extractThickness,
  extractFirmness,
  generateSpecification,
  
  // Testing
  testMapping,
  
  // Configuration
  IMPERIALELITE_SPECS,
  
  // Metadata
  mattressType: 'Imperial Elite',
  version: '1.0.0',
  lastUpdated: new Date().toISOString()
};

// Auto-run tests if file executed directly
if (require.main === module) {
  testMapping();
}
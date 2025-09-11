// Essential Mattress Mapping System
// File: routes/mappings/essential-mapping.js

// ============================================================================
// ESSENTIAL MATTRESS SPECIFICATION TABLE
// ============================================================================

const ESSENTIAL_SPECS = {
  mattressType: 'Essential',
  skuPrefix: 'Essential',
  
  // Essential only has one firmness option
  firmnessOptions: ['Medium-Firm'],
  
  // Thickness specifications (matches your spreadsheet exactly)
  specifications: {
    '2': {
      depth: '2" inch / 5cm - Ultra-light support',
      firmness: 'Medium-Firm',
      supplierCode: '2" 30/130 White Foam Base Layer',
      cover: 'Raoul Knit Zip Cover'
    },
    '3': {
      depth: '3" inch / 7.5cm - Light support',
      firmness: 'Medium-Firm', 
      supplierCode: '3" 30/130 White Foam Base Layer',
      cover: 'Raoul Knit Zip Cover'
    },
    '4': {
      depth: '4" inch / 10cm - Basic support',
      firmness: 'Medium-Firm',
      supplierCode: '4" 30/130 White Foam Base Layer', 
      cover: 'Raoul Knit Zip Cover'
    },
    '6': {
      depth: '6" inch / 15cm - Standard support',
      firmness: 'Medium-Firm',
      supplierCode: '6" 30/130 White Foam Base Layer',
      cover: 'Raoul Knit Zip Cover'
    },
    '8': {
      depth: '8" inch / 20cm - Premium support',
      firmness: 'Medium-Firm',
      supplierCode: '8" 30/130 White Foam Base Layer',
      cover: 'Raoul Knit Zip Cover'
    },
    '10': {
      depth: '10" inch / 25cm - Luxury support',
      firmness: 'Medium-Firm', 
      supplierCode: '10" 30/130 White Foam Base Layer',
      cover: 'Raoul Knit Zip Cover'
    }
  }
};

// ============================================================================
// ESSENTIAL MATTRESS DETECTION
// ============================================================================

/**
 * Check if product is an Essential mattress
 */
function isEssentialMattress(productTitle, shopifySku = null, handle = null) {
  // PRIMARY METHOD: Check SKU prefix
  if (shopifySku) {
    const skuLower = shopifySku.toLowerCase();
    if (skuLower.startsWith('essential')) {
      console.log(`[Essential] Detected via SKU prefix: ${shopifySku}`);
      return true;
    }
  }
  
  // FALLBACK METHOD: Check product title and handle
  const title = productTitle.toLowerCase();
  const handleText = handle ? handle.toLowerCase() : '';
  
  const titleMatch = title.startsWith('essential') || handleText.startsWith('essential');
  
  if (titleMatch) {
    console.log(`[Essential] Detected via title/handle: ${productTitle}`);
    return true;
  }
  
  return false;
}

// ============================================================================
// ESSENTIAL MATTRESS PARSING
// ============================================================================

/**
 * Extract thickness from Essential mattress product data
 */
function extractThickness(productTitle, productVariant = null, productProperties = null) {
  console.log(`[Essential] Extracting thickness from: ${productTitle}`);
  
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
      if (ESSENTIAL_SPECS.specifications[thickness]) {
        console.log(`[Essential] Found valid thickness in title: ${thickness}"`);
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
        if (ESSENTIAL_SPECS.specifications[thickness]) {
          console.log(`[Essential] Found valid thickness in variant: ${thickness}"`);
          return thickness;
        }
      }
    }
  }

  // Check properties (Shopify order properties)
  if (productProperties && Array.isArray(productProperties)) {
    for (const prop of productProperties) {
      if (prop.name && prop.name.toLowerCase().includes('thickness')) {
        const match = prop.value.match(/(\d+)/);
        if (match && ESSENTIAL_SPECS.specifications[match[1]]) {
          console.log(`[Essential] Found thickness in properties: ${match[1]}"`);
          return match[1];
        }
      }
    }
  }

  console.log(`[Essential] No thickness found, defaulting to 6"`);
  return '6'; // Default thickness
}

// ============================================================================
// ESSENTIAL MATTRESS SPECIFICATION GENERATION
// ============================================================================

/**
 * Generate supplier specification for Essential mattress
 */
function generateSpecification(thickness) {
  console.log(`[Essential] Generating specification for ${thickness}" thickness`);
  
  const spec = ESSENTIAL_SPECS.specifications[thickness];
  
  if (!spec) {
    console.error(`[Essential] No specification found for ${thickness}" thickness`);
    return null;
  }

  // Format: [Supplier Code] + [Cover]
  const fullSpecification = `${spec.supplierCode} + ${spec.cover}`;
  
  const result = {
    mattressType: 'Essential',
    thickness: thickness,
    firmness: spec.firmness,
    depth: spec.depth,
    supplierCode: spec.supplierCode,
    cover: spec.cover,
    fullSpecification: fullSpecification,
    confidence: 100 // High confidence - Essential has simple, clear mapping
  };

  console.log(`[Essential] Generated: ${fullSpecification}`);
  return result;
}

// ============================================================================
// MAIN MAPPING FUNCTION
// ============================================================================

/**
 * Main mapping function for Essential mattress
 */
function mapEssentialMattress(productTitle, productVariant = null, productProperties = null, shopifySku = null) {
  console.log(`\n=== MAPPING ESSENTIAL MATTRESS ===`);
  console.log(`Product: ${productTitle}`);
  console.log(`SKU: ${shopifySku || 'Not provided'}`);
  
  try {
    // 1. Verify this is an Essential mattress
    if (!isEssentialMattress(productTitle, shopifySku)) {
      return {
        success: false,
        error: 'Product is not an Essential mattress',
        confidence: 0
      };
    }

    // 2. Extract thickness
    const thickness = extractThickness(productTitle, productVariant, productProperties);
    
    // 3. Generate specification
    const specification = generateSpecification(thickness);
    
    if (!specification) {
      return {
        success: false,
        error: 'Could not generate Essential mattress specification',
        confidence: 0
      };
    }

    // 4. Return successful mapping
    return {
      success: true,
      mattressType: 'Essential',
      specification: specification,
      confidence: specification.confidence,
      debugInfo: {
        extractedThickness: thickness,
        availableThicknesses: Object.keys(ESSENTIAL_SPECS.specifications),
        matchedSpec: ESSENTIAL_SPECS.specifications[thickness]
      }
    };

  } catch (error) {
    console.error(`[Essential] Mapping error:`, error);
    return {
      success: false,
      error: `Essential mapping failed: ${error.message}`,
      confidence: 0
    };
  }
}

// ============================================================================
// TESTING FUNCTIONS
// ============================================================================

/**
 * Test Essential mattress mapping with various inputs
 */
function testMapping() {
  console.log('\n=== TESTING ESSENTIAL MATTRESS MAPPING ===\n');
  
  const testCases = [
    {
      name: 'Essential with 6" variant',
      title: 'Essential Bunk Bed Caravan Mattress - Single',
      variant: { title: '6" inch / 15cm - Standard support' },
      expected: '6" 30/130 White Foam Base Layer + Raoul Knit Zip Cover'
    },
    {
      name: 'Essential with 8" variant',
      title: 'Essential Rectangular Motorhome Mattress - Double', 
      variant: { title: '8" inch / 20cm - Premium support' },
      expected: '8" 30/130 White Foam Base Layer + Raoul Knit Zip Cover'
    },
    {
      name: 'Essential with 10" variant',
      title: 'Essential Left Cut Corner Mattress - King',
      variant: { title: '10" inch / 25cm - Luxury support' },
      expected: '10" 30/130 White Foam Base Layer + Raoul Knit Zip Cover'
    },
    {
      name: 'Essential with 4" variant',
      title: 'Essential Custom Shape Mattress - Single',
      variant: { title: '4" inch / 10cm - Basic support' },
      expected: '4" 30/130 White Foam Base Layer + Raoul Knit Zip Cover'
    },
    {
      name: 'Essential with thickness in title',
      title: 'Essential 2" Ultra Light Mattress - Single',
      variant: null,
      expected: '2" 30/130 White Foam Base Layer + Raoul Knit Zip Cover'
    }
  ];

  testCases.forEach((testCase, index) => {
    console.log(`--- Test ${index + 1}: ${testCase.name} ---`);
    
    const result = mapEssentialMattress(testCase.title, testCase.variant);
    
    if (result.success) {
      const match = result.specification.fullSpecification === testCase.expected;
      console.log(`✅ Result: ${result.specification.fullSpecification}`);
      console.log(`✅ Expected: ${testCase.expected}`);
      console.log(`${match ? '✅' : '❌'} Match: ${match ? 'YES' : 'NO'}`);
      console.log(`✅ Confidence: ${result.confidence}%`);
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
  isEssentialMattress,
  mapEssentialMattress,
  
  // Helper functions  
  extractThickness,
  generateSpecification,
  
  // Testing
  testMapping,
  
  // Configuration
  ESSENTIAL_SPECS,
  
  // Metadata
  mattressType: 'Essential',
  version: '1.0.0',
  lastUpdated: new Date().toISOString()
};

// Auto-run tests if file executed directly
if (require.main === module) {
  testMapping();
}